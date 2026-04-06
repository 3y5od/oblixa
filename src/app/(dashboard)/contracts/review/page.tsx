import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/supabase/server";
import { ContractTable } from "@/components/contracts/contract-table";
import { ContractPagination } from "@/components/contracts/contract-pagination";
import { attachOwnerProfiles } from "@/lib/contracts";
import { CONTRACTS_PAGE_SIZE } from "@/lib/contract-list";
import {
  fetchReviewQueuePage,
  getReviewStatsForContractIds,
} from "@/lib/contract-review-stats";
import Link from "next/link";

export default async function ContractReviewQueuePage(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const { orgId, admin } = ctx;
  const parsedPage = parseInt(searchParams.page ?? "1", 10);
  const page =
    Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const queue = await fetchReviewQueuePage(admin, orgId, page);
  const totalPages =
    queue.total > 0 ? Math.max(1, Math.ceil(queue.total / queue.pageSize)) : 1;

  if (page > totalPages && queue.total > 0) {
    const next = new URLSearchParams();
    next.set("page", String(totalPages));
    redirect(`/contracts/review?${next.toString()}`);
  }

  const contracts = await attachOwnerProfiles(admin, queue.contracts);
  const reviewStats = await getReviewStatsForContractIds(
    admin,
    contracts.map((c) => c.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="ui-page-title">Review queue</h1>
            {queue.total > 0 && (
              <span className="rounded-full border border-amber-200/80 bg-amber-50/90 px-2.5 py-0.5 text-xs font-semibold text-amber-950">
                {queue.total} need attention
              </span>
            )}
          </div>
          <p className="ui-muted mt-1.5 max-w-2xl">
            Contracts in <strong className="font-semibold text-zinc-700">pending review</strong>{" "}
            or with{" "}
            <strong className="font-semibold text-zinc-700">pending extracted fields</strong>,
            ordered so the largest review backlogs surface first.
          </p>
        </div>
        <Link href="/contracts" className="ui-btn-secondary shrink-0 px-4 py-2">
          All contracts
        </Link>
      </div>

      {queue.total === 0 ? (
        <div className="rounded-xl border border-dashed border-emerald-200/70 bg-emerald-50/25 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-zinc-900">Queue is clear</p>
          <p className="mt-1 text-sm text-zinc-600">
            Nothing is waiting on field approval right now.
          </p>
          <Link href="/contracts" className="ui-btn-primary mt-6">
            Browse contracts
          </Link>
        </div>
      ) : (
        <ContractTable
          contracts={contracts}
          reviewStats={reviewStats}
          footer={
            <ContractPagination
              total={queue.total}
              page={queue.page}
              pageSize={CONTRACTS_PAGE_SIZE}
              basePath="/contracts/review"
              queryParams={{}}
            />
          }
        />
      )}
    </div>
  );
}
