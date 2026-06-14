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
import { ActivityFeed, type ActivityFeedItem } from "@/components/ui/activity-feed";
import { CountChip } from "@/components/ui/count-chip";
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
    <span className="inline-flex items-center rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase leading-none tracking-[0.12em] text-[var(--text-primary)] tabular-nums">
      +{value}
    </span>
  );
}
const CATEGORY_FIX_FIELD: Record<CoreDashboardDataGapCategory["key"], string> = {
  owners: "Owner",
  dates: "Renewal date",
  counterparties: "Counterparty",
};

export function DataGapBoard({
  categories,
  summary,
}: {
  categories: CoreDashboardDataGapCategory[];
  summary: CoreDashboardDataGapSummary;
}) {
  const active = categories.filter((category) => category.rows.length > 0);
  const clear = categories.filter((category) => category.rows.length === 0);
  const activeCols =
    active.length >= 3
      ? "md:grid-cols-3"
      : active.length === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-1";
  return (
    <div>
      {summary.oldestUpdatedAt ? (
        <div className="mb-2 flex items-center justify-end gap-1.5 px-1">
          <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Oldest gap</span>
          <TimeChip date={summary.oldestUpdatedAt} bordered className="shrink-0" />
        </div>
      ) : null}
      <div
        className={`grid grid-cols-1 gap-y-5 ${activeCols} md:gap-y-0 md:divide-x md:divide-[color:color-mix(in_oklab,var(--border-subtle)_40%,transparent)]`}
      >
        {active.map((category, index) => (
          <div
            key={category.key}
            className={`min-w-0 ${
              active.length === 1
                ? ""
                : index === 0
                  ? "md:pr-5"
                  : index === active.length - 1
                    ? "md:pl-5"
                    : "md:px-5"
            }`}
          >
            <div className="mb-1 flex items-center gap-1.5 px-1">
              <span className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">
                {category.label}
              </span>
              <CountChip value={category.total} emphasis="strong" tone="warning" />
            </div>
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
                        <p className="truncate text-[13px] font-semibold leading-[1.3] tracking-tight text-[var(--text-primary)]">
                          {row.title}
                        </p>
                      }
                      meta={
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          {visibleFields.map((field) => (
                            <FieldChip key={field} label={field} className="max-w-[10rem]" />
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
          </div>
        ))}
      </div>
      {clear.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)] px-1 pt-3">
          {clear.map((category) => (
            <span
              key={category.key}
              className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1"
              style={{
                borderColor: "color-mix(in oklab, var(--success-ink) 24%, var(--border-card))",
                background: "color-mix(in oklab, var(--success-ink) 8%, var(--surface))",
              }}
            >
              <Check
                className="h-3 w-3 shrink-0"
                strokeWidth={2.4}
                style={{ color: "var(--success-ink)" }}
                aria-hidden
              />
              <span
                className="ui-caps-2 text-[10px]"
                style={{ color: "color-mix(in oklab, var(--success-ink) 70%, var(--text-secondary))" }}
              >
                {category.label}
              </span>
              <span
                className="ui-caps-3 text-[9.5px]"
                style={{ color: "color-mix(in oklab, var(--success-ink) 55%, var(--text-tertiary))" }}
              >
                All clear
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ActivityRows({ rows }: { rows: CoreDashboardActivityRow[] }) {
  const items: ActivityFeedItem[] = rows.map((row) => {
    const visual = activityVisual(row);
    return {
      id: row.id,
      icon: visual.icon,
      tone: visual.tone,
      verb: visual.verb,
      target: row.contractTitle ?? undefined,
      timestamp: row.occurredAt ?? "",
      href: row.href,
    };
  });
  return <ActivityFeed items={items} emptyLabel="No recent activity" />;
}
