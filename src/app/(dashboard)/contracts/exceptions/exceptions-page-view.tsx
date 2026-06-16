import type React from "react";
import Link from "next/link";
import { ChevronRight, ListChecks, ShieldAlert, SlidersHorizontal, Sparkles } from "lucide-react";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PermissionEligibilityHint } from "@/components/ui/permission-eligibility-hint";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCell } from "@/components/ui/stat-cell";
import { UiRadioGroup } from "@/components/ui/ui-radio-group";
import { ExceptionLedgerRow } from "@/app/(dashboard)/contracts/exceptions/exception-ledger-row";
import {
  SEVERITY_FILTERS,
  STATUS_FILTERS,
} from "@/app/(dashboard)/contracts/exceptions/exceptions-page-config";
import type {
  ExceptionEvent,
  ExceptionRow,
  OwnerOption,
  ResolutionActionOptions,
  SeverityFilter,
  StatusFilter,
} from "@/app/(dashboard)/contracts/exceptions/exceptions-page-types";

export function ExceptionsPageView({
  actionableCount,
  canEdit,
  contractById,
  contractFilter,
  criticalActiveCount,
  eventsByException,
  orderedExceptions,
  overdueActiveCount,
  ownerLabelById,
  ownerOptions,
  resolutionActionOptions,
  severity,
  showDecisionsCta,
  status,
  todayIso,
  unassignedActiveCount,
}: {
  actionableCount: number;
  canEdit: boolean;
  contractById: Map<string, string>;
  contractFilter: string | null;
  criticalActiveCount: number;
  eventsByException: Map<string, ExceptionEvent[]>;
  orderedExceptions: ExceptionRow[];
  overdueActiveCount: number;
  ownerLabelById: Map<string, string>;
  ownerOptions: OwnerOption[];
  resolutionActionOptions: ResolutionActionOptions;
  severity: SeverityFilter;
  showDecisionsCta: boolean;
  status: StatusFilter;
  todayIso: string;
  unassignedActiveCount: number;
}) {
  const hasFilters = Boolean(status || severity || contractFilter);
  return (
    <div className="ui-page-stack mx-auto max-w-6xl">
      <DashboardPageHeader
        icon={<ShieldAlert className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Issues"
        title="Contract issues"
        lead="Track missing information, overdue contract requirements, escalations, and other contract problems until they are owned and resolved."
        actions={<DecisionsAction showDecisionsCta={showDecisionsCta} />}
      />
      <IssueSummary
        actionableCount={actionableCount}
        criticalActiveCount={criticalActiveCount}
        overdueActiveCount={overdueActiveCount}
        unassignedActiveCount={unassignedActiveCount}
      />
      <IssueFilters hasFilters={hasFilters} severity={severity} status={status} />
      <IssueLedger
        canEdit={canEdit}
        contractById={contractById}
        eventsByException={eventsByException}
        hasFilters={hasFilters}
        orderedExceptions={orderedExceptions}
        ownerLabelById={ownerLabelById}
        ownerOptions={ownerOptions}
        resolutionActionOptions={resolutionActionOptions}
        status={status}
        todayIso={todayIso}
      />
    </div>
  );
}

function DecisionsAction({ showDecisionsCta }: { showDecisionsCta: boolean }) {
  return showDecisionsCta ? (
    <Link
      href="/decisions"
      prefetch={false}
      className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
    >
      <Sparkles className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
      Review decisions
      <ChevronRight className="h-3 w-3 opacity-60" aria-hidden />
    </Link>
  ) : null;
}

function IssueSummary({
  actionableCount,
  criticalActiveCount,
  overdueActiveCount,
  unassignedActiveCount,
}: {
  actionableCount: number;
  criticalActiveCount: number;
  overdueActiveCount: number;
  unassignedActiveCount: number;
}) {
  return (
    <section aria-label="Issue summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCell
        label="Open issues"
        display={String(actionableCount)}
        isZero={actionableCount === 0}
        tone="warning"
        context={
          actionableCount === 0
            ? "Issue list is clear"
            : `${actionableCount === 1 ? "1 entry needs" : `${actionableCount} entries need`} action`
        }
      />
      <StatCell
        label="Critical"
        display={String(criticalActiveCount)}
        isZero={criticalActiveCount === 0}
        tone="danger"
        context={criticalActiveCount === 0 ? "No critical severity" : "Active critical severity"}
      />
      <StatCell
        label="Unassigned"
        display={String(unassignedActiveCount)}
        isZero={unassignedActiveCount === 0}
        tone="warning"
        context={unassignedActiveCount === 0 ? "All owners routed" : "Still need an owner"}
      />
      <StatCell
        label="Past due"
        display={String(overdueActiveCount)}
        isZero={overdueActiveCount === 0}
        tone="danger"
        context={overdueActiveCount === 0 ? "Target dates intact" : "Target date elapsed"}
      />
    </section>
  );
}

function IssueFilters({
  hasFilters,
  severity,
  status,
}: {
  hasFilters: boolean;
  severity: SeverityFilter;
  status: StatusFilter;
}) {
  return (
    <section className="ui-card overflow-hidden p-0">
      <SectionHeader
        eyebrow="Filters"
        trailing={
          hasFilters ? (
            <Link
              href="/contracts/exceptions"
              className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              Clear filters
            </Link>
          ) : null
        }
      />
      <form action="/contracts/exceptions" method="get" className="px-5 py-4">
        <div className="space-y-2.5">
          <FilterRadioRow label="Status">
            <UiRadioGroup name="status" defaultValue={status} ariaLabel="Issue status" options={STATUS_FILTERS} />
          </FilterRadioRow>
          <FilterRadioRow label="Severity">
            <UiRadioGroup
              name="severity"
              defaultValue={severity}
              ariaLabel="Issue severity"
              options={SEVERITY_FILTERS}
            />
          </FilterRadioRow>
        </div>
        <div className="mt-4 flex items-center justify-end border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3">
          <button type="submit" className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px]">
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            Apply filters
          </button>
        </div>
      </form>
    </section>
  );
}

function FilterRadioRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="min-w-[4.5rem] shrink-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
        {label}
      </p>
      {children}
    </div>
  );
}

function IssueLedger({
  canEdit,
  contractById,
  eventsByException,
  hasFilters,
  orderedExceptions,
  ownerLabelById,
  ownerOptions,
  resolutionActionOptions,
  status,
  todayIso,
}: {
  canEdit: boolean;
  contractById: Map<string, string>;
  eventsByException: Map<string, ExceptionEvent[]>;
  hasFilters: boolean;
  orderedExceptions: ExceptionRow[];
  ownerLabelById: Map<string, string>;
  ownerOptions: OwnerOption[];
  resolutionActionOptions: ResolutionActionOptions;
  status: StatusFilter;
  todayIso: string;
}) {
  const activeCount = orderedExceptions.filter((item) =>
    ["open", "in_progress"].includes(item.status)
  ).length;
  return (
    <section className="ui-card overflow-hidden p-0">
      <IssueLedgerHeader orderedCount={orderedExceptions.length} actionableCount={activeCount} status={status} />
      {!canEdit ? (
        <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-5 py-3">
          <PermissionEligibilityHint variant="not_permitted" actionLabel="Workspace roles" actionHref="/settings" />
        </div>
      ) : null}
      {orderedExceptions.length === 0 ? (
        <IssueEmptyState hasFilters={hasFilters} />
      ) : (
        <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
          {orderedExceptions.map((item) => (
            <ExceptionLedgerRow
              key={item.id}
              canEdit={canEdit}
              contractTitle={item.contract_id ? contractById.get(item.contract_id) ?? null : null}
              events={eventsByException.get(item.id) ?? []}
              item={item}
              ownerLabelById={ownerLabelById}
              ownerOptions={ownerOptions}
              resolutionActionOptions={resolutionActionOptions}
              todayIso={todayIso}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function IssueLedgerHeader({
  orderedCount,
  actionableCount,
  status,
}: {
  orderedCount: number;
  actionableCount: number;
  status: StatusFilter;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
          Issues in scope
        </p>
        <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">
          Contract issues in scope
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          State, owners, and recovery actions visible in one place.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {status !== "open" && actionableCount > 0 ? (
          <Link href="/contracts/exceptions?status=open" className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
            Show open only
            <ChevronRight className="h-3 w-3 opacity-60" aria-hidden />
          </Link>
        ) : null}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,transparent)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          <ListChecks className="h-3 w-3" strokeWidth={1.85} aria-hidden />
          {orderedCount} {orderedCount === 1 ? "entry" : "entries"}
        </span>
      </div>
    </header>
  );
}

function IssueEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="p-5">
      <EmptyState
        eyebrow="Issue status"
        title="No issues match this view"
        copy={
          hasFilters
            ? "Adjust the filters above or clear the current view to keep active contract issues visible."
            : "No contract issues are in scope right now."
        }
        action={
          <>
            <Link href="/contracts/exceptions" className="ui-btn-primary px-4 py-2 text-[12.5px]">
              Clear filters
            </Link>
            <Link href="/work" className="ui-btn-secondary px-4 py-2 text-[12.5px]">
              Review tasks
            </Link>
          </>
        }
      />
    </div>
  );
}
