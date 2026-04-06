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
    <div className="space-y-8">
      <header className="flex flex-col gap-6 border-b border-zinc-200/60 pb-8 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="ui-eyebrow">Field approval</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="ui-display-title">Review queue</h1>
            {queue.total > 0 && (
              <span className="rounded-full border border-amber-200/70 bg-amber-50/90 px-3 py-1 text-[12px] font-semibold text-amber-950">
                {queue.total} need attention
              </span>
            )}
          </div>
          <p className="ui-muted mt-3 max-w-2xl">
            Contracts in <strong className="font-semibold text-zinc-800">pending review</strong>{" "}
            or with <strong className="font-semibold text-zinc-800">pending extracted fields</strong>,
            ordered so larger backlogs surface first.
          </p>
        </div>
        <Link href="/contracts" className="ui-btn-secondary shrink-0 px-5 py-2.5">
          All contracts
        </Link>
      </header>

      {queue.total === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200/60 bg-gradient-to-b from-emerald-50/30 to-white px-8 py-16 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700/80">
            Clear
          </p>
          <p className="mt-3 text-lg font-semibold text-zinc-900">Nothing in the queue</p>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-zinc-500">
            When contracts need field approval, they appear here for fast review.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/contracts" className="ui-btn-primary px-6">
              Browse contracts
            </Link>
            <Link href="/contracts/new" className="ui-btn-secondary px-6">
              Upload contract
            </Link>
          </div>
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
