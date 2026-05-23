import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Contract, ExtractedField } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBusinessDateAtNoon } from "@/lib/v9-business-dates";

interface UpcomingAction {
  contract: Pick<Contract, "id" | "title">;
  field: Pick<ExtractedField, "id" | "field_name" | "field_value">;
  daysUntil: number;
}

interface UpcomingActionsProps {
  actions: UpcomingAction[];
}

function formatFieldDateLabel(iso: string | null | undefined): string {
  return formatBusinessDateAtNoon(iso, "Unknown");
}

function urgencyRing(days: number): string {
  if (days <= 7) return "bg-[var(--danger-ink)]";
  if (days <= 30) return "bg-[var(--warning-ink)]";
  return "bg-[var(--border-strong)]";
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

export function UpcomingActions({ actions, embedded = false }: UpcomingActionsProps & { embedded?: boolean }) {
  if (actions.length === 0) {
    if (embedded) {
      return (
        <p className="ui-support-copy rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-3">
          No approved dates enter the two-week horizon.
        </p>
      );
    }
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
    <section className={embedded ? "overflow-hidden rounded-lg border border-[var(--border-subtle)]" : "ui-card overflow-hidden"}>
      <div className={embedded ? "border-b border-[var(--border-subtle)] px-3 py-2" : "ui-surface-tint px-4 py-3.5 md:px-6 md:py-4"}>
        <h2 className="ui-section-title">Upcoming actions</h2>
        <p className="mt-1 text-[11px] text-[var(--text-secondary)] md:text-[12.5px]">
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
                <p className="text-[14px] font-semibold leading-snug text-[var(--text-primary)] group-hover:text-[var(--accent-strong)] md:text-[14px]">
                  {action.contract.title}
                </p>
                <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
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
                  className={`text-right text-[12.5px] font-semibold tabular-nums ${
                    action.daysUntil <= 7
                      ? "text-[var(--danger-ink)]"
                      : action.daysUntil <= 30
                        ? "text-[var(--warning-ink)]"
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
                  strokeWidth={1.65}
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
