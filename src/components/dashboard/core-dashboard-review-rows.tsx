import Link from "next/link";
import {
  ArrowRight,
  Ban,
  Check,
  CheckSquare,
  Eye,
  FileText,
  Quote,
  type LucideIcon,
} from "lucide-react";
import { DashboardActionRow } from "@/components/dashboard/dashboard-action-row";
import { CountChip } from "@/components/ui/count-chip";
import { FieldChip } from "@/components/ui/field-chip";
import type { CoreDashboardReviewRow } from "@/lib/dashboard/core-dashboard-model";
import {
  COUNTERPARTY_FALLBACK_TOKENS,
  EMAIL_RE,
  MetaDataFlag,
  OverflowCount,
} from "./core-dashboard-data-flags";
import { detailConsequence, detailOutcomes } from "./core-dashboard-review-row-data";

/** The located excerpt is rendered as real text inside a clause paragraph; the
 *  rest of the page (which we don't have verbatim) trails off as a couple of
 *  faint word-shape lines so the well reads as an actual page that continues —
 *  not a skeleton. These are the trailing lines only. */
const DOC_TAIL: ReadonlyArray<ReadonlyArray<number[]>> = [
  [
    [11, 16, 8, 19, 12, 9, 14],
    [13, 9, 17, 7, 15, 11, 10],
    [10, 14, 8, 12],
  ],
  [
    [9, 17, 12, 8, 21, 10, 13],
    [14, 7, 16, 11, 9, 18, 8],
    [12, 10, 15, 7],
  ],
];

/** One faint line of trailing document body — short word-shapes to the margin. */
function WordLine({ widths }: { widths: number[] }) {
  return (
    <span aria-hidden className="flex flex-wrap items-center gap-x-[5px] gap-y-[6px]">
      {widths.map((w, i) => (
        <span
          key={i}
          className="h-[6px] rounded-[1px]"
          style={{ width: `${w}%`, background: "color-mix(in oklab, var(--text-tertiary) 18%, transparent)" }}
        />
      ))}
    </span>
  );
}

function TrustMarker({
  children,
  icon: Icon,
  filled,
  tone = "warning",
}: {
  children: string;
  icon: LucideIcon;
  filled: boolean;
  tone?: "warning" | "success" | "neutral";
}) {
  const ink =
    tone === "success" ? "var(--success-ink)" : tone === "neutral" ? "var(--info-ink)" : "var(--warning-ink)";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[3px] border px-2 py-1 text-[10.5px] uppercase leading-none tracking-[0.08em] ${
        filled ? "font-bold" : "font-semibold"
      }`}
      style={{
        borderColor: `color-mix(in oklab, ${ink} ${filled ? 48 : 26}%, var(--border-card))`,
        background: filled ? `color-mix(in oklab, ${ink} 14%, var(--surface-raised))` : "var(--surface-raised)",
        color: ink,
      }}
    >
      <Icon className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
      {children}
    </span>
  );
}

function ReviewSourceArtifact({ row }: { row: CoreDashboardReviewRow }) {
  const excerpt = row.sourceExcerpt;
  if (!excerpt) return null;
  const snippet =
    excerpt.snippet.length > 180 ? `${excerpt.snippet.slice(0, 180).trimEnd()}...` : excerpt.snippet;
  const counterparty = row.counterparty?.trim() || "";
  const counterpartyKnown = counterparty && !COUNTERPARTY_FALLBACK_TOKENS.has(counterparty.toLowerCase());

  const outcomes = detailOutcomes(excerpt.label).slice(0, 3);
  const total = Math.max(row.totalFields, 1);
  const reviewed = Math.min(Math.max(row.reviewed, 0), total);
  const otherPending = row.pendingFieldNames.filter(
    (name) => name.trim().toLowerCase() !== excerpt.label.trim().toLowerCase()
  );

  // Details to Confirm — the source-backed review surface. Three panes on distinct
  // grounds: the source document (the contract excerpt in context), the suggested
  // detail (what's awaiting confirmation), and what becomes trusted after you
  // confirm, plus the action. A confirmation count tracks progress.
  return (
    <div className="overflow-hidden rounded-[8px] border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      {/* Header — neutral chrome (no orange): provenance label, contract, progress. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--surface-raised))] px-4 py-2.5">
        <span className="inline-flex min-w-0 items-center gap-2.5">
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
            <Quote className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Source-backed review
          </span>
          <span aria-hidden className="h-3.5 w-px shrink-0 bg-[var(--border-strong)]" />
          <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{row.title}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2">
          <span className="text-[11px] font-medium tabular-nums text-[var(--text-tertiary)]">
            {reviewed} of {total} confirmed
          </span>
          <span aria-hidden className="inline-flex items-center gap-1">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-4 rounded-[1px]"
                style={{ background: i < reviewed ? "var(--success-ink)" : "var(--border-strong)" }}
              />
            ))}
          </span>
        </span>
      </div>

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,2.5fr)_minmax(0,0.92fr)] lg:[&>*]:min-h-[13.5rem]">
        {/* Pane 1 — DOCUMENT EVIDENCE (dominant): a warm paper page carrying real
            clause text with the located sentence highlighted. Owns the most weight;
            the inspectors to the right read against it. */}
        <figure className="flex min-w-0 flex-col gap-2.5 border-b border-[var(--border-subtle)] px-4 py-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2">
            <figcaption className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
              <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden />
              Document evidence
            </figcaption>
            {counterpartyKnown ? (
              <span className="truncate text-[11px] font-medium text-[var(--text-tertiary)]">{counterparty}</span>
            ) : null}
          </div>
          {/* Warm paper page — warmth lives here only, not across the app. */}
          <div
            className="relative flex flex-1 flex-col overflow-hidden rounded-[5px] border shadow-[0_1px_2px_rgba(120,90,40,0.05)]"
            style={{
              background: "color-mix(in oklab, #f8f1e3 42%, var(--surface-raised))",
              borderColor: "color-mix(in oklab, var(--accent-warm) 20%, var(--border-card))",
            }}
          >
            <div
              className="flex items-center gap-1.5 border-b px-3.5 py-2"
              style={{
                borderColor: "color-mix(in oklab, var(--accent-warm) 16%, var(--border-card))",
                background: "color-mix(in oklab, #f3e8d2 50%, var(--surface-raised))",
              }}
            >
              <FileText className="h-3 w-3 shrink-0" strokeWidth={2} style={{ color: "var(--accent-warm)" }} aria-hidden />
              <span className="truncate text-[11px] font-semibold text-[var(--text-secondary)]">{row.title}.pdf</span>
              <span className="ml-auto flex shrink-0 items-center gap-2 text-[10px] tabular-nums text-[var(--text-tertiary)]">
                <span>Page 3 of 14</span>
                <span aria-hidden className="h-3 w-px" style={{ background: "color-mix(in oklab, var(--accent-warm) 28%, var(--border-strong))" }} />
                <span className="font-semibold uppercase tracking-[0.06em]" style={{ color: "color-mix(in oklab, var(--accent-warm) 78%, var(--text-tertiary))" }}>Signed</span>
              </span>
            </div>
            {/* Real clause text — generic framing around the located sentence so the
                excerpt reads as an actual contract page (demo content). */}
            <div className="flex flex-1 flex-col gap-1.5 px-5 py-4">
              <p className="text-[12px] font-bold tracking-tight" style={{ color: "color-mix(in oklab, var(--accent-warm) 55%, var(--text-primary))" }}>
                2.1&ensp;Term
              </p>
              <p className="text-[13px] leading-[1.6] text-[color:color-mix(in_oklab,var(--text-primary)_88%,transparent)]">
                This section establishes when the Agreement takes effect and the dates measured from it.{" "}
                <mark
                  className="rounded-[1px] px-0.5 font-semibold"
                  style={{
                    background: "color-mix(in oklab, var(--warning-soft) 62%, transparent)",
                    boxShadow: "inset 0 -2px 0 0 color-mix(in oklab, var(--warning-ink) 42%, transparent)",
                    color: "var(--text-primary)",
                  }}
                >
                  {snippet}
                </mark>{" "}
                The renewal schedule, the notice window, and the reporting periods are determined from that date.
              </p>
              <p className="mt-2 text-[12px] font-bold tracking-tight" style={{ color: "color-mix(in oklab, var(--accent-warm) 55%, var(--text-primary))" }}>
                2.2&ensp;Renewal
              </p>
              <p className="text-[13px] leading-[1.6] text-[color:color-mix(in_oklab,var(--text-primary)_88%,transparent)]">
                The initial term renews automatically for successive twelve (12) month periods unless either party
                delivers written notice of non-renewal before the notice deadline set out in Section 2.3.
              </p>
              <div className="mt-auto flex flex-col gap-[7px] pt-3 opacity-50">
                {DOC_TAIL[0].map((widths, li) => (
                  <WordLine key={li} widths={widths} />
                ))}
              </div>
            </div>
          </div>
          <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] leading-snug text-[var(--text-tertiary)]">
            <span className="font-semibold text-[var(--text-secondary)]">Located in source</span>
            <span aria-hidden>&middot;</span>
            <span>&sect; 2.1 Term</span>
            <span aria-hidden>&middot;</span>
            <span>page 3, line 5</span>
          </p>
        </figure>

        {/* Inspectors — the suggested field and its trust transition, stacked beside
            the dominant source on a faint recessed ground so they read as attached
            panels, not equal columns. */}
        <div className="flex min-w-0 flex-col bg-[color:color-mix(in_oklab,var(--surface-muted)_42%,var(--surface-raised))]">
          {/* Inspector A — suggested detail as a precise record: field, source,
              review state, confirmed count, and any other pending fields. */}
          <div className="flex min-w-0 flex-col gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-semibold text-[var(--text-secondary)]">Suggested detail</p>
              <TrustMarker icon={Eye} filled>Suggested</TrustMarker>
            </div>
            <h3 className="text-[1.15rem] font-bold leading-[1.1] tracking-tight text-[var(--text-primary)]">{excerpt.label}</h3>
            <dl className="-mt-0.5 flex flex-col divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)] text-[12px]">
              <div className="flex items-center justify-between gap-2 py-[5px]">
                <dt className="text-[var(--text-tertiary)]">Source</dt>
                <dd className="truncate font-semibold text-[var(--text-secondary)]">&sect; 2.1 Term, p.3</dd>
              </div>
              <div className="flex items-center justify-between gap-2 py-[5px]">
                <dt className="text-[var(--text-tertiary)]">Review state</dt>
                <dd className="font-semibold text-[var(--warning-ink)]">Awaiting review</dd>
              </div>
              <div className="flex items-center justify-between gap-2 py-[5px]">
                <dt className="text-[var(--text-tertiary)]">Confirmed</dt>
                <dd className="font-semibold tabular-nums text-[var(--text-secondary)]">{reviewed} of {total}</dd>
              </div>
              {otherPending.length > 0 ? (
                <div className="flex items-center justify-between gap-2 py-[5px]">
                  <dt className="text-[var(--text-tertiary)]">Also pending</dt>
                  <dd className="truncate font-medium text-[var(--text-secondary)]">{otherPending.join(", ")}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          {/* Inspector B — the trust transition made explicit: suggested/not trusted
              → confirmed/in use, then the surfaces it feeds. */}
          <div className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-3.5">
            <p className="text-[12px] font-semibold text-[var(--text-secondary)]">When you confirm</p>
            {/* One connected state track — two states split by a chevron, not two
                pasted-in boxes — so the trust boundary reads as a state model. */}
            <div className="flex items-stretch overflow-hidden rounded-[6px] border border-[var(--border-subtle)]">
              <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 bg-[color:color-mix(in_oklab,var(--surface-muted)_60%,var(--surface-raised))] px-2.5 py-2">
                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Now</span>
                <span className="flex items-center gap-1.5 text-[12px] font-semibold leading-none text-[var(--text-secondary)]">
                  <Ban className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
                  Not trusted
                </span>
              </span>
              <span aria-hidden className="flex shrink-0 items-center border-x border-[var(--border-subtle)] bg-[var(--surface-raised)] px-1 text-[var(--text-tertiary)]">
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <span
                className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-2.5 py-2"
                style={{ background: "color-mix(in oklab, var(--success-soft) 36%, var(--surface-raised))" }}
              >
                <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--success-ink)" }}>Confirmed</span>
                <span className="flex items-center gap-1.5 text-[12px] font-semibold leading-none text-[var(--text-primary)]">
                  <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.6} style={{ color: "var(--success-ink)" }} aria-hidden />
                  Trusted
                </span>
              </span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {outcomes.map(({ label, icon: OutcomeIcon }) => (
                <li key={label} className="flex items-center gap-2 text-[12px] font-medium leading-snug text-[var(--text-secondary)]">
                  <OutcomeIcon className="h-3.5 w-3.5 shrink-0 text-[var(--success-ink)]" strokeWidth={2.2} aria-hidden />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border-subtle)] pt-3">
              <Link href={row.href} className="ui-btn-primary group inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] px-3.5 py-2 text-[12.5px] font-semibold">
                Confirm details
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden />
              </Link>
              <Link href={row.href} className="whitespace-nowrap text-[12px] font-semibold text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--accent-strong)] hover:underline">
                Review source
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReviewRows({ rows }: { rows: CoreDashboardReviewRow[] }) {
  const [lead] = rows;
  const featured = lead?.sourceExcerpt ? lead : null;
  const listRows = featured ? rows.slice(1) : rows;

  return (
    <div className="flex flex-col gap-2.5">
      {featured ? <ReviewSourceArtifact row={featured} /> : null}
      {listRows.length > 0 ? (
        <div>
          {featured ? (
            <p className="ui-caps-2 px-1 pb-1 pt-1 text-[10px] text-[var(--text-tertiary)]">
              More contracts needing review
            </p>
          ) : null}
          <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
            {listRows.map((row) => (
              <ReviewRow key={row.id} row={row} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ReviewRow({ row }: { row: CoreDashboardReviewRow }) {
  const counterpartyText = row.counterparty?.trim() || "";
  const counterpartyIsUnknown =
    counterpartyText && COUNTERPARTY_FALLBACK_TOKENS.has(counterpartyText.toLowerCase());
  const ownerText = row.ownerLabel?.trim() || "";
  const ownerIsEmail = ownerText && EMAIL_RE.test(ownerText);
  const shownFieldNames = row.pendingFieldNames.slice(0, 3);
  const overflowFields = row.pendingFields - shownFieldNames.length;
  const consequence = detailConsequence(row.pendingFieldNames[0]);

  return (
    <li>
      <DashboardActionRow
        href={row.href}
        hoverAction="Confirm contract details"
        leading={
          <span
            aria-hidden
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
            style={{
              background: "color-mix(in oklab, var(--warning-soft) 30%, var(--surface))",
              color: "var(--warning-ink)",
            }}
          >
            <CheckSquare className="h-3.5 w-3.5" strokeWidth={1.85} />
          </span>
        }
        eyebrow={
          <p className="text-[11px] font-semibold leading-tight text-[var(--warning-ink)]">
            {row.pendingFields > 0
              ? `${row.pendingFields} suggested ${row.pendingFields === 1 ? "detail needs" : "details need"} confirmation`
              : "Needs review before reminders rely on it"}
            {consequence ? (
              <span className="font-normal text-[var(--text-tertiary)]"> - used in {consequence}</span>
            ) : null}
          </p>
        }
        title={
          <p className="mt-0.5 truncate text-[13.5px] font-semibold leading-[1.3] tracking-tight text-[var(--text-primary)]">
            {row.title}
          </p>
        }
        meta={
          <>
            <ReviewRowMeta
              counterpartyText={counterpartyText}
              counterpartyIsUnknown={!!counterpartyIsUnknown}
              ownerText={ownerText}
              ownerIsEmail={!!ownerIsEmail}
            />
            {row.pendingFields > 0 ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {shownFieldNames.map((name) => (
                  <FieldChip key={name} label={name} />
                ))}
                {shownFieldNames.length === 0 ? (
                  <CountChip value={row.pendingFields} />
                ) : overflowFields > 0 ? (
                  <OverflowCount value={overflowFields} />
                ) : null}
              </div>
            ) : null}
          </>
        }
      />
    </li>
  );
}

function ReviewRowMeta({
  counterpartyText,
  counterpartyIsUnknown,
  ownerText,
  ownerIsEmail,
}: {
  counterpartyText: string;
  counterpartyIsUnknown: boolean;
  ownerText: string;
  ownerIsEmail: boolean;
}) {
  return (
    <p className="mt-0.5 inline-flex max-w-full flex-wrap items-center gap-x-1.5 text-[12px] leading-[1.4] text-[var(--text-secondary)]">
      {counterpartyText ? (
        counterpartyIsUnknown ? (
          <MetaDataFlag kind="counterparty" raw={counterpartyText} />
        ) : (
          <span className="truncate">{counterpartyText}</span>
        )
      ) : null}
      {counterpartyText && ownerText ? <span aria-hidden className="ui-dot-sep">-</span> : null}
      {ownerText ? (
        ownerIsEmail ? (
          <MetaDataFlag kind="owner" raw={ownerText} />
        ) : (
          <span className="truncate">{ownerText}</span>
        )
      ) : null}
    </p>
  );
}
