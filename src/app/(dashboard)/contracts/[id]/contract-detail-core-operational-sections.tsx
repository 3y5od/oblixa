import type { ContractDetailPageModel } from "./contract-detail-page-model";
import * as D from "./contract-detail-view-deps";

export function ContractDetailCoreOperationalSections({ model }: { model: ContractDetailPageModel }) {
  const { ctx, canEdit, contract, ownerMembers, notes, obligations, approvals, evidenceRequirements, openExceptionsCount, pendingApprovalsCount, v10ApprovalRecords, coreWorkRows, coreActivityRows, coreActivityFeedItems, activeTab, activeEvidenceCount, exceptionsCasefileData } = model;

  return (
    <>
            {activeTab === "work" ? (
              <section id="contract-work" className="ui-card-quiet scroll-mt-28 overflow-hidden">
                <D.ContractPanelHeader
                  icon={D.ListChecks}
                  eyebrow="Tasks"
                  title="Tasks, requirements, and issues"
                  count={coreWorkRows.length + openExceptionsCount + obligations.length}
                  countLabel="items"
                  action={
                    <D.Link href={`/work?contract=${contract.id}`} className="ui-btn-secondary px-4 py-2 text-[13px]">
                      Create task
                    </D.Link>
                  }
                />
                <div className="space-y-5 px-5 py-5 sm:px-6">
                  {/* §10.5: one quiet inset with hairline-divided cells, not
                      three nested bordered boxes. Mirrors the action-summary
                      strip idiom (border-t on mobile, border-l on sm+). */}
                  <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_30%,transparent)] sm:grid-cols-3">
                    {[
                      ["Tasks", coreWorkRows.length, "Open tasks and tasks needing input"],
                      ["Requirements", obligations.length, "Contract commitments"],
                      ["Issues", openExceptionsCount, "Open contract issues"],
                    ].map(([label, count, detail]) => (
                      <div
                        key={String(label)}
                        className="border-t border-[var(--border-subtle)] px-4 py-3 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0"
                      >
                        <p className="ui-caps-3 text-[var(--text-tertiary)]">{label}</p>
                        <p className="mt-2 text-lg font-semibold leading-none tabular-nums text-[var(--text-primary)]">
                          {count}
                        </p>
                        <p className="mt-2 text-[12.5px] text-[var(--text-secondary)]">{detail}</p>
                      </div>
                    ))}
                  </div>
                  {coreWorkRows.length === 0 && openExceptionsCount === 0 && obligations.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_34%,transparent)] px-4 py-5">
                      <p className="font-semibold text-[var(--text-primary)]">No open tasks are attached to this contract.</p>
                      <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                        Create a task from a deadline, requirement, issue, or evidence request when follow-up is needed.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]">
                      {coreWorkRows.slice(0, 8).map((item) => (
                        <li key={item.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--text-primary)]">{item.title}</p>
                            <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">{item.detail || "Task"}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <D.StatusBadge status={D.coreSemanticStatus(item.status)}>
                              {D.humanizeContractEnumLabel(item.status)}
                            </D.StatusBadge>
                            <D.Link href="/work" className="ui-link text-[12.5px]">
                              {item.action}
                            </D.Link>
                          </div>
                        </li>
                      ))}
                      {(exceptionsCasefileData ?? []).filter((item) => ["open", "in_progress"].includes(item.status)).slice(0, 4).map((issue: { id: string; title: string; status: string }) => (
                        <li key={`issue-${issue.id}`} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold text-[var(--text-primary)]">{issue.title}</p>
                            <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">Issue</p>
                          </div>
                          <D.StatusBadge status={D.coreSemanticStatus(issue.status)}>
                            {D.humanizeContractEnumLabel(issue.status)}
                          </D.StatusBadge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ) : null}

            {activeTab === "approvals" ? (
              <section id="renewal-approvals" className="ui-card-quiet scroll-mt-28 overflow-hidden">
                <D.ContractPanelHeader
                  icon={D.BadgeCheck}
                  eyebrow="Approvals"
                  title="Approval decisions"
                  count={pendingApprovalsCount}
                  countLabel="pending"
                  action={
                    <D.Link href={`/contracts/approvals?contract=${contract.id}`} className="ui-btn-secondary px-4 py-2 text-[13px]">
                      Review approval queue
                    </D.Link>
                  }
                />
                <div className="px-5 py-5 sm:px-6">
                  {approvals.length === 0 && v10ApprovalRecords.length === 0 ? (
                    <p className="text-[13px] text-[var(--text-secondary)]">No approvals are attached to this contract.</p>
                  ) : (
                    <ul className="divide-y divide-[var(--border-subtle)]">
                      {approvals.slice(0, 8).map((approval) => (
                        <li key={approval.id} className="flex items-center justify-between gap-3 py-3">
                          <span className="font-medium text-[var(--text-primary)]">
                            {D.humanizeContractEnumLabel(approval.approval_type)}
                          </span>
                          <D.StatusBadge status={D.coreSemanticStatus(approval.status)}>
                            {D.humanizeContractEnumLabel(approval.status)}
                          </D.StatusBadge>
                        </li>
                      ))}
                      {approvals.length === 0 ? v10ApprovalRecords.slice(0, 8).map((approval) => (
                        <li key={String(approval.approval_id)} className="flex items-center justify-between gap-3 py-3">
                          <span className="font-medium text-[var(--text-primary)]">
                            {D.humanizeContractEnumLabel(String(approval.approval_type))}
                          </span>
                          <D.StatusBadge status={D.coreSemanticStatus(String(approval.status))}>
                            {D.humanizeContractEnumLabel(String(approval.status))}
                          </D.StatusBadge>
                        </li>
                      )) : null}
                    </ul>
                  )}
                </div>
              </section>
            ) : null}

            {activeTab === "obligations" ? (
              <section id="contract-obligations" className="ui-card-quiet scroll-mt-28 overflow-hidden">
                <D.ContractPanelHeader
                  icon={D.ListChecks}
                  eyebrow="Requirements"
                  title="Contract requirements"
                  count={obligations.length}
                  countLabel="items"
                  action={
                    <D.Link href={`/contracts/obligations?contract=${contract.id}`} className="ui-btn-secondary px-4 py-2 text-[13px]">
                      Create requirement
                    </D.Link>
                  }
                />
                <div className="px-5 py-5 sm:px-6">
                  {obligations.length === 0 ? (
                    <p className="text-[13px] text-[var(--text-secondary)]">No contract requirements are recorded yet.</p>
                  ) : (
                    <ul className="divide-y divide-[var(--border-subtle)]">
                      {obligations.slice(0, 10).map((obligation) => (
                        <li key={obligation.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--text-primary)]">{obligation.title}</p>
                            <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">
                              {(() => {
                                const ownerLabel = obligation.owner_id
                                  ? ownerMembers.find((member) => member.userId === obligation.owner_id)?.label ?? "Assigned"
                                  : "Unassigned";
                                const timing = obligation.due_date
                                  ? `Due ${D.formatBusinessDateAtNoon(obligation.due_date)}`
                                  : obligation.cadence || null;
                                const parts = [ownerLabel, timing].filter(Boolean) as string[];
                                return parts.length > 0
                                  ? parts.map((part, i) => (
                                      <span key={part}>
                                        {i > 0 ? (
                                          <span className="ui-dot-sep" aria-hidden>
                                            ·
                                          </span>
                                        ) : null}
                                        {part}
                                      </span>
                                    ))
                                  : "No cadence or due date set";
                              })()}
                            </p>
                          </div>
                          <D.StatusBadge status={D.coreSemanticStatus(obligation.status)}>
                            {D.humanizeContractEnumLabel(obligation.status)}
                          </D.StatusBadge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ) : null}

            {(activeTab === "overview" || activeTab === "evidence") && (activeEvidenceCount > 0 || evidenceRequirements.length > 0 || activeTab === "evidence") ? (
              <section id="contract-evidence" className="ui-card-quiet scroll-mt-28 overflow-hidden">
                <D.ContractPanelHeader
                  icon={D.FileCheck2}
                  eyebrow="Evidence"
                  title="Pending requests"
                  action={
                    <D.Link href={`/evidence?contract=${contract.id}`} className="ui-btn-secondary px-4 py-2 text-[13px]">
                      Request evidence
                    </D.Link>
                  }
                />
                <div className="px-5 py-1 sm:px-6">
                  {evidenceRequirements.filter((item) => D.isEvidenceGapStatus(item.status)).length === 0 ? (
                    <p className="py-2 text-[11.5px] text-[var(--text-tertiary)]">No active evidence request needs follow-up.</p>
                  ) : (
                    <ul className="divide-y divide-[var(--border-subtle)]">
                      {evidenceRequirements.filter((item) => D.isEvidenceGapStatus(item.status)).slice(0, 6).map((item) => {
                        return (
                          <li key={item.id} className="py-2 first:pt-0 last:pb-0 text-[12.5px] font-medium text-[var(--text-primary)]">
                            {item.title}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>
            ) : null}

            {activeTab === "notes" ? (
              <section id="contract-notes" className="ui-card-quiet scroll-mt-28 overflow-hidden">
                <D.ContractPanelHeader icon={D.NotebookPen} eyebrow="Notes" title="Notes and handoff context" count={notes.length} countLabel="notes" />
                <div className="px-5 py-5 sm:px-6">
                  <D.ContractNotesPanel
                    contractId={contract.id}
                    notes={notes}
                    currentUserId={ctx.user.id}
                    memberLabels={ownerMembers}
                    canEdit={canEdit}
                  />
                </div>
              </section>
            ) : null}

            {activeTab === "activity" ? (
              <section id="contract-activity" className="ui-card-quiet scroll-mt-28 overflow-hidden">
                <D.ContractPanelHeader icon={D.FileText} eyebrow="Activity" title="Contract activity" count={coreActivityRows.length} countLabel="events" />
                <div className="px-5 py-4 sm:px-6">
                  <D.ActivityFeed items={coreActivityFeedItems} emptyLabel="No activity recorded yet" />
                </div>
              </section>
            ) : null}

            {activeTab === "overview" && coreActivityRows.length > 0 ? (
              <section id="contract-recent-activity" className="ui-card-quiet scroll-mt-28 overflow-hidden">
                <D.ContractPanelHeader
                  icon={D.FileText}
                  eyebrow="Activity"
                  title="Recent activity"
                  action={<D.ActionChip verb="View all" href={`/contracts/${contract.id}?tab=activity`} />}
                />
                <div className="px-5 py-3 sm:px-6">
                  <D.ActivityFeed items={coreActivityFeedItems.slice(0, 5)} compact />
                </div>
              </section>
            ) : null}
    </>
  );
}
