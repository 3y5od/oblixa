"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isValid } from "date-fns";
import type { Contract } from "@/lib/types";
import type { ContractReviewStats } from "@/lib/contract-review-stats";
import type { ContractListRowSignals } from "@/lib/contract-list-row-signals";
import { STATUS_SEMANTICS, STATUS_LABELS } from "@/lib/contracts";
import { EmptyStateTelemetryLink } from "@/components/ui/empty-state-telemetry-link";
import { RecoverableState } from "@/components/ui/recoverable-state";
import { ActionChip } from "@/components/ui/action-chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
import { UiAvatar } from "@/components/ui/ui-avatar";
import { UiSelect } from "@/components/ui/ui-select";
import { TimeChip } from "@/components/ui/time-chip";
import { surfaceTestIds } from "@/lib/qa/test-ids";
import { bulkAssignContractOwners } from "@/actions/contracts";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import {
  clearContractTableSelection,
  readContractTableSelection,
  writeContractTableSelection,
} from "@/lib/security/client-storage";

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
  const storageScope = bulkActions?.orgId ?? null;
  const [selectionLoaded, setSelectionLoaded] = useState(!storageScope);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [isBulkAssignPending, startBulkAssignTransition] = useTransition();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const hydratedStorageScopeRef = useRef<string | null>(null);

  const selectedList = useMemo(() => [...selected], [selected]);
  const visibleSelectedCount = useMemo(
    () => contracts.filter((contract) => selected.has(contract.id)).length,
    [contracts, selected]
  );
  const hiddenSelectedCount = Math.max(0, selectedList.length - visibleSelectedCount);
  const allVisibleSelected = contracts.length > 0 && visibleSelectedCount === contracts.length;

  useEffect(() => {
    if (!storageScope) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const initialHydration = hydratedStorageScopeRef.current === null;
      const storedSelection = new Set(readContractTableSelection(storageScope));
      setSelected((current) =>
        initialHydration && current.size > 0 ? current : storedSelection
      );
      hydratedStorageScopeRef.current = storageScope;
      setSelectionLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storageScope]);

  useEffect(() => {
    if (!storageScope || !selectionLoaded) return;
    if (selected.size === 0) {
      clearContractTableSelection(storageScope);
      return;
    }
    writeContractTableSelection(storageScope, [...selected]);
  }, [selected, selectionLoaded, storageScope]);

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
        <RecoverableState
          state="empty"
          title={emptyState.title}
          reason={emptyState.copy}
          accessibleName="Filtered contracts empty state"
          surface="contracts"
          section="contract_table"
          sourceObject="contract"
          nextActionLabel={emptyState.actionLabel}
          nextAction={
            <EmptyStateTelemetryLink
              href={emptyState.actionHref}
              className="ui-btn-primary px-6"
              surface="contracts"
              section="contract_table"
              sourceObject="contract"
              actionLabel={emptyState.actionLabel}
            >
              {emptyState.actionLabel}
            </EmptyStateTelemetryLink>
          }
        />
      );
    }
    return (
      <RecoverableState
        state="empty"
        title="No contracts yet"
        reason="Upload an agreement to extract dates and build your operational record."
        accessibleName="Contracts empty state"
        surface="contracts"
        section="contract_table"
        sourceObject="contract"
        nextActionLabel="Upload contract"
        nextAction={
          <EmptyStateTelemetryLink
            href="/contracts/new"
            className="ui-btn-primary px-6"
            surface="contracts"
            section="contract_table"
            sourceObject="contract"
            actionLabel="Upload contract"
          >
            Upload contract
          </EmptyStateTelemetryLink>
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
  const selectedContractIdsParam =
    selectedList.length > 0 ? encodeURIComponent(selectedList.join(",")) : null;
  const requestReviewHref = selectedContractIdsParam
    ? `/contracts/review?contractIds=${selectedContractIdsParam}`
    : null;
  const archiveHref = selectedContractIdsParam
    ? `/contracts/maintenance?action=archive&contractIds=${selectedContractIdsParam}`
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

  const ownerDisplay = (contract: Contract): { display: string; tooltip?: string } | null => {
    const ownerName = contract.owner?.full_name?.trim();
    const ownerEmail = contract.owner?.email?.trim();
    if (ownerName && ownerName.toLowerCase() !== "name") {
      return { display: ownerName, tooltip: ownerEmail };
    }
    if (ownerEmail && ownerEmail.toLowerCase() !== "name") {
      const local = ownerEmail.split("@")[0];
      return { display: local || ownerEmail, tooltip: ownerEmail };
    }
    return null;
  };

  const reviewState = (contractId: string) => {
    const stats = reviewStats?.[contractId];
    if (!stats || stats.total <= 0) return null;
    if (stats.pending > 0) {
      return {
        label: `${stats.pending} pending`,
        status: "in_review" as const,
        href: `/contracts/${contractId}#extracted-fields`,
      };
    }
    return {
      label: `${stats.approved}/${stats.total} reviewed`,
      status: "healthy" as const,
      href: `/contracts/${contractId}#extracted-fields`,
    };
  };
  // v22 aesthetic pass: refine grid chrome — softer outer border, cleaner
  // hairline gutters between cells, slight bump in cell padding. Keeps
  // the canonical "table-inside-card" feel but reads more refined.
  const signalGridClass =
    "mt-4 grid overflow-hidden rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] bg-[color:color-mix(in_oklab,var(--border-subtle)_40%,transparent)] md:grid-cols-2 xl:grid-cols-4";
  const signalCellClass =
    "min-w-0 bg-[var(--surface-raised)] px-4 py-3.5";
  const signalLabelClass = "ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]";
  const signalValueClass =
    "mt-2 flex min-w-0 flex-wrap items-center gap-2 text-[12.5px] leading-snug text-[var(--text-secondary)]";

  return (
    <div className="space-y-3">
      {bulkActions && selectedList.length > 0 ? (
        <div
          className="ui-table-shell flex flex-col gap-3 border border-[color:color-mix(in_oklab,var(--accent)_20%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col gap-1">
            <p className="inline-flex items-center gap-2 text-[12.5px] font-semibold tracking-tight text-[var(--text-primary)]">
              <span
                aria-hidden
                className="inline-flex h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--accent)" }}
              />
              {selectedList.length} selected
            </p>
            {hiddenSelectedCount > 0 ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                {hiddenSelectedCount} outside this page · Persists across filters
              </p>
            ) : filterFingerprint ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                Selection persists across pages
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {exportHref ? (
              <a
                href={exportHref}
                className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
              >
                Export CSV
              </a>
            ) : null}
            {requestReviewHref ? (
              <a
                href={requestReviewHref}
                className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
              >
                Request review
              </a>
            ) : null}
            {archiveHref ? (
              <a
                href={archiveHref}
                className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
              >
                Archive
              </a>
            ) : null}
            <button
              type="button"
              className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
              onClick={() => setSelected(new Set())}
            >
              Clear
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
                <UiSelect
                  name="newOwnerId"
                  required
                  ariaLabel="Assign owner"
                  placeholder="Assign to…"
                  disabled={isBulkAssignPending}
                  className="min-w-[10rem] max-w-[16rem]"
                  buttonClassName="h-8 text-[12.5px]"
                  options={bulkActions.members.map((m) => ({ value: m.id, label: m.label }))}
                />
                <button
                  type="submit"
                  className="ui-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
                  disabled={isBulkAssignPending}
                >
                  {isBulkAssignPending ? "Assigning…" : "Apply"}
                </button>
                {bulkError ? (
                  <span className="text-[12.5px] font-medium text-[var(--danger-ink)]" role="alert">
                    {bulkError}
                  </span>
                ) : null}
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
      {bulkActions ? (
        <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex min-w-0 items-center gap-3 text-[12.5px] font-semibold text-[var(--text-secondary)]">
            <input
              ref={selectAllRef}
              type="checkbox"
              className="ui-checkbox"
              aria-label="Select all contracts on this page"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
            />
            <span>Select all on page</span>
          </label>
          <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">
            {contracts.length} contract{contracts.length === 1 ? "" : "s"} shown
          </span>
        </div>
      ) : null}
      <div
        data-testid={surfaceTestIds.contractsTable}
        role="list"
        aria-label="Contracts in this workspace"
        className="space-y-3 text-[12.5px]"
      >
        {contracts.map((contract) => {
          const stats = reviewStats?.[contract.id];
          const sig = rowSignals?.[contract.id];
          const updatedDate = new Date(contract.updated_at);
          const owner = ownerDisplay(contract);
          const review = reviewState(contract.id);
          const nextDateTone =
            sig?.nextHorizonDays == null
              ? undefined
              : sig.nextHorizonDays < 0
                ? "danger"
                : sig.nextHorizonDays <= 14
                  ? "warning"
                  : undefined;
          const nextImportantLabel =
            sig?.nextHorizonDate && sig.nextHorizonDays != null
              ? sig.nextHorizonDays < 0
                ? `${horizonLabel(sig.nextHorizonField)} overdue ${Math.abs(sig.nextHorizonDays)}d`
                : sig.nextHorizonDays === 0
                  ? `${horizonLabel(sig.nextHorizonField)} due today`
                  : `${horizonLabel(sig.nextHorizonField)} in ${sig.nextHorizonDays}d`
              : null;
          return (
            <article
              key={contract.id}
              role="listitem"
              className="ui-table-shell ui-table-row overflow-hidden p-0 transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_10%,transparent)]"
            >
              <div className="px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    {bulkActions ? (
                      <input
                        type="checkbox"
                        className="ui-checkbox mt-1"
                        aria-label={`Select ${contract.title}`}
                        checked={selected.has(contract.id)}
                        onChange={() => toggle(contract.id)}
                      />
                    ) : null}
                    {/* v22 aesthetic pass: dropped two redundant elements
                        per §10.4 (eliminate redundancy):
                        - The "Contract" caps eyebrow above the title — the
                          row IS the contract; the label is self-evident.
                        - The Counterparty/type/Updated sub-line — these
                          three values are already shown as discrete cells
                          in the signal grid below (COUNTERPARTY +
                          LAST UPDATED), so the inline prose duplicated the
                          structured cells and violated §10.7 (small plain
                          text under a title). Title now stands clean
                          above the signal grid. */}
                    <div className="min-w-0">
                      <Link
                        href={`/contracts/${contract.id}`}
                        dir="auto"
                        className="block min-w-0 truncate text-[17px] font-semibold leading-[1.25] tracking-tight text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)] [unicode-bidi:isolate]"
                        title={contract.title}
                      >
                        {contract.title}
                      </Link>
                    </div>
                  </div>
                  <Link
                    href={`/contracts/${contract.id}`}
                    aria-label={`${contract.title} — open contract details`}
                    className="ui-btn-secondary inline-flex shrink-0 items-center justify-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold"
                  >
                    Open contract
                  </Link>
                </div>

                {showContinuityLinks ? (
                  <div className="mt-3">
                    <ContractContinuityLinks contractId={contract.id} omit={["contract", "work"]} />
                  </div>
                ) : null}

                <dl className={signalGridClass} aria-label={`Contract signals for ${contract.title}`}>
                  <div className={signalCellClass}>
                    <dt className={signalLabelClass}>Counterparty</dt>
                    <dd className={signalValueClass}>
                      <span className="truncate font-semibold text-[var(--text-primary)]">
                        {contract.counterparty || "Not set"}
                      </span>
                      {contract.contract_type ? (
                        <span className="text-[var(--text-tertiary)]">{contract.contract_type}</span>
                      ) : null}
                    </dd>
                  </div>
                  <div className={signalCellClass}>
                    <dt className={signalLabelClass}>Status</dt>
                    <dd className={signalValueClass}>
                      <StatusBadge status={STATUS_SEMANTICS[contract.status] ?? STATUS_SEMANTICS.draft}>
                        {STATUS_LABELS[contract.status] || contract.status}
                      </StatusBadge>
                      {sig?.openExceptionCount && sig.openExceptionCount > 0 ? (
                        <Link
                          href={`/contracts/exceptions?status=open&contract=${contract.id}`}
                          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--danger-ink)] hover:text-[var(--accent-strong)]"
                        >
                          {sig.openExceptionCount} exception{sig.openExceptionCount === 1 ? "" : "s"}
                        </Link>
                      ) : null}
                    </dd>
                  </div>
                  <div className={signalCellClass}>
                    <dt className={signalLabelClass}>Review state</dt>
                    <dd className="mt-2 min-w-0 text-[12.5px] text-[var(--text-secondary)]">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {review ? (
                          <Link href={review.href} aria-label="Continue field review">
                            <StatusBadge status={review.status}>{review.label}</StatusBadge>
                          </Link>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">No fields</span>
                        )}
                        {stats && stats.total > 0 ? (
                          <span className="text-[12px] text-[var(--text-tertiary)]">
                            {stats.approved}/{stats.total} fields
                          </span>
                        ) : null}
                      </div>
                      {stats && stats.total > 0 ? (
                        <span
                          className="ui-progress-mini mt-2 !h-1.5 !w-full max-w-[12rem]"
                          role="progressbar"
                          aria-valuenow={stats.approved}
                          aria-valuemin={0}
                          aria-valuemax={stats.total}
                          aria-label={`${stats.approved} of ${stats.total} fields reviewed`}
                        >
                          <span
                            aria-hidden
                            className={`ui-progress-mini-fill${stats.pending > 0 ? " ui-progress-mini-fill-warning" : ""}`}
                            style={{ width: `${Math.round((stats.approved / stats.total) * 100)}%` }}
                          />
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div className={signalCellClass}>
                    <dt className={signalLabelClass}>Next important date</dt>
                    <dd className={signalValueClass}>
                      {sig?.nextHorizonDate ? (
                        <>
                          <span className="truncate font-semibold text-[var(--text-primary)]">{nextImportantLabel}</span>
                          <TimeChip date={sig.nextHorizonDate} format="calendar" tone={nextDateTone} />
                        </>
                      ) : sig?.missingCriticalDates ? (
                        <Link
                          href={`/contracts/${contract.id}#dates`}
                          className="inline-flex min-h-6 items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--warning-soft)_55%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_32%,var(--surface-raised))] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--warning-ink)] transition-colors hover:border-[var(--warning-ink)]"
                        >
                          Dates gap
                        </Link>
                      ) : (
                        <span className="text-[var(--text-tertiary)]">No date set</span>
                      )}
                    </dd>
                  </div>
                  <div className={signalCellClass}>
                    <dt className={signalLabelClass}>Owner</dt>
                    <dd className={signalValueClass}>
                      {!owner ? (
                        <Link
                          href={`/contracts/${contract.id}#ownership-record`}
                          className="font-medium text-[var(--warning-ink)] hover:text-[var(--accent-strong)]"
                        >
                          Assign owner
                        </Link>
                      ) : (
                        <span className="inline-flex min-w-0 items-center gap-2" title={owner.tooltip}>
                          <UiAvatar name={contract.owner?.full_name} email={contract.owner?.email} size="xs" />
                          <span className="truncate font-semibold text-[var(--text-primary)]">{owner.display}</span>
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className={signalCellClass}>
                    <dt className={signalLabelClass}>Open work</dt>
                    <dd className={signalValueClass}>
                      {(sig?.openWorkCount ?? 0) > 0 ? (
                        <Link
                          href={`/work?contract=${contract.id}`}
                          className="inline-flex min-h-6 items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_24%,var(--surface-raised))] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--accent-strong)] transition-colors hover:border-[var(--accent-strong)]"
                        >
                          {sig?.openWorkCount} open
                        </Link>
                      ) : sig?.outstandingEvidenceCount && sig.outstandingEvidenceCount > 0 ? (
                        <Link
                          href={`/contracts/evidence-studio?contract=${contract.id}`}
                          className="font-medium text-[var(--warning-ink)] hover:text-[var(--accent-strong)]"
                        >
                          {sig.outstandingEvidenceCount} evidence request{sig.outstandingEvidenceCount === 1 ? "" : "s"}
                        </Link>
                      ) : (
                        <span className="text-[var(--text-tertiary)]">None</span>
                      )}
                    </dd>
                  </div>
                  <div className={signalCellClass}>
                    <dt className={signalLabelClass}>Last updated</dt>
                    <dd className={signalValueClass} suppressHydrationWarning>
                      {isValid(updatedDate) ? <TimeChip date={updatedDate} /> : "Unknown"}
                    </dd>
                  </div>
                  <div className={signalCellClass}>
                    <dt className={signalLabelClass}>Actions</dt>
                    {/* v22: small-plain-text accent links replaced with
                        canonical <ActionChip> primitives (§2.6). Each
                        verb now reads as a discrete pill with arrow,
                        consistent with the rest of the app's action
                        affordances. */}
                    <dd className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
                      <ActionChip verb="Add reminder" href={`/contracts/${contract.id}#dates`} />
                      <ActionChip verb="Assign owner" href={`/contracts/${contract.id}#ownership-record`} />
                      <ActionChip verb="Create work" href={`/contracts/${contract.id}#contract-tasks`} />
                    </dd>
                  </div>
                </dl>
              </div>
            </article>
          );
        })}
      </div>
      {footer}
    </div>
  );
}
