import type { ContractDetailPageModel } from "./contract-detail-page-model";
import * as D from "./contract-detail-view-deps";

export function ContractDetailAdvancedRenewalCard({ model }: { model: ContractDetailPageModel }) {
  const { canEdit, showContractRenewalWorkspace, contract, ownerMembers, renewalScenario, approvals, renewalWorkspaceNotes, isWatchlisted, activeTab } = model;

  return (
    <>
          {showContractRenewalWorkspace && (activeTab === "overview" || activeTab === "approvals" || activeTab === "renewals") && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4">
              <h3 className="ui-section-title text-base">Renewal scenario & approvals</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-[var(--text-tertiary)]">
                Scenario: {renewalScenario?.scenario?.replace(/_/g, " ") || "not set"}
                {renewalScenario?.blocker ? ` · input needed: ${renewalScenario.blocker}` : ""}
              </p>
              {canEdit && (
                <form action={D.upsertRenewalScenarioForm} className="space-y-2">
                  <input type="hidden" name="contractId" value={contract.id} />
                  <D.UiSelect
                    name="scenario"
                    defaultValue={renewalScenario?.scenario ?? "awaiting_decision"}
                    ariaLabel="Renewal scenario"
                    options={[
                      { value: "awaiting_decision", label: "awaiting decision" },
                      { value: "renew", label: "renew" },
                      { value: "renegotiate", label: "renegotiate" },
                      { value: "terminate", label: "terminate" },
                      { value: "replace", label: "replace" },
                      { value: "discontinue", label: "discontinue" },
                      { value: "temporary_extension", label: "temporary extension" },
                    ]}
                    variant="compact"
                    portal
                    className="w-full"
                    buttonClassName="w-full !min-h-11 text-xs"
                  />
                  <input aria-label="Dependency reason (optional)" name="blocker"
                    defaultValue={renewalScenario?.blocker ?? ""}
                    placeholder="Dependency reason (optional)"
                    className="ui-input text-xs"
                  />
                  <textarea
                    name="decisionNotes"
                    defaultValue={renewalScenario?.decision_notes ?? ""}
                    placeholder="Decision notes"
                    className="ui-input min-h-[70px] text-xs"
                  />
                  <D.UiSelect
                    name="workspaceStatus"
                    defaultValue={renewalScenario?.workspace_status ?? "in_progress"}
                    ariaLabel="Workspace status"
                    options={[
                      { value: "not_started", label: "not started" },
                      { value: "in_progress", label: "in progress" },
                      { value: "blocked", label: "needs input" },
                      { value: "decision_pending", label: "decision pending" },
                      { value: "closed", label: "closed" },
                    ]}
                    variant="compact"
                    portal
                    className="w-full"
                    buttonClassName="w-full !min-h-11 text-xs"
                  />
                  <D.UiSelect
                    name="ownerId"
                    defaultValue={renewalScenario?.owner_id ?? ""}
                    ariaLabel="Workspace owner"
                    options={[
                      { value: "", label: "Workspace owner (optional)" },
                      ...ownerMembers.map((member) => ({
                        value: member.userId,
                        label: member.label,
                      })),
                    ]}
                    variant="compact"
                    portal
                    searchThreshold={8}
                    className="w-full"
                    buttonClassName="w-full !min-h-11 text-xs"
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input aria-label="Target decision date" name="targetDecisionDate"
                      type="date"
                      defaultValue={renewalScenario?.target_decision_date ?? ""}
                      className="ui-input text-xs"
                    />
                    <input aria-label="Escalation date" name="escalationDate"
                      type="date"
                      defaultValue={renewalScenario?.escalation_date ?? ""}
                      className="ui-input text-xs"
                    />
                    <input aria-label="Confidence %" name="scenarioConfidence"
                      type="number"
                      min={1}
                      max={100}
                      defaultValue={renewalScenario?.scenario_confidence ?? ""}
                      placeholder="Confidence %"
                      className="ui-input text-xs"
                    />
                  </div>
                  <textarea
                    name="commercialContext"
                    defaultValue={renewalScenario?.commercial_context ?? ""}
                    placeholder="Commercial context (optional)"
                    className="ui-input min-h-[54px] text-xs"
                  />
                  <button type="submit" className="ui-btn-secondary w-full px-3 py-2 text-xs">
                    Save scenario
                  </button>
                </form>
              )}
              <div className="border-t border-[var(--border-subtle)] pt-4">
                <p className="ui-label-caps">Workspace notes ({renewalWorkspaceNotes.length})</p>
                {canEdit && (
                  <form action={D.addRenewalWorkspaceNoteForm as never} className="mt-2 space-y-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <textarea name="body" placeholder="Add renewal workspace note" className="ui-input min-h-[60px] text-xs" />
                    <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <input aria-label="Pinned" type="checkbox" name="pinned" value="1" className="ui-checkbox" />
                      Pin note
                    </label>
                    <button type="submit" className="ui-btn-secondary w-full px-3 py-2 text-xs">
                      Add note
                    </button>
                  </form>
                )}
                {renewalWorkspaceNotes.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {renewalWorkspaceNotes.slice(0, 4).map((note) => (
                      <li key={note.id} className="rounded border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                        {note.pinned ? "Pinned · " : ""}
                        {note.body}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="border-t border-[var(--border-subtle)] pt-4">
                <p className="ui-label-caps">Renewal command context</p>
                <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                  <li>
                    Watchlist:{" "}
                    <span className="font-semibold text-[var(--text-primary)]">{isWatchlisted ? "yes" : "no"}</span>
                  </li>
                  <li>
                    Pending approvals:{" "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {approvals.filter((a) => a.status === "pending").length}
                    </span>
                  </li>
                  <li>
                    Contract risk:{" "}
                    <span className="font-semibold text-[var(--text-primary)]">{contract.health_status ?? "unknown"}</span>
                  </li>
                  <li>
                    Why surfaced: target decision path, dependencies, approvals, and risk are coordinated here.
                  </li>
                </ul>
              </div>
              <div id="renewal-approvals" className="border-t border-[var(--border-subtle)] pt-4">
                <p className="ui-label-caps">Approvals ({approvals.length})</p>
                {canEdit && (
                  <form action={D.requestContractApprovalForm} className="mt-2 space-y-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <D.UiSelect
                      name="approvalType"
                      defaultValue="renewal_decision"
                      ariaLabel="Approval type"
                      options={[
                        { value: "renewal_decision", label: "renewal decision" },
                        { value: "notice_action", label: "notice action" },
                        { value: "commercial_exception", label: "commercial issue" },
                        { value: "ownership_handoff", label: "ownership handoff" },
                      ]}
                      variant="compact"
                      portal
                      className="w-full"
                      buttonClassName="w-full !min-h-11 text-xs"
                    />
                    <textarea name="notes" placeholder="Request notes" className="ui-input min-h-[60px] text-xs" />
                    <D.UiSelect
                      name="approverId"
                      defaultValue=""
                      ariaLabel="Approver"
                      options={[
                        { value: "", label: "Policy/default approver" },
                        ...ownerMembers.map((member) => ({
                          value: member.userId,
                          label: member.label,
                        })),
                      ]}
                      variant="compact"
                      portal
                      searchThreshold={8}
                      className="w-full"
                      buttonClassName="w-full !min-h-11 text-xs"
                    />
                    <D.UiSelect
                      name="category"
                      defaultValue="standard"
                      ariaLabel="Approval category"
                      options={[
                        { value: "standard", label: "standard" },
                        { value: "policy_exception", label: "policy issue" },
                        { value: "financial", label: "financial" },
                        { value: "operational", label: "operational" },
                      ]}
                      variant="compact"
                      portal
                      className="w-full"
                      buttonClassName="w-full !min-h-11 text-xs"
                    />
                    <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <input aria-label="Issue flag" type="checkbox" name="exceptionFlag" value="1" className="ui-checkbox" />
                      Mark as issue
                    </label>
                    <input aria-label="Issue reason (optional)" name="exceptionReason"
                      placeholder="Issue reason (optional)"
                      className="ui-input text-xs"
                    />
                    <button type="submit" className="ui-btn-secondary w-full px-3 py-2 text-xs">
                      Request approval
                    </button>
                  </form>
                )}
                {approvals.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {approvals.slice(0, 4).map((a) => (
                      <li key={a.id} className="rounded border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                        {a.approval_type.replace(/_/g, " ")} · {a.status}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          )}
    </>
  );
}
