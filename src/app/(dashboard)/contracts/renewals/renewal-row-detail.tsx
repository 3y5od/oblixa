import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarClock, FileSearch, Minus, MoveRight, ShieldAlert } from "lucide-react";
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
import { DateProvenanceBadge } from "@/components/ui/date-provenance-badge";
import { formatBusinessDateAtNoon } from "@/lib/business-dates";
import {
  RENEWAL_DATE_REVIEW_HINTS,
  RENEWAL_DATE_REVIEW_LABELS,
  RENEWAL_SECONDARY_ACTION_LABELS,
  RENEWALS_TRUST_NOTE,
} from "@/lib/renewals/spec-strings";
import type { RenewalDateReviewState, RenewalRow, RenewalWindowKey } from "@/lib/renewals/types";
import { REVIEW_TO_PROVENANCE } from "./renewals-ledger-constants";

export function RenewalRowDetail({ row, activeWindow }: { row: RenewalRow; activeWindow: RenewalWindowKey }) {
  const lastReviewed = row.lastUpdateAt ? formatBusinessDateAtNoon(row.lastUpdateAt.slice(0, 10), "\u2014") : "\u2014";
  const reportLine = row.reportIncluded
    ? `Included in the Upcoming renewals report for the next ${activeWindow} days.`
    : `Outside the current ${activeWindow}-day report window.`;
  const windowDays = row.noticeWindowDays && row.noticeWindowDays > 0 ? row.noticeWindowDays : null;
  // \u00a758 trust note rides only when a displayed date is not yet operational truth.
  const unconfirmed = (state: RenewalDateReviewState) => state !== "reviewed";
  const showTrustNote = unconfirmed(row.renewalDateReview) || unconfirmed(row.noticeDateReview);
  return (
    <div className="space-y-3.5">
      {/* The date chain, spelled out on parchment so it reads as a ledger
          artifact, not a flat panel: renewal date, minus the notice window, gives
          the notice deadline \u2014 the last day to act. The connectors carry the
          arithmetic so a reader sees exactly how the deadline was reached. */}
      <div className="rounded-[6px] border border-[color:color-mix(in_oklab,var(--border-strong)_38%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--surface-inset)_55%,var(--surface-raised))] p-3.5 shadow-[var(--shadow-1)]">
        <p className="ui-caps-3 mb-3 flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
          <CalendarClock className="h-3 w-3 shrink-0" strokeWidth={1.85} aria-hidden />
          Date chain
        </p>
        <div className="flex flex-wrap items-stretch gap-x-2 gap-y-3">
          <ChainNode
            label="Renewal date"
            dateLabel={row.renewalDateLabel}
            review={row.renewalDateReview}
          />
          {row.noticeDateIsComputed ? (
            <ChainOperator
              icon={<Minus className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />}
              caption={windowDays ? `${windowDays}-day notice window` : "notice window"}
            />
          ) : (
            <ChainOperator
              icon={<MoveRight className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />}
              caption="on file"
            />
          )}
          <ChainNode
            label="Notice deadline"
            dateLabel={row.noticeDateLabel}
            review={row.noticeDateReview}
            lead
          />
        </div>
        {showTrustNote ? (
          <p className="mt-3 flex items-start gap-1.5 border-t border-[color:color-mix(in_oklab,var(--warning-ink)_22%,var(--border-subtle))] pt-2.5 text-[11px] leading-snug text-[var(--warning-ink)]">
            <ShieldAlert className="mt-px h-3 w-3 shrink-0" strokeWidth={1.85} aria-hidden />
            <span>{RENEWALS_TRUST_NOTE}</span>
          </p>
        ) : null}
      </div>

      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <DetailField label="Owner">
          {row.ownerUserId ? row.ownerLabel : "Unassigned \u2014 assign to route reminders"}
        </DetailField>
        <DetailField label="Last reviewed">
          <span className="tabular-nums">{lastReviewed}</span>
        </DetailField>
        <DetailField label="Report inclusion">{reportLine}</DetailField>
        <DetailField label="Source review">
          <Link
            href={`/contracts/${row.id}?tab=renewals`}
            className="ui-chip-focus inline-flex items-center gap-1 rounded-md text-[12px] font-semibold text-[var(--accent-strong)] underline-offset-2 hover:underline"
          >
            <FileSearch className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden />
            {RENEWAL_SECONDARY_ACTION_LABELS.review_source}
          </Link>
        </DetailField>
      </div>

      {/* Routine cross-object continuity lives here, out of the scannable record
          block \u2014 related work for this contract on the other Core surfaces. */}
      <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-2.5">
        <ContractContinuityLinks
          contractId={row.id}
          omit={["contract", "renewals"]}
          label="Related work"
          variant="inline"
          maxVisible={4}
          className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--text-tertiary)]"
        />
      </div>
    </div>
  );
}

/** One end of the date chain \u2014 a dated register entry with its provenance badge.
 *  The lead node (notice deadline) sits on its own cool-steel plaque and reads in
 *  stronger ink as the action date; the renewal node stays plain context. */
function ChainNode({
  label,
  dateLabel,
  review,
  lead = false,
}: {
  label: string;
  dateLabel: string;
  review: RenewalDateReviewState;
  lead?: boolean;
}) {
  const missing = review === "missing";
  if (lead) {
    return (
      <div
        className="min-w-0 rounded-[5px] border border-[color:color-mix(in_oklab,var(--calculated-ink)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--surface-cool)_55%,var(--surface-raised))] px-2.5 py-1.5"
      >
        <p className="ui-caps-3 text-[10px] text-[var(--text-secondary)]">{label}</p>
        <p
          className={`mt-0.5 text-[15px] font-semibold leading-snug tracking-[-0.01em] tabular-nums ${
            missing ? "italic text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"
          }`}
        >
          {dateLabel}
        </p>
        <div className="mt-1">
          <DateProvenanceBadge
            state={REVIEW_TO_PROVENANCE[review]}
            label={RENEWAL_DATE_REVIEW_LABELS[review]}
            hint={RENEWAL_DATE_REVIEW_HINTS[review]}
            srPrefix={label}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="min-w-0 self-center">
      <p className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">{label}</p>
      <p
        className={`mt-0.5 text-[13px] tabular-nums leading-snug ${
          missing ? "italic text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"
        }`}
      >
        {dateLabel}
      </p>
      <div className="mt-1">
        <DateProvenanceBadge
          state={REVIEW_TO_PROVENANCE[review]}
          label={RENEWAL_DATE_REVIEW_LABELS[review]}
          hint={RENEWAL_DATE_REVIEW_HINTS[review]}
          srPrefix={label}
        />
      </div>
    </div>
  );
}

/** The arithmetic connector between the two chain ends. */
function ChainOperator({ icon, caption }: { icon: ReactNode; caption: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center self-center px-1 text-[var(--text-tertiary)]">
      <span aria-hidden className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[var(--surface-raised)]">
        {icon}
      </span>
      <span className="mt-1 max-w-[8rem] text-center text-[10px] leading-tight text-[var(--text-tertiary)]">
        {caption}
      </span>
    </div>
  );
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-l border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pl-3">
      <p className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">{label}</p>
      <div className="mt-0.5 break-words text-[12.5px] leading-snug text-[var(--text-primary)]">{children}</div>
    </div>
  );
}
