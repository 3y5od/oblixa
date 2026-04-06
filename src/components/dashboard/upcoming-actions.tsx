import Link from "next/link";
import { format } from "date-fns";
import { Calendar, ArrowRight } from "lucide-react";
import type { Contract, ExtractedField } from "@/lib/types";

interface UpcomingAction {
  contract: Contract;
  field: ExtractedField;
  daysUntil: number;
}

interface UpcomingActionsProps {
  actions: UpcomingAction[];
}

export function UpcomingActions({ actions }: UpcomingActionsProps) {
  if (actions.length === 0) {
    return (
      <div className="ui-card p-6 shadow-none">
        <h2 className="ui-section-title">Upcoming actions</h2>
        <p className="mt-3 text-sm text-zinc-500">
          No upcoming deadlines. Contracts with approved notice or renewal dates
          will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="ui-card overflow-hidden shadow-none">
      <div className="border-b border-zinc-200/90 px-6 py-4">
        <h2 className="ui-section-title">Upcoming actions</h2>
      </div>
      <ul className="divide-y divide-zinc-200/70">
        {actions.map((action) => (
          <li key={action.field.id}>
            <Link
              href={`/contracts/${action.contract.id}#field-${action.field.id}`}
              className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-zinc-50/80"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex rounded-lg border p-2 ${
                    action.daysUntil <= 7
                      ? "border-rose-200/80 bg-rose-50 text-rose-700"
                      : action.daysUntil <= 30
                        ? "border-amber-200/80 bg-amber-50 text-amber-800"
                        : "border-sky-200/80 bg-sky-50 text-sky-800"
                  }`}
                >
                  <Calendar size={16} strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {action.contract.title}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {action.field.field_name.replace(/_/g, " ")} &middot;{" "}
                    {action.field.field_value
                      ? format(new Date(action.field.field_value), "MMM d, yyyy")
                      : "Unknown"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold tabular-nums ${
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
                      : `${action.daysUntil} days`}
                </span>
                <ArrowRight size={14} className="text-zinc-400" strokeWidth={1.75} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
