import type { ContractDetailPageModel } from "./contract-detail-page-model";
import * as D from "./contract-detail-view-deps";

export function ContractDetailAdvancedTrust({ model }: { model: ContractDetailPageModel }) {
  const { contract, v10HealthSnapshot, v10Deductions, v10DeductionCount, v10WorkItems, v10Activation, v10FieldProvenance, v10RenewalPosture, v10EvidenceStatuses, v10ApprovalRecords, v10ExceptionRecords, v10AuditEvents, v10HasAnyTrustSignal } = model;

  return (
    <>
          <section
            aria-labelledby="v10-contract-record-trust-title"
            data-v10-surface="contract_record"
            data-v10-section="trust_header"
            data-v10-state={v10HasAnyTrustSignal ? undefined : "partial"}
            data-v10-visibility-state={v10HasAnyTrustSignal ? "visible" : "missing_trust_signal"}
            data-v10-source-object="contract"
            className="mt-5 rounded-2xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] px-4 py-3 text-sm"
          >
            <p className="ui-eyebrow">Contract record trust</p>
            <h2 id="v10-contract-record-trust-title" className="mt-1 text-base font-semibold text-[var(--text-primary)]">
              Contract record trust
            </h2>
            {v10HasAnyTrustSignal ? (
              <div className="mt-2 space-y-4 text-[var(--text-secondary)]">
                {v10HealthSnapshot ? (
                  <p>
                    Health score{" "}
                    <span className="font-semibold text-[var(--text-primary)]">{v10HealthSnapshot.score}</span>{" "}
                    ({v10HealthSnapshot.band.replace(/_/g, " ")}) with {v10DeductionCount} active deduction
                    {v10DeductionCount === 1 ? "" : "s"}. Next action:{" "}
                    <span className="font-medium text-[var(--text-primary)]">
                      {v10HealthSnapshot.next_action.replace(/_/g, " ")}
                    </span>
                    .
                  </p>
                ) : (
                  <D.RecoverableState
                    state="partial"
                    title="Contract health read model has not materialized"
                    reason="Related activation, task, renewal, evidence, approval, issue, and audit signals are shown below so the record remains recoverable while health is rebuilt."
                    accessibleName="Contract health read model partial state"
                    nextActionLabel="Review workspace health"
                    surface="contract_record"
                    section="trust_header"
                    sourceObject="contract"
                    nextAction={
                      <D.Link href="/settings/health" className="ui-link">
                        Review workspace health
                      </D.Link>
                    }
                  />
                )}
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  {v10HealthSnapshot ? (
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                        Health gaps
                      </p>
                      <p className="mt-1 font-medium text-[var(--text-primary)]">
                        {v10HealthSnapshot.missing_required_field_count} required ·{" "}
                        {v10HealthSnapshot.missing_critical_date_count} critical dates
                      </p>
                      <p className="mt-1 text-xs">
                        {v10HealthSnapshot.overdue_work_count} overdue ·{" "}
                        {v10HealthSnapshot.failed_or_partial_job_count} failed or partial jobs
                      </p>
                    </div>
                  ) : null}
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      Activation
                    </p>
                    <p className="mt-1 font-medium text-[var(--text-primary)]">
                      {v10Activation ? v10Activation.state.replace(/_/g, " ") : "not materialized"}
                    </p>
                    {v10Activation ? (
                      <p className="mt-1 text-xs">
                        {v10Activation.required_fields_approved}/{v10Activation.required_fields_total} required details confirmed
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                        Tasks
                      </p>
                    <p className="mt-1 font-medium text-[var(--text-primary)]">
                      {v10WorkItems.length} open linked item{v10WorkItems.length === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-xs">
                      {v10WorkItems.filter((item) => item.due_state === "overdue").length} overdue ·{" "}
                      {v10WorkItems.filter((item) => item.status === "blocked").length} need input
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      Audit
                    </p>
                    <p className="mt-1 font-medium text-[var(--text-primary)]">
                      {v10AuditEvents.length} recent event{v10AuditEvents.length === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-xs">
                      Latest: {v10AuditEvents[0]?.action ? String(v10AuditEvents[0].action).replace(/_/g, " ") : "none"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      Detail provenance
                    </p>
                    <p className="mt-1 font-medium text-[var(--text-primary)]">
                      {v10FieldProvenance.length} detail record{v10FieldProvenance.length === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-xs">
                      {v10FieldProvenance[0]?.field_key
                        ? `${String(v10FieldProvenance[0].field_key).replace(/_/g, " ")} · ${String(v10FieldProvenance[0].state).replace(/_/g, " ")}`
                        : "none materialized"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      Renewal posture
                    </p>
                    <p className="mt-1 font-medium text-[var(--text-primary)]">
                      {v10RenewalPosture ? v10RenewalPosture.posture.replace(/_/g, " ") : "not materialized"}
                    </p>
                    <p className="mt-1 text-xs">
                      {v10RenewalPosture?.reminder_eligible ? "Reminder eligible" : v10RenewalPosture?.blocked_reason ?? "No reminder action"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      Evidence status
                    </p>
                    <p className="mt-1 font-medium text-[var(--text-primary)]">
                      {v10EvidenceStatuses.length} request{v10EvidenceStatuses.length === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-xs">
                      {v10EvidenceStatuses.filter((item) => item.resubmission_allowed).length} resubmission path
                      {v10EvidenceStatuses.filter((item) => item.resubmission_allowed).length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      Approvals
                    </p>
                    <p className="mt-1 font-medium text-[var(--text-primary)]">
                      {v10ApprovalRecords.length} approval{v10ApprovalRecords.length === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-xs">
                      {v10ApprovalRecords.filter((item) => item.status === "pending").length} pending ·{" "}
                      {v10ApprovalRecords.filter((item) => item.due_state === "overdue").length} overdue
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      Issues
                    </p>
                    <p className="mt-1 font-medium text-[var(--text-primary)]">
                      {v10ExceptionRecords.length} issue{v10ExceptionRecords.length === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-xs">
                      {v10ExceptionRecords.filter((item) => item.severity === "critical" || item.severity === "high").length} high risk ·{" "}
                      {v10ExceptionRecords.filter((item) => item.owner_state === "unassigned").length} unassigned
                    </p>
                  </div>
                </div>
                {v10Deductions.length > 0 ? (
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      Health deductions
                    </p>
                    <ul className="mt-2 grid gap-2 md:grid-cols-2">
                      {v10Deductions.map((deduction, index) => {
                        const sourceHref =
                          deduction.source_type === "contract" || !deduction.source_type
                            ? `/contracts/${contract.id}`
                            : deduction.source_type === "evidence_request"
                              ? `/contracts/${contract.id}?tab=overview#contract-evidence`
                              : deduction.source_type === "approval"
                                ? `/contracts/${contract.id}?tab=overview#renewal-approvals`
                                : deduction.source_type === "obligation"
                                  ? `/contracts/${contract.id}?tab=obligations`
                                  : `/work`;
                        return (
                          <li key={`${deduction.key ?? "deduction"}:${index}`} className="rounded-xl border border-[var(--border-subtle)] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-medium text-[var(--text-primary)]">
                                {String(deduction.label ?? deduction.key ?? "health deduction").replace(/_/g, " ")}
                              </p>
                              <span className="text-xs font-semibold text-[var(--danger)]">
                                -{Number(deduction.points ?? 0)}
                              </span>
                            </div>
                            <D.Link
                              href={sourceHref}
                              aria-label={`Inspect source for ${String(deduction.label ?? deduction.key ?? "health deduction").replace(/_/g, " ")}`}
                              className="mt-2 inline-flex text-xs font-medium text-[var(--text-link)] underline underline-offset-2"
                            >
                              Inspect source
                            </D.Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                {v10WorkItems.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {v10WorkItems.slice(0, 4).map((item) => {
                      const workHref =
                        item.type === "approval"
                          ? `/contracts/${contract.id}?tab=overview#renewal-approvals`
                          : item.type === "obligation"
                            ? `/contracts/${contract.id}?tab=obligations`
                            : item.type === "evidence_request"
                              ? `/contracts/${contract.id}?tab=overview#contract-evidence`
                              : item.type === "exception"
                                ? `/contracts/exceptions?status=open&contract=${contract.id}`
                                : `/contracts/${contract.id}`;
                      return (
                      <D.Link
                        key={`${item.type}:${item.source_id}`}
                        href={workHref}
                        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 hover:border-[var(--accent)]"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                          {String(item.type).replace(/_/g, " ")}
                        </p>
                        <p className="mt-1 font-medium text-[var(--text-primary)]">{item.title}</p>
                        <p className="mt-1 text-xs">
                          {String(item.status).replace(/_/g, " ")}
                          {item.due_state && item.due_state !== "none"
                            ? ` · ${String(item.due_state).replace(/_/g, " ")}`
                            : ""}
                        </p>
                      </D.Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-2 space-y-3 text-[var(--text-secondary)]">
                <p>
                  This contract is visible, but no health snapshot is available yet. The legacy header,
                  reminders, approvals, evidence, and audit state remain available, and workspace health can
                  show whether refresh, suggested-detail, import, report, or export jobs are affecting the read model.
                </p>
                <div className="flex flex-wrap gap-3">
                  <D.Link href="/settings/health" className="ui-link">
                    Review workspace health
                  </D.Link>
                  <D.Link href={`/work?lens=blocked`} className="ui-link">
                    Review tasks needing input
                  </D.Link>
                  <D.Link href={`/contracts/${contract.id}?tab=audit`} className="ui-link">
                    Review audit trail
                  </D.Link>
                </div>
              </div>
            )}
          </section>
    </>
  );
}
