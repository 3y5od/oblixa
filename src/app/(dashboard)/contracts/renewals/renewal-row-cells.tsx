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
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
import { DateProvenanceBadge } from "@/components/ui/date-provenance-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  RENEWAL_DATE_REVIEW_HINTS,
  RENEWAL_DATE_REVIEW_LABELS,
  RENEWAL_OWNER_MISSING_HELP,
  RENEWAL_ROW_LABELS,
  RENEWAL_SECONDARY_ACTION_LABELS,
  renewalNoticeBasis,
} from "@/lib/renewals/spec-strings";
import type {
  RenewalConsequenceTone,
  RenewalDateReviewState,
  RenewalRow,
  RenewalStatus,
} from "@/lib/renewals/types";
import { RenewalActionCluster } from "./renewal-action-cluster";
import { REVIEW_TO_PROVENANCE } from "./renewals-ledger-constants";
import type { RenewalFormAction } from "./renewals-page-types";

export function RenewalContractCell({ row, titleId }: { row: RenewalRow; titleId: string }) {
  return (
    <div className="min-w-0">
      <p className="ui-caps-3 mb-1.5 block text-[10.5px] text-[var(--text-tertiary)] xl:sr-only">
        {RENEWAL_ROW_LABELS.contract}
      </p>
      <Link
        href={row.href}
        id={titleId}
        title={row.title}
        className="ui-chip-focus line-clamp-2 break-words text-[14px] font-semibold leading-snug text-[var(--text-primary)] underline-offset-[3px] decoration-from-font transition-colors hover:text-[var(--accent-strong)] hover:underline"
      >
        {row.title}
      </Link>
      <p className="mt-0.5 truncate text-[12px] leading-snug text-[var(--text-tertiary)]" title={row.counterparty}>
        <span className="sr-only">{RENEWAL_ROW_LABELS.counterparty}: </span>
        {row.counterparty}
      </p>
      <p
        className="mt-1.5 text-[12px] font-medium leading-snug"
        style={{ color: consequenceInk(row.consequence.tone) }}
      >
        {row.consequence.label}
      </p>
      <ContractContinuityLinks
        contractId={row.id}
        omit={["contract", "renewals"]}
        label="Related"
        maxVisible={1}
        className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1 text-[11px] text-[var(--text-tertiary)]"
      />
    </div>
  );
}

function consequenceInk(tone: RenewalConsequenceTone): string {
  if (tone === "danger") return "var(--danger-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "success") return "var(--success-ink)";
  return "var(--text-secondary)";
}

export function RenewalDateCell({
  label,
  dateLabel,
  days,
  review,
  basis,
}: {
  label: string;
  dateLabel: string;
  days: number | null;
  review: RenewalDateReviewState;
  basis: string | null;
}) {
  const empty = review === "missing";
  return (
    <div className="min-w-0">
      <p className="ui-caps-3 mb-1.5 block text-[10.5px] text-[var(--text-tertiary)] xl:sr-only">{label}</p>
      <p
        className={`text-[13px] leading-snug tabular-nums ${
          empty ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"
        }`}
      >
        {dateLabel}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-y-1">
        {days != null ? (
          <>
            <RenewalDueChip days={days} />
            <span className="ui-rule-vert" aria-hidden />
          </>
        ) : null}
        <DateProvenanceBadge
          state={REVIEW_TO_PROVENANCE[review]}
          label={RENEWAL_DATE_REVIEW_LABELS[review]}
          hint={RENEWAL_DATE_REVIEW_HINTS[review]}
          srPrefix={label}
        />
      </div>
      {basis ? (
        <p className="mt-1 max-w-[16rem] text-[10px] leading-snug text-[var(--text-tertiary)]">{basis}</p>
      ) : null}
    </div>
  );
}

function RenewalDueChip({ days }: { days: number | null }) {
  if (days == null) return null;
  const overdue = days < 0;
  const near = days >= 0 && days <= 14;
  const ink = overdue ? "var(--danger-ink)" : near ? "var(--warning-ink)" : "var(--text-tertiary)";
  const label = overdue ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `${days}d`;
  const description = overdue ? `${Math.abs(days)} days overdue` : days === 0 ? "Due today" : `In ${days} days`;
  return (
    <span
      aria-label={description}
      title={description}
      className="ui-caps-3 inline-flex items-center text-[10.5px] leading-none tabular-nums"
      style={{ color: ink }}
    >
      {label}
    </span>
  );
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
  const quiet = row.status === "completed" || row.status === "no_renewal_action_needed";
  if (quiet) {
    const ink = row.status === "completed" ? "var(--success-ink)" : "var(--text-tertiary)";
    return (
      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase leading-tight text-[var(--text-tertiary)]">
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} style={{ color: ink }} aria-hidden />
        <span>{row.statusLabel}</span>
      </span>
    );
  }
  return (
    <StatusBadge status={row.statusTone} className="gap-1.5 whitespace-nowrap">
      <Icon className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
      {row.statusLabel}
    </StatusBadge>
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
  return (
    <div className="min-w-0 xl:text-right">
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

export function RenewalFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="ui-caps-3 mb-1.5 block text-[10.5px] text-[var(--text-tertiary)] xl:sr-only">{label}</p>
      <div className="break-words text-[13px] leading-snug text-[var(--text-primary)]">{children}</div>
    </div>
  );
}

export { renewalNoticeBasis };
