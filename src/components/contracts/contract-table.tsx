"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, formatDistanceToNowStrict, isValid } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  CircleUserRound,
  Clock3,
  FileText,
  FileWarning,
} from "lucide-react";
import type { Contract } from "@/lib/types";
import type { ContractReviewStats } from "@/lib/contract-review-stats";
import type { ContractListRowSignals } from "@/lib/contract-list-row-signals";
import { STATUS_SEMANTICS, STATUS_LABELS } from "@/lib/contracts";
import { V10EmptyStateTelemetryLink } from "@/components/ui/v10-empty-state-telemetry-link";
import { V10RecoverableState } from "@/components/ui/v10-recoverable-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
import { surfaceTestIds } from "@/lib/qa/test-ids";
import { bulkAssignContractOwners } from "@/actions/contracts";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import { formatBusinessDateAtNoon } from "@/lib/v9-business-dates";

interface ContractTableProps {
  contracts: Contract[];
  /** When set, shows extraction review progress per row. */
  reviewStats?: Record<string, ContractReviewStats>;
  rowSignals?: Record<string, ContractListRowSignals>;
  /** Per-row “Open in” links (product-surface policy §16.3). */
  showContinuityLinks?: boolean;
  /** Renders below the table inside the same card (e.g. pagination). */
  footer?: ReactNode;
  /** Used only for explanatory copy when selection spans filters/pages. */
  filterFingerprint?: string;
  emptyState?: {
    title: string;
    copy: string;
    actionHref: string;
    actionLabel: string;
  };
  bulkActions?: {
    canEdit: boolean;
    members: { id: string; label: string }[];
    orgId: string;
  };
}

export function ContractTable({
  contracts,
  reviewStats,
  rowSignals,
  showContinuityLinks,
  footer,
  filterFingerprint,
  emptyState,
  bulkActions,
}: ContractTableProps) {
  const router = useRouter();
  const storageKey = bulkActions ? `oblixa.contract-table.selection:${bulkActions.orgId}` : null;
  const [selectionLoaded, setSelectionLoaded] = useState(!storageKey);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [isBulkAssignPending, startBulkAssignTransition] = useTransition();
  const selectAllRef = useRef<HTMLInputElement>(null);

  const selectedList = useMemo(() => [...selected], [selected]);
  const visibleSelectedCount = useMemo(
    () => contracts.filter((contract) => selected.has(contract.id)).length,
    [contracts, selected]
  );
  const hiddenSelectedCount = Math.max(0, selectedList.length - visibleSelectedCount);
  const allVisibleSelected = contracts.length > 0 && visibleSelectedCount === contracts.length;

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        setSelected(new Set(Array.isArray(parsed) ? parsed : []));
      } else {
        setSelected(new Set());
      }
    } catch {
      setSelected(new Set());
    } finally {
      setSelectionLoaded(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !selectionLoaded || typeof window === "undefined") return;
    try {
      if (selected.size === 0) {
        window.sessionStorage.removeItem(storageKey);
      } else {
        window.sessionStorage.setItem(storageKey, JSON.stringify([...selected]));
      }
    } catch {
      // Ignore storage failures; selection still works in-memory.
    }
  }, [selected, selectionLoaded, storageKey]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = visibleSelectedCount > 0 && !allVisibleSelected;
  }, [allVisibleSelected, visibleSelectedCount]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const contract of contracts) {
          next.delete(contract.id);
        }
      } else {
        for (const contract of contracts) {
          next.add(contract.id);
        }
      }
      return next;
    });
  };

  if (contracts.length === 0) {
    if (emptyState) {
      return (
        <V10RecoverableState
          state="empty"
          title={emptyState.title}
          reason={emptyState.copy}
          accessibleName="Filtered contracts empty state"
          surface="contracts"
          section="contract_table"
          sourceObject="contract"
          nextActionLabel={emptyState.actionLabel}
          nextAction={
            <V10EmptyStateTelemetryLink
              href={emptyState.actionHref}
              className="ui-btn-primary px-6"
              surface="contracts"
              section="contract_table"
              sourceObject="contract"
              actionLabel={emptyState.actionLabel}
            >
              {emptyState.actionLabel}
            </V10EmptyStateTelemetryLink>
          }
        />
      );
    }
    return (
      <V10RecoverableState
        state="empty"
        title="No contracts yet"
        reason="Upload an agreement to extract dates and build your operational record."
        accessibleName="Contracts empty state"
        surface="contracts"
        section="contract_table"
        sourceObject="contract"
        nextActionLabel="Upload contract"
        nextAction={
          <V10EmptyStateTelemetryLink
            href="/contracts/new"
            className="ui-btn-primary px-6"
            surface="contracts"
            section="contract_table"
            sourceObject="contract"
            actionLabel="Upload contract"
          >
            Upload contract
          </V10EmptyStateTelemetryLink>
        }
      />
    );
  }

  const exportHref =
    bulkActions && selectedList.length > 0
      ? `/api/export/contracts?orgId=${encodeURIComponent(bulkActions.orgId)}&contractIds=${encodeURIComponent(
          selectedList.join(",")
        )}`
      : null;

  const horizonLabel = (field: string | null) => {
    switch (field) {
      case "notice_window":
        return "Notice";
      case "renewal_date":
        return "Renewal";
      case "end_date":
        return "End";
      default:
        return "Date";
    }
  };
  const nextActionForContract = (
    contract: Contract,
    sig: ContractListRowSignals | undefined,
    stats: ContractReviewStats | undefined
  ): { label: string; href: string; detail: string } => {
    if (stats && stats.pending > 0) {
      return {
        label: "Continue field review",
        href: `/contracts/${contract.id}#extracted-fields`,
        detail: `${stats.pending} pending field${stats.pending === 1 ? "" : "s"}`,
      };
    }
    if (sig?.missingCriticalDates) {
      return {
        label: "Review approved dates",
        href: `/contracts/${contract.id}#dates`,
        detail: "Critical dates are missing",
      };
    }
    if ((sig?.openExceptionCount ?? 0) > 0) {
      return {
        label: "Resolve exceptions",
        href: `/contracts/exceptions?status=open&contract=${contract.id}`,
        detail: `${sig?.openExceptionCount ?? 0} open exception${sig?.openExceptionCount === 1 ? "" : "s"}`,
      };
    }
    if ((sig?.outstandingEvidenceCount ?? 0) > 0) {
      return {
        label: "Review evidence",
        href: `/contracts/${contract.id}?tab=overview#contract-evidence`,
        detail: `${sig?.outstandingEvidenceCount ?? 0} evidence request${sig?.outstandingEvidenceCount === 1 ? "" : "s"}`,
      };
    }
    if (!contract.owner_id) {
      return {
        label: "Assign owner",
        href: `/contracts/${contract.id}#ownership-record`,
        detail: "Ownership missing",
      };
    }
    if (sig?.nextHorizonDays != null && sig.nextHorizonDays <= 14) {
      return {
        label: "Review deadline",
        href: `/contracts/${contract.id}`,
        detail:
          sig.nextHorizonDays < 0
            ? `${horizonLabel(sig.nextHorizonField)} overdue`
            : sig.nextHorizonDays === 0
              ? `${horizonLabel(sig.nextHorizonField)} due today`
              : `${horizonLabel(sig.nextHorizonField)} in ${sig.nextHorizonDays}d`,
      };
    }
    return {
      label: "Review contract",
      href: `/contracts/${contract.id}`,
      detail: "No active exception",
    };
  };

  return (
    <div className="ui-table-shell">
      {bulkActions && selectionLoaded && selectedList.length > 0 ? (
        <div
          className="ui-status-panel ui-status-panel-info flex flex-col gap-3 rounded-none border-x-0 border-t-0 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          role="status"
          aria-live="polite"
        >
          <div className="space-y-1">
            <p className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
              {selectedList.length} selected
              {hiddenSelectedCount > 0 ? ` · ${hiddenSelectedCount} outside this page` : ""}
            </p>
            {hiddenSelectedCount > 0 ? (
              <p className="text-[12px] text-[var(--text-secondary)]">
                Bulk actions keep the same selected contract ids across pages and filters.
              </p>
            ) : filterFingerprint ? (
              <p className="text-[12px] text-[var(--text-secondary)]">
                Selecting more pages adds to this same contract set.
              </p>
            ) : null}
            {exportHref ? (
              <p className="text-[11px] text-[var(--text-tertiary)]">
                CSV export includes only the selected ids (server caps at 200 per request). Confirm the downloaded row
                count matches this selection before relying on it outside Oblixa.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {exportHref ? (
              <a href={exportHref} className="ui-btn-secondary px-3 py-1.5 text-[12px]">
                Export selected CSV
              </a>
            ) : null}
            <button
              type="button"
              className="ui-btn-secondary px-3 py-1.5 text-[12px]"
              onClick={() => setSelected(new Set())}
            >
              Clear selection
            </button>
            {bulkActions.canEdit && bulkActions.members.length > 0 ? (
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (isBulkAssignPending) return;
                  setBulkError(null);
                  const form = e.currentTarget;
                  startBulkAssignTransition(async () => {
                    const fd = new FormData(form);
                    const res = await bulkAssignContractOwners(fd);
                    if ("error" in res && res.error) {
                      setBulkError(describeRecoverableMutationError(res.error));
                      return;
                    }
                    setSelected(new Set());
                    router.refresh();
                  });
                }}
              >
                <input type="hidden" name="contractIds" value={selectedList.join(",")} />
                <label className="sr-only" htmlFor="bulk-owner-select">
                  Assign owner
                </label>
                <select
                  id="bulk-owner-select"
                  name="newOwnerId"
                  required
                  className="ui-input-compact h-8 max-w-[14rem] text-[12px]"
                  defaultValue=""
                  disabled={isBulkAssignPending}
                >
                  <option value="" disabled>
                    Assign to…
                  </option>
                  {bulkActions.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="ui-btn-primary px-3 py-1.5 text-[12px]"
                  disabled={isBulkAssignPending}
                >
                  {isBulkAssignPending ? "Assigning..." : "Apply"}
                </button>
                {bulkError ? (
                  <span className="text-[12px] font-medium text-[var(--danger-ink)]" role="alert">
                    {bulkError}
                  </span>
                ) : null}
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table
          data-testid={surfaceTestIds.contractsTable}
          aria-label="Contracts in this workspace"
          className="min-w-full border-collapse text-[13px]"
        >
          <thead className="sticky top-0 z-[1] bg-[color:color-mix(in_oklab,var(--surface)_92%,white)] backdrop-blur">
            <tr className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)]">
              {bulkActions ? (
                <th className="ui-table-header w-10 whitespace-nowrap px-2 py-2.5 first:pl-4 lg:pl-6">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent)]"
                    aria-label="Select all contracts on this page"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                  />
                </th>
              ) : null}
              <th className="ui-table-header whitespace-nowrap px-5 py-2.5 first:pl-6 lg:pl-8">
                Contract
              </th>
              <th className="ui-table-header whitespace-nowrap px-5 py-2.5">Next action</th>
              <th className="ui-table-header whitespace-nowrap px-5 py-2.5">Counterparty</th>
              <th className="ui-table-header whitespace-nowrap px-5 py-2.5 text-center">Status</th>
              {reviewStats && <th className="ui-table-header whitespace-nowrap px-5 py-2.5 text-center">Review</th>}
              {rowSignals ? <th className="ui-table-header whitespace-nowrap px-5 py-2.5 text-center">Horizon</th> : null}
              {rowSignals ? <th className="ui-table-header whitespace-nowrap px-5 py-2.5 text-center">Signals</th> : null}
              <th className="ui-table-header whitespace-nowrap px-5 py-2.5 text-center">Owner</th>
              <th className="ui-table-header whitespace-nowrap px-5 py-2.5">Updated</th>
              <th className="relative whitespace-nowrap px-5 py-2.5 pr-6 lg:pr-8">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => {
              const stats = reviewStats?.[contract.id];
              const sig = rowSignals?.[contract.id];
              const nextAction = nextActionForContract(contract, sig, stats);
              const updatedDate = new Date(contract.updated_at);
              const updatedLabel = isValid(updatedDate)
                ? formatDistanceToNowStrict(updatedDate, { addSuffix: true })
                : "Unknown";
              return (
                <tr
                  key={contract.id}
                  className="ui-table-row odd:bg-[color:color-mix(in_oklab,var(--surface)_88%,transparent)] even:bg-[color:color-mix(in_oklab,var(--surface-muted)_60%,transparent)] last:border-0"
                >
                  {bulkActions ? (
                    <td className="whitespace-nowrap px-2 py-3.5 first:pl-4 lg:pl-6">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--accent)]"
                        aria-label={`Select ${contract.title}`}
                        checked={selected.has(contract.id)}
                        onChange={() => toggle(contract.id)}
                      />
                    </td>
                  ) : null}
                  <td className="whitespace-nowrap px-5 py-4 first:pl-6 lg:pl-8">
                    <div className="flex min-w-[18rem] items-start gap-3">
                      <span className="ui-icon-tile-compact shrink-0 text-[var(--text-tertiary)]">
                        <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/contracts/${contract.id}`}
                          dir="auto"
                          className="block max-w-[24rem] min-w-0 truncate text-[14px] font-semibold tracking-tight text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)] [unicode-bidi:isolate]"
                          title={contract.title}
                        >
                          {contract.title}
                        </Link>
                        {contract.contract_type && (
                          <p className="ui-meta mt-1 leading-none">
                            {contract.contract_type}
                          </p>
                        )}
                        {showContinuityLinks ? (
                          <div className="mt-2">
                            <ContractContinuityLinks contractId={contract.id} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 align-middle">
                    <Link
                      href={nextAction.href}
                      className="inline-flex min-w-[10rem] flex-col rounded-[1rem] border border-[color:color-mix(in_oklab,var(--border-subtle)_86%,transparent)] bg-[color:color-mix(in_oklab,var(--surface)_78%,white)] px-3 py-2 text-[12px] shadow-[var(--shadow-1)] transition-colors hover:border-[var(--accent)]"
                    >
                      <span className="font-semibold text-[var(--text-primary)]">{nextAction.label}</span>
                      <span className="mt-1 text-[11px] text-[var(--text-tertiary)]">{nextAction.detail}</span>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="inline-flex min-h-8 items-center rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_88%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_74%,transparent)] px-3 text-[12px] font-semibold text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
                      {contract.counterparty || "—"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-center align-middle">
                    <StatusBadge status={STATUS_SEMANTICS[contract.status] ?? STATUS_SEMANTICS.draft}>
                      {STATUS_LABELS[contract.status] || contract.status}
                    </StatusBadge>
                  </td>
                  {reviewStats && (
                    <td className="whitespace-nowrap px-5 py-4 text-center align-middle text-[13px]">
                      {stats && stats.total > 0 ? (
                        <div className="inline-flex min-w-[7.5rem] flex-col gap-1.5 rounded-[1rem] border border-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)] bg-[color:color-mix(in_oklab,var(--surface)_72%,transparent)] px-3 py-2 shadow-[var(--shadow-1)]">
                          <span
                            className={
                              stats.pending > 0
                                ? "text-[12px] font-semibold leading-none text-[var(--warning-ink)]"
                                : "text-[12px] font-semibold leading-none text-[var(--success-ink)]"
                            }
                          >
                            {stats.pending > 0 ? `${stats.pending} pending` : "Complete"}
                          </span>
                          <span className="text-[11px] leading-none text-[var(--text-tertiary)]">
                            {stats.approved}/{stats.total} fields
                          </span>
                        </div>
                      ) : (
                        <span className="text-[var(--text-tertiary)]">—</span>
                      )}
                    </td>
                  )}
                  {rowSignals && sig ? (
                    <td className="whitespace-nowrap px-5 py-4 text-center align-middle text-[12px]">
                      {sig.nextHorizonDate && sig.nextHorizonDays != null ? (
                        <div className="inline-flex min-w-[8.5rem] flex-col gap-1.5 rounded-[1rem] border border-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)] bg-[color:color-mix(in_oklab,var(--surface)_72%,transparent)] px-3 py-2 shadow-[var(--shadow-1)]">
                          <span
                            className={
                              sig.nextHorizonDays < 0
                                ? "text-[12px] font-semibold leading-none text-[var(--danger-ink)]"
                                : sig.nextHorizonDays <= 14
                                  ? "text-[12px] font-semibold leading-none text-[var(--warning-ink)]"
                                  : "text-[12px] font-semibold leading-none text-[var(--text-primary)]"
                            }
                          >
                            {sig.nextHorizonDays < 0
                              ? `${horizonLabel(sig.nextHorizonField)} overdue by ${Math.abs(sig.nextHorizonDays)}d`
                              : sig.nextHorizonDays === 0
                                ? `${horizonLabel(sig.nextHorizonField)} due today`
                                : `${horizonLabel(sig.nextHorizonField)} in ${sig.nextHorizonDays}d`}
                          </span>
                          <span className="text-[11px] leading-none text-[var(--text-tertiary)]">
                            {formatBusinessDateAtNoon(sig.nextHorizonDate)}
                          </span>
                        </div>
                      ) : sig.missingCriticalDates ? (
                        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--warning-soft)_66%,transparent)] bg-[color:color-mix(in_oklab,var(--warning-soft)_62%,transparent)] px-3 text-[12px] font-semibold leading-none text-[var(--warning-ink)]">
                          <CalendarClock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                          No approved dates
                        </span>
                      ) : (
                        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_70%,transparent)] px-3 text-[12px] font-medium leading-none text-[var(--text-tertiary)]">
                          <Clock3 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                          No dated trigger
                        </span>
                      )}
                    </td>
                  ) : null}
                  {rowSignals && sig ? (
                    <td className="max-w-[11rem] whitespace-normal px-5 py-4 text-center align-middle text-[12px]">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {sig.openExceptionCount > 0 ? (
                          <Link
                            href={`/contracts/exceptions?status=open&contract=${contract.id}`}
                            className="inline-flex min-h-7 items-center justify-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--warning-soft)_60%,transparent)] bg-[var(--warning-soft)] px-2.5 py-1 text-[11px] font-semibold leading-none text-[var(--warning-ink)] transition-colors hover:border-[var(--warning-ink)]"
                          >
                            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                            {sig.openExceptionCount} exception{sig.openExceptionCount === 1 ? "" : "s"}
                          </Link>
                        ) : null}
                        {sig.outstandingEvidenceCount > 0 ? (
                          <span className="inline-flex min-h-7 items-center justify-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--info-soft)_62%,transparent)] bg-[var(--info-soft)] px-2.5 py-1 text-[11px] font-semibold leading-none text-[var(--info-ink)]">
                            <FileWarning className="h-3 w-3 shrink-0" aria-hidden />
                            {sig.outstandingEvidenceCount} evidence request{sig.outstandingEvidenceCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                        {sig.missingCriticalDates ? (
                          <Link
                            href={`/contracts/${contract.id}#dates`}
                            className="inline-flex min-h-7 items-center justify-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--warning-soft)_56%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_78%,transparent)] px-2.5 py-1 text-[11px] font-semibold leading-none text-[var(--warning-ink)] transition-colors hover:border-[var(--warning-ink)] hover:bg-[var(--warning-soft)]"
                          >
                            <CalendarClock className="h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden />
                            Dates gap
                          </Link>
                        ) : null}
                        {sig.openExceptionCount === 0 &&
                        sig.outstandingEvidenceCount === 0 &&
                        !sig.missingCriticalDates ? (
                          <span className="text-[var(--text-tertiary)]" aria-label="No active row signals" />
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                  <td className="whitespace-nowrap px-5 py-4 text-center align-middle">
                    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_68%,transparent)] px-3 text-[12px] font-medium text-[var(--text-secondary)]">
                      <CircleUserRound className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.75} aria-hidden />
                      {contract.owner?.full_name || contract.owner?.email || "—"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-[13px] tabular-nums text-[var(--text-tertiary)]">
                    <div className="flex flex-col gap-0.5">
                      <span>{format(new Date(contract.updated_at), "MMM d, yyyy")}</span>
                      <span
                        className="text-[11px] text-[var(--text-tertiary)]"
                        suppressHydrationWarning
                      >
                        {updatedLabel}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 pr-6 text-right lg:pr-8">
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="inline-flex rounded-[0.9rem] border border-transparent p-2 text-[var(--text-tertiary)] transition-colors hover:border-[color:color-mix(in_oklab,var(--border-subtle)_88%,transparent)] hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_72%,transparent)] hover:text-[var(--text-primary)]"
                      aria-label={`Open ${contract.title}`}
                    >
                      <ChevronRight size={18} strokeWidth={1.75} aria-hidden />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
