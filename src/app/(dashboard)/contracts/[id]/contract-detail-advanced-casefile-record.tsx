import type { ContractDetailPageModel } from "./contract-detail-page-model";
import * as D from "./contract-detail-view-deps";

export function ContractDetailAdvancedCasefileRecord({ model }: { model: ContractDetailPageModel }) {
  const { canEdit, canDelete, showContractWorkflowOps, showContractAuditOps, showContractRecordControls, contract, ownerMembers, showContractOwnerAssignment, handoffChecklists, mergedCasefile, activeTab } = model;

  return (
    <>
          {showContractAuditOps && (activeTab === "overview" || activeTab === "exceptions" || activeTab === "casefile" || activeTab === "audit") && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4">
              <h3 className="ui-section-title text-base">Operational casefile</h3>
            </div>
            <div className="p-6">
              {mergedCasefile.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)]">No casefile events recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {mergedCasefile.map((entry) => (
                    <li key={entry.id} className="flex items-start justify-between gap-3 text-xs">
                      <span className="text-[var(--text-secondary)]">
                        <span className="font-semibold">{entry.headline}</span>
                        {entry.detail ? ` · ${entry.detail}` : ""}
                        <span className="text-[var(--text-tertiary)]"> · {entry.kind}</span>
                      </span>
                      <span className="shrink-0 text-[var(--text-tertiary)]">
                        {D.format(new Date(entry.occurred_at), "MMM d, h:mm a")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          )}

          {showContractRecordControls && (
          <div id="ownership-record" className="ui-card scroll-mt-6 overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4">
              <h3 className="ui-section-title text-base">Ownership & record</h3>
            </div>
            <div className="p-6">
            <dl className="space-y-3">
              <div className="flex items-center gap-2">
                <D.User size={14} className="text-[var(--text-tertiary)]" />
                <dt className="text-sm text-[var(--text-tertiary)]">Owner</dt>
                <dd className="ml-auto text-sm font-medium text-[var(--text-primary)]">
                  {contract.owner?.full_name || contract.owner?.email || "—"}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <D.Calendar size={14} className="text-[var(--text-tertiary)]" />
                <dt className="text-sm text-[var(--text-tertiary)]">Created</dt>
                <dd className="ml-auto text-sm text-[var(--text-primary)]">
                  {D.format(new Date(contract.created_at), "MMM d, yyyy")}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <D.Calendar size={14} className="text-[var(--text-tertiary)]" />
                <dt className="text-sm text-[var(--text-tertiary)]">Updated</dt>
                <dd className="ml-auto text-sm text-[var(--text-primary)]">
                  {D.format(new Date(contract.updated_at), "MMM d, yyyy")}
                </dd>
              </div>
            </dl>
            {showContractOwnerAssignment && (
              <D.OwnerAssignmentForm
                contractId={contract.id}
                currentOwnerId={contract.owner_id}
                currentSecondaryOwnerId={contract.secondary_owner_id ?? null}
                members={ownerMembers}
              />
            )}
            {showContractWorkflowOps && canEdit && ownerMembers.length > 0 && (
              <form action={D.upsertContractHandoffChecklistForm} className="mt-4 space-y-2">
                <input type="hidden" name="contractId" value={contract.id} />
                <p className="ui-label-caps">Ownership handoff checklist</p>
                <D.UiSelect
                  name="toOwnerId"
                  required
                  defaultValue=""
                  ariaLabel="New owner"
                  placeholder="Select new owner…"
                  options={ownerMembers.map((m) => ({
                    value: m.userId,
                    label: m.label,
                  }))}
                  variant="compact"
                  portal
                  searchThreshold={8}
                  className="w-full"
                  buttonClassName="w-full !min-h-11 text-xs"
                />
                <textarea
                  name="checklistNote"
                  required
                  maxLength={4000}
                  placeholder="Capture context, client nuance, unresolved issues, and next actions."
                  className="ui-input min-h-[72px] text-xs"
                />
                <button type="submit" className="ui-btn-secondary px-3 py-2 text-xs">
                  Save handoff checklist
                </button>
                {handoffChecklists.length > 0 && (
                  <ul className="space-y-1.5">
                    {handoffChecklists.slice(0, 3).map((item) => (
                      <li key={item.id} className="text-xs text-[var(--text-secondary)]">
                        <span>{item.status} · {item.checklist_note}</span>
                        {item.status !== "completed" && (
                          <form
                            action={D.updateContractHandoffChecklistStatusForm.bind(
                              null,
                              item.id,
                              "completed"
                            )}
                            className="inline-block ml-2"
                          >
                            <button type="submit" className="ui-btn-secondary px-2 py-0.5 text-[11px]">
                              Mark complete
                            </button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </form>
            )}
            {showContractRecordControls ? (
              <D.DeleteContractButton
                contractId={contract.id}
                contractTitle={contract.title}
                canDelete={canDelete}
              />
            ) : null}
            </div>
          </div>
          )}
    </>
  );
}
