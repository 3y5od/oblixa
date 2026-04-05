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
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Upcoming Actions</h2>
        <p className="mt-4 text-sm text-gray-500">
          No upcoming deadlines. Contracts with approved notice or renewal dates
          will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Upcoming Actions</h2>
      </div>
      <ul className="divide-y divide-gray-100">
        {actions.map((action) => (
          <li key={action.field.id}>
            <Link
              href={`/contracts/${action.contract.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-lg p-2 ${
                    action.daysUntil <= 7
                      ? "bg-red-100 text-red-600"
                      : action.daysUntil <= 30
                        ? "bg-amber-100 text-amber-600"
                        : "bg-blue-100 text-blue-600"
                  }`}
                >
                  <Calendar size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {action.contract.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {action.field.field_name.replace(/_/g, " ")} &middot;{" "}
                    {action.field.field_value
                      ? format(new Date(action.field.field_value), "MMM d, yyyy")
                      : "Unknown"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium ${
                    action.daysUntil <= 7
                      ? "text-red-600"
                      : action.daysUntil <= 30
                        ? "text-amber-600"
                        : "text-gray-500"
                  }`}
                >
                  {action.daysUntil === 0
                    ? "Today"
                    : action.daysUntil === 1
                      ? "Tomorrow"
                      : `${action.daysUntil} days`}
                </span>
                <ArrowRight size={14} className="text-gray-400" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
