import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  CheckSquare,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  UploadCloud,
  Users,
  type LucideIcon,
} from "lucide-react";
import { DashboardActionRow } from "@/components/dashboard/dashboard-action-row";
import { FieldChip } from "@/components/ui/field-chip";
import type { StatTone } from "@/components/ui/stat-cell";
import { TimeChip } from "@/components/ui/time-chip";
import { CAPS_VERBS } from "@/lib/ui-copy";
import type {
  CoreDashboardActivityRow,
  CoreDashboardDataGapCategory,
  CoreDashboardDataGapSummary,
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

function OverflowCount({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10.5px] font-medium leading-none text-[var(--text-tertiary)]">
      <span className="tabular-nums">{value}</span> more
    </span>
  );
}
const CATEGORY_FIX_FIELD: Record<CoreDashboardDataGapCategory["key"], string> = {
  owners: "Owner",
  dates: "Renewal date",
  counterparties: "Counterparty",
};

// Object-class noun for each gap category, so the column header reads as a full
// semantic count ("1 contract missing an owner") rather than a bare label + chip
// the user has to decode (§19 count semantics).
const CATEGORY_GAP_NOUN: Record<CoreDashboardDataGapCategory["key"], string> = {
  owners: "an owner",
  dates: "renewal or notice dates",
  counterparties: "a counterparty",
};

// Fixed column order so the three completeness columns stay stable whether a
// category has gaps or is all-clear (§14 stable columns). Cleared categories
// render as a structured column, not an appended success pill (§13).
const GAP_COLUMN_ORDER: CoreDashboardDataGapCategory["key"][] = [
  "owners",
  "dates",
  "counterparties",
];

export function DataGapBoard({
  categories,
  summary,
}: {
  categories: CoreDashboardDataGapCategory[];
  summary: CoreDashboardDataGapSummary;
}) {
  const byKey = new Map(categories.map((category) => [category.key, category]));
  const ordered = GAP_COLUMN_ORDER.map((key) => byKey.get(key)).filter(
    (category): category is CoreDashboardDataGapCategory => Boolean(category)
  );
  return (
    <div>
      {summary.oldestUpdatedAt ? (
        <div className="mb-2 flex items-center justify-end gap-1.5 px-1">
          <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">
            Oldest missing detail
          </span>
          <TimeChip date={summary.oldestUpdatedAt} bordered className="shrink-0" />
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-y-5 md:grid-cols-3 md:gap-y-0 md:divide-x md:divide-[color:color-mix(in_oklab,var(--border-subtle)_40%,transparent)]">
        {ordered.map((category, index) => {
          const pad =
            index === 0
              ? "md:pr-5"
              : index === ordered.length - 1
                ? "md:pl-5"
                : "md:px-5";
          const hasGaps = category.rows.length > 0;
          return (
            <div key={category.key} className={`min-w-0 ${pad}`}>
              {hasGaps ? (
                <>
                  <p className="mb-1.5 px-1 text-[11.5px] leading-snug text-[var(--text-secondary)]">
                    <span className="font-semibold tabular-nums text-[var(--warning-ink)]">
                      {category.total}
                    </span>{" "}
                    {category.total === 1 ? "contract" : "contracts"} missing{" "}
                    {CATEGORY_GAP_NOUN[category.key]}
                  </p>
                  <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)]">
                    {category.rows.map((row) => {
                      const visibleFields = row.missing.slice(0, 2);
                      const overflow = row.missing.slice(2);
                      return (
                        <li key={row.id}>
                          <DashboardActionRow
                            href={row.href}
                            minHeightClassName="min-h-[2.5rem]"
                            paddingClassName="py-1.5"
                            hoverAction={gapFixLabel(CATEGORY_FIX_FIELD[category.key])}
                            title={
                              <p className="truncate text-[13px] font-semibold leading-[1.3] text-[var(--text-primary)]">
                                {row.title}
                              </p>
                            }
                            meta={
                              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                {visibleFields.map((field) => (
                                  <FieldChip key={field} label={field} transform="preserve" className="max-w-[10rem]" />
                                ))}
                                {overflow.length > 0 ? (
                                  <span
                                    title={`Also missing: ${overflow.join(", ")}`}
                                    aria-label={`${overflow.length} more detail${overflow.length === 1 ? "" : "s"}: ${overflow.join(", ")}`}
                                    className="inline-flex shrink-0 cursor-help"
                                  >
                                    <OverflowCount value={overflow.length} />
                                  </span>
                                ) : null}
                              </div>
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <div className="flex min-h-[2.5rem] items-center gap-2 px-1 py-1.5">
                  <Check
                    className="h-3.5 w-3.5 shrink-0"
                    strokeWidth={2.4}
                    style={{ color: "var(--success-ink)" }}
                    aria-hidden
                  />
                  <span
                    className="text-[11.5px] leading-snug"
                    style={{ color: "color-mix(in oklab, var(--success-ink) 72%, var(--text-secondary))" }}
                  >
                    No contracts missing {CATEGORY_GAP_NOUN[category.key]}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
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
      <p className="px-2 py-1.5 text-[11.5px] text-[var(--text-tertiary)]">
        No recent activity yet.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)]">
      {rows.map((row) => {
        const visual = activityVisual(row);
        const Icon = visual.icon;
        const ink = activityInk(visual.tone);
        const summary = row.summary?.trim() || row.label?.trim() || "Activity";
        return (
          <li key={row.id}>
            <Link
              href={row.href}
              className="group flex items-start gap-2.5 rounded-[6px] px-2 py-2 transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_12%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:outline-none"
            >
              <span aria-hidden className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center" style={{ color: ink }}>
                <Icon className="h-3.5 w-3.5" strokeWidth={1.85} />
              </span>
              <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-[var(--text-primary)]">
                <span className="font-medium">{summary}</span>
                {row.contractTitle ? (
                  <span className="font-normal text-[var(--text-secondary)]"> for {row.contractTitle}</span>
                ) : null}
              </p>
              {row.occurredAt ? (
                <TimeChip date={row.occurredAt} className="shrink-0 self-start text-[var(--text-tertiary)]" />
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
