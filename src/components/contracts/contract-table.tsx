"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isValid } from "date-fns";
import {
  Bell,
  CheckCheck,
  ChevronRight,
  Hourglass,
  MoreHorizontal,
  Plus,
  UserCog,
  UserPlus,
} from "lucide-react";
import type { Contract } from "@/lib/types";
import type { ContractReviewStats } from "@/lib/contract-review-stats";
import type { ContractListRowSignals } from "@/lib/contract-list-row-signals";
import { STATUS_SEMANTICS, STATUS_LABELS } from "@/lib/contracts";
import { EmptyStateTelemetryLink } from "@/components/ui/empty-state-telemetry-link";
import { RecoverableState } from "@/components/ui/recoverable-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
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

const COUNTERPARTY_FALLBACK_TOKENS = new Set([
  "tenants",
  "tenant",
  "vendor",
  "counterparty",
  "supplier",
  "customer",
  "party",
  "other",
]);
const CONTRACT_TYPE_FALLBACK_TOKENS = new Set([
  "other",
  "unknown",
  "unclassified",
  "n/a",
]);
const OWNER_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ContractTableProps {
  contracts: Contract[];
  reviewStats?: Record<string, ContractReviewStats>;
  rowSignals?: Record<string, ContractListRowSignals>;
  showContinuityLinks?: boolean;
  footer?: ReactNode;
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

function RowActionsMenu({
  contractId,
  hasOwner,
}: {
  contractId: string;
  hasOwner: boolean;
}) {
  // The row's visible OPEN affordance handles "Open contract" — the
  // kebab only carries the three non-open spec actions. Items are
  // left-aligned, icon + label, tight rows, lighter panel chrome.
  const itemClass =
    "flex items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_7%,transparent)] hover:text-[var(--accent-strong)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)] focus-visible:text-[var(--accent-strong)] focus-visible:outline-none";
  const iconClass = "h-3.5 w-3.5 shrink-0";
  return (
    <details className="relative inline-block">
      <summary
        aria-label="Row actions"
        className="inline-flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,transparent)] hover:text-[var(--accent-strong)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,transparent)] focus-visible:text-[var(--accent-strong)] group-hover:text-[var(--accent-strong)] [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.85} aria-hidden />
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-40 overflow-hidden rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] bg-[var(--surface-raised)] py-1 shadow-[var(--shadow-1)]">
        <ul className="text-[12px]">
          <li>
            <Link
              href={`/contracts/${contractId}#ownership-record`}
              className={itemClass}
            >
              {hasOwner ? (
                <UserCog
                  className={iconClass}
                  strokeWidth={1.85}
                  aria-hidden
                />
              ) : (
                <UserPlus
                  className={iconClass}
                  strokeWidth={1.85}
                  aria-hidden
                />
              )}
              {hasOwner ? "Reassign owner" : "Assign owner"}
            </Link>
          </li>
          <li>
            <Link href={`/contracts/${contractId}#dates`} className={itemClass}>
              <Bell className={iconClass} strokeWidth={1.85} aria-hidden />
              Add reminder
            </Link>
          </li>
          <li>
            <Link
              href={`/contracts/${contractId}#contract-tasks`}
              className={itemClass}
            >
              <Plus className={iconClass} strokeWidth={1.85} aria-hidden />
              Create work
            </Link>
          </li>
        </ul>
      </div>
    </details>
  );
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
  const hiddenSelectedCount = Math.max(
    0,
    selectedList.length - visibleSelectedCount
  );
  const allVisibleSelected =
    contracts.length > 0 && visibleSelectedCount === contracts.length;

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
    selectAllRef.current.indeterminate =
      visibleSelectedCount > 0 && !allVisibleSelected;
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
    selectedList.length > 0
      ? encodeURIComponent(selectedList.join(","))
      : null;
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

  const ownerDisplay = (
    contract: Contract
  ): { display: string; tooltip?: string; isEmailFallback?: boolean } | null => {
    const ownerName = contract.owner?.full_name?.trim();
    const ownerEmail = contract.owner?.email?.trim();
    if (ownerName && ownerName.toLowerCase() !== "name") {
      return { display: ownerName, tooltip: ownerEmail };
    }
    if (ownerEmail && ownerEmail.toLowerCase() !== "name") {
      const local = ownerEmail.split("@")[0];
      return {
        display: local || ownerEmail,
        tooltip: ownerEmail,
        isEmailFallback: OWNER_EMAIL_RE.test(ownerEmail),
      };
    }
    return null;
  };

  const reviewState = (contractId: string) => {
    const stats = reviewStats?.[contractId];
    if (!stats || stats.total <= 0) return null;
    if (stats.pending > 0) {
      // `warning` (amber) — pending review is a "needs attention" state,
      // not a primary-action state. Earlier `in_review` rendered accent
      // blue and collided with primary-action color elsewhere.
      return {
        label: `${stats.pending} pending`,
        status: "warning" as const,
        href: `/contracts/${contractId}#extracted-fields`,
      };
    }
    return {
      label: `${stats.approved} of ${stats.total}`,
      status: "healthy" as const,
      href: `/contracts/${contractId}#extracted-fields`,
    };
  };

  const headerCellClass =
    "px-3 py-1.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)] whitespace-nowrap";
  const bodyCellClass = "px-3 py-2 align-middle";
  // Small outline chip used uniformly for every "needs attention" missing-
  // value cell (counterparty / owner / dates). Caps + tracking + warning
  // tint align with the table's other caps-chip vocabulary (Status pills,
  // work chip, review chip) so the row scans as one consistent shape
  // family regardless of which column is empty.
  const missingChipClass =
    "inline-flex items-center rounded-sm border border-[color:color-mix(in_oklab,var(--warning-ink)_25%,var(--border-subtle))] bg-transparent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--warning-ink)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--warning-soft)_22%,transparent)]";

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
                <input
                  type="hidden"
                  name="contractIds"
                  value={selectedList.join(",")}
                />
                <UiSelect
                  name="newOwnerId"
                  required
                  ariaLabel="Assign owner"
                  placeholder="Assign to…"
                  disabled={isBulkAssignPending}
                  className="min-w-[10rem] max-w-[16rem]"
                  buttonClassName="h-8 text-[12.5px]"
                  options={bulkActions.members.map((m) => ({
                    value: m.id,
                    label: m.label,
                  }))}
                />
                <button
                  type="submit"
                  className="ui-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
                  disabled={isBulkAssignPending}
                >
                  {isBulkAssignPending ? "Assigning…" : "Apply"}
                </button>
                {bulkError ? (
                  <span
                    className="text-[12.5px] font-medium text-[var(--danger-ink)]"
                    role="alert"
                  >
                    {bulkError}
                  </span>
                ) : null}
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* No outer card chrome — the table sits flush with the page so
          the inventory reads as the page's content, not as another
          surface tier. Structure comes from the thead's bottom border
          and the per-row .ui-table-row dividers. */}
      <div
        data-testid={surfaceTestIds.contractsTable}
        className="overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse text-[12.5px]"
            aria-label="Contracts in this workspace"
          >
            <thead className="bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--surface-raised))]">
              <tr className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)]">
                {bulkActions ? (
                  <th
                    scope="col"
                    className="w-6 px-1.5 py-1.5 text-left align-middle"
                  >
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="ui-checkbox"
                      aria-label="Select all contracts on this page"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                    />
                    <span className="sr-only">Select all on page</span>
                  </th>
                ) : null}
                <th scope="col" className={`${headerCellClass} min-w-[16rem]`}>
                  Contract
                </th>
                <th scope="col" className={`${headerCellClass} min-w-[10rem]`}>
                  Counterparty
                </th>
                <th scope="col" className={`${headerCellClass} min-w-[8rem]`}>
                  Owner
                </th>
                <th scope="col" className={`${headerCellClass} min-w-[7.5rem]`}>
                  Status
                </th>
                {/* Short visible labels keep the header row on one line at
                    operational widths; aria-label carries the full spec
                    name from oblixa-release-state.md so screen readers and
                    surface tests still see the canonical string. */}
                <th
                  scope="col"
                  aria-label="Next important date"
                  className={`${headerCellClass} min-w-[7rem]`}
                >
                  Next date
                </th>
                <th
                  scope="col"
                  aria-label="Review state"
                  className={`${headerCellClass} min-w-[7rem]`}
                >
                  Review
                </th>
                <th
                  scope="col"
                  aria-label="Open work"
                  className={`${headerCellClass} min-w-[5rem]`}
                >
                  Work
                </th>
                <th
                  scope="col"
                  aria-label="Last updated"
                  className={`${headerCellClass} min-w-[5rem]`}
                >
                  Updated
                </th>
                <th scope="col" className="w-10 px-2 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // eslint-disable-next-line react-hooks/purity -- per-render clock used to compute Updated freshness gating
                const renderNow = Date.now();
                const FRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
                return contracts.map((contract) => {
                  const stats = reviewStats?.[contract.id];
                  const sig = rowSignals?.[contract.id];
                  const updatedDate = new Date(contract.updated_at);
                  const updatedStale =
                    isValid(updatedDate) &&
                    renderNow - updatedDate.getTime() > FRESH_WINDOW_MS;
                  const owner = ownerDisplay(contract);
                  const review = reviewState(contract.id);
                  // Two-tier urgency on Next important date: past-due → danger,
                  // ≤14 days → warning, else neutral. The earlier "soon" accent
                  // tier was dropped per iteration 11 feedback because accent
                  // blue overloaded with primary-action color elsewhere.
                  const nextDateTone: "danger" | "warning" | undefined =
                    sig?.nextHorizonDays == null
                      ? undefined
                      : sig.nextHorizonDays < 0
                        ? "danger"
                        : sig.nextHorizonDays <= 14
                          ? "warning"
                          : undefined;
                  const horizonTypeLabel = sig?.nextHorizonField
                    ? horizonLabel(sig.nextHorizonField)
                    : null;
                  const horizonRelative =
                    sig?.nextHorizonDays != null
                      ? sig.nextHorizonDays < 0
                        ? `Overdue ${Math.abs(sig.nextHorizonDays)}d`
                        : sig.nextHorizonDays === 0
                          ? "Due today"
                          : sig.nextHorizonDays === 1
                            ? "Due tomorrow"
                            : `In ${sig.nextHorizonDays}d`
                      : null;
                  const cp = contract.counterparty?.trim();
                  const cpFallback =
                    !!cp &&
                    COUNTERPARTY_FALLBACK_TOKENS.has(cp.toLowerCase());
                  const type = contract.contract_type?.trim();
                  const typeFallback =
                    !!type &&
                    CONTRACT_TYPE_FALLBACK_TOKENS.has(type.toLowerCase());
                  return (
                    <tr key={contract.id} className="ui-table-row group">
                      {bulkActions ? (
                        // Inline padding — don't compose with bodyCellClass
                        // (which has px-3) since the later px-1.5 in
                        // composed Tailwind utilities loses to the earlier
                        // px-3 in the generated CSS. Standalone className
                        // ensures the checkbox cell matches the <th>
                        // padding exactly so the column aligns.
                        <td className="w-6 px-1.5 py-2 align-middle">
                          <input
                            type="checkbox"
                            className="ui-checkbox"
                            aria-label={`Select ${contract.title}`}
                            checked={selected.has(contract.id)}
                            onChange={() => toggle(contract.id)}
                          />
                        </td>
                      ) : null}
                      <td className={bodyCellClass}>
                        <div className="min-w-0">
                          <Link
                            href={`/contracts/${contract.id}`}
                            title={contract.title}
                            dir="auto"
                            className="block max-w-[28rem] truncate font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)] [unicode-bidi:isolate]"
                          >
                            {contract.title}
                          </Link>
                          {showContinuityLinks ? (
                            <div className="mt-1">
                              <ContractContinuityLinks
                                contractId={contract.id}
                                omit={["contract", "work"]}
                              />
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className={bodyCellClass}>
                        {!cp ? (
                          <Link
                            href={`/contracts/${contract.id}#counterparty`}
                            className={missingChipClass}
                            title="Counterparty not set"
                          >
                            Missing counterparty
                          </Link>
                        ) : (
                          <div className="min-w-0">
                            {/* Fallback values (Tenants/Vendor/Other) render
                                identically to real counterparty names — the
                                earlier tertiary tint read as visual
                                instability across rows. Title attr still
                                explains the data-quality issue on hover. */}
                            <span
                              className="block max-w-[14rem] truncate text-[var(--text-primary)]"
                              title={
                                cpFallback
                                  ? `Counterparty name missing — currently shows "${cp}"`
                                  : undefined
                              }
                            >
                              {cp}
                            </span>
                            {type ? (
                              <span
                                className="block max-w-[14rem] truncate text-[11px] text-[var(--text-tertiary)]"
                                title={
                                  typeFallback
                                    ? `Contract type unclassified — currently shows "${type}"`
                                    : undefined
                                }
                              >
                                {type}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className={bodyCellClass}>
                        {!owner || owner.isEmailFallback ? (
                          // Same outline chip shape as Counterparty
                          // missing / Missing dates so the row's "needs
                          // attention" cells scan as a single visual
                          // vocabulary, not a mix of CTA + chip + em-dash.
                          <Link
                            href={`/contracts/${contract.id}#ownership-record`}
                            className={missingChipClass}
                            title={
                              owner?.isEmailFallback
                                ? `Owner not set — only email on file (${owner.tooltip ?? ""})`
                                : "Owner not assigned"
                            }
                          >
                            Missing owner
                          </Link>
                        ) : (
                          <span
                            className="block max-w-[10rem] truncate text-[var(--text-primary)]"
                            title={owner.tooltip}
                          >
                            {owner.display}
                          </span>
                        )}
                      </td>
                      <td className={bodyCellClass}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Small filled status dot prefix — `bg-current`
                              inherits the pill's ink color so each status
                              carries a shape cue (dot + label) plus tone,
                              not tone alone (ui-design-principles §7.7).
                              The dot is the universal "status indicator"
                              shape; no icon-glyph ambiguity to interpret. */}
                          {/* Status dot with soft halo per
                              ui-design-principles §2.5 — `bg-current`
                              inherits the pill's ink, and the box-shadow
                              halo mixes the current color at low alpha
                              so each status has dot + halo + label +
                              tone (four cues stacked, not just tone). */}
                          <StatusBadge
                            status={
                              STATUS_SEMANTICS[contract.status] ??
                              STATUS_SEMANTICS.draft
                            }
                            className="gap-1.5"
                          >
                            <span
                              aria-hidden
                              className="inline-block h-1.5 w-1.5 rounded-full bg-current"
                              style={{
                                boxShadow:
                                  "0 0 0 2px color-mix(in oklab, currentColor 22%, transparent)",
                              }}
                            />
                            {STATUS_LABELS[contract.status] || contract.status}
                          </StatusBadge>
                          {sig?.openExceptionCount &&
                          sig.openExceptionCount > 0 ? (
                            <Link
                              href={`/contracts/exceptions?status=open&contract=${contract.id}`}
                              aria-label={`${sig.openExceptionCount} exception${sig.openExceptionCount === 1 ? "" : "s"}`}
                            >
                              <StatusBadge status="critical" className="gap-1.5">
                                <span
                                  aria-hidden
                                  className="inline-block h-1.5 w-1.5 rounded-full bg-current"
                                  style={{
                                    boxShadow:
                                      "0 0 0 2px color-mix(in oklab, currentColor 22%, transparent)",
                                  }}
                                />
                                {sig.openExceptionCount} exception
                                {sig.openExceptionCount === 1 ? "" : "s"}
                              </StatusBadge>
                            </Link>
                          ) : null}
                        </div>
                      </td>
                      <td className={`${bodyCellClass} tabular-nums`}>
                        {sig?.nextHorizonDate ? (
                          <div className="min-w-0">
                            <span
                              title={new Date(
                                sig.nextHorizonDate
                              ).toISOString()}
                              className="block truncate font-medium"
                              style={{
                                color:
                                  nextDateTone === "danger"
                                    ? "var(--danger-ink)"
                                    : nextDateTone === "warning"
                                      ? "var(--warning-ink)"
                                      : "var(--text-primary)",
                              }}
                            >
                              {horizonTypeLabel ? `${horizonTypeLabel} ` : ""}
                              {new Date(
                                sig.nextHorizonDate
                              ).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            {horizonRelative ? (
                              <span className="block text-[11px] text-[var(--text-tertiary)]">
                                {horizonRelative}
                              </span>
                            ) : null}
                          </div>
                        ) : sig?.missingCriticalDates ? (
                          <Link
                            href={`/contracts/${contract.id}#dates`}
                            aria-label="Critical contract dates missing"
                            className={missingChipClass}
                          >
                            Missing dates
                          </Link>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">—</span>
                        )}
                      </td>
                      <td className={`${bodyCellClass} tabular-nums`}>
                        {review ? (
                          // Outline chip (no fill) so review-state amber
                          // doesn't blur into the filled PENDING REVIEW
                          // status pill and the warning Missing chips.
                          // Fraction format (`1/2`, `2/2`) scales better
                          // than `2 of 2 reviewed` for large denominators.
                          <Link
                            href={review.href}
                            aria-label="Continue field review"
                            className={`inline-flex items-center gap-1 rounded-sm border bg-transparent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                              review.status === "healthy"
                                ? "border-[color:color-mix(in_oklab,var(--success-ink)_30%,var(--border-subtle))] text-[var(--success-ink)] hover:bg-[color:color-mix(in_oklab,var(--success-soft)_22%,transparent)]"
                                : "border-[color:color-mix(in_oklab,var(--warning-ink)_25%,var(--border-subtle))] text-[var(--warning-ink)] hover:bg-[color:color-mix(in_oklab,var(--warning-soft)_22%,transparent)]"
                            }`}
                          >
                            {review.status === "healthy" ? (
                              <CheckCheck
                                aria-hidden
                                className="h-3 w-3"
                                strokeWidth={2}
                              />
                            ) : (
                              <Hourglass
                                aria-hidden
                                className="h-3 w-3"
                                strokeWidth={2}
                              />
                            )}
                            {/* Parallel "X/Y verb" format across both
                                states — same shape, different verb. The
                                fraction X/Y reads as progress regardless
                                of state; the verb ("pending" vs
                                "reviewed") + tone (warning vs success)
                                signals which side of done the row is on. */}
                            {stats
                              ? stats.pending === 0
                                ? `${stats.approved}/${stats.total} reviewed`
                                : `${stats.pending}/${stats.total} pending`
                              : review.label}
                          </Link>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">—</span>
                        )}
                      </td>
                      <td className={`${bodyCellClass} tabular-nums`}>
                        {(sig?.openWorkCount ?? 0) > 0 ? (
                          // "N open" — caps + the WORK column header
                          // disambiguate from the row-level Open contract
                          // action. "N work" read as grammatically off
                          // (the chip carries a count + state, not a
                          // count + noun).
                          <Link
                            href={`/work?contract=${contract.id}`}
                            className="inline-flex items-center rounded-sm border border-[color:color-mix(in_oklab,var(--accent)_25%,var(--border-subtle))] bg-transparent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,transparent)]"
                          >
                            {sig?.openWorkCount} open
                          </Link>
                        ) : sig?.outstandingEvidenceCount &&
                            sig.outstandingEvidenceCount > 0 ? (
                          <Link
                            href={`/contracts/evidence-studio?contract=${contract.id}`}
                            className="inline-flex items-center rounded-sm border border-[color:color-mix(in_oklab,var(--warning-ink)_25%,var(--border-subtle))] bg-transparent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--warning-ink)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--warning-soft)_22%,transparent)]"
                          >
                            {sig.outstandingEvidenceCount} evidence
                          </Link>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">—</span>
                        )}
                      </td>
                      <td
                        className={`${bodyCellClass} tabular-nums`}
                        suppressHydrationWarning
                      >
                        {isValid(updatedDate) ? (
                          // Default `relative` format renders caps "10D"
                          // (tabular, tight) per ui-design-principles §2.6
                          // — the earlier `readable` format gave "10 d"
                          // which read as loose prose.
                          <span
                            className={
                              updatedStale
                                ? "text-[var(--text-tertiary)]"
                                : "text-[var(--text-secondary)]"
                            }
                          >
                            <TimeChip date={updatedDate} />
                          </span>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">—</span>
                        )}
                      </td>
                      <td className={`${bodyCellClass} w-20 px-2 text-right`}>
                        <div className="flex items-center justify-end gap-2">
                          {/* Visible at rest — release-state names Open
                              contract as the primary row action; hiding
                              it behind hover (per §8.6) made it
                              undiscoverable on touch / first-glance. The
                              small caps link has minimal chrome so it
                              doesn't compete with the row's other weight. */}
                          <Link
                            href={`/contracts/${contract.id}`}
                            aria-label={`Open contract: ${contract.title}`}
                            className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)] transition-colors hover:underline"
                          >
                            Open
                            <ChevronRight
                              className="h-2.5 w-2.5"
                              strokeWidth={2}
                              aria-hidden
                            />
                          </Link>
                          <RowActionsMenu
                            contractId={contract.id}
                            hasOwner={!!owner && !owner.isEmailFallback}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
      {footer}
    </div>
  );
}
