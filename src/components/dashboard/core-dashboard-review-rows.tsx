import Link from "next/link";
import { CheckSquare, ChevronRight } from "lucide-react";
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

const DETAIL_CONSEQUENCE: Record<string, string> = {
  "renewal date": "renewal reminders and reports",
  "notice date": "notice-deadline reminders",
  "notice deadline": "notice-deadline reminders",
  "notice window": "the calculated notice deadline",
  owner: "reminder routing, tasks, and reports",
  counterparty: "search, grouping, and reports",
  "effective date": "status and renewal timing",
  "start date": "status and renewal timing",
  "end date": "status and renewal timing",
  "termination date": "status and renewal timing",
  "expiration date": "status and renewal timing",
  "contract value": "inventory and prioritization reports",
  "payment terms": "contract tracking and reports",
};

function detailConsequence(label: string | undefined): string | null {
  if (!label) return null;
  return DETAIL_CONSEQUENCE[label.trim().toLowerCase()] ?? null;
}

function ReviewSourceArtifact({ row }: { row: CoreDashboardReviewRow }) {
  const excerpt = row.sourceExcerpt;
  if (!excerpt) return null;
  const consequence = detailConsequence(excerpt.label);
  const snippet =
    excerpt.snippet.length > 220 ? `${excerpt.snippet.slice(0, 220).trimEnd()}...` : excerpt.snippet;

  return (
    <Link
      href={row.href}
      aria-label={`Confirm the suggested ${excerpt.label.toLowerCase()} for ${row.title}`}
      className="group relative block overflow-hidden rounded-[5px] border border-[color:color-mix(in_oklab,var(--warning-ink)_24%,var(--border-card))] bg-[var(--surface-raised)] transition-colors duration-150 hover:border-[color:color-mix(in_oklab,var(--accent)_32%,var(--border-card))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:color-mix(in_oklab,var(--accent)_45%,transparent)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3.5 pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {/* Trust state is the most important signal at the point of risk, so
              "Not trusted yet" leads as the dominant marker; "Source found"
              demotes to a quiet supporting outline (§20 trust, §9 #9). */}
          <span
            className="inline-flex items-center rounded-[3px] border px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-[0.08em]"
            style={{
              borderColor: "color-mix(in oklab, var(--warning-ink) 55%, var(--border-card))",
              background: "color-mix(in oklab, var(--warning-ink) 20%, var(--surface))",
              color: "var(--warning-ink)",
            }}
          >
            Not trusted yet
          </span>
          <span
            className="inline-flex items-center rounded-[3px] border px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-[0.08em]"
            style={{
              borderColor: "color-mix(in oklab, var(--warning-ink) 30%, var(--border-card))",
              background: "color-mix(in oklab, var(--warning-ink) 9%, var(--surface))",
              color: "var(--warning-ink)",
            }}
          >
            Suggested detail
          </span>
          <span
            className="inline-flex items-center rounded-[3px] border px-1.5 py-0.5 text-[10px] font-medium uppercase leading-none tracking-[0.08em]"
            style={{
              borderColor: "color-mix(in oklab, var(--success-ink) 24%, var(--border-card))",
              background: "transparent",
              color: "color-mix(in oklab, var(--success-ink) 80%, var(--text-tertiary))",
            }}
          >
            Source found
          </span>
        </div>
        <span
          aria-hidden
          className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-[3px] border border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-[0.12em] text-[var(--accent-strong)] transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-visible:opacity-100"
        >
          Confirm contract details
          <ChevronRight className="h-2.5 w-2.5" strokeWidth={1.85} />
        </span>
      </div>
      <p className="mt-1.5 px-3.5 text-[13.5px] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
        {excerpt.label}
        <span className="font-normal text-[var(--text-tertiary)]"> - {row.title}</span>
      </p>
      <figure
        className="ui-surface-source mx-3.5 mt-2 rounded-[4px] border border-l-2 px-3 py-2"
        style={{
          borderColor: "color-mix(in oklab, var(--warning-ink) 16%, var(--border-card))",
          borderLeftColor: "color-mix(in oklab, var(--warning-ink) 50%, transparent)",
        }}
      >
        <figcaption className="ui-caps-3 text-[9.5px]" style={{ color: "color-mix(in oklab, var(--warning-ink) 72%, var(--text-tertiary))" }}>
          Source text
        </figcaption>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
          &ldquo;{snippet}&rdquo;
        </p>
      </figure>
      <p className="px-3.5 pb-3 pt-2 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
        {consequence ? `Used in ${consequence}. ` : ""}
        Suggested details are not used in reminders or reports until confirmed.
      </p>
    </Link>
  );
}

export function ReviewRows({ rows }: { rows: CoreDashboardReviewRow[] }) {
  const [lead] = rows;
  const featured = lead?.sourceExcerpt ? lead : null;
  const listRows = featured ? rows.slice(1) : rows;

  return (
    <div className="flex flex-col gap-2">
      {featured ? <ReviewSourceArtifact row={featured} /> : null}
      {listRows.length > 0 ? (
        <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
          {listRows.map((row) => (
            <ReviewRow key={row.id} row={row} />
          ))}
        </ul>
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
    <p className="mt-0.5 inline-flex max-w-full flex-wrap items-center gap-x-1.5 text-[11.5px] leading-[1.4] text-[var(--text-secondary)]">
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
