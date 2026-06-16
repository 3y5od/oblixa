import Link from "next/link";
import type { ReactNode } from "react";
import { FileSearch } from "lucide-react";
import { formatBusinessDateAtNoon } from "@/lib/business-dates";
import {
  RENEWAL_DATE_REVIEW_HINTS,
  RENEWAL_DATE_REVIEW_LABELS,
  RENEWAL_SECONDARY_ACTION_LABELS,
  renewalNoticeBasis,
} from "@/lib/renewals/spec-strings";
import type { RenewalRow, RenewalWindowKey } from "@/lib/renewals/types";

export function RenewalRowDetail({ row, activeWindow }: { row: RenewalRow; activeWindow: RenewalWindowKey }) {
  const lastReviewed = row.lastUpdateAt ? formatBusinessDateAtNoon(row.lastUpdateAt.slice(0, 10), "\u2014") : "\u2014";
  const reportLine = row.reportIncluded
    ? `Included in the Upcoming renewals report for the next ${activeWindow} days.`
    : `Outside the current ${activeWindow}-day report window.`;
  return (
    <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      <DetailField label={`Renewal date \u00b7 ${RENEWAL_DATE_REVIEW_LABELS[row.renewalDateReview]}`}>
        {row.renewalDateLabel}
        {row.renewalDateReview !== "reviewed" ? (
          <span className="block text-[11px] text-[var(--text-tertiary)]">
            {RENEWAL_DATE_REVIEW_HINTS[row.renewalDateReview]}
          </span>
        ) : null}
      </DetailField>
      <DetailField label={`Notice deadline \u00b7 ${RENEWAL_DATE_REVIEW_LABELS[row.noticeDateReview]}`}>
        {row.noticeDateLabel}
        {row.noticeDateIsComputed ? (
          <span className="block text-[11px] text-[var(--text-tertiary)]">{renewalNoticeBasis(row.noticeWindowDays)}</span>
        ) : row.noticeDateReview !== "reviewed" ? (
          <span className="block text-[11px] text-[var(--text-tertiary)]">
            {RENEWAL_DATE_REVIEW_HINTS[row.noticeDateReview]}
          </span>
        ) : null}
      </DetailField>
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
