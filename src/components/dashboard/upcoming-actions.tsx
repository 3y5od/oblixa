import Link from "next/link";
import { format, isValid } from "date-fns";
import { ArrowUpRight } from "lucide-react";
import type { Contract, ExtractedField } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";

interface UpcomingAction {
  contract: Pick<Contract, "id" | "title">;
  field: Pick<ExtractedField, "id" | "field_name" | "field_value">;
  daysUntil: number;
}

interface UpcomingActionsProps {
  actions: UpcomingAction[];
}

function formatFieldDateLabel(iso: string | null | undefined): string {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  return isValid(d) ? format(d, "MMM d, yyyy") : "Invalid date";
}

function urgencyRing(days: number): string {
  if (days <= 7) return "bg-rose-500";
  if (days <= 30) return "bg-amber-400";
  return "bg-zinc-300";
}

function rationaleForField(fieldName: string): string {
  if (fieldName === "notice_window")
    return "Notice deadline drives non-renewal and exit timing.";
  if (fieldName === "renewal_date")
    return "Renewal window needs scenario, owner, and commercial alignment.";
  if (fieldName === "end_date")
    return "Term ending requires continuity or offboarding decisions.";
  return "Approved effective date is entering the execution horizon.";
}

export function UpcomingActions({ actions }: UpcomingActionsProps) {
  if (actions.length === 0) {
    return (
      <section>
        <EmptyState
          eyebrow="Calendar"
          title="No upcoming deadlines"
          copy="When notice, renewal, or end dates are approved, they appear here with a clear countdown."
          className="min-h-[220px] md:min-h-[240px]"
        />
      </section>
    );
  }

  return (
    <section className="ui-card overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_52%,transparent)] px-4 py-3.5 md:px-6 md:py-4">
        <h2 className="ui-section-title">Upcoming actions</h2>
        <p className="mt-1 text-[11px] text-[var(--text-secondary)] md:text-[12px]">
          Approved operational dates in the next 90 days
        </p>
      </div>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {actions.map((action) => (
          <li key={action.field.id}>
            <Link
              href={`/contracts/${action.contract.id}#field-${action.field.id}`}
              className="ui-transition-surface group flex items-start gap-3.5 px-4 py-3.5 hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_72%,transparent)] md:gap-4 md:px-6 md:py-4"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${urgencyRing(action.daysUntil)}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold leading-snug text-[var(--text-primary)] group-hover:text-[var(--accent-strong)] md:text-[15px]">
                  {action.contract.title}
                </p>
                <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                  <span className="text-[var(--text-primary)]">
                    {action.field.field_name.replace(/_/g, " ")}
                  </span>
                  <span className="text-[var(--text-tertiary)]"> · </span>
                  {formatFieldDateLabel(action.field.field_value)}
                </p>
                <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                  {rationaleForField(action.field.field_name)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`text-right text-[13px] font-semibold tabular-nums ${
                    action.daysUntil <= 7
                      ? "text-rose-700"
                      : action.daysUntil <= 30
                        ? "text-amber-800"
                        : "text-[var(--text-secondary)]"
                  }`}
                >
                  {action.daysUntil === 0
                    ? "Today"
                    : action.daysUntil === 1
                      ? "Tomorrow"
                      : `${action.daysUntil}d`}
                </span>
                <ArrowUpRight
                  size={16}
                  className="text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--accent-strong)]"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
