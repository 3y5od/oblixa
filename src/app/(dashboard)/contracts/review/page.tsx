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
import { getContractListRowSignalsMap } from "@/lib/contract-list-row-signals";
import Link from "next/link";
import { AlertTriangle, ClipboardPen, PlayCircle, ShieldAlert } from "lucide-react";
import { QueueItemCard } from "@/components/ui/queue-item-card";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ReviewQueueStartGuide } from "@/components/contracts/review-queue-start-guide";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext, resolveWorkflowDestination } from "@/lib/product-surface";

export const metadata = { title: "Review queue" };

function reviewContractHref(contractId: string, page: number) {
  return `/contracts/${contractId}?tab=overview&from=review&reviewPage=${page}#extracted-fields`;
}

export default async function ContractReviewQueuePage(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) {
    return (
      <WorkspaceRequiredState
        title="Workspace required for review"
        message="Review queue access depends on a workspace context. Refresh this page, then ask a workspace admin to restore your contract access if the queue still does not load."
      />
    );
  }

  const { orgId, admin } = ctx;
  const productSurface = await loadProductSurfaceContext(admin, orgId, ctx.role as WorkspaceRole);
  const reviewDestination = resolveWorkflowDestination(productSurface, "review");
  const reviewCopy = reviewDestination?.visible ? reviewDestination.copy : null;
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

  const contracts = await attachOwnerProfiles(admin, orgId, queue.contracts);
  const { data: profileRow } = await admin
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", ctx.user.id)
    .maybeSingle();
  const reviewStats = await getReviewStatsForContractIds(
    admin,
    contracts.map((c) => c.id)
  );
  const rowSignals = await getContractListRowSignalsMap(
    admin,
    orgId,
    contracts.map((contract) => contract.id)
  );
  const currentPagePendingFields = contracts.reduce(
    (sum, contract) => sum + (reviewStats[contract.id]?.pending ?? 0),
    0
  );
  const currentPageCriticalGaps = contracts.filter(
    (contract) => rowSignals[contract.id]?.missingCriticalDates
  ).length;
  const currentPageBlockedContracts = contracts.filter((contract) => {
    const signals = rowSignals[contract.id];
    return (signals?.openExceptionCount ?? 0) > 0 || (signals?.outstandingEvidenceCount ?? 0) > 0;
  }).length;
  const nextContract = contracts[0] ?? null;
  const nextContractStats = nextContract ? reviewStats[nextContract.id] : null;
  const nextContractSignals = nextContract ? rowSignals[nextContract.id] : null;
  const nextOwnerLabel =
    nextContract?.owner?.full_name ?? nextContract?.owner?.email ?? "Unassigned";
  const showStartGuide = !profileRow?.onboarding_completed_at;

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="ui-eyebrow">Field approval</p>
          <div className="mt-2 flex min-w-0 flex-wrap items-end gap-3">
            <h1 className="ui-display-title m-0 min-w-0">Review queue</h1>
            {queue.total > 0 ? (
              <span className="mb-[0.18em] inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-amber-200/70 bg-amber-50/90 px-4 py-2 font-sans text-[13px] font-medium leading-none tracking-normal text-amber-950">
                <span className="tabular-nums">{queue.total}&nbsp;</span>
                <span>{queue.total === 1 ? "needs" : "need"} attention</span>
              </span>
            ) : null}
          </div>
          <p className="ui-page-lead mt-3">
            {reviewCopy?.headerLead ??
              "Contracts in pending review or with pending extracted fields, ordered so larger backlogs and higher-risk cleanup surface first."}
          </p>
        </div>
        <Link href="/contracts" className="ui-btn-secondary shrink-0 px-5 py-2.5">
          All contracts
        </Link>
      </header>

      {queue.total === 0 ? (
        <EmptyState
          eyebrow="Review clear"
          title="Nothing is waiting in review"
          copy="When contracts need field approval, they appear here with the next contract ready to open. Use the contracts list to inspect portfolio state or upload the next contract to keep first-value flow moving."
          action={
            <>
              <Link href="/contracts" className="ui-btn-primary px-6">
                Browse contracts
              </Link>
              <Link href="/contracts/new" className="ui-btn-secondary px-6">
                Upload contract
              </Link>
            </>
          }
        />
      ) : (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-8">
            <OperationalSummaryCard
              eyebrow="Backlog"
              headline="Contracts waiting"
              tone="attention"
              icon={ClipboardPen}
              primaryValue={queue.total}
              primaryUnit="contracts in queue"
              action={{ href: reviewContractHref(contracts[0].id, queue.page), label: "Open next review" }}
              variant="compact"
              className="xl:col-span-2"
            />
            <OperationalSummaryCard
              eyebrow="Current page"
              headline="Pending fields"
              tone={currentPagePendingFields > 0 ? "attention" : "healthy"}
              icon={PlayCircle}
              primaryValue={currentPagePendingFields}
              primaryUnit="still awaiting review"
              action={{ href: reviewContractHref(contracts[0].id, queue.page), label: "Start queue" }}
              variant="compact"
              className="xl:col-span-2"
            />
            <OperationalSummaryCard
              eyebrow="Critical dates"
              headline="Missing approved dates"
              tone={currentPageCriticalGaps > 0 ? "risk" : "healthy"}
              icon={AlertTriangle}
              primaryValue={currentPageCriticalGaps}
              primaryUnit="contracts on this page"
              action={{ href: "/contracts?missing_data=critical_dates", label: "Open date gaps" }}
              variant="compact"
              className="xl:col-span-2"
            />
            <OperationalSummaryCard
              eyebrow="Blockers"
              headline="Exceptions or evidence"
              tone={currentPageBlockedContracts > 0 ? "attention" : "healthy"}
              icon={ShieldAlert}
              primaryValue={currentPageBlockedContracts}
              primaryUnit="contracts need extra follow-up"
              action={{ href: "/contracts/exceptions?status=open", label: "Open blockers" }}
              variant="compact"
              className="xl:col-span-2"
            />
          </section>

          {nextContract && showStartGuide ? (
            <ReviewQueueStartGuide nextContractHref={reviewContractHref(nextContract.id, queue.page)}>
                  <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_84%,white)] px-4 py-3 shadow-[var(--shadow-1)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                      Contract
                    </p>
                    <p className="mt-1 text-[14px] font-semibold text-[var(--text-primary)]">
                      {nextContract.title}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      {nextContract.counterparty || "No counterparty"} · {nextOwnerLabel}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_84%,white)] px-4 py-3 shadow-[var(--shadow-1)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                      Review backlog
                    </p>
                    <p className="mt-1 text-[14px] font-semibold text-[var(--text-primary)]">
                      {(nextContractStats?.pending ?? 0) > 0
                        ? `${nextContractStats?.pending ?? 0} pending field${(nextContractStats?.pending ?? 0) === 1 ? "" : "s"}`
                        : "Pending review state only"}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      {nextContractStats?.approved ?? 0} approved of {nextContractStats?.total ?? 0} total extracted fields
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_84%,white)] px-4 py-3 shadow-[var(--shadow-1)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                      Critical dates
                    </p>
                    <p className="mt-1 text-[14px] font-semibold text-[var(--text-primary)]">
                      {nextContractSignals?.missingCriticalDates
                        ? "Approve end, renewal, or notice date first"
                        : nextContractSignals?.nextHorizonDate
                          ? `Next horizon ${nextContractSignals.nextHorizonDate}`
                          : "No approved date yet"}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      {nextContractSignals?.missingCriticalDates
                        ? "Reminders and renewal state should stay blocked until key dates are approved."
                        : "Approved key dates are already available for downstream workflow."}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_84%,white)] px-4 py-3 shadow-[var(--shadow-1)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                      Blockers
                    </p>
                    <p className="mt-1 text-[14px] font-semibold text-[var(--text-primary)]">
                      {(nextContractSignals?.openExceptionCount ?? 0) > 0 ||
                      (nextContractSignals?.outstandingEvidenceCount ?? 0) > 0
                        ? `${nextContractSignals?.openExceptionCount ?? 0} exception${(nextContractSignals?.openExceptionCount ?? 0) === 1 ? "" : "s"} · ${nextContractSignals?.outstandingEvidenceCount ?? 0} evidence gap${(nextContractSignals?.outstandingEvidenceCount ?? 0) === 1 ? "" : "s"}`
                        : "No extra blockers on this contract"}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      Review can proceed faster when linked exceptions and evidence gaps stay visible.
                    </p>
                  </div>
            </ReviewQueueStartGuide>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-2">
            {contracts.slice(0, 4).map((contract) => {
              const stats = reviewStats[contract.id];
              const signals = rowSignals[contract.id];
              const ownerLabel =
                contract.owner?.full_name ?? contract.owner?.email ?? "Unassigned";
              const cardMeta = [
                signals?.missingCriticalDates ? "Critical dates still unapproved" : null,
                (signals?.openExceptionCount ?? 0) > 0
                  ? `${signals?.openExceptionCount} open exception${signals?.openExceptionCount === 1 ? "" : "s"}`
                  : null,
                (signals?.outstandingEvidenceCount ?? 0) > 0
                  ? `${signals?.outstandingEvidenceCount} evidence gap${signals?.outstandingEvidenceCount === 1 ? "" : "s"}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <QueueItemCard
                  key={contract.id}
                  href={reviewContractHref(contract.id, queue.page)}
                  objectType="Review"
                  title={contract.title}
                  statusLabel={
                    (stats?.pending ?? 0) > 0
                      ? `${stats?.pending ?? 0} pending`
                      : "Pending review"
                  }
                  statusTone={(stats?.pending ?? 0) > 0 ? "warning" : "in_review"}
                  owner={ownerLabel}
                  due={signals?.nextHorizonDate ?? undefined}
                  meta={cardMeta || undefined}
                  continuityContractId={contract.id}
                  continuityOmit={["contract"]}
                  nextAction={{
                    label: "Open review",
                    href: reviewContractHref(contract.id, queue.page),
                  }}
                />
              );
            })}
          </section>

          <section className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_52%,transparent)] px-5 py-4">
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="ui-label-caps">Table view</p>
                  <h2 className="ui-section-title mt-1 text-base">Secondary queue scan</h2>
                </div>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  Keep using the table when you need to compare many contracts at once.
                </p>
              </div>
            </div>
            <ContractTable
              contracts={contracts}
              reviewStats={reviewStats}
              rowSignals={rowSignals}
              showContinuityLinks
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
          </section>
        </div>
      )}
    </div>
  );
}
