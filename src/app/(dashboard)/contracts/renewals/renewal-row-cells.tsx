import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  CircleDashed,
  CircleUserRound,
  Clock,
  Eye,
  type LucideIcon,
} from "lucide-react";
import {
  RENEWAL_OWNER_MISSING_HELP,
  RENEWAL_ROW_LABELS,
  RENEWAL_SECONDARY_ACTION_LABELS,
  renewalNoticeBasis,
} from "@/lib/renewals/spec-strings";
import type {
  RenewalConsequenceTone,
  RenewalRow,
  RenewalStatus,
} from "@/lib/renewals/types";
import { RenewalActionCluster } from "./renewal-action-cluster";
import type { RenewalFormAction } from "./renewals-page-types";

export { RenewalDateCell } from "./renewal-date-cell";

export function RenewalContractCell({ row, titleId }: { row: RenewalRow; titleId: string }) {
  const tone = row.consequence.tone;
  // The record cell carries the row's weight: a strong contract name set in
  // record-sheet ink, the counterparty named inline beneath it, and the
  // operational consequence set off by a toned rule so a reader sees what is true
  // and what is at stake before scanning the date chain. Risk tones
  // (danger/warning) wear the rule; calm states read as quiet secondary text.
  // Routine cross-object links are demoted into the row disclosure so the record
  // block stays a clean name + consequence, not a chip cluster.
  const consequenceColor = consequenceInk(tone);
  const ruled = tone === "danger" || tone === "warning";
  return (
    <div className="min-w-0">
      <p className="ui-caps-3 mb-1.5 block text-[10.5px] text-[var(--text-tertiary)] xl:sr-only">
        {RENEWAL_ROW_LABELS.contract}
      </p>
      <Link
        href={row.href}
        id={titleId}
        title={row.title}
        className="ui-chip-focus line-clamp-2 break-words text-[15.5px] font-semibold leading-[1.22] tracking-[-0.01em] text-[var(--text-primary)] underline-offset-[3px] decoration-from-font transition-colors hover:text-[var(--accent-strong)] hover:underline"
      >
        {row.title}
      </Link>
      <p className="mt-1 truncate text-[12.5px] leading-snug text-[var(--text-secondary)]" title={row.counterparty}>
        <span className="text-[var(--text-tertiary)]">{RENEWAL_ROW_LABELS.counterparty}: </span>
        {row.counterparty}
      </p>
      <p
        className={`mt-2 text-[12px] font-medium leading-snug ${ruled ? "border-l-2 pl-2.5" : ""}`}
        style={{
          color: consequenceColor,
          borderColor: ruled ? `color-mix(in oklab, ${consequenceColor} 60%, transparent)` : undefined,
        }}
      >
        {row.consequence.label}
      </p>
    </div>
  );
}

function consequenceInk(tone: RenewalConsequenceTone): string {
  if (tone === "danger") return "var(--danger-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "success") return "var(--success-ink)";
  return "var(--text-secondary)";
}

export function RenewalOwnerCell({ row }: { row: RenewalRow }) {
  if (row.ownerUserId) {
    const initial = row.ownerLabel.trim().charAt(0).toUpperCase() || "?";
    return (
      <span className="flex w-full min-w-0 max-w-full items-center gap-1.5 overflow-hidden">
        <span
          aria-hidden
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_72%,var(--surface-raised))] text-[10px] font-semibold leading-none text-[var(--text-secondary)]"
        >
          {initial}
        </span>
        <span className="block min-w-0 flex-1 truncate text-[13px] leading-snug text-[var(--text-primary)]" title={row.ownerLabel}>
          {row.ownerLabel}
        </span>
      </span>
    );
  }
  return (
    <span className="flex flex-col gap-1">
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className="ui-caps-3 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] leading-none"
          style={{
            borderColor: "color-mix(in oklab, var(--warning-ink) 30%, var(--border-subtle))",
            background: "color-mix(in oklab, var(--warning-soft) 26%, var(--surface-raised))",
            color: "var(--warning-ink)",
          }}
        >
          <CircleUserRound className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
          Unassigned
        </span>
        <Link
          href={`/contracts/${row.id}`}
          className="ui-chip-focus inline-flex items-center gap-0.5 whitespace-nowrap rounded-md px-1 py-0.5 text-[12px] font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)]"
        >
          {RENEWAL_SECONDARY_ACTION_LABELS.assign_owner}
          <ArrowRight className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
        </Link>
      </span>
      <span className="text-[10.5px] leading-snug text-[var(--text-tertiary)]">{RENEWAL_OWNER_MISSING_HELP}</span>
    </span>
  );
}

const RENEWAL_STATUS_ICON: Record<RenewalStatus, LucideIcon> = {
  needs_owner: CircleUserRound,
  needs_review: Eye,
  notice_window_open: BellRing,
  in_progress: Clock,
  completed: CheckCircle2,
  no_renewal_action_needed: CircleDashed,
};

// Renewal status reads as a compact icon + label that WRAPS within the narrow
// status column \u2014 never a fixed-height nowrap badge that overflows into the next
// action (the "Renewal task active" overlap), and quieter than a filled chip so
// the urgent date and next action carry the row (\u00a716 status, \u00a7critique reduce
// badge noise). Tone ink still separates risk states from calm ones.
function renewalStatusInk(status: RenewalStatus): string {
  if (status === "completed") return "var(--success-ink)";
  if (status === "no_renewal_action_needed") return "var(--text-tertiary)";
  if (status === "in_progress") return "var(--text-secondary)";
  return "var(--warning-ink)"; // needs_review, notice_window_open
}

export function RenewalStatusBadge({ row }: { row: RenewalRow }) {
  const Icon = RENEWAL_STATUS_ICON[row.status];
  if (row.status === "needs_owner") {
    return (
      <span className="inline-flex items-center text-[13px] leading-snug text-[var(--text-tertiary)]" title="Owner needed - see the Owner column">
        <span aria-hidden>{"\u2014"}</span>
        <span className="sr-only">{row.statusLabel}</span>
      </span>
    );
  }
  // Sentence-case value (not a column header): the status reads as plain
  // legible operational text with a glyph + tone ink, so it never competes with
  // the uppercase register labels above it (§16 — fewer shouting micro-pills).
  return (
    <span
      className="inline-flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold leading-tight"
      style={{ color: renewalStatusInk(row.status) }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden />
      <span>{row.statusLabel}</span>
    </span>
  );
}

export function RenewalNextActionCell({
  row,
  canMutate,
  returnTo,
  updateRenewalAction,
}: {
  row: RenewalRow;
  canMutate: boolean;
  returnTo: string;
  updateRenewalAction: RenewalFormAction;
}) {
  // The closing end of the disposition band (see RenewalFact): same cool
  // inspection wash + hairline, rounded on the right so the owner → status →
  // action trio reads as one ruled register subregion. The action chip stays
  // cobalt (actions only); the wash never tints it.
  return (
    <div className="min-w-0 xl:-my-1.5 xl:flex xl:flex-col xl:items-end xl:justify-center xl:self-stretch xl:rounded-r-[5px] xl:border-y xl:border-r xl:border-[color:color-mix(in_oklab,var(--calculated-ink)_24%,var(--border-subtle))] xl:bg-[color:color-mix(in_oklab,var(--surface-cool)_46%,var(--surface-raised))] xl:px-2.5 xl:py-1.5 xl:text-right">
      <p className="ui-caps-3 mb-1.5 block text-[10.5px] text-[var(--text-tertiary)] xl:sr-only">
        {RENEWAL_ROW_LABELS.nextAction}
      </p>
      <div className="flex min-w-0 items-center gap-1.5 xl:justify-end">
        {row.status !== "no_renewal_action_needed" && row.status !== "needs_owner" ? (
          <Link
            href={row.nextActionHref}
            className="ui-chip-focus inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[12.5px] font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)]"
          >
            {row.nextActionLabel}
            <ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          </Link>
        ) : null}
        <RenewalActionCluster
          actions={row.actions}
          canMutate={canMutate}
          returnTo={returnTo}
          contractTitle={row.title}
          contractHref={row.href}
          updateRenewalAction={updateRenewalAction}
        />
      </div>
    </div>
  );
}

// The owner / renewal-status / next-action columns form the row's DISPOSITION
// cluster — who holds it, where it stands, and what to do next. On wide
// viewports they sit on a shared cool inspection wash (`--surface-cool`) with a
// hairline top/bottom rule, so the right of the row reads as one ruled register
// subregion rather than three floating text columns. `edge` rounds the open
// (owner) and close (action) ends so the three cells read as a single band even
// across the grid gap. Below xl the wash drops away and each fact stacks with
// its own label, as before.
// `xl:self-stretch` pulls each pane cell to the row's full height (set by the
// taller record/date cells), so the three blocks share a flush top and bottom
// and read as one continuous band rather than three ragged tiles.
const DISPOSITION_PANE =
  "xl:self-stretch xl:bg-[color:color-mix(in_oklab,var(--surface-cool)_46%,var(--surface-raised))] xl:border-y xl:border-[color:color-mix(in_oklab,var(--calculated-ink)_24%,var(--border-subtle))] xl:px-2.5 xl:py-1.5 xl:-my-1.5";

export function RenewalFact({
  label,
  children,
  pane,
  edge,
}: {
  label: string;
  children: ReactNode;
  /** Render on the shared disposition wash at xl. */
  pane?: boolean;
  /** Round the open ("start") or close ("end") end of the disposition band. */
  edge?: "start" | "end";
}) {
  const edgeClass =
    edge === "start"
      ? "xl:rounded-l-[5px] xl:border-l xl:border-l-[color:color-mix(in_oklab,var(--calculated-ink)_24%,var(--border-subtle))]"
      : "";
  // In the band, vertically center the fact so the owner avatar / status glyph
  // sit on the same optical line across the three blocks.
  const paneInner = pane ? "xl:flex xl:flex-col xl:justify-center" : "";
  return (
    <div className={`min-w-0 ${paneInner} ${pane ? `${DISPOSITION_PANE} ${edgeClass}` : ""}`.trim()}>
      <p className="ui-caps-3 mb-1.5 block text-[10.5px] text-[var(--text-tertiary)] xl:sr-only">{label}</p>
      <div className="break-words text-[13px] leading-snug text-[var(--text-primary)]">{children}</div>
    </div>
  );
}

export { renewalNoticeBasis };
