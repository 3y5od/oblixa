import Link from "next/link";
import { CalendarClock, ChevronRight, Download, Eye, Plus, Sparkles } from "lucide-react";
import { RenewalFilterBar } from "@/components/renewals/renewal-filter-bar";
import { DataSurfaceCard, DataSurfaceShell } from "@/components/ui/data-surface-shell";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { RecoverableState } from "@/components/ui/recoverable-state";
import { buildRenewalsHref } from "@/lib/renewals/model";
import {
  RENEWAL_ACTION_LABELS,
  RENEWAL_FILTER_LABELS,
  RENEWAL_SORT_LABELS,
  RENEWALS_EXPORT_EMPTY_REASON,
  RENEWALS_EXPORT_FILTER_HELPER,
  RENEWALS_PAGE_TITLE,
  RENEWALS_PARTIAL_DATA_REASON,
  RENEWALS_PARTIAL_DATA_TITLE,
  RENEWALS_TRUST_NOTE,
  renewalActiveFilterSummary,
} from "@/lib/renewals/spec-strings";
import type { RenewalSortKey } from "@/lib/renewals/types";
import { RenewalLedger } from "./renewals-ledger";
import {
  CreateRenewalTaskPanel,
  MissingDatesCallout,
  RenewalLedgerFooter,
  RenewalSummaryBand,
} from "./renewals-page-sections";
import type { RenewalFormAction, RenewalsPageModel } from "./renewals-page-types";

export function RenewalsPageView({
  model,
  canMutate,
  showDecisionsCta,
  error,
  createRenewalTaskAction,
  updateRenewalAction,
}: {
  model: RenewalsPageModel;
  canMutate: boolean;
  showDecisionsCta: boolean;
  error: string;
  createRenewalTaskAction: RenewalFormAction;
  updateRenewalAction: RenewalFormAction;
}) {
  const createHref = buildRenewalsHref({
    window: model.activeWindow,
    filters: model.filters,
    sort: model.activeSort,
    create: true,
  });
  const filtersActive = Boolean(
    model.filters.owner || model.filters.counterparty || model.filters.status || model.filters.review
  );
  const clearFiltersHref = buildRenewalsHref({ window: model.activeWindow, sort: model.activeSort });
  const returnTo = buildRenewalsHref({
    window: model.activeWindow,
    filters: model.filters,
    sort: model.activeSort,
  });
  const canExport = model.summary.visible > 0;
  const showTrustNote = model.rows.some(
    (row) =>
      row.renewalDateReview === "suggested" ||
      row.renewalDateReview === "computed" ||
      row.noticeDateReview === "suggested" ||
      row.noticeDateReview === "computed"
  );

  return (
    <DataSurfaceShell
      width="medium"
      header={
        <DashboardPageHeader
          icon={<CalendarClock className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
          density="compact"
          eyebrow={model.eyebrow}
          title={RENEWALS_PAGE_TITLE}
          lead={model.lead}
          actions={
            <>
              {showDecisionsCta ? (
                <Link
                  href="/decisions"
                  prefetch={false}
                  className="ui-btn-ghost inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px]"
                >
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                  Review decisions
                  <ChevronRight className="h-3 w-3 opacity-60" aria-hidden />
                </Link>
              ) : null}
              {canExport ? (
                <Link
                  href={model.exportHref}
                  title={RENEWALS_EXPORT_FILTER_HELPER}
                  className="ui-btn-ghost inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px]"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                  {RENEWAL_ACTION_LABELS.export_renewal_report}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  title={RENEWALS_EXPORT_EMPTY_REASON}
                  aria-label={`${RENEWAL_ACTION_LABELS.export_renewal_report} \u2014 ${RENEWALS_EXPORT_EMPTY_REASON}`}
                  className="ui-btn-ghost inline-flex cursor-not-allowed items-center gap-1.5 rounded-md px-4 py-2 text-[13px] opacity-55"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                  {RENEWAL_ACTION_LABELS.export_renewal_report}
                </button>
              )}
              <Link href={createHref} className="ui-btn-primary inline-flex items-center gap-2 rounded-md px-4 py-2 text-[13px]">
                <Plus className="h-4 w-4" aria-hidden />
                {model.primaryCta}
              </Link>
            </>
          }
        />
      }
    >
      {model.warnings.length > 0 ? (
        <RecoverableState
          state="partial"
          title={RENEWALS_PARTIAL_DATA_TITLE}
          reason={RENEWALS_PARTIAL_DATA_REASON}
          accessibleName="Renewals partial data state"
          nextActionLabel="Review workspace health"
          nextAction={
            <Link href="/settings/health" className="ui-link">
              Review workspace health
            </Link>
          }
        />
      ) : null}

      <DataSurfaceCard
        summary={<RenewalSummaryBand model={model} />}
        filters={
          <RenewalFilterBar
            activeWindow={model.activeWindow}
            filters={model.filters}
            labels={RENEWAL_FILTER_LABELS}
            windowOptions={model.windows.map((window) => ({ value: window.key, label: window.label }))}
            ownerOptions={model.filterOptions.owners}
            counterpartyOptions={model.filterOptions.counterparties}
            statusOptions={model.filterOptions.statuses}
            reviewOptions={model.filterOptions.reviewStates}
            activeSort={model.activeSort}
            sortOptions={renewalSortOptions()}
            keepCreateOpen={model.create.open}
            matchCount={model.summary.visible}
          />
        }
        footer={
          <RenewalLedgerFooter
            model={model}
            filtersActive={filtersActive}
            clearFiltersHref={clearFiltersHref}
          />
        }
      >
        <p className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] px-5 py-2 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
          {renewalActiveFilterSummary(model.activeWindow)}
          {model.activeSort !== "urgent" ? ` Sorted by ${RENEWAL_SORT_LABELS[model.activeSort].toLowerCase()}.` : ""}
        </p>

        {model.create.open ? (
          <CreateRenewalTaskPanel
            model={model}
            error={error}
            cancelHref={returnTo}
            createAction={createRenewalTaskAction}
          />
        ) : null}

        {model.summary.missingDates > 0 && model.filters.review !== "missing" ? (
          <MissingDatesCallout
            count={model.summary.missingDates}
            href={buildRenewalsHref({
              window: model.activeWindow,
              filters: { ...model.filters, review: "missing" },
              sort: model.activeSort,
            })}
          />
        ) : null}

        {showTrustNote ? (
          <p className="flex items-start gap-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] bg-[color:color-mix(in_oklab,var(--warning-soft)_16%,transparent)] px-5 py-2 text-[11.5px] leading-snug text-[var(--text-secondary)]">
            <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning-ink)]" strokeWidth={1.85} aria-hidden />
            {RENEWALS_TRUST_NOTE}
          </p>
        ) : null}

        <RenewalLedger
          model={model}
          canMutate={canMutate}
          returnTo={returnTo}
          filtersActive={filtersActive}
          clearFiltersHref={clearFiltersHref}
          updateRenewalAction={updateRenewalAction}
        />
      </DataSurfaceCard>
    </DataSurfaceShell>
  );
}

function renewalSortOptions() {
  return (Object.keys(RENEWAL_SORT_LABELS) as RenewalSortKey[]).map((key) => ({
    value: key,
    label: RENEWAL_SORT_LABELS[key],
  }));
}
