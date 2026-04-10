import type { AdminClient } from "@/lib/v6/service";
import { createRow, createFindingEvent } from "@/lib/v6/service";
import { nowIso } from "@/lib/v5/api";
import { gatherPortfolioMetrics } from "@/lib/v6/portfolio-metrics";
import { evaluatePublishedControlPolicies, type PolicyEvaluationResult } from "@/lib/v6/policy-evaluator";
import { applyPolicyEnforcementForEvaluations } from "@/lib/v6/policy-enforcement-router";
import { recordV6AssuranceActivity } from "@/lib/v6/telemetry";
import { buildSegmentRollupsForOrg } from "@/lib/v6/segment-rollups";

export type AssuranceTriggerType = "scheduled" | "event" | "manual";

async function hasRecentFinding(
  admin: AdminClient,
  orgId: string,
  findingType: string,
  withinMs: number
): Promise<boolean> {
  const since = new Date(Date.now() - withinMs).toISOString();
  const { data } = await admin
    .from("assurance_findings")
    .select("id")
    .eq("organization_id", orgId)
    .eq("finding_type", findingType)
    .in("status", ["open", "in_review"])
    .gte("created_at", since)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function findOpenPolicyFindingIdForUnit(
  admin: AdminClient,
  orgId: string,
  evaluationUnitKey: string
): Promise<string | null> {
  const { data } = await admin
    .from("assurance_findings")
    .select("id, scope_json")
    .eq("organization_id", orgId)
    .eq("finding_type", "policy_compliance")
    .in("status", ["open", "in_review"])
    .order("updated_at", { ascending: false })
    .limit(60);
  const row = (data ?? []).find((r) => {
    const sj = (r as { scope_json?: { evaluation_unit_key?: string } }).scope_json;
    return sj?.evaluation_unit_key === evaluationUnitKey;
  });
  return row ? String((row as { id: string }).id) : null;
}

/**
 * Create or map policy breach findings, attach remediation playbook from policy row, run enforcement.
 */
async function processPolicyBreachesForCheckRun(
  admin: AdminClient,
  orgId: string,
  actorUserId: string | null,
  runId: string | undefined,
  policyBreaches: PolicyEvaluationResult[],
  updateSummary: (enfActions: unknown[]) => Promise<void>
) {
  const errors: unknown[] = [];
  const findingsCreated: unknown[] = [];
  const findingIdByEvaluationUnit = new Map<string, string>();

  for (const breachRow of policyBreaches) {
    const existingOpen = await findOpenPolicyFindingIdForUnit(admin, orgId, breachRow.evaluation_unit_key);
    if (existingOpen) {
      findingIdByEvaluationUnit.set(breachRow.evaluation_unit_key, existingOpen);
      if (breachRow.remediation_playbook_id) {
        await admin
          .from("assurance_findings")
          .update({
            recommended_playbook_id: breachRow.remediation_playbook_id,
            updated_at: nowIso(),
          })
          .eq("organization_id", orgId)
          .eq("id", existingOpen)
          .is("recommended_playbook_id", null);
      }
      continue;
    }

    const titleScope =
      breachRow.scope.label && breachRow.scope.label !== "Organization (no assignments)"
        ? `${breachRow.policy_name} · ${breachRow.scope.label}`
        : breachRow.policy_name;

    const f = await createRow(admin, "assurance_findings", orgId, {
      finding_type: "policy_compliance",
      title: `Control policy breach: ${titleScope}`,
      summary: breachRow.breaches.map((b) => b.detail).join("; "),
      severity: breachRow.breaches.some((b) => b.severity === "high") ? "high" : "medium",
      confidence: 88,
      recommended_playbook_id: breachRow.remediation_playbook_id ?? null,
      scope_json: {
        policy_id: breachRow.policy_id,
        evaluation_unit_key: breachRow.evaluation_unit_key,
        assignment_id: breachRow.scope.assignment_id,
        scope_label: breachRow.scope.label,
        contract_ids_sample: breachRow.scope.contract_ids.slice(0, 12),
      },
      linked_controls_json: [
        {
          policy_id: breachRow.policy_id,
          pass: breachRow.pass,
          evaluation_unit_key: breachRow.evaluation_unit_key,
          remediation_playbook_id: breachRow.remediation_playbook_id ?? null,
        },
      ],
      linked_entities_json: breachRow.scope.contract_ids.slice(0, 20).map((cid) => ({
        type: "contract",
        id: cid,
      })),
      status: "open",
      source_check_run_id: runId ?? null,
    });
    if (f.data?.id && actorUserId) {
      await createFindingEvent(admin, orgId, String(f.data.id), "finding.created_from_check", actorUserId, {
        check_run_id: runId,
        evaluation_unit_key: breachRow.evaluation_unit_key,
      });
    }
    if (f.error) errors.push(f.error);
    if (f.data?.id) {
      findingsCreated.push(f.data);
      findingIdByEvaluationUnit.set(breachRow.evaluation_unit_key, String(f.data.id));
    }
  }

  if (policyBreaches.length > 0 && findingIdByEvaluationUnit.size > 0) {
    const enf = await applyPolicyEnforcementForEvaluations(admin, orgId, policyBreaches, {
      findingIdByEvaluationUnit,
      actorUserId,
      sourceCheckRunId: runId ?? null,
    });
    errors.push(...enf.errors);
    if (enf.allActions.length > 0) {
      await updateSummary(enf.allActions);
    }
  }

  return { findingsCreated, errors };
}

/**
 * Modular assurance evaluation: portfolio metrics + policy compliance + targeted findings.
 */
export async function runModularAssuranceChecks(
  admin: AdminClient,
  orgId: string,
  actorUserId: string | null,
  triggerType: AssuranceTriggerType
) {
  const metrics = await gatherPortfolioMetrics(admin, orgId);
  const policyResults = await evaluatePublishedControlPolicies(admin, orgId);

  const watchSignals: string[] = [];
  const recommended: string[] = [];

  if (metrics.approvals_past_due > 0) {
    watchSignals.push("approval_timeliness_drift");
    recommended.push("route_approvals_review");
  }
  if (metrics.contracts_without_owner > 0) {
    watchSignals.push("ownership_coverage_gap");
    recommended.push("assign_contract_owners");
  }
  if (metrics.overdue_tasks > 0) {
    watchSignals.push("execution_task_backlog");
    recommended.push("clear_blocked_tasks");
  }
  if (metrics.evidence_stale_proxy > 0) {
    watchSignals.push("evidence_freshness_declining");
    recommended.push("request_evidence_refresh");
  }
  if (metrics.obligations_overdue > 0) {
    watchSignals.push("obligation_fulfillment_gap");
    recommended.push("clear_overdue_obligations");
  }
  if (metrics.campaigns_with_drift_concern > 0) {
    watchSignals.push("campaign_drift");
    recommended.push("review_campaign_effectiveness");
  }
  if (metrics.relationship_risk_signals > 0) {
    watchSignals.push("relationship_risk_propagation");
    recommended.push("open_relationship_workspace");
  }
  if (metrics.repeat_exception_type_clusters > 0) {
    watchSignals.push("exception_recurrence_pattern");
    recommended.push("review_repeat_exceptions");
  }
  if (metrics.evidence_stale_proxy > 8) {
    watchSignals.push("evidence_freshness_portfolio");
    recommended.push("evidence_refresh_campaign");
  }
  if (metrics.avg_renewal_readiness != null && metrics.avg_renewal_readiness < 70) {
    watchSignals.push("renewal_readiness_pressure");
    recommended.push("renewal_readiness_review");
  }
  if (metrics.attestation_gaps > 0) {
    watchSignals.push("attestation_coverage");
    recommended.push("close_attestation_gaps");
  }
  if (metrics.low_health_program_scorecards >= 2) {
    watchSignals.push("program_effectiveness_pressure");
    recommended.push("program_evolution_review");
  }

  const { data: prevAssuranceRun } = await admin
    .from("assurance_check_runs")
    .select("summary_json")
    .eq("organization_id", orgId)
    .eq("check_type", "portfolio_assurance")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prevMetrics = (prevAssuranceRun?.summary_json as { metrics?: { avg_assurance_score?: number | null } } | null)
    ?.metrics;
  const prevAvg = prevMetrics?.avg_assurance_score;
  const confidenceDegraded =
    typeof prevAvg === "number" &&
    metrics.avg_assurance_score != null &&
    metrics.avg_assurance_score < prevAvg - 5;
  if (confidenceDegraded) {
    watchSignals.push("confidence_degradation");
    recommended.push("review_recent_interventions");
  }

  const policyBreaches = policyResults.filter((p) => !p.pass);
  if (policyBreaches.length > 0) {
    watchSignals.push("control_policy_breach");
    recommended.push("review_control_policies");
  }

  const riskDelta = {
    open_exceptions: metrics.open_exceptions + metrics.open_exceptions_in_progress,
    approvals_past_due: metrics.approvals_past_due,
    policy_failures: policyBreaches.length,
    rationale: "Modular assurance recompute from live portfolio counts",
    confidence_degradation: confidenceDegraded,
    prior_avg_assurance_score: typeof prevAvg === "number" ? prevAvg : null,
    current_avg_assurance_score: metrics.avg_assurance_score,
    low_health_program_scorecards: metrics.low_health_program_scorecards,
  };

  const segment_rollups = await buildSegmentRollupsForOrg(admin, orgId);

  const run = await createRow(admin, "assurance_check_runs", orgId, {
    check_type: "portfolio_assurance",
    trigger_type: triggerType,
    status: "completed",
    summary_json: {
      metrics,
      segment_rollups,
      policy_evaluations: policyResults.map((p) => ({
        policy_id: p.policy_id,
        evaluation_unit_key: p.evaluation_unit_key,
        scope: p.scope,
        pass: p.pass,
        breach_codes: p.breaches.map((b) => b.code),
      })),
    },
    risk_delta_json: riskDelta,
    watch_signals_json: watchSignals,
    recommended_interventions_json: recommended,
    started_at: nowIso(),
    completed_at: nowIso(),
    created_by: actorUserId,
  });

  const errors: unknown[] = [run.error].filter(Boolean);
  const findingsCreated: unknown[] = [];

  const dupWindowMs = 24 * 60 * 60 * 1000;

  const policyProc = await processPolicyBreachesForCheckRun(
    admin,
    orgId,
    actorUserId,
    run.data?.id ? String(run.data.id) : undefined,
    policyBreaches,
    async (enfActions) => {
      if (!run.data?.id) return;
      await admin
        .from("assurance_check_runs")
        .update({
          summary_json: {
            metrics,
            segment_rollups,
            policy_evaluations: policyResults.map((p) => ({
              policy_id: p.policy_id,
              evaluation_unit_key: p.evaluation_unit_key,
              scope: p.scope,
              pass: p.pass,
              breach_codes: p.breaches.map((b) => b.code),
            })),
            enforcement_actions: enfActions,
          },
        })
        .eq("organization_id", orgId)
        .eq("id", run.data.id);
    }
  );
  findingsCreated.push(...policyProc.findingsCreated);
  errors.push(...policyProc.errors);

  if (
    metrics.contracts_without_owner > 2 &&
    !(await hasRecentFinding(admin, orgId, "ownership_coverage", dupWindowMs))
  ) {
    const f = await createRow(admin, "assurance_findings", orgId, {
      finding_type: "ownership_coverage",
      title: "Contracts without assigned owner",
      summary: `${metrics.contracts_without_owner} contracts in active workflow lack an owner.`,
      severity: metrics.contracts_without_owner > 10 ? "high" : "medium",
      confidence: 92,
      scope_json: { metric: "contracts_without_owner" },
      linked_controls_json: [],
      linked_entities_json: [],
      status: "open",
      source_check_run_id: run.data?.id,
    });
    if (f.data?.id && actorUserId) {
      await createFindingEvent(admin, orgId, String(f.data.id), "finding.created_from_check", actorUserId, {
        check_run_id: run.data?.id,
      });
    }
    if (f.error) errors.push(f.error);
    if (f.data) findingsCreated.push(f.data);
  }

  if (
    metrics.approvals_past_due > 0 &&
    !(await hasRecentFinding(admin, orgId, "approval_sla", dupWindowMs))
  ) {
    const f = await createRow(admin, "assurance_findings", orgId, {
      finding_type: "approval_sla",
      title: "Approval SLA pressure",
      summary: `${metrics.approvals_past_due} approvals are past due.`,
      severity: metrics.approvals_past_due > 15 ? "high" : "medium",
      confidence: 90,
      scope_json: { pending_approvals: metrics.pending_approvals, past_due: metrics.approvals_past_due },
      linked_controls_json: [],
      linked_entities_json: [],
      status: "open",
      source_check_run_id: run.data?.id,
    });
    if (f.data?.id && actorUserId) {
      await createFindingEvent(admin, orgId, String(f.data.id), "finding.created_from_check", actorUserId, {
        check_run_id: run.data?.id,
      });
    }
    if (f.error) errors.push(f.error);
    if (f.data) findingsCreated.push(f.data);
  }

  if (
    metrics.obligations_overdue > 3 &&
    !(await hasRecentFinding(admin, orgId, "obligation_fulfillment", dupWindowMs))
  ) {
    const f = await createRow(admin, "assurance_findings", orgId, {
      finding_type: "obligation_fulfillment",
      title: "Overdue obligations accumulating",
      summary: `${metrics.obligations_overdue} obligations are past due with open or in-progress status.`,
      severity: metrics.obligations_overdue > 20 ? "high" : "medium",
      confidence: 85,
      scope_json: { obligations_overdue: metrics.obligations_overdue },
      linked_controls_json: [],
      linked_entities_json: [],
      status: "open",
      source_check_run_id: run.data?.id,
    });
    if (f.data?.id && actorUserId) {
      await createFindingEvent(admin, orgId, String(f.data.id), "finding.created_from_check", actorUserId, {
        check_run_id: run.data?.id,
      });
    }
    if (f.error) errors.push(f.error);
    if (f.data) findingsCreated.push(f.data);
  }

  if (
    metrics.campaigns_with_drift_concern > 0 &&
    !(await hasRecentFinding(admin, orgId, "campaign_drift", dupWindowMs))
  ) {
    const f = await createRow(admin, "assurance_findings", orgId, {
      finding_type: "campaign_drift",
      title: "Campaign effectiveness drift",
      summary: `${metrics.campaigns_with_drift_concern} active campaigns show effectiveness drift signals.`,
      severity: "medium",
      confidence: 78,
      scope_json: { campaigns_with_drift_concern: metrics.campaigns_with_drift_concern },
      linked_controls_json: [],
      linked_entities_json: [],
      status: "open",
      source_check_run_id: run.data?.id,
    });
    if (f.data?.id && actorUserId) {
      await createFindingEvent(admin, orgId, String(f.data.id), "finding.created_from_check", actorUserId, {
        check_run_id: run.data?.id,
      });
    }
    if (f.error) errors.push(f.error);
    if (f.data) findingsCreated.push(f.data);
  }

  if (
    metrics.repeat_exception_type_clusters > 0 &&
    !(await hasRecentFinding(admin, orgId, "exception_recurrence", dupWindowMs))
  ) {
    const f = await createRow(admin, "assurance_findings", orgId, {
      finding_type: "exception_recurrence",
      title: "Repeated open exceptions by type",
      summary: `${metrics.repeat_exception_type_clusters} exception type cluster(s) show three or more open items — possible systemic issue.`,
      severity: metrics.repeat_exception_type_clusters > 3 ? "high" : "medium",
      confidence: 70,
      scope_json: { repeat_exception_type_clusters: metrics.repeat_exception_type_clusters },
      linked_controls_json: [],
      linked_entities_json: [],
      status: "open",
      source_check_run_id: run.data?.id,
    });
    if (f.data?.id && actorUserId) {
      await createFindingEvent(admin, orgId, String(f.data.id), "finding.created_from_check", actorUserId, {
        check_run_id: run.data?.id,
      });
    }
    if (f.error) errors.push(f.error);
    if (f.data) findingsCreated.push(f.data);
  }

  if (
    metrics.evidence_stale_proxy > 12 &&
    !(await hasRecentFinding(admin, orgId, "evidence_freshness", dupWindowMs))
  ) {
    const f = await createRow(admin, "assurance_findings", orgId, {
      finding_type: "evidence_freshness",
      title: "Evidence submissions aging in submitted state",
      summary: `${metrics.evidence_stale_proxy} evidence submissions have been in submitted status beyond the freshness proxy window.`,
      severity: metrics.evidence_stale_proxy > 40 ? "high" : "medium",
      confidence: 75,
      scope_json: { evidence_stale_proxy: metrics.evidence_stale_proxy },
      linked_controls_json: [],
      linked_entities_json: [],
      status: "open",
      source_check_run_id: run.data?.id,
    });
    if (f.data?.id && actorUserId) {
      await createFindingEvent(admin, orgId, String(f.data.id), "finding.created_from_check", actorUserId, {
        check_run_id: run.data?.id,
      });
    }
    if (f.error) errors.push(f.error);
    if (f.data) findingsCreated.push(f.data);
  }

  if (
    metrics.relationship_risk_signals > 0 &&
    !(await hasRecentFinding(admin, orgId, "relationship_risk", dupWindowMs))
  ) {
    const f = await createRow(admin, "assurance_findings", orgId, {
      finding_type: "relationship_risk",
      title: "Relationship risk propagation signals",
      summary: `${metrics.relationship_risk_signals} relationship timelines carry elevated propagation risk context.`,
      severity: metrics.relationship_risk_signals > 5 ? "high" : "medium",
      confidence: 72,
      scope_json: { relationship_risk_signals: metrics.relationship_risk_signals },
      linked_controls_json: [],
      linked_entities_json: [],
      status: "open",
      source_check_run_id: run.data?.id,
    });
    if (f.data?.id && actorUserId) {
      await createFindingEvent(admin, orgId, String(f.data.id), "finding.created_from_check", actorUserId, {
        check_run_id: run.data?.id,
      });
    }
    if (f.error) errors.push(f.error);
    if (f.data) findingsCreated.push(f.data);
  }

  if (
    metrics.low_health_program_scorecards >= 2 &&
    !(await hasRecentFinding(admin, orgId, "program_effectiveness", dupWindowMs))
  ) {
    const f = await createRow(admin, "assurance_findings", orgId, {
      finding_type: "program_effectiveness",
      title: "Program versions underperforming on assurance scorecards",
      summary: `${metrics.low_health_program_scorecards} program scorecard(s) are below the weak-program threshold (overall score under 52). Consider Program Evolution or playbook remediation.`,
      severity: metrics.low_health_program_scorecards > 5 ? "high" : "medium",
      confidence: 76,
      scope_json: { low_health_program_scorecards: metrics.low_health_program_scorecards },
      linked_controls_json: [],
      linked_entities_json: [],
      status: "open",
      source_check_run_id: run.data?.id,
    });
    if (f.data?.id && actorUserId) {
      await createFindingEvent(admin, orgId, String(f.data.id), "finding.created_from_check", actorUserId, {
        check_run_id: run.data?.id,
      });
    }
    if (f.error) errors.push(f.error);
    if (f.data) findingsCreated.push(f.data);
  }

  await recordV6AssuranceActivity(admin, orgId, {
    last_assurance_check_at: nowIso(),
    trigger_type: triggerType,
    findings_created: findingsCreated.length,
    policy_breaches: policyBreaches.length,
  }).catch(() => undefined);

  return {
    checkRun: run.data,
    findings: findingsCreated,
    metrics,
    policyResults,
    errors,
  };
}

/** Scheduled policy-only pass: logs evaluation without duplicating modular findings (cron). */
export async function runControlPolicyReevaluation(admin: AdminClient, orgId: string) {
  const metrics = await gatherPortfolioMetrics(admin, orgId);
  const policyResults = await evaluatePublishedControlPolicies(admin, orgId);
  const run = await createRow(admin, "assurance_check_runs", orgId, {
    check_type: "control_policy_reevaluation",
    trigger_type: "scheduled",
    status: "completed",
    summary_json: {
      metrics,
      policy_evaluations: policyResults.map((p) => ({
        policy_id: p.policy_id,
        policy_name: p.policy_name,
        evaluation_unit_key: p.evaluation_unit_key,
        scope: p.scope,
        pass: p.pass,
        breaches: p.breaches,
      })),
    },
    risk_delta_json: { policy_failures: policyResults.filter((p) => !p.pass).length },
    watch_signals_json: policyResults.some((p) => !p.pass) ? ["control_policy_breach"] : [],
    recommended_interventions_json: policyResults.some((p) => !p.pass) ? ["review_control_policies"] : [],
    started_at: nowIso(),
    completed_at: nowIso(),
    created_by: null,
  });
  return { checkRun: run.data, policyResults, error: run.error };
}

/**
 * Event-hook pass: control-policy evaluation, breach findings, and enforcement only.
 * Skips portfolio-wide heuristic findings (ownership, SLA clusters, etc.) — those run on scheduled `portfolio_assurance`.
 * Call after portfolio-shaping writes (campaigns, evidence, etc.). When an API mutates `contracts.tags`, hook here too.
 */
export async function runIncrementalAssuranceChecks(
  admin: AdminClient,
  orgId: string,
  actorUserId: string | null
) {
  const metrics = await gatherPortfolioMetrics(admin, orgId);
  const policyResults = await evaluatePublishedControlPolicies(admin, orgId);
  const policyBreaches = policyResults.filter((p) => !p.pass);

  const watchSignals = policyBreaches.length > 0 ? ["control_policy_breach"] : [];
  const recommended = policyBreaches.length > 0 ? ["review_control_policies"] : [];

  const run = await createRow(admin, "assurance_check_runs", orgId, {
    check_type: "incremental_assurance",
    trigger_type: "event",
    status: "completed",
    summary_json: {
      metrics,
      mode: "policy_breach_focus",
      policy_evaluations: policyResults.map((p) => ({
        policy_id: p.policy_id,
        evaluation_unit_key: p.evaluation_unit_key,
        scope: p.scope,
        pass: p.pass,
        breach_codes: p.breaches.map((b) => b.code),
      })),
    },
    risk_delta_json: {
      policy_failures: policyBreaches.length,
      rationale: "Incremental event pass — policies and enforcement only (no portfolio heuristic findings)",
    },
    watch_signals_json: watchSignals,
    recommended_interventions_json: recommended,
    started_at: nowIso(),
    completed_at: nowIso(),
    created_by: actorUserId,
  });

  const errors: unknown[] = [run.error].filter(Boolean);
  const policyProc = await processPolicyBreachesForCheckRun(
    admin,
    orgId,
    actorUserId,
    run.data?.id ? String(run.data.id) : undefined,
    policyBreaches,
    async (enfActions) => {
      if (!run.data?.id) return;
      await admin
        .from("assurance_check_runs")
        .update({
          summary_json: {
            metrics,
            mode: "policy_breach_focus",
            policy_evaluations: policyResults.map((p) => ({
              policy_id: p.policy_id,
              evaluation_unit_key: p.evaluation_unit_key,
              scope: p.scope,
              pass: p.pass,
              breach_codes: p.breaches.map((b) => b.code),
            })),
            enforcement_actions: enfActions,
          },
        })
        .eq("organization_id", orgId)
        .eq("id", run.data.id);
    }
  );
  errors.push(...policyProc.errors);

  await recordV6AssuranceActivity(admin, orgId, {
    last_incremental_assurance_at: nowIso(),
    last_assurance_check_at: nowIso(),
    trigger_type: "event",
    findings_created: policyProc.findingsCreated.length,
    policy_breaches: policyBreaches.length,
    incremental_assurance: true,
  }).catch(() => undefined);

  return {
    checkRun: run.data,
    findings: policyProc.findingsCreated,
    metrics,
    policyResults,
    errors,
  };
}
