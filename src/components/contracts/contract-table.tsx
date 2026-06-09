"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isValid } from "date-fns";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ChevronRight,
  Hourglass,
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
import { RowActionMenu, RowActionMenuItem } from "@/components/ui/row-action-menu";
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

type CellChipTone = "danger" | "warning" | "success" | "neutral";

const CELL_CHIP_BASE =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md border bg-transparent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

const CELL_CHIP_TONE: Record<CellChipTone, string> = {
  danger:
    "border-[color:color-mix(in_oklab,var(--danger-ink)_30%,var(--border-subtle))] text-[var(--danger-ink)] hover:bg-[color:color-mix(in_oklab,var(--danger-soft)_20%,transparent)]",
  warning:
    "border-[color:color-mix(in_oklab,var(--warning-ink)_26%,var(--border-subtle))] text-[var(--warning-ink)] hover:bg-[color:color-mix(in_oklab,var(--warning-soft)_22%,transparent)]",
  success:
    "border-[color:color-mix(in_oklab,var(--success-ink)_30%,var(--border-subtle))] text-[var(--success-ink)] hover:bg-[color:color-mix(in_oklab,var(--success-soft)_22%,transparent)]",
  neutral:
    "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] hover:text-[var(--accent-strong)]",
};

function CellChip({
  href,
  tone,
  dashed,
  ariaLabel,
  title,
  children,
}: {
  href: string;
  tone: CellChipTone;
  dashed?: boolean;
  ariaLabel?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      title={title}
      className={`${CELL_CHIP_BASE} ${CELL_CHIP_TONE[tone]}${dashed ? " border-dashed" : ""}`}
    >
      {children}
    </Link>
  );
}

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
  // Shared dense-row overflow menu (32px trigger, portaled, reserved icon slots,
  // standard width) — the one row-action family across Contracts/Work/Renewals/
  // Evidence. Replaces the bespoke inline DropdownMenu so the contracts kebab
  // can no longer drift from the other surfaces.
  const iconClass = "h-3.5 w-3.5 shrink-0";
  return (
    <RowActionMenu menuLabel="Contract row actions" triggerLabel="Row actions">
      <RowActionMenuItem
        href={`/contracts/${contractId}#ownership-record`}
        icon={
          hasOwner ? (
            <UserCog className={iconClass} strokeWidth={1.85} aria-hidden />
          ) : (
            <UserPlus className={iconClass} strokeWidth={1.85} aria-hidden />
          )
        }
      >
        {hasOwner ? "Reassign owner" : "Assign owner"}
      </RowActionMenuItem>
      <RowActionMenuItem
        href={`/contracts/${contractId}#extracted-fields`}
        icon={<CheckCheck className={iconClass} strokeWidth={1.85} aria-hidden />}
      >
        Confirm details
      </RowActionMenuItem>
      <RowActionMenuItem
        href={`/contracts/${contractId}#dates`}
        icon={<Bell className={iconClass} strokeWidth={1.85} aria-hidden />}
      >
        Add reminder
      </RowActionMenuItem>
      <RowActionMenuItem
        href={`/contracts/${contractId}#contract-tasks`}
        icon={<Plus className={iconClass} strokeWidth={1.85} aria-hidden />}
      >
        Create task
      </RowActionMenuItem>
    </RowActionMenu>
  );
}

// Structured row-action affordance (§8.6 / §11.22): a bordered accent chip that
// telegraphs intent, revealed on row hover or keyboard focus so a full column of
// always-on "OPEN" pills doesn't add noise. The contract name is already the
// primary link; this chip just confirms the row is openable. Desktop-only — the
// mobile cards make the whole title the tap target.
function OpenContractChip({
  contractId,
  title,
}: {
  contractId: string;
  title: string;
}) {
  return (
    <Link
      href={`/contracts/${contractId}`}
      aria-label={`Open contract: ${title}`}
      className="group/open inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_24%,var(--surface-raised))] px-2 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--accent-strong)] opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_46%,var(--surface-raised))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      Open
      <ChevronRight
        className="h-3 w-3 transition-transform group-hover/open:translate-x-0.5"
        strokeWidth={2}
        aria-hidden
      />
    </Link>
  );
}

// Issue flag for the status column. Mirrors the lifecycle StatusBadge's
// 22px rounded-full silhouette so the two read as one chip family, and pairs an
// icon with the count (never a bare colored pill — §7.7) behind a descriptive
// accessible name. The danger-soft tint matches `.ui-status-badge-critical`
// rather than a saturated alert red, so a single open flag doesn't shout.
function ExceptionAlertChip({
  contractId,
  count,
}: {
  contractId: string;
  count: number;
}) {
  return (
    <Link
      href={`/contracts/exceptions?status=open&contract=${contractId}`}
      aria-label={`${count} issue${count === 1 ? "" : "s"}`}
      title={`${count} open issue${count === 1 ? "" : "s"}`}
      className="inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full border px-2 text-[10.5px] font-semibold uppercase leading-none tracking-[0.1em] tabular-nums transition-colors border-[color:color-mix(in_oklab,var(--danger-soft)_52%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger-soft)_50%,transparent)] text-[var(--danger-ink)] hover:bg-[color:color-mix(in_oklab,var(--danger-soft)_78%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden />
      <span className="tabular-nums">{count}</span>
    </Link>
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
  // Viewport gate for the table↔cards swap. We render ONE layout (not both
  // behind `hidden`/`md:hidden`) so there is a single set of row controls —
  // duplicate-DOM would double the checkboxes/links and break unit tests that
  // query globally. Default to the narrow cards for SSR so the desktop table's
  // intrinsic width cannot widen mobile documents before hydration; wide
  // clients promote to the table immediately after mount.
  const [isNarrow, setIsNarrow] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function")
      return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

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
        reason="Upload an agreement so Oblixa can suggest dates and build your operational record."
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
      // `warning` — pending review is "needs attention", not a primary action.
      return {
        status: "warning" as const,
        href: `/contracts/${contractId}#extracted-fields`,
      };
    }
    return {
      status: "success" as const,
      href: `/contracts/${contractId}#extracted-fields`,
    };
  };

  const headerCellClass =
    "px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)] whitespace-nowrap";
  const bodyCellClass = "px-3 py-2.5 align-middle";
  const selectionCellClass =
    "box-border w-[3.25rem] min-w-[3.25rem] max-w-[3.25rem] pl-4 pr-2 align-middle";

  // Precompute a per-row view model once so the desktop table rows and the
  // md:hidden mobile cards render from a single source (no divergence) and the
  // per-render clock is sampled once.
  // eslint-disable-next-line react-hooks/purity -- per-render clock used to compute Updated freshness gating
  const renderNow = Date.now();
  const FRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  const rowModels = contracts.map((contract) => {
    const stats = reviewStats?.[contract.id];
    const sig = rowSignals?.[contract.id];
    const updatedDate = new Date(contract.updated_at);
    const updatedStale =
      isValid(updatedDate) && renderNow - updatedDate.getTime() > FRESH_WINDOW_MS;
    const owner = ownerDisplay(contract);
    const review = reviewState(contract.id);
    // Two-tier urgency on Next important date: past-due → danger, ≤14 days →
    // warning, else neutral.
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
    const cpFallback = !!cp && COUNTERPARTY_FALLBACK_TOKENS.has(cp.toLowerCase());
    const type = contract.contract_type?.trim();
    const typeFallback =
      !!type && CONTRACT_TYPE_FALLBACK_TOKENS.has(type.toLowerCase());
    return {
      contract,
      stats,
      sig,
      updatedDate,
      updatedStale,
      owner,
      review,
      nextDateTone,
      horizonTypeLabel,
      horizonRelative,
      cp,
      cpFallback,
      type,
      typeFallback,
    };
  });

  type RowModel = (typeof rowModels)[number];

  const nextDateColor = (tone: "danger" | "warning" | undefined) =>
    tone === "danger"
      ? "var(--danger-ink)"
      : tone === "warning"
        ? "var(--warning-ink)"
        : "var(--text-primary)";

  const reviewChipText = (m: RowModel) =>
    m.stats
      ? m.stats.pending === 0
        ? `${m.stats.approved}/${m.stats.total} confirmed`
        : `${m.stats.pending}/${m.stats.total} pending`
      : "";

  return (
    // Bare inner frame — the page's <DataSurfaceCard> is now the one card
    // surface, so this no longer carries its own .ui-table-shell (that would be
    // card-within-card, §10.5). The selection bar below is a top band, not a
    // nested card, for the same reason.
    <div className="min-w-0">
      {bulkActions && selectedList.length > 0 ? (
        <div
          className="flex flex-col gap-3 border-b border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col gap-1">
            <p className="inline-flex items-center gap-2 text-[12.5px] font-semibold tracking-tight tabular-nums text-[var(--text-primary)]">
              <span
                aria-hidden
                className="inline-flex h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--accent)" }}
              />
              {selectedList.length} selected
            </p>
            {hiddenSelectedCount > 0 ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] tabular-nums text-[var(--text-tertiary)]">
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

      {/* §7.5 canonical table treatment — the inventory sits inside a
          .ui-table-shell card (rounded border + soft gradient + shadow) so it
          reads as the page's single focal surface. Desktop renders the table;
          a md:hidden card list takes over on narrow screens. The shell's
          bottom edge closes the frame even when pagination is hidden. */}
      <div data-testid={surfaceTestIds.contractsTable} className="min-w-0 max-w-full">
        {!isNarrow ? (
          <div className="max-w-full overflow-x-auto [contain:inline-size]">
          <table
            className="w-full border-collapse text-[12.5px]"
            aria-label="Contracts in this workspace"
          >
            <thead className="bg-[color:color-mix(in_oklab,var(--surface-muted)_82%,var(--surface-raised))]">
              <tr className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)]">
                {bulkActions ? (
                  // Dedicated selection gutter: explicit left padding keeps the
                  // checkbox off the card border even when table auto-layout or
                  // browser zoom compresses the first column.
                  <th scope="col" className={`${selectionCellClass} py-2`}>
                    <div className="flex items-center justify-start">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        className="ui-checkbox"
                        aria-label="Select all contracts on this page"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                      />
                    </div>
                    <span className="sr-only">Select all on page</span>
                  </th>
                ) : null}
                <th scope="col" className={`${headerCellClass} min-w-[15rem]`}>
                  Contract
                </th>
                <th scope="col" className={`${headerCellClass} min-w-[10rem]`}>
                  Counterparty
                </th>
                <th scope="col" className={`${headerCellClass} min-w-[7rem]`}>
                  Owner
                </th>
                <th scope="col" className={`${headerCellClass} min-w-[9.5rem]`}>
                  Status
                </th>
                {/* Short visible labels keep the header row on one line at
                    operational widths; aria-label carries the full spec name
                    from oblixa-release-state.md so screen readers and surface
                    tests still see the canonical string. */}
                <th
                  scope="col"
                  aria-label="Next important date"
                  className={`${headerCellClass} min-w-[8rem]`}
                >
                  Next date
                </th>
                <th
                  scope="col"
                  aria-label="Review state"
                  className={`${headerCellClass} min-w-[7.5rem]`}
                >
                  Review
                </th>
                <th
                  scope="col"
                  aria-label="Open tasks"
                  className={`${headerCellClass} min-w-[5.5rem]`}
                >
                  Tasks
                </th>
                <th
                  scope="col"
                  aria-label="Last updated"
                  className={`${headerCellClass} min-w-[5rem]`}
                >
                  Updated
                </th>
                <th scope="col" className="w-[6.5rem] px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rowModels.map((m) => {
                const contract = m.contract;
                const isSelected = !!bulkActions && selected.has(contract.id);
                return (
                  <tr
                    key={contract.id}
                    className={`ui-table-row group${isSelected ? " ui-table-row-selected" : ""}`}
                  >
                    {bulkActions ? (
                      // Same gutter as the header cell so the select-all and
                      // per-row checkboxes share one stable x-axis.
                      <td className={`${selectionCellClass} py-2.5`}>
                        <div className="flex items-center justify-start">
                          <input
                            type="checkbox"
                            className="ui-checkbox"
                            aria-label={`Select ${contract.title}`}
                            checked={selected.has(contract.id)}
                            onChange={() => toggle(contract.id)}
                          />
                        </div>
                      </td>
                    ) : null}
                    <td className={bodyCellClass}>
                      <div className="min-w-0">
                        <Link
                          href={`/contracts/${contract.id}`}
                          title={contract.title}
                          dir="auto"
                          className="block truncate font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)] [unicode-bidi:isolate]"
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
                      {!m.cp ? (
                        <CellChip
                          href={`/contracts/${contract.id}#counterparty`}
                          tone="warning"
                          dashed
                          title="Counterparty not set"
                        >
                          Missing counterparty
                        </CellChip>
                      ) : (
                        <div className="min-w-0">
                          {/* Fallback values (Tenants/Vendor/Other) render
                              identically to real names — a tertiary tint read
                              as instability across rows. Title still explains
                              the data-quality issue on hover. */}
                          <span
                            className="block truncate text-[var(--text-primary)]"
                            title={
                              m.cpFallback
                                ? `Counterparty name missing — currently shows "${m.cp}"`
                                : undefined
                            }
                          >
                            {m.cp}
                          </span>
                          {m.type ? (
                            <span
                              className="block truncate text-[11px] text-[var(--text-tertiary)]"
                              title={
                                m.typeFallback
                                  ? `Contract type unclassified — currently shows "${m.type}"`
                                  : undefined
                              }
                            >
                              {m.type}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className={bodyCellClass}>
                      {!m.owner || m.owner.isEmailFallback ? (
                        // Same dashed "data gap" chip vocabulary as the other
                        // missing cells so the owner column doesn't swap a name
                        // for an odd status-looking pill.
                        <CellChip
                          href={`/contracts/${contract.id}#ownership-record`}
                          tone="warning"
                          dashed
                          title={
                            m.owner?.isEmailFallback
                              ? `Owner not set — only email on file (${m.owner.tooltip ?? ""})`
                              : "Owner not assigned"
                          }
                        >
                          Missing owner
                        </CellChip>
                      ) : (
                        <span
                          className="block truncate text-[var(--text-primary)]"
                          title={m.owner.tooltip}
                        >
                          {m.owner.display}
                        </span>
                      )}
                    </td>
                    <td className={bodyCellClass}>
                      {/* Lifecycle StatusBadge on the left; the exception flag
                          sits in a reserved slot at the right edge of the column
                          (justify-between). Every cell in this column shares one
                          width, so the flags line up vertically and a row without
                          one never reflows the badge. Single line — no flex-wrap —
                          so a second signal can't push the row to two. */}
                      <div className="flex items-center justify-between gap-2">
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
                        {m.sig?.openExceptionCount &&
                        m.sig.openExceptionCount > 0 ? (
                          <ExceptionAlertChip
                            contractId={contract.id}
                            count={m.sig.openExceptionCount}
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className={`${bodyCellClass} tabular-nums`}>
                      {m.sig?.nextHorizonDate ? (
                        <div className="min-w-0">
                          {/* Type reads as a quiet caps label (RENEWAL / END /
                              NOTICE), the date as the bold value — weight + case
                              gradation separates them without two literal pills
                              (§10.8), keeping the column scannable, not noisy. */}
                          <span className="flex items-baseline gap-1.5">
                            {m.horizonTypeLabel ? (
                              <span className="ui-caps-3 shrink-0 text-[9.5px] text-[var(--text-tertiary)]">
                                {m.horizonTypeLabel}
                              </span>
                            ) : null}
                            <span
                              title={new Date(m.sig.nextHorizonDate).toISOString()}
                              className="truncate text-[12.5px] font-semibold tabular-nums"
                              style={{ color: nextDateColor(m.nextDateTone) }}
                            >
                              {new Date(m.sig.nextHorizonDate).toLocaleDateString(
                                undefined,
                                { month: "short", day: "numeric" }
                              )}
                            </span>
                          </span>
                          {m.horizonRelative ? (
                            // Horizon caption bumped tertiary → secondary so it
                            // stays legible (still clearly below the date);
                            // urgency tone only when the deadline is near or past.
                            <span
                              className="mt-0.5 block text-[11px] tabular-nums"
                              style={{
                                color:
                                  m.nextDateTone === "danger"
                                    ? "var(--danger-ink)"
                                    : m.nextDateTone === "warning"
                                      ? "var(--warning-ink)"
                                      : "var(--text-secondary)",
                              }}
                            >
                              {m.horizonRelative}
                            </span>
                          ) : null}
                        </div>
                      ) : m.sig?.missingCriticalDates ? (
                        <CellChip
                          href={`/contracts/${contract.id}#dates`}
                          tone="warning"
                          dashed
                          ariaLabel="Critical contract dates missing"
                        >
                          Missing dates
                        </CellChip>
                      ) : (
                        <span className="text-[var(--text-tertiary)]">—</span>
                      )}
                    </td>
                    <td className={`${bodyCellClass} tabular-nums`}>
                      {m.review ? (
                        <CellChip
                          href={m.review.href}
                          tone={m.review.status === "success" ? "success" : "warning"}
                          ariaLabel="Continue detail confirmation"
                        >
                          {m.review.status === "success" ? (
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
                          {/* Parallel "X/Y verb" — fraction reads as progress;
                              verb + tone signal which side of done it is on. */}
                          <span className="tabular-nums">{reviewChipText(m)}</span>
                        </CellChip>
                      ) : (
                        <span className="text-[var(--text-tertiary)]">—</span>
                      )}
                    </td>
                    <td className={`${bodyCellClass} tabular-nums`}>
                      {(m.sig?.openWorkCount ?? 0) > 0 ? (
                        // Neutral — open tasks should not carry the same tonal
                        // weight as an issue or pending confirmation unless urgent.
                        <CellChip
                          href={`/work?contract=${contract.id}`}
                          tone="neutral"
                        >
                          {m.sig?.openWorkCount} open
                        </CellChip>
                      ) : m.sig?.outstandingEvidenceCount &&
                        m.sig.outstandingEvidenceCount > 0 ? (
                        <CellChip
                          href={`/evidence?contract=${contract.id}`}
                          tone="warning"
                        >
                          {/* Count + word as adjacent text nodes (no inner
                              span) so getByText("N evidence") resolves; the
                              chip base already supplies tabular-nums. */}
                          {m.sig.outstandingEvidenceCount} evidence
                        </CellChip>
                      ) : (
                        <span className="text-[var(--text-tertiary)]">—</span>
                      )}
                    </td>
                    <td
                      className={`${bodyCellClass} tabular-nums`}
                      suppressHydrationWarning
                    >
                      {isValid(m.updatedDate) ? (
                        <span
                          className={
                            m.updatedStale
                              ? "text-[var(--text-tertiary)]"
                              : "text-[var(--text-secondary)]"
                          }
                        >
                          <TimeChip date={m.updatedDate} />
                        </span>
                      ) : (
                        <span className="text-[var(--text-tertiary)]">—</span>
                      )}
                    </td>
                    <td className={`${bodyCellClass} w-[6.5rem]`}>
                      <div className="flex items-center justify-end gap-1.5">
                        <OpenContractChip
                          contractId={contract.id}
                          title={contract.title}
                        />
                        <RowActionsMenu
                          contractId={contract.id}
                          hasOwner={!!m.owner && !m.owner.isEmailFallback}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        ) : (
          /* Mobile: compact contract cards — the dense 9-column table doesn't
             fit narrow viewports, and horizontally scrolling it is hostile.
             Same data + operational signals, single-column card layout. */
          <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)]">
          {rowModels.map((m) => {
            const contract = m.contract;
            const isSelected = !!bulkActions && selected.has(contract.id);
            return (
              <li
                key={contract.id}
                className={`px-4 py-3 ${isSelected ? "bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)]" : ""}`}
              >
                {/* Center the leading checkbox + trailing kebab against the whole
                    card — was items-start + mt-0.5, which top-anchored the checkbox
                    to the title so it floated high in a tall card. Title /
                    counterparty / chips stack in the middle column. */}
                <div className="flex items-center gap-2.5">
                  {bulkActions ? (
                    <input
                      type="checkbox"
                      className="ui-checkbox"
                      aria-label={`Select ${contract.title}`}
                      checked={selected.has(contract.id)}
                      onChange={() => toggle(contract.id)}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/contracts/${contract.id}`}
                      aria-label={`Open contract: ${contract.title}`}
                      title={contract.title}
                      dir="auto"
                      className="block min-w-0 truncate text-[13.5px] font-semibold text-[var(--text-primary)] [unicode-bidi:isolate]"
                    >
                      {contract.title}
                    </Link>
                    <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-tertiary)]">
                      {m.cp ? m.cp : "Missing counterparty"}
                      {m.type ? ` · ${m.type}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {/* Status + its exception flag stay welded together so they
                          can't wrap onto separate lines as an awkward stack; the
                          remaining signal chips wrap after this unit. */}
                      <span className="inline-flex items-center gap-1.5">
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
                        {m.sig?.openExceptionCount && m.sig.openExceptionCount > 0 ? (
                          <ExceptionAlertChip
                            contractId={contract.id}
                            count={m.sig.openExceptionCount}
                          />
                        ) : null}
                      </span>
                      {!m.owner || m.owner.isEmailFallback ? (
                        <CellChip
                          href={`/contracts/${contract.id}#ownership-record`}
                          tone="warning"
                          dashed
                        >
                          Missing owner
                        </CellChip>
                      ) : null}
                      {m.sig?.nextHorizonDate ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none tabular-nums"
                          style={{ color: nextDateColor(m.nextDateTone) }}
                        >
                          {m.horizonTypeLabel ? `${m.horizonTypeLabel} ` : ""}
                          {new Date(m.sig.nextHorizonDate).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric" }
                          )}
                        </span>
                      ) : m.sig?.missingCriticalDates ? (
                        <CellChip
                          href={`/contracts/${contract.id}#dates`}
                          tone="warning"
                          dashed
                          ariaLabel="Critical contract dates missing"
                        >
                          Missing dates
                        </CellChip>
                      ) : null}
                      {m.review ? (
                        <CellChip
                          href={m.review.href}
                          tone={m.review.status === "success" ? "success" : "warning"}
                          ariaLabel="Continue detail confirmation"
                        >
                          {m.review.status === "success" ? (
                            <CheckCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
                          ) : (
                            <Hourglass aria-hidden className="h-3 w-3" strokeWidth={2} />
                          )}
                          <span className="tabular-nums">{reviewChipText(m)}</span>
                        </CellChip>
                      ) : null}
                      {(m.sig?.openWorkCount ?? 0) > 0 ? (
                        <CellChip href={`/work?contract=${contract.id}`} tone="neutral">
                          <span className="tabular-nums">{m.sig?.openWorkCount}</span> open
                        </CellChip>
                      ) : m.sig?.outstandingEvidenceCount &&
                        m.sig.outstandingEvidenceCount > 0 ? (
                        <CellChip
                          href={`/evidence?contract=${contract.id}`}
                          tone="warning"
                        >
                          <span className="tabular-nums">
                            {m.sig.outstandingEvidenceCount}
                          </span>{" "}
                          evidence
                        </CellChip>
                      ) : null}
                    </div>
                  </div>
                  <RowActionsMenu
                    contractId={contract.id}
                    hasOwner={!!m.owner && !m.owner.isEmailFallback}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        )}

        {footer}
      </div>
    </div>
  );
}
