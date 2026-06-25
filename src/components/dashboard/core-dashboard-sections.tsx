import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  CheckSquare,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  UploadCloud,
  Users,
  type LucideIcon,
} from "lucide-react";
/** Plain-language age of the longest-standing gap ("11 days old") so the data
 *  register states the staleness in words instead of a cryptic "11D" chip (§9 #8).
 *  Server-rendered, so `new Date()` introduces no hydration drift. */
function daysOldLabel(iso: string | null): string | null {
  if (!iso) return null;
  const when = new Date(iso);
  if (!Number.isFinite(when.getTime())) return null;
  const days = Math.max(0, differenceInCalendarDays(new Date(), when));
  if (days === 0) return "today";
  return `${days} day${days === 1 ? "" : "s"} old`;
}
import type { StatTone } from "@/components/ui/stat-cell";
import { CAPS_VERBS, formatMonthDay } from "@/lib/ui-copy";
import type {
  CoreDashboardActivityRow,
  CoreDashboardDataGapCategory,
} from "@/lib/dashboard/core-dashboard-model";

/** Short, specific fix verb for a data-gap row's primary missing field
 *  ("Fix owner" / "Fix date" / "Fix counterparty") instead of echoing the raw
 *  field label. */
function gapFixLabel(field: string | undefined): string {
  const f = (field ?? "").toLowerCase();
  if (f.includes("owner")) return "Fix owner";
  if (f.includes("counterparty")) return "Fix counterparty";
  if (f.includes("date") || f.includes("notice") || f.includes("renewal")) return "Fix date";
  if (f.includes("value")) return "Fix value";
  if (f.includes("status")) return "Fix status";
  return "Fix";
}


/** Map an activity row onto the canonical activity-feed vocabulary: a caps
 *  verb from the shared list, a single-color semantic icon, and an optional
 *  tone. Keeps Recent Activity to "verb + target chip + time" per §8.5
 *  instead of free sentence prose. */
function activityVisual(row: CoreDashboardActivityRow): {
  verb: string;
  icon: LucideIcon;
  tone?: StatTone;
} {
  const text = `${row.label} ${row.summary} ${row.outcome ?? ""}`.toLowerCase();
  if (text.includes("upload")) return { verb: CAPS_VERBS.uploaded, icon: UploadCloud };
  if (text.includes("extract")) return { verb: CAPS_VERBS.extracted, icon: FileText };
  // Detail review reads as "Confirmed", not "Approved" (release vocabulary);
  // genuine approval-task events keep "Approved".
  if (text.includes("confirm") || ((text.includes("field") || text.includes("detail")) && text.includes("approv")))
    return { verb: "Confirmed", icon: BadgeCheck, tone: "success" };
  if (text.includes("approv")) return { verb: CAPS_VERBS.approved, icon: BadgeCheck, tone: "success" };
  if (text.includes("reject")) return { verb: CAPS_VERBS.rejected, icon: AlertTriangle, tone: "danger" };
  if (text.includes("creat")) return { verb: CAPS_VERBS.created, icon: FileText };
  if (text.includes("delet")) return { verb: CAPS_VERBS.deleted, icon: FileText };
  if (text.includes("owner")) return { verb: CAPS_VERBS.changed, icon: Users };
  if (
    text.includes("updat") ||
    text.includes("chang") ||
    text.includes("status") ||
    text.includes("supersed") ||
    text.includes("applied")
  )
    return { verb: CAPS_VERBS.changed, icon: FileText };
  if (text.includes("complet") || text.includes("done"))
    return { verb: CAPS_VERBS.completed, icon: CheckSquare, tone: "success" };
  if (text.includes("evidence") || text.includes("receiv"))
    return { verb: CAPS_VERBS.received, icon: ShieldCheck };
  if (text.includes("export")) return { verb: CAPS_VERBS.exported, icon: FileSpreadsheet };
  if (text.includes("sign")) return { verb: CAPS_VERBS.signed, icon: BadgeCheck, tone: "success" };
  const words = row.label.trim().split(/\s+/);
  const fallback = (words[words.length - 1] || "Activity").toUpperCase();
  return { verb: fallback, icon: FileText };
}

const CATEGORY_FIX_FIELD: Record<CoreDashboardDataGapCategory["key"], string> = {
  owners: "Owner",
  dates: "Renewal date",
  counterparties: "Counterparty",
};

// Short category nouns for the compact "no gaps" footer.
const CATEGORY_CLEAR_NOUN: Record<CoreDashboardDataGapCategory["key"], string> = {
  owners: "owners",
  dates: "renewal & notice dates",
  counterparties: "counterparties",
};

// Which of a row's missing fields belong to THIS group's dimension, so a row in
// the Owners band leads with its owner gap (not the counterparty/date gaps that
// belong to other dimensions) — the rest fold into a quiet "also missing" note
// (§7 critique #4 — no group/chip mismatch).
const CATEGORY_PRIMARY_FIELDS: Record<CoreDashboardDataGapCategory["key"], string[]> = {
  owners: ["Owner"],
  dates: ["Renewal date", "Notice date"],
  counterparties: ["Counterparty"],
};

// The prominent gap marker per group, matching the band it sits under.
const CATEGORY_PRIMARY_LABEL: Record<CoreDashboardDataGapCategory["key"], string> = {
  owners: "Missing owner",
  dates: "Missing dates",
  counterparties: "Missing counterparty",
};

// Plain-language operational consequence of the gap, so each row says why it
// matters, not just what is absent (§7 critique #5 — row consequence copy).
const CATEGORY_CONSEQUENCE: Record<CoreDashboardDataGapCategory["key"], string> = {
  owners: "Reminders can't be routed until an owner is assigned.",
  dates: "Renewal and notice reminders can't run without these dates.",
  counterparties: "Search, grouping, and reports need the counterparty.",
};

// Fixed order so categories with gaps keep a stable sequence.
const GAP_COLUMN_ORDER: CoreDashboardDataGapCategory["key"][] = [
  "owners",
  "dates",
  "counterparties",
];

/**
 * Data-quality register: contracts that are missing details, grouped into
 * category bands (Owners / Dates / Counterparties). Each row is contract-led —
 * the contract name plus the group's gap marker dominate, an operational
 * consequence explains why it matters, secondary gaps fold into a quiet note, and
 * age + a compact outline fix action sit close on the right (§7 critique — one
 * scannable row, no horizontal slack, no group/chip mismatch).
 */
export function DataGapBoard({
  categories,
  compact = false,
}: {
  categories: CoreDashboardDataGapCategory[];
  compact?: boolean;
}) {
  const byKey = new Map(categories.map((category) => [category.key, category]));
  const ordered = GAP_COLUMN_ORDER.map((key) => byKey.get(key)).filter(
    (category): category is CoreDashboardDataGapCategory => Boolean(category)
  );
  const gapCategories = ordered.filter((category) => category.rows.length > 0);
  const clearedCategories = ordered.filter((category) => category.rows.length === 0);
  return (
    <div>
      {gapCategories.map((category) => {
        const primaryFields = CATEGORY_PRIMARY_FIELDS[category.key];
        return (
          <section key={category.key} className="min-w-0">
            {/* Category subsection — sentence-case label on the left, a quiet count
                on the right; the per-row consequence carries the "what's missing". */}
            <div className={`flex items-baseline justify-between gap-2 ${compact ? "px-2 pb-1 pt-2.5" : "px-3 pb-1.5 pt-3 first:pt-2"}`}>
              <span className="text-[12px] font-semibold tracking-tight text-[var(--text-secondary)]">{category.label}</span>
              <span className="shrink-0 text-[11px] font-medium tabular-nums text-[var(--text-tertiary)]">
                {category.total} {category.total === 1 ? "contract" : "contracts"}
              </span>
            </div>
            <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)]">
              {category.rows.map((row) => {
                const otherFields = row.missing.filter((field) => !primaryFields.includes(field));
                const age = daysOldLabel(row.updatedAt);
                if (compact) {
                  return (
                    <li key={row.id}>
                      <Link
                        href={row.href}
                        aria-label={`Fix the missing ${CATEGORY_FIX_FIELD[category.key].toLowerCase()} for ${row.title}`}
                        className="group flex items-center justify-between gap-2 rounded-[6px] px-2 py-1.5 transition-colors duration-150 hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_12%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:outline-none"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[12.5px] font-semibold leading-tight text-[var(--text-primary)]">{row.title}</span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-[var(--text-secondary)]">
                            {CATEGORY_CONSEQUENCE[category.key]}
                          </span>
                        </span>
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-[5px] border px-2 py-1 text-[11px] font-semibold leading-none transition-colors duration-150 group-hover:border-[color:color-mix(in_oklab,var(--accent)_45%,transparent)] group-hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))] group-hover:text-[var(--accent-strong)]"
                          style={{ borderColor: "color-mix(in oklab, var(--border-strong) 70%, var(--border-card))", color: "var(--text-secondary)" }}
                        >
                          {gapFixLabel(CATEGORY_FIX_FIELD[category.key])}
                          <ChevronRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={2} />
                        </span>
                      </Link>
                    </li>
                  );
                }
                return (
                  <li key={row.id}>
                    <Link
                      href={row.href}
                      aria-label={`Fix the missing ${CATEGORY_FIX_FIELD[category.key].toLowerCase()} for ${row.title}${age ? `, ${age}` : ""}`}
                      className="group block rounded-[6px] px-3 py-2.5 transition-colors duration-150 hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_12%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:outline-none sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-x-5"
                    >
                      {/* Contract + the group's gap marker + consequence. */}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate text-[14px] font-semibold leading-[1.3] text-[var(--text-primary)]">
                            {row.title}
                          </span>
                          <span
                            className="inline-flex shrink-0 items-center rounded-[3px] border px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em]"
                            style={{
                              borderColor: "color-mix(in oklab, var(--warning-ink) 42%, var(--border-card))",
                              background: "color-mix(in oklab, var(--warning-soft) 58%, var(--surface-raised))",
                              color: "var(--warning-ink)",
                            }}
                          >
                            {CATEGORY_PRIMARY_LABEL[category.key]}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] leading-snug text-[var(--text-secondary)]">
                          {CATEGORY_CONSEQUENCE[category.key]}
                        </p>
                        {otherFields.length > 0 ? (
                          <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
                            Also missing {otherFields.map((field) => field.toLowerCase()).join(", ")}.
                          </p>
                        ) : null}
                      </div>
                      {/* Age */}
                      <span className="mt-1.5 block whitespace-nowrap text-[12px] leading-snug tabular-nums text-[var(--text-tertiary)] sm:mt-0 sm:text-right">
                        {age ?? "-"}
                      </span>
                      {/* Action — a compact outline button, the one action style here. */}
                      <span
                        className="mt-2 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[4px] border px-2.5 py-1.5 text-[11px] font-semibold uppercase leading-none tracking-[0.06em] transition-colors duration-150 group-hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))] sm:mt-0 sm:justify-self-end"
                        style={{
                          borderColor: "color-mix(in oklab, var(--accent) 42%, var(--border-card))",
                          color: "var(--accent-strong)",
                        }}
                      >
                        {gapFixLabel(CATEGORY_FIX_FIELD[category.key])}
                        <ChevronRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={2} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {clearedCategories.length > 0 ? (
        <p
          className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] leading-snug ${compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}
          style={{ color: "color-mix(in oklab, var(--success-ink) 72%, var(--text-secondary))" }}
        >
          <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} style={{ color: "var(--success-ink)" }} aria-hidden />
          <span>
            No gaps in {clearedCategories.map((category) => CATEGORY_CLEAR_NOUN[category.key]).join(", ")}.
          </span>
        </p>
      ) : null}
    </div>
  );
}

function activityInk(tone: StatTone | undefined): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  return "var(--text-tertiary)";
}

// Recent Activity reads as an audit ledger: a semantic glyph, a plain-language
// event sentence (action + object + contract), and a right-aligned time — not a
// caps verb chip the reader has to decode (§Recent Activity, §18 sentences).
// The shared ActivityFeed (verb-chip form) is left untouched for the contract
// detail and billing surfaces that still use it.
export function ActivityRows({ rows }: { rows: CoreDashboardActivityRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-1 py-1.5 text-[12px] text-[var(--text-tertiary)]">
        No recent activity yet.
      </p>
    );
  }
  // A deliberate audit rail: a connecting spine threads tone-coded event nodes,
  // each pairing the state change + object with a readable timestamp — an
  // intentional trail, not loose text in a column (§6 audit rail, §8.5 activity).
  return (
    <ol className="space-y-0">
      {rows.map((row, index) => {
        const visual = activityVisual(row);
        const Icon = visual.icon;
        const ink = activityInk(visual.tone);
        const summary = row.summary?.trim() || row.label?.trim() || "Activity";
        const isLast = index === rows.length - 1;
        return (
          <li key={row.id} className="relative flex gap-3">
            <div className="relative flex w-5 shrink-0 flex-col items-center">
              <span
                aria-hidden
                className="z-[1] inline-flex h-5 w-5 items-center justify-center rounded-full border"
                style={{
                  borderColor: `color-mix(in oklab, ${ink} 48%, var(--border-card))`,
                  background: `color-mix(in oklab, ${ink} 13%, var(--surface-raised))`,
                  color: ink,
                }}
              >
                <Icon className="h-3 w-3" strokeWidth={2} />
              </span>
              {!isLast ? (
                <span aria-hidden className="w-[1.5px] flex-1 bg-[color:color-mix(in_oklab,var(--border-strong)_55%,transparent)]" />
              ) : null}
            </div>
            <Link
              href={row.href}
              className={`group -mt-0.5 flex min-w-0 flex-1 items-start justify-between gap-2.5 rounded-[6px] px-1.5 pt-1 transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_12%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:outline-none ${isLast ? "pb-1" : "pb-4"}`}
            >
              {/* action + object on the left, one precise right-aligned timestamp —
                  an audit row, not a notification feed (§10). */}
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold leading-snug text-[var(--text-primary)]">{summary}</span>
                {row.contractTitle ? (
                  <span className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-[var(--text-tertiary)]">{row.contractTitle}</span>
                ) : null}
              </span>
              {row.occurredAt ? (
                <time className="shrink-0 self-start pt-0.5 text-[11px] font-medium tabular-nums text-[var(--text-tertiary)]">
                  {formatMonthDay(row.occurredAt)}
                </time>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
