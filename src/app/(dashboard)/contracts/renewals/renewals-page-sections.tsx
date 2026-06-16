import Link from "next/link";
import { ArrowRight, CalendarClock, CircleDashed, Eye, Filter, Plus, RotateCcw } from "lucide-react";
import { OperationalCount } from "@/components/ui/operational-count";
import { UiSelect } from "@/components/ui/ui-select";
import { buildRenewalsHref, type loadRenewalsPageModel } from "@/lib/renewals/model";
import {
  RENEWAL_DATE_REVIEW_LABELS,
  RENEWAL_ROW_LABELS,
  RENEWAL_STATUS_LABELS,
  RENEWALS_EMPTY_NO_CONTRACTS,
  RENEWALS_EMPTY_NO_DATES_HINT,
  RENEWALS_EMPTY_NO_DATES_IN_WINDOW,
  RENEWALS_EXPORT_FILTER_HELPER,
  RENEWALS_FILTERED_EMPTY_STATE,
  RENEWALS_MISSING_DATES_ACTION,
  RENEWALS_MISSING_DATES_TITLE,
  RENEWALS_SECTION_EYEBROW,
  RENEWALS_SECTION_TITLE,
  renewalFooterFilteredBy,
  renewalFooterWindow,
} from "@/lib/renewals/spec-strings";
import type { RenewalWindowKey } from "@/lib/renewals/types";

type RenewalsPageModel = Awaited<ReturnType<typeof loadRenewalsPageModel>>;
type FormAction = (formData: FormData) => void | Promise<void>;

export function RenewalSummaryBand({ model }: { model: RenewalsPageModel }) {
  const { summary, filters, activeWindow, activeSort } = model;
  const gapHref = (next: Partial<typeof filters>) =>
    buildRenewalsHref({ window: activeWindow, filters: { ...filters, ...next }, sort: activeSort });
  return (
    <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
        <h2 id="renewals-surface-title" className="sr-only">
          {RENEWALS_SECTION_TITLE}
        </h2>
        <p className="ui-caps-2 text-[var(--text-tertiary)]">{RENEWALS_SECTION_EYEBROW}</p>
        <OperationalCount
          value={summary.visible}
          noun="renewal and notice date"
          shortNoun="date"
          condition="in view"
        />
        {summary.needsReview > 0 ? (
          <OperationalCount
            value={summary.needsReview}
            noun="date"
            condition="needing confirmation"
            tone="warning"
            href={gapHref({ status: "needs_review" })}
          />
        ) : null}
        {summary.needsOwner > 0 ? (
          <OperationalCount
            value={summary.needsOwner}
            noun="contract"
            condition="missing an owner"
            tone="warning"
            href={gapHref({ status: "needs_owner" })}
          />
        ) : null}
        {summary.noticeWindowOpen > 0 ? (
          <OperationalCount
            value={summary.noticeWindowOpen}
            noun="notice deadline"
            condition="open"
            tone="warning"
            href={gapHref({ status: "notice_window_open" })}
          />
        ) : null}
      </div>
      <div className="mt-2.5 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-[11px] leading-snug text-[var(--text-tertiary)]">
        <span>
          <span className="font-medium text-[var(--text-secondary)]">Dates in view:</span> renewal and notice
          deadlines inside the selected window.
        </span>
        <span>
          <span className="font-medium text-[var(--text-secondary)]">Needs confirmation:</span> renewal or notice date
          is missing, suggested, or calculated and still needs confirmation.
        </span>
        <span>
          <span className="font-medium text-[var(--text-secondary)]">Missing owner:</span> no person is assigned to the
          contract.
        </span>
        <span>
          <span className="font-medium text-[var(--text-secondary)]">Notice window open:</span> notice period is currently
          open.
        </span>
      </div>
    </div>
  );
}

export function MissingDatesCallout({ count, href }: { count: number; href: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_30%,transparent)] px-5 py-2.5">
      <CircleDashed className="h-4 w-4 shrink-0 text-[var(--warning-ink)]" strokeWidth={1.85} aria-hidden />
      <p className="min-w-0 text-[12.5px] leading-snug text-[var(--text-secondary)]">
        <span className="font-semibold text-[var(--text-primary)]">{RENEWALS_MISSING_DATES_TITLE}</span>{" "}
        <span className="tabular-nums">({count})</span>. These have no date in any window.
      </p>
      <Link
        href={href}
        className="ui-chip-focus ml-auto inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)]"
      >
        {RENEWALS_MISSING_DATES_ACTION}
        <ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      </Link>
    </div>
  );
}

export function CreateRenewalTaskPanel({
  model,
  error,
  cancelHref,
  createAction,
}: {
  model: RenewalsPageModel;
  error: string;
  cancelHref: string;
  createAction: FormAction;
}) {
  return (
    <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_26%,transparent)] px-5 py-4">
      <form action={createAction} className="grid gap-3 lg:grid-cols-[1.25fr_1.35fr_0.95fr_0.8fr]">
        <div className="space-y-2">
          <p className="ui-caps-2 text-[var(--text-tertiary)]">{model.primaryCta}</p>
          <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="renewal-create-contract">
            {RENEWAL_ROW_LABELS.contract}
          </label>
          <UiSelect
            className="block w-full"
            buttonClassName="w-full"
            portal
            name="contractId"
            required
            defaultValue={model.create.selectedContract}
            options={model.create.contracts.map((contract) => ({ value: contract.value, label: contract.label }))}
            placeholder="Select contract"
            ariaLabel={RENEWAL_ROW_LABELS.contract}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="renewal-create-title">
            Title
          </label>
          <input id="renewal-create-title" name="title" required className="ui-input w-full" placeholder="e.g., Confirm renewal notice plan" />
          {error ? <p className="text-[12.5px] text-[var(--danger-ink)]">{error}</p> : null}
        </div>
        <div className="space-y-2">
          <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="renewal-create-owner">
            {RENEWAL_ROW_LABELS.owner}
          </label>
          <UiSelect
            className="block w-full"
            buttonClassName="w-full"
            portal
            name="assigneeId"
            options={[
              { value: "", label: "Unassigned" },
              ...model.create.ownerOptions.map((owner) => ({ value: owner.value, label: owner.label })),
            ]}
            placeholder="Unassigned"
            ariaLabel={RENEWAL_ROW_LABELS.owner}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="renewal-create-due">
            Due date
          </label>
          <input id="renewal-create-due" name="dueDate" type="date" className="ui-input w-full" />
        </div>
        <div className="space-y-2 lg:col-span-3">
          <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="renewal-create-details">
            Details
          </label>
          <textarea id="renewal-create-details" name="details" className="ui-input min-h-16 w-full resize-y" />
        </div>
        <div className="flex flex-wrap items-end justify-end gap-2">
          <Link href={cancelHref} className="ui-btn-secondary px-4 py-2">
            Cancel
          </Link>
          <button type="submit" className="ui-btn-primary px-4 py-2">
            {model.primaryCta}
          </button>
        </div>
      </form>
    </div>
  );
}

export function RenewalsEmptyState({
  filtersActive,
  hasAnyContracts,
  clearFiltersHref,
  activeWindow,
  widenHref,
}: {
  filtersActive: boolean;
  hasAnyContracts: boolean;
  clearFiltersHref: string;
  activeWindow: RenewalWindowKey;
  widenHref: string;
}) {
  const iconTile =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]";
  if (filtersActive) {
    return (
      <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-12">
        <div className="mx-auto flex max-w-md items-start gap-4">
          <span className={iconTile} aria-hidden>
            <Filter className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />
          </span>
          <div className="min-w-0">
            <p className="ui-caps-2 text-[10.5px] text-[var(--text-tertiary)]">No matches</p>
            <p className="mt-1 text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
              {RENEWALS_FILTERED_EMPTY_STATE}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              Clear the filters to see upcoming renewal and notice deadlines.
            </p>
            <div className="mt-4">
              <Link href={clearFiltersHref} className="ui-btn-secondary inline-flex items-center px-3.5 py-2 text-[12.5px]">
                Clear filters
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  const headline = hasAnyContracts ? RENEWALS_EMPTY_NO_DATES_IN_WINDOW : RENEWALS_EMPTY_NO_CONTRACTS;
  const sub = hasAnyContracts
    ? RENEWALS_EMPTY_NO_DATES_HINT
    : "Upload a contract or import your tracker, then review the dates.";
  return (
    <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-12">
      <div className="mx-auto flex max-w-xl items-start gap-4">
        <span className={iconTile} aria-hidden>
          <CalendarClock className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />
        </span>
        <div className="min-w-0">
          <p className="ui-caps-2 text-[10.5px] text-[var(--text-tertiary)]">Get started</p>
          <p className="mt-1 text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{headline}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">{sub}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/contracts/review" className="ui-btn-primary inline-flex items-center gap-2 px-4 py-2">
              <Eye className="h-4 w-4" aria-hidden />
              Review contract details
            </Link>
            <Link href="/contracts/new" className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px]">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Upload contract
            </Link>
            <Link href="/contracts/bulk" className="ui-btn-ghost inline-flex items-center px-3 py-2 text-[12.5px]">
              Import contracts
            </Link>
            {activeWindow !== "180" ? (
              <Link href={widenHref} className="ui-btn-ghost inline-flex items-center px-3 py-2 text-[12.5px]">
                Show 180 days
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RenewalLedgerFooter({
  model,
  filtersActive,
  clearFiltersHref,
}: {
  model: RenewalsPageModel;
  filtersActive: boolean;
  clearFiltersHref: string;
}) {
  const parts: string[] = [];
  if (model.filters.owner) parts.push(model.filters.owner === "unassigned" ? "unassigned owner" : "owner");
  if (model.filters.counterparty) parts.push(`counterparty ${model.filters.counterparty}`);
  if (model.filters.status) parts.push(RENEWAL_STATUS_LABELS[model.filters.status].toLowerCase());
  if (model.filters.review) parts.push(`${RENEWAL_DATE_REVIEW_LABELS[model.filters.review].toLowerCase()} dates`);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[color:color-mix(in_oklab,var(--border-strong)_40%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--surface-raised))] px-5 py-2.5 text-[11px] text-[var(--text-tertiary)]">
      <span className="inline-flex items-center gap-2">
        <CalendarClock className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
        <OperationalCount value={model.summary.visible} noun="renewal and notice date" shortNoun="date" condition="in view" />
      </span>
      <span className="ui-rule-vert" aria-hidden />
      <span className="tabular-nums">{renewalFooterWindow(model.activeWindow)}</span>
      <span className="ui-rule-vert" aria-hidden />
      <span>{renewalFooterFilteredBy(parts)}</span>
      {filtersActive ? (
        <Link
          href={clearFiltersHref}
          className="ui-chip-focus inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)]"
        >
          <RotateCcw className="h-3 w-3 shrink-0" strokeWidth={1.85} aria-hidden />
          Clear filters
        </Link>
      ) : null}
      <span className="ml-auto text-[var(--text-tertiary)]">{RENEWALS_EXPORT_FILTER_HELPER}</span>
    </div>
  );
}
