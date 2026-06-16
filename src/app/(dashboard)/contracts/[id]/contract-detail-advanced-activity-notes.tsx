import type { ContractDetailPageModel } from "./contract-detail-page-model";
import * as D from "./contract-detail-view-deps";

export function ContractDetailAdvancedActivityNotes({ model }: { model: ContractDetailPageModel }) {
  const { ctx, canEdit, isCoreContractDetail, showContractAuditOps, showContractFieldCollaboration, contract, auditEvents, ownerMembers, notes, fieldComments, workflowTimeline, activeTab } = model;

  return (
    <>
          {showContractAuditOps && (activeTab === "overview" || activeTab === "timeline" || activeTab === "audit") && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4">
              <h3 className="ui-section-title text-base">Unified workflow timeline</h3>
            </div>
            <div className="p-6">
              {workflowTimeline.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)]">No workflow timeline entries yet.</p>
              ) : (
                <ul className="space-y-2">
                  {workflowTimeline.map((entry) => (
                    <li key={entry.id} className="flex items-start justify-between gap-3 text-xs">
                      <span className="text-[var(--text-secondary)]">
                        <span className="font-semibold">{D.humanizeContractEnumLabel(entry.domain)}</span> · {D.humanizeAuditEventLabel(entry.label)}
                      </span>
                      <span className="shrink-0 text-[var(--text-tertiary)]">
                        {D.format(new Date(entry.createdAt), "MMM d, h:mm a")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          )}

          {showContractAuditOps && (activeTab === "overview" || activeTab === "audit") && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4">
              <h3 className="ui-section-title text-base">Activity</h3>
            </div>
            <div className="p-6">
            {auditEvents.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No activity recorded.</p>
            ) : (
              <ul className="space-y-3">
                {auditEvents.map(
                  (event: {
                    id: string;
                    action: string;
                    created_at: string;
                  }) => (
                    <li key={event.id} className="flex items-start gap-2">
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--border-strong)]" />
                      <div>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {D.humanizeAuditEventLabel(event.action)}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {D.format(
                            new Date(event.created_at),
                            "MMM d, yyyy h:mm a"
                          )}
                        </p>
                      </div>
                    </li>
                  )
                )}
              </ul>
            )}
            </div>
          </div>
          )}

          {((activeTab === "notes") || (!isCoreContractDetail && activeTab === "overview")) && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4">
              <h3 className="ui-section-title text-base">Notes & commentary</h3>
            </div>
            <div className="p-6">
              <D.ContractNotesPanel
                contractId={contract.id}
                notes={notes}
                currentUserId={ctx.user.id}
                memberLabels={ownerMembers}
                canEdit={canEdit}
              />
              {showContractFieldCollaboration ? (
              <div id="field-comments" className="mt-6 border-t border-[var(--border-subtle)] pt-5 scroll-mt-28">
                <p className="ui-label-caps">Detail comments & mentions</p>
                {canEdit && (
                  <form action={D.createClarificationTaskForm as never} className="mt-2 space-y-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <input aria-label="Optional detail id" name="fieldId"
                      placeholder="Optional detail id"
                      className="ui-input text-xs"
                    />
                    <input aria-label="Team queue key" name="teamKey"
                      defaultValue="ops"
                      placeholder="Team queue key"
                      className="ui-input text-xs"
                    />
                    <textarea
                      name="requesterNote"
                      required
                      placeholder="Request clarification from owner/teammate..."
                      className="ui-input min-h-[64px] text-xs"
                    />
                    <button type="submit" className="ui-btn-secondary px-3 py-2 text-xs">
                      Create clarification task
                    </button>
                  </form>
                )}
                {canEdit && (
                  <form action={D.addFieldCommentForm} className="mt-2 space-y-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <input aria-label="Optional detail id" name="fieldId"
                      placeholder="Optional detail id"
                      className="ui-input text-xs"
                    />
                    <textarea
                      name="comment"
                      required
                      placeholder="Add detail-level context. Mention teammates with @email or @full.name."
                      className="ui-input min-h-[72px] text-xs"
                    />
                    <button type="submit" className="ui-btn-secondary px-3 py-2 text-xs">
                      Add detail comment
                    </button>
                  </form>
                )}
                {fieldComments.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {fieldComments.map((comment) => (
                      <li key={comment.id} className="rounded border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                        {comment.comment}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              ) : null}
            </div>
          </div>
          )}
    </>
  );
}
