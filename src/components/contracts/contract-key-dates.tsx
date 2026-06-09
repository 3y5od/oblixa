import Link from "next/link";
import { Bell, ChevronRight, ListChecks } from "lucide-react";
import { DUE_SOON_DAYS, parseBusinessDateAtNoon } from "@/lib/business-dates";
import { humanizeOperationalToken } from "@/lib/ui/operational-copy";
import { TimeChip } from "@/components/ui/time-chip";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { CountChip } from "@/components/ui/count-chip";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import { RenewalCheckpointsPanel } from "./renewal-checkpoints-panel";
import type { ContractRenewalCheckpoint } from "@/lib/types";

type DateRow = {
  key: string;
  id: string | null;
  label: string;
  value: string;
  status: string;
  confidence: number | null;
};
type ReminderRow = { id: string; reminder_type: string; reminder_date: string };
type CheckpointRow = Pick<
  ContractRenewalCheckpoint,
  "id" | "label" | "offset_days" | "due_date" | "status" | "completed_at" | "renewal_state" | "workspace_json"
>;

function statusToSemantic(status: string): SemanticStatus {
  if (["approved", "active", "complete", "completed", "accepted"].includes(status)) return "healthy";
  if (["rejected", "failed", "blocked"].includes(status)) return "blocked";
  if (["pending", "pending_review", "awaiting_review", "in_progress", "open"].includes(status)) return "warning";
  return "empty";
}

function reminderUrgency(reminderDate: string): { overdue: boolean; soon: boolean } {
  const due = parseBusinessDateAtNoon(reminderDate);
  if (!due) return { overdue: false, soon: false };
  const days = Math.round((due.getTime() - Date.now()) / 86_400_000);
  return { overdue: days < 0, soon: days >= 0 && days <= DUE_SOON_DAYS };
}

/**
 * Populated body of the Core "Key dates" panel: the reviewed/suggested/missing
 * date rows, scheduled reminders, and renewal tasks. The section header and the
 * waiting-on-extraction empty state stay in the route so their copy is owned
 * there. notice_window renders as a duration token, never a calendar date.
 */
export function ContractKeyDates({
  dateRows,
  reminders,
  checkpoints,
  canEdit,
  contractId,
}: {
  dateRows: DateRow[];
  reminders: ReminderRow[];
  checkpoints: CheckpointRow[];
  canEdit: boolean;
  contractId: string;
}) {
  return (
    <>
      <div className="px-5 py-2 sm:px-6">
        <div className="divide-y divide-[var(--border-subtle)]">
          {dateRows.map((row) => {
            const isMissing = row.status === "missing";
            const isPending = row.status === "pending";
            const isNotice = row.key === "notice_window";
            const actionable = isMissing || isPending;
            const parsed = isNotice ? null : parseBusinessDateAtNoon(row.value);
            const href = isMissing
              ? "#extracted-fields"
              : `/contracts/review?contract=${contractId}${row.id ? `&field=${row.id}` : ""}`;
            const rowInner = (
              <>
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="inline-flex h-1.5 w-1.5 min-w-[0.375rem] shrink-0 items-center justify-center"
                    aria-hidden
                  >
                    {actionable ? (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          background: "var(--warning-ink)",
                          boxShadow: "0 0 0 2.5px color-mix(in oklab, var(--warning-ink) 24%, transparent)",
                        }}
                      />
                    ) : null}
                  </span>
                  <div className="min-w-0">
                    <p className="ui-caps-3 text-[11px] text-[var(--text-tertiary)]">{row.label}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[13.5px] font-semibold tabular-nums text-[var(--text-primary)]">
                      {isMissing ? (
                        <>
                          <span aria-hidden className="font-medium text-[var(--text-tertiary)]">
                            —
                          </span>
                          <span className="sr-only">No {row.label.toLowerCase()} recorded</span>
                        </>
                      ) : isNotice ? (
                        <span className="inline-flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                          {row.value}
                        </span>
                      ) : parsed ? (
                        <TimeChip date={parsed} format="calendar" bordered />
                      ) : (
                        <span className="text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                          {row.value}
                        </span>
                      )}
                      {row.confidence != null ? (
                        <KeyValueChip label="Source match" value={`${Math.round(row.confidence * 100)}%`} />
                      ) : null}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isMissing ? (
                    <StatusBadge status="warning">Missing</StatusBadge>
                  ) : (
                    <StatusBadge status={statusToSemantic(row.status)}>
                      {/* An unreviewed extracted/imported date is "Suggested"
                          (Data Confidence vocabulary), not a generic "Pending"
                          — so the rows don't all read identically. */}
                      {isPending ? "Suggested" : humanizeOperationalToken(row.status)}
                    </StatusBadge>
                  )}
                  {actionable ? (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--accent-strong)] opacity-0 transition-opacity group-hover/date:opacity-100 group-focus-visible/date:opacity-100">
                      {isMissing ? "Add date" : "Review"}
                      <ChevronRight className="h-2.5 w-2.5" strokeWidth={1.85} aria-hidden />
                    </span>
                  ) : null}
                </div>
              </>
            );
            // Only rows with a real next action are links; approved rows are
            // static (no self-anchor link).
            return actionable ? (
              <Link
                key={row.key}
                href={href}
                className="group/date flex items-center justify-between gap-3 rounded-md py-2.5 outline-none transition-colors first:pt-0 hover:bg-[color:color-mix(in_oklab,var(--warning-soft)_14%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--warning-soft)_14%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                {rowInner}
              </Link>
            ) : (
              <div key={row.key} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                {rowInner}
              </div>
            );
          })}
        </div>
      </div>
      {reminders.length > 0 || checkpoints.length > 0 ? (
        <div className="border-t border-[var(--border-subtle)] px-5 py-3 sm:px-6">
          {reminders.length > 0 ? (
            <>
              <div className="flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
                <p className="ui-caps-3 text-[11px] text-[var(--text-tertiary)]">Scheduled reminders</p>
                <CountChip value={reminders.length} />
              </div>
              <ul className="mt-2 divide-y divide-[var(--border-subtle)]">
                {reminders.map((reminder) => {
                  const { overdue, soon } = reminderUrgency(reminder.reminder_date);
                  const dotInk = overdue ? "var(--danger-ink)" : soon ? "var(--warning-ink)" : null;
                  return (
                    <li key={reminder.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span aria-hidden className="inline-flex h-1.5 w-1.5 min-w-[0.375rem] shrink-0 items-center justify-center">
                          {dotInk ? (
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: dotInk, boxShadow: `0 0 0 2.5px color-mix(in oklab, ${dotInk} 24%, transparent)` }}
                            />
                          ) : null}
                        </span>
                        <p className="ui-caps-3 truncate text-[11px] text-[var(--text-secondary)]">
                          {humanizeOperationalToken(reminder.reminder_type)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {overdue ? (
                          <StatusBadge status="overdue">Overdue</StatusBadge>
                        ) : soon ? (
                          <StatusBadge status="warning">Due soon</StatusBadge>
                        ) : null}
                        <TimeChip
                          date={reminder.reminder_date}
                          format="calendar"
                          tone={overdue ? "danger" : soon ? "warning" : undefined}
                          bordered
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
          {checkpoints.length > 0 ? (
            <div className={reminders.length > 0 ? "mt-4 border-t border-[var(--border-subtle)] pt-4" : ""}>
              <div className="flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
                <p className="ui-caps-3 text-[11px] text-[var(--text-tertiary)]">Renewal tasks</p>
                <CountChip value={checkpoints.length} />
              </div>
              <div className="mt-2">
                <RenewalCheckpointsPanel checkpoints={checkpoints} canEdit={canEdit} compact />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
