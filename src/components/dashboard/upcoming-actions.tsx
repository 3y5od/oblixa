import Link from "next/link";
import { format, isValid } from "date-fns";
import { ArrowUpRight } from "lucide-react";
import type { Contract, ExtractedField } from "@/lib/types";

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
  if (fieldName === "notice_window") return "Why: notice deadlines drive non-renewal decision timing.";
  if (fieldName === "renewal_date") return "Why: renewal window needs scenario + owner alignment.";
  if (fieldName === "end_date") return "Why: term ending requires continuity or offboarding decision.";
  return "Why: approved contract date is entering execution horizon.";
}

export function UpcomingActions({ actions }: UpcomingActionsProps) {
  if (actions.length === 0) {
    return (
      <section className="ui-card flex min-h-[220px] flex-col justify-center px-6 py-8 text-center md:min-h-[240px] md:px-8 md:py-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Calendar
        </p>
        <h2 className="mt-2 ui-section-title text-base">No upcoming deadlines</h2>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-zinc-500 md:text-sm">
          When notice, renewal, or end dates are approved, they appear here with
          a clear countdown.
        </p>
      </section>
    );
  }

  return (
    <section className="ui-card overflow-hidden">
      <div className="border-b border-zinc-100/90 bg-zinc-50/30 px-4 py-3.5 md:px-6 md:py-4">
        <h2 className="ui-section-title">Upcoming actions</h2>
        <p className="mt-1 text-[11px] text-zinc-500 md:text-[12px]">
          Approved operational dates in the next 90 days
        </p>
      </div>
      <ul className="divide-y divide-zinc-100">
        {actions.map((action) => (
          <li key={action.field.id}>
            <Link
              href={`/contracts/${action.contract.id}#field-${action.field.id}`}
              className="ui-transition-surface group flex items-start gap-3.5 px-4 py-3.5 hover:bg-zinc-50/70 md:gap-4 md:px-6 md:py-4"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${urgencyRing(action.daysUntil)}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold leading-snug text-zinc-900 group-hover:text-[var(--accent)] md:text-[15px]">
                  {action.contract.title}
                </p>
                <p className="mt-0.5 text-[13px] text-zinc-500">
                  <span className="text-zinc-700">
                    {action.field.field_name.replace(/_/g, " ")}
                  </span>
                  <span className="text-zinc-300"> · </span>
                  {formatFieldDateLabel(action.field.field_value)}
                </p>
                <p className="mt-1 text-[11px] text-zinc-400">
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
                        : "text-zinc-500"
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
                  className="text-zinc-300 transition-colors group-hover:text-[var(--accent)]"
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
