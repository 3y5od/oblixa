import type { ContractDetailPageModel } from "./contract-detail-page-model";
import * as D from "./contract-detail-view-deps";

export function ContractDetailAdvancedApprovalReminders({ model }: { model: ContractDetailPageModel }) {
  const { showContractAuditOps, upcomingReminders, reminderHistory, reminderDeliveryMap, approvals, activeTab } = model;

  return (
    <>
          {showContractAuditOps && (activeTab === "overview" || activeTab === "approvals" || activeTab === "audit") && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4">
              <h3 className="ui-section-title text-base">Approval evidence and decision history</h3>
            </div>
            <div className="p-6">
              {approvals.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)]">No approval evidence recorded yet.</p>
              ) : (
                <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
                  {approvals.slice(0, 6).map((approval) => (
                    <li key={approval.id} className="rounded border border-[var(--border-subtle)] px-3 py-2">
                      {D.humanizeContractEnumLabel(approval.approval_type)} · {D.humanizeContractEnumLabel(approval.status)}
                      {approval.resolved_at ? ` · Decided ${D.format(new Date(approval.resolved_at), "MMM d, yyyy")}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          )}

          {showContractAuditOps && (activeTab === "overview" || activeTab === "audit" || activeTab === "reports") && (
          <div id="reminder-delivery-history" className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4">
              <h3 className="flex items-center gap-2 ui-section-title text-base">
                <D.Bell size={17} className="text-[var(--accent)]" strokeWidth={1.65} aria-hidden />
                Reminders
              </h3>
            </div>
            <div className="p-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase text-[var(--text-tertiary)]">
                  Scheduled
                </p>
                {upcomingReminders.length === 0 ? (
                  <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                    None pending. Confirm a date detail to schedule reminders.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {upcomingReminders.map(
                      (r: {
                        id: string;
                        reminder_type: string;
                        reminder_date: string;
                      }) => {
                        const delivery = D.getReminderDeliveryState(reminderDeliveryMap[r.id] ?? []);
                        const deliveryToneClass =
                          delivery.tone === "healthy"
                            ? "border-[color:color-mix(in_oklab,var(--success)_32%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_24%,var(--surface-raised))] text-[var(--success-ink)]"
                            : delivery.tone === "risk"
                              ? "border-[color:color-mix(in_oklab,var(--danger)_38%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger)_10%,var(--surface))] text-[var(--danger)]"
                              : delivery.tone === "attention"
                                ? "border-[color:color-mix(in_oklab,var(--warning)_42%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning)_12%,var(--surface))] text-[var(--warning-ink)]"
                                : "border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] text-[var(--text-secondary)]";
                        return (
                          <li
                            key={r.id}
                            className="rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] px-3 py-2 text-sm"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-[var(--text-primary)]">
                                {r.reminder_type.replace(/_/g, " ")}
                              </span>
                              <span className="text-[var(--text-tertiary)]">
                                {D.formatBusinessDateAtNoon(r.reminder_date)}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${deliveryToneClass}`}
                              >
                                {delivery.label}
                              </span>
                            </div>
                            <p className="mt-1 text-[12.5px] text-[var(--text-tertiary)]">{delivery.detail}</p>
                            {delivery.timestamp ? (
                              <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                                Updated {D.format(new Date(delivery.timestamp), "MMM d, yyyy h:mm a")}
                              </p>
                            ) : null}
                          </li>
                        );
                      }
                    )}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-[var(--text-tertiary)]">
                  Sent (history)
                </p>
                {reminderHistory.length === 0 ? (
                  <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                    No reminder emails sent yet for this contract.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {reminderHistory.map(
                      (r: {
                        id: string;
                        reminder_type: string;
                        reminder_date: string;
                        sent_at: string;
                      }) => {
                        const delivery = D.getReminderDeliveryState(reminderDeliveryMap[r.id] ?? []);
                        const deliveryToneClass =
                          delivery.tone === "healthy"
                            ? "border-[color:color-mix(in_oklab,var(--success)_32%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_24%,var(--surface-raised))] text-[var(--success-ink)]"
                            : delivery.tone === "risk"
                              ? "border-[color:color-mix(in_oklab,var(--danger)_38%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger)_10%,var(--surface))] text-[var(--danger)]"
                              : delivery.tone === "attention"
                                ? "border-[color:color-mix(in_oklab,var(--warning)_42%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning)_12%,var(--surface))] text-[var(--warning-ink)]"
                                : "border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] text-[var(--text-secondary)]";
                        return (
                          <li key={r.id} className="rounded-lg border border-[var(--border-subtle)]/70 px-3 py-2 text-sm text-[var(--text-secondary)]">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[var(--text-primary)]">
                                {r.reminder_type.replace(/_/g, " ")}
                              </span>
                              <span>scheduled {D.formatBusinessDateAtNoon(r.reminder_date)}</span>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${deliveryToneClass}`}
                              >
                                {delivery.label}
                              </span>
                            </div>
                            {r.sent_at ? (
                              <p className="mt-1 text-[12.5px] text-[var(--text-tertiary)]">
                                Sent {D.format(new Date(r.sent_at), "MMM d, yyyy h:mm a")}
                              </p>
                            ) : null}
                            <p className="mt-1 text-[12.5px] text-[var(--text-tertiary)]">{delivery.detail}</p>
                          </li>
                        );
                      }
                    )}
                  </ul>
                )}
              </div>
            </div>
            </div>
          </div>
          )}
    </>
  );
}
