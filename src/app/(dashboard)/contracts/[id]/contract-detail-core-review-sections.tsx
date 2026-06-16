import type { ContractDetailPageModel } from "./contract-detail-page-model";
import * as D from "./contract-detail-view-deps";
import { ContractDetailCoreSourceDocuments } from "./contract-detail-core-source-documents";

export function ContractDetailCoreReviewSections({ model }: { model: ContractDetailPageModel }) {
  const { canEdit, contract, upcomingReminders, extractionJob, checkpoints, pendingFieldsCount, approvedFieldsCount, readyFieldsCount, fieldsCount, reviewQueueContinuity, reviewPage, reviewQueueHref, activeTab, hasSourceFiles, hasExtractedFields, extractedFields, nonDateExtractedFields, coreDateRows, shouldPrioritizeSourceDocuments } = model;

  return (
    <>
            {shouldPrioritizeSourceDocuments ? <ContractDetailCoreSourceDocuments model={model} /> : null}

            {(activeTab === "overview" || activeTab === "fields" || activeTab === "dates") && (
              <section id="extracted-fields" className="ui-card scroll-mt-28 overflow-hidden">
                <D.ContractPanelHeader
                  icon={D.ClipboardCheck}
                  eyebrow="Confirm"
                  title="Suggested details"
                  countNode={
                    fieldsCount > 0 ? (
                      <D.RatioChip
                        numerator={approvedFieldsCount}
                        denominator={fieldsCount}
                         suffix="confirmed"
                        tone={approvedFieldsCount >= fieldsCount ? "success" : undefined}
                      />
                    ) : undefined
                  }
                  action={
                    <>
                      {hasSourceFiles && hasExtractedFields ? (
                        <D.ExtractButton
                          contractId={contract.id}
                          hasFiles={hasSourceFiles}
                          canEdit={canEdit}
                          extractionJob={extractionJob}
                        />
                      ) : null}
                      {canEdit && hasExtractedFields ? (
                        <form action={D.applyContractTemplatePackForm}>
                          <input type="hidden" name="contractId" value={contract.id} />
                          <button
                            type="submit"
                            title="Add the standard details, reminders, and tasks defined for this contract type."
                            className="inline-flex max-w-max items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                          >
                            <D.BadgeCheck className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                            Apply contract template
                          </button>
                        </form>
                      ) : null}
                    </>
                  }
                />
                <div className="space-y-4 px-5 py-3 sm:px-6">
                  <D.ExtractionJobAlert
                    job={extractionJob}
                    fieldsCount={fieldsCount}
                    pendingFieldsCount={pendingFieldsCount}
                  />
                  {reviewQueueContinuity ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-y border-[color:color-mix(in_oklab,var(--border-subtle)_78%,transparent)] py-3">
                      {/* One count→action unit: the ratio links to the full queue,
                          Continue advances to the next contract (§10.13). */}
                      <D.Link
                        href={reviewQueueHref}
                        className="ui-chip-focus inline-flex max-w-max items-center gap-2 rounded-md"
                      >
                        {reviewQueueContinuity.total > 1 ? (
                          <D.RatioChip
                            numerator={reviewQueueContinuity.position}
                            denominator={reviewQueueContinuity.total}
                            suffix="queue"
                          />
                        ) : (
                          <span className="ui-caps-2 text-[var(--text-secondary)]">Review queue</span>
                        )}
                      </D.Link>
                      {reviewQueueContinuity.nextContractId ? (
                        <D.ReviewSaveNextTelemetryLink
                          href={`/contracts/${reviewQueueContinuity.nextContractId}?tab=overview&from=review&reviewPage=${reviewPage}#extracted-fields`}
                          className="ui-btn-primary inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs"
                        >
                          Continue
                          <D.ChevronRight className="h-3 w-3" strokeWidth={2} aria-hidden />
                        </D.ReviewSaveNextTelemetryLink>
                      ) : null}
                    </div>
                  ) : null}
                  <D.BatchApproveButton
                    contractId={contract.id}
                    pendingCount={pendingFieldsCount}
                    readyCount={readyFieldsCount}
                    canEdit={canEdit}
                  />
                  {nonDateExtractedFields.length > 0 ? (
                    <D.FieldReview fields={nonDateExtractedFields} canEdit={canEdit} />
                  ) : hasExtractedFields ? (
                    <div className="flex flex-wrap items-center gap-3 py-1">
                      <span className="ui-icon-tile-compact shrink-0" aria-hidden>
                        <D.CalendarClock className="h-4 w-4" strokeWidth={1.85} />
                      </span>
                      <p className="ui-caps-3 text-[11px] text-[var(--text-tertiary)]">Only date suggestions remain</p>
                      <D.ActionChip verb="Review key dates" href="#contract-dates" />
                    </div>
                  ) : (
                    <div className="grid gap-4 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_34%,transparent)] px-4 py-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                      <span className="ui-icon-tile-compact" aria-hidden>
                        <D.ClipboardCheck className="h-4 w-4" strokeWidth={1.85} />
                      </span>
                      <p className="min-w-0 text-[14px] font-semibold text-[var(--text-primary)]">
                        {hasSourceFiles ? "No suggested details yet" : "Confirmation starts after a source file is attached"}
                      </p>
                      {hasSourceFiles ? (
                        <D.ExtractButton
                          contractId={contract.id}
                          hasFiles={hasSourceFiles}
                          canEdit={canEdit}
                          extractionJob={extractionJob}
                        />
                      ) : (
                        <D.Link href="#source-documents" className="ui-btn-secondary px-4 py-2 text-[13px] sm:justify-self-end">
                          Attach source file
                        </D.Link>
                      )}
                    </div>
                  )}
                  <D.AddFieldForm
                    contractId={contract.id}
                    existingFieldNames={extractedFields.map((f: { field_name: string }) => f.field_name)}
                    canEdit={canEdit}
                  />
                </div>
              </section>
            )}

            {(activeTab === "overview" || activeTab === "dates") && (
              <section id="contract-dates" className="ui-card-quiet scroll-mt-28 overflow-hidden">
                <D.ContractPanelHeader
                  icon={D.CalendarClock}
                  eyebrow="Dates"
                  title="Key dates"
                  action={
                    !hasExtractedFields ? (
                      <D.Link
                        href={hasSourceFiles ? "#extracted-fields" : `/contracts/${model.id}?tab=files`}
                        className="ui-btn-secondary px-4 py-2 text-[13px]"
                      >
                        {hasSourceFiles ? "Run suggestions" : "Attach source file"}
                      </D.Link>
                    ) : null
                  }
                />
                {!hasExtractedFields ? (
                  <div className="px-5 py-5 sm:px-6">
                    <div className="grid gap-4 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_34%,transparent)] px-4 py-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                      <span className="ui-icon-tile-compact" aria-hidden>
                        <D.CalendarClock className="h-4 w-4" strokeWidth={1.85} />
                      </span>
                      <p className="min-w-0 text-[14px] font-semibold text-[var(--text-primary)]">
                        Date tracking needs suggested details
                      </p>
                      <D.Link
                        href={hasSourceFiles ? "#extracted-fields" : "#source-documents"}
                        className="ui-btn-secondary px-4 py-2 text-[13px] sm:justify-self-end"
                      >
                        {hasSourceFiles ? "Run suggestions" : "Attach source file"}
                      </D.Link>
                    </div>
                  </div>
                ) : (
                  <D.ContractKeyDates
                    dateRows={coreDateRows}
                    reminders={upcomingReminders}
                    checkpoints={checkpoints}
                    canEdit={canEdit}
                    contractId={contract.id}
                  />
                )}
              </section>
            )}

            {activeTab === "files" || (activeTab === "overview" && hasSourceFiles)
              ? <ContractDetailCoreSourceDocuments model={model} />
              : null}
    </>
  );
}
