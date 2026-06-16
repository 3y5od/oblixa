import type { ContractDetailPageModel } from "./contract-detail-page-model";
import * as D from "./contract-detail-view-deps";

export function ContractDetailAdvancedWorkflowCard({ model }: { model: ContractDetailPageModel }) {
  const { orgId, admin, canEdit, showContractWorkflowOps, showContractAdvancedRouting, showContractEvidenceOps, showUtilityExecutionSurfaces, showProgramsSurface, showCollaborationSurface, contract, executionGraphEdges, evidenceRequirements, latestEvidenceSubmissionByRequirement, canReviewEvidence, activeTab, programAssignmentsData } = model;

  return (
    <>
          {((showContractWorkflowOps && ["overview", "workflow"].includes(activeTab)) ||
            (showContractAdvancedRouting && ["overview", "programs", "integrations"].includes(activeTab)) ||
            (showContractEvidenceOps && ["overview", "evidence", "reports"].includes(activeTab))) && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4">
              <h3 className="ui-section-title text-base">
                {showContractEvidenceOps && !showContractWorkflowOps ? "Operational evidence pack" : "Workflow status"}
              </h3>
            </div>
            <div className="p-6">
              {showContractWorkflowOps ? (
              <>
                <D.ContractStatusTransition
                  contractId={contract.id}
                  currentStatus={contract.status}
                  canEdit={canEdit}
                />
              <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
                <p className="ui-label-caps">Operational lifecycle</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Intake: {contract.intake_status ?? "awaiting_review"} · Health:{" "}
                  {contract.health_status ?? "unknown"}
                </p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Next step: {contract.required_next_step || "Not set"}
                </p>
                {canEdit && (
                  <form action={D.updateContractOperationalStateForm} className="mt-3 space-y-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="min-w-0">
                      <D.UiSelect
                        name="intakeStatus"
                        defaultValue={contract.intake_status ?? "awaiting_review"}
                        ariaLabel="Intake status"
                        options={[
                          { value: "awaiting_review", label: "awaiting review" },
                          { value: "in_clarification", label: "in clarification" },
                          { value: "active", label: "active" },
                          { value: "at_risk", label: "at risk" },
                          { value: "renewal_prep", label: "renewal prep" },
                          { value: "notice_decision", label: "notice decision" },
                          { value: "archived", label: "archived" },
                        ]}
                        variant="compact"
                        portal
                        className="w-full"
                        buttonClassName="w-full min-w-0 !min-h-11 text-xs"
                      />
                      </div>
                      <div className="min-w-0">
                      <D.UiSelect
                        name="healthStatus"
                        defaultValue={contract.health_status ?? "unknown"}
                        ariaLabel="Health status"
                        options={[
                          { value: "healthy", label: "healthy" },
                          { value: "watch", label: "watch" },
                          { value: "at_risk", label: "at risk" },
                          { value: "unknown", label: "unknown" },
                        ]}
                        variant="compact"
                        portal
                        className="w-full"
                        buttonClassName="w-full min-w-0 !min-h-11 text-xs"
                      />
                      </div>
                    </div>
                    <input aria-label="Required next step" name="requiredNextStep"
                      defaultValue={contract.required_next_step ?? ""}
                      placeholder="Required next step"
                      maxLength={240}
                      className="ui-input text-xs"
                    />
                    <button type="submit" className="ui-btn-secondary w-full px-3 py-2 text-xs">
                      Update lifecycle
                    </button>
                  </form>
                )}
              </div>
              </>
              ) : null}
              {showUtilityExecutionSurfaces ? (
                <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
                  <p className="ui-label-caps">Execution graph</p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">Cross-work dependencies for this contract.</p>
                  <D.Link
                    href={`/contracts/execution-graph?contractId=${contract.id}`}
                    className="ui-link mt-2 inline-block text-xs"
                  >
                    Inspect portfolio graph
                  </D.Link>
                  {executionGraphEdges.length > 0 ? (
                    <div className="mt-3 max-h-[320px] overflow-auto">
                      <D.ExecutionGraphVizDynamic edges={executionGraphEdges} />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-[var(--text-tertiary)]">Apply a program to generate dependency edges.</p>
                  )}
                </div>
              ) : null}
              {showContractEvidenceOps ? (
              <div id="contract-evidence" className="mt-6 border-t border-[var(--border-subtle)] pt-5">
                <p className="ui-label-caps">Operational evidence pack</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Export submissions and requirements for audits.
                </p>
                <D.ApiJsonLink
                  href={`/api/evidence/export/${contract.id}`}
                  className="ui-link mt-2 inline-block text-xs"
                >
                  Download evidence pack (JSON)
                </D.ApiJsonLink>
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                    Active requirements
                  </p>
                  <div className="mt-2">
                    <D.ContractEvidenceRequirementsPanel
                      requirements={evidenceRequirements}
                      canEdit={canEdit}
                      canReview={canReviewEvidence}
                      contractId={contract.id}
                      latestSubmissionByRequirement={latestEvidenceSubmissionByRequirement}
                    />
                  </div>
                </div>
              </div>
              ) : null}
              {showContractAdvancedRouting ? (
              <D.ContractExternalCollaborationSummary
                admin={admin}
                orgId={orgId}
                contractId={contract.id}
                allowed={showCollaborationSurface}
              />
              ) : null}
              {showProgramsSurface && (programAssignmentsData ?? []).length > 0 ? (
                <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
                  <p className="ui-label-caps">Program assignment overrides</p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    Per-contract routing JSON merged when programs apply (assignee_id, assignee_by_team).
                  </p>
                  <ul className="mt-3 space-y-3">
                    {(programAssignmentsData ?? []).map(
                      (row: {
                        id: string;
                        program_id: string;
                        override_json: Record<string, unknown>;
                        contract_programs: { name: string } | { name: string }[] | null;
                      }) => {
                        const prog = row.contract_programs;
                        const programName = Array.isArray(prog)
                          ? prog[0]?.name
                          : prog?.name;
                        return (
                          <li key={row.id} className="rounded-lg border border-[var(--border-subtle)] p-3 text-xs">
                            <p className="font-medium text-[var(--text-primary)]">
                              {programName ?? row.program_id}
                            </p>
                            {canEdit ? (
                              <form action={D.updateProgramAssignmentOverrideFormAction} className="mt-2 space-y-2">
                                <input type="hidden" name="assignmentId" value={row.id} />
                                <textarea
                                  name="overrideJson"
                                  defaultValue={JSON.stringify(row.override_json ?? {}, null, 2)}
                                  rows={5}
                                  className="ui-input w-full font-mono text-[11px]"
                                />
                                <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                                  Save override
                                </button>
                              </form>
                            ) : (
                              <pre className="mt-2 overflow-x-auto rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-2 text-[11px]">
                                {JSON.stringify(row.override_json ?? {}, null, 2)}
                              </pre>
                            )}
                          </li>
                        );
                      }
                    )}
                  </ul>
                </div>
              ) : null}
              {showContractAdvancedRouting ? (
              <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
                <p className="ui-label-caps">CRM / external link</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {contract.source_system || "No source system"} ·{" "}
                  {contract.region || "No region"} ·{" "}
                  {contract.annual_value != null ? `$${Number(contract.annual_value).toLocaleString()}` : "No annual value"} ·{" "}
                  {contract.external_reference_id || "No external reference"}
                </p>
                {canEdit && (
                  <form action={D.updateContractExternalLinkForm} className="mt-3 space-y-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <input aria-label="CRM/system name" name="sourceSystem"
                      defaultValue={contract.source_system ?? ""}
                      placeholder="CRM/system name"
                      maxLength={80}
                      className="ui-input text-xs"
                    />
                    <input aria-label="External ID" name="externalReferenceId"
                      defaultValue={contract.external_reference_id ?? ""}
                      placeholder="External ID"
                      maxLength={160}
                      className="ui-input text-xs"
                    />
                    <input aria-label="Region (NA, EMEA, APAC...)" name="region"
                      defaultValue={contract.region ?? ""}
                      placeholder="Region (NA, EMEA, APAC...)"
                      maxLength={40}
                      className="ui-input text-xs"
                    />
                    <input aria-label="Annual value (e.g. 125000)" name="annualValue"
                      defaultValue={
                        contract.annual_value == null ? "" : String(contract.annual_value)
                      }
                      placeholder="Annual value (e.g. 125000)"
                      inputMode="decimal"
                      className="ui-input text-xs"
                    />
                    <button type="submit" className="ui-btn-secondary w-full px-3 py-2 text-xs">
                      Save external link
                    </button>
                  </form>
                )}
              </div>
              ) : null}
            </div>
          </div>
          )}
    </>
  );
}
