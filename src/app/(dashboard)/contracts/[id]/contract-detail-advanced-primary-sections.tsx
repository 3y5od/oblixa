import type { ContractDetailPageModel } from "./contract-detail-page-model";
import * as D from "./contract-detail-view-deps";

export function ContractDetailAdvancedPrimarySections({ model }: { model: ContractDetailPageModel }) {
  const { canEdit, showContractWorkflowOps, showRelationshipWorkspaces, contract, ownerMembers, extractionJob, tasks, obligations, taskChecklistItems, taskComments, taskDependencies, taskArtifacts, checkpoints, executionGraphEdges, taskEvents, obligationEvents, pendingFieldsCount, filesCount, fieldsCount, reviewQueueContinuity, reviewPage, reviewQueueHref, activeTab } = model;

  return (
    <>
          {(activeTab === "overview" || activeTab === "fields" || activeTab === "dates") && (
          <div id="extracted-fields" className="scroll-mt-28 ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-5 py-5 md:px-8">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <h2 className="ui-section-title text-base">Suggested details</h2>
                <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                  Confirm source-backed values before reminders, renewals, or downstream tasks rely on this contract.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
                  <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-0.5">
                    {fieldsCount} detail{fieldsCount === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-0.5">
                    {pendingFieldsCount} need confirmation
                  </span>
                  <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-0.5">
                    {filesCount} source file{filesCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="ui-toolbar flex max-w-full flex-col items-stretch gap-1.5 p-2 sm:flex-row sm:flex-nowrap sm:items-center sm:self-start [&_.ui-btn-primary]:px-3 [&_.ui-btn-primary]:text-xs [&_.ui-btn-primary]:sm:px-3">
                <D.Link href="/contracts/review" className="ui-btn-secondary w-full whitespace-nowrap px-3 py-2 text-xs sm:w-auto">
                  Confirm details
                </D.Link>
                <D.ExtractButton
                  contractId={contract.id}
                  hasFiles={!!contract.contract_files?.length}
                  canEdit={canEdit}
                  extractionJob={extractionJob}
                />
                {canEdit && (
                  <form action={D.applyContractTemplatePackForm} className="w-full sm:w-auto">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <button type="submit" className="ui-btn-secondary w-full whitespace-nowrap px-3 py-2 text-xs sm:w-auto">
                      Apply template pack
                    </button>
                  </form>
                )}
              </div>
              </div>
            </div>
            <div className="space-y-5 px-4 py-6 md:px-8">
              <D.ExtractionJobAlert
                job={extractionJob}
                fieldsCount={fieldsCount}
                pendingFieldsCount={pendingFieldsCount}
              />
              {reviewQueueContinuity ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--info-soft)_36%,var(--surface))] px-4 py-4 text-sm text-[var(--text-secondary)]">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                        Review queue
                      </p>
                      <p className="font-semibold text-[var(--text-primary)]">
                        Contract {reviewQueueContinuity.position} of {reviewQueueContinuity.total} still needs attention.
                      </p>
                      <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                        {reviewQueueContinuity.currentPendingCount > 0
                          ? `${reviewQueueContinuity.currentPendingCount} detail${reviewQueueContinuity.currentPendingCount === 1 ? "" : "s"} on this contract still need confirmation.`
                          : "The contract is still marked pending review even though no suggested details are pending."}{" "}
                        {reviewQueueContinuity.nextContractId
                          ? `When you finish here, continue straight to the next contract instead of returning to the queue.`
                          : "This is the last contract in the active review queue."}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center md:justify-end">
                      <D.Link href={reviewQueueHref} className="ui-btn-secondary px-3 py-2 text-xs">
                        Review queue
                      </D.Link>
                      {reviewQueueContinuity.nextContractId ? (
                        <D.ReviewSaveNextTelemetryLink
                          href={`/contracts/${reviewQueueContinuity.nextContractId}?tab=overview&from=review&reviewPage=${reviewPage}#extracted-fields`}
                          className="ui-btn-primary px-3 py-2 text-xs"
                        >
                          Continue next contract
                          {reviewQueueContinuity.nextPendingCount > 0
                            ? ` (${reviewQueueContinuity.nextPendingCount} pending)`
                            : ""}
                        </D.ReviewSaveNextTelemetryLink>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              <D.BatchApproveButton
                contractId={contract.id}
                pendingCount={pendingFieldsCount}
                canEdit={canEdit}
              />
              <D.FieldReview
                fields={contract.extracted_fields || []}
                canEdit={canEdit}
              />
              <D.AddFieldForm
                contractId={contract.id}
                existingFieldNames={(contract.extracted_fields || []).map(
                  (f: { field_name: string }) => f.field_name
                )}
                canEdit={canEdit}
              />
            </div>
          </div>
          )}

          {activeTab === "overview" &&
            showRelationshipWorkspaces &&
            (Boolean((contract as { account_key?: string | null }).account_key) ||
              Boolean((contract as { counterparty_key?: string | null }).counterparty_key)) && (
              <div className="ui-card border-[color:color-mix(in_oklab,var(--success)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_20%,var(--surface-raised))] p-5 md:p-6">
                <h2 className="ui-section-title text-base">Relationship context</h2>
                <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">
                  Use portfolio summaries for keys on this contract.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(contract as { account_key?: string | null }).account_key ? (
                    <D.Link
                      href={`/accounts/${encodeURIComponent(String((contract as { account_key?: string | null }).account_key))}`}
                      className="ui-btn-secondary px-3 py-2 text-xs"
                    >
                      Account workspace
                    </D.Link>
                  ) : null}
                  {(contract as { counterparty_key?: string | null }).counterparty_key ? (
                    <D.Link
                      href={`/counterparties/${encodeURIComponent(String((contract as { counterparty_key?: string | null }).counterparty_key))}`}
                      className="ui-btn-secondary px-3 py-2 text-xs"
                    >
                      Counterparty workspace
                    </D.Link>
                  ) : null}
                </div>
              </div>
            )}

          {(activeTab === "overview" || activeTab === "files" || activeTab === "dates") && (
          <div id="source-documents" className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-4 py-3.5 md:px-8 md:py-4">
              <h2 className="ui-section-title text-base">Source documents</h2>
              <p className="mt-1 text-[12.5px] text-[var(--text-tertiary)]">Signed files on this agreement.</p>
            </div>
            <div className="px-4 py-4.5 md:px-8 md:py-5">
              {!contract.contract_files?.length ? (
                <p className="text-[12.5px] text-[var(--text-tertiary)]">No files uploaded yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {contract.contract_files.map(
                    (file: {
                      id: string;
                      file_name: string;
                      file_type: string;
                      file_size: number;
                      storage_path: string;
                      created_at: string;
                    }) => (
                      <li
                        key={file.id}
                        className="flex items-center justify-between gap-4 py-4 first:pt-0"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))]">
                            <D.FileText size={18} className="text-[var(--text-tertiary)]" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                              {file.file_name}
                            </p>
                            <p className="mt-0.5 text-[12.5px] text-[var(--text-tertiary)]">
                              {D.formatFileSize(file.file_size)}
                              <span className="text-[var(--text-tertiary)]"> · </span>
                              {D.format(new Date(file.created_at), "MMM d, yyyy")}
                              <span className="text-[var(--text-tertiary)]"> · </span>
                              <span className="font-medium text-[var(--success-ink)]">Stored</span>
                            </p>
                          </div>
                        </div>
                        <D.DownloadButton
                          storagePath={file.storage_path}
                          fileName={file.file_name}
                        />
                      </li>
                    )
                  )}
                </ul>
              )}
              <div className="mt-6 border-t border-[var(--border-subtle)] pt-6">
                <D.UploadMoreFiles contractId={contract.id} canEdit={canEdit} />
                {canEdit && contract.contract_files?.length ? (
                  <form action={D.supersedeContractFileForm} className="mt-4 space-y-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <p className="ui-label-caps">Supersede older file and re-extract</p>
                    <D.UiSelect
                      name="fileId"
                      defaultValue=""
                      ariaLabel="File to supersede"
                      placeholder="Select file to supersede"
                      options={contract.contract_files.map(
                        (file: { id: string; file_name: string }) => ({
                          value: file.id,
                          label: file.file_name,
                        }),
                      )}
                      variant="compact"
                      portal
                      searchThreshold={8}
                      className="w-full"
                      buttonClassName="w-full !min-h-11 text-xs"
                    />
                    <input aria-label="Reason (optional)" name="reason"
                      maxLength={200}
                      placeholder="Reason (optional)"
                      className="ui-input text-xs"
                    />
                    <button type="submit" className="ui-btn-secondary px-3 py-2 text-xs">
                      Mark superseded and rerun suggestions
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          </div>
          )}

          {showContractWorkflowOps && (activeTab === "overview" || activeTab === "tasks" || activeTab === "workflow") && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4 md:px-8">
              <h2 className="ui-section-title text-base">Tasks & follow-up</h2>
              <p className="mt-1 text-[12.5px] text-[var(--text-tertiary)]">Ownership and execution work.</p>
            </div>
            <div className="px-4 py-6 md:px-8">
              <D.ContractTasksPanel
                contractId={contract.id}
                tasks={tasks}
                canEdit={canEdit}
                members={ownerMembers}
                taskEvents={taskEvents}
                taskChecklistItems={taskChecklistItems}
                taskComments={taskComments}
                taskDependencies={taskDependencies}
                taskArtifacts={taskArtifacts}
                executionGraphEdges={executionGraphEdges}
              />
            </div>
          </div>
          )}

          {showContractWorkflowOps && (activeTab === "overview" || activeTab === "obligations" || activeTab === "workflow") && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4 md:px-8">
              <h2 className="ui-section-title text-base">Requirements</h2>
              <p className="mt-1 text-[12.5px] text-[var(--text-tertiary)]">Ongoing commitments and evidence.</p>
            </div>
            <div className="px-4 py-6 md:px-8">
              <D.ContractObligationsPanel
                contractId={contract.id}
                obligations={obligations}
                members={ownerMembers}
                canEdit={canEdit}
                obligationEvents={obligationEvents}
                executionGraphEdges={executionGraphEdges}
              />
            </div>
          </div>
          )}

          {(activeTab === "overview" || activeTab === "dates" || activeTab === "renewals") && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4 md:px-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="ui-section-title text-base">Renewal checklist</h2>
                  <p className="mt-1 text-[12.5px] text-[var(--text-tertiary)]">120/90/60/30 renewal checkpoints.</p>
                </div>
                {canEdit && showContractWorkflowOps && checkpoints.length === 0 && (
                  <form action={D.seedRenewalPlaybook.bind(null, contract.id) as never}>
                    <button type="submit" className="ui-btn-secondary px-4 py-2 text-[12.5px]">
                      Seed checklist
                    </button>
                  </form>
                )}
              </div>
            </div>
            <div className="px-4 py-6 md:px-8">
              <D.RenewalCheckpointsPanel checkpoints={checkpoints} canEdit={canEdit} />
            </div>
          </div>
          )}
    </>
  );
}
