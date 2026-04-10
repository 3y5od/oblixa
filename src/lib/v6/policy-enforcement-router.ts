import { randomUUID } from "node:crypto";
import type { AdminClient } from "@/lib/v6/service";
import { createRow } from "@/lib/v6/service";
import { nowIso } from "@/lib/v5/api";
import type { PolicyEvaluationResult } from "@/lib/v6/policy-evaluator";
import { executeAutopilotAction, type AutopilotRuleRow } from "@/lib/v6/autopilot-executors";

export type EnforcementActionRecord = {
  kind: string;
  id?: string;
  detail?: Record<string, unknown>;
};

/** Prefer rules with `guardrails_json.policy_id` matching the breached policy; else first enabled rule. */
async function selectAutopilotRuleForPolicy(
  admin: AdminClient,
  orgId: string,
  policyId: string
): Promise<AutopilotRuleRow | null> {
  const { data: rules } = await admin
    .from("autopilot_rules")
    .select("id, action_type, allowlist_json, requires_approval, enabled, guardrails_json, reversible")
    .eq("organization_id", orgId)
    .eq("enabled", true)
    .order("updated_at", { ascending: false })
    .limit(40);

  const list = (rules ?? []) as AutopilotRuleRow[];
  const matched = list.find((r) => {
    const g = r.guardrails_json;
    if (!g || typeof g !== "object") return false;
    return String((g as { policy_id?: string }).policy_id ?? "") === policyId;
  });
  return matched ?? list[0] ?? null;
}

/**
 * Routes control policy enforcement_mode after a breach to concrete org-scoped side effects (v6.md §9.1).
 */
export async function routePolicyEnforcement(
  admin: AdminClient,
  orgId: string,
  evaluation: PolicyEvaluationResult,
  ctx: {
    findingId?: string | null;
    actorUserId: string | null;
    sourceCheckRunId?: string | null;
    /** Contracts in the policy evaluation scope (for workspaces / campaigns). */
    linkedContractIds?: string[];
  }
): Promise<{ actions: EnforcementActionRecord[]; errors: unknown[] }> {
  const actions: EnforcementActionRecord[] = [];
  const errors: unknown[] = [];

  if (evaluation.pass || evaluation.breaches.length === 0) {
    return { actions, errors };
  }

  const mode = evaluation.enforcement_mode;
  const title = `Policy breach: ${evaluation.policy_name}`;
  const summary = evaluation.breaches.map((b) => b.detail).join("; ");
  const linked = (ctx.linkedContractIds ?? evaluation.scope.contract_ids ?? []).slice(0, 200);

  const v6Context = {
    source: "control_policy_enforcement",
    policy_id: evaluation.policy_id,
    finding_id: ctx.findingId ?? null,
    check_run_id: ctx.sourceCheckRunId ?? null,
    breaches: evaluation.breaches,
    evaluation_unit_key: evaluation.evaluation_unit_key,
    scope_label: evaluation.scope.label,
    assignment_id: evaluation.scope.assignment_id,
    linked_contract_ids: linked,
  };

  switch (mode) {
    case "observe_only": {
      actions.push({ kind: "observe_only", detail: { policy_id: evaluation.policy_id } });
      break;
    }
    case "warn": {
      if (ctx.findingId && ctx.actorUserId) {
        await admin.from("assurance_finding_events").insert({
          organization_id: orgId,
          finding_id: ctx.findingId,
          event_type: "policy.enforcement_warn",
          actor_user_id: ctx.actorUserId,
          payload_json: { policy_id: evaluation.policy_id, v6_context: v6Context },
        });
      }
      actions.push({ kind: "warn", detail: { policy_id: evaluation.policy_id } });
      break;
    }
    case "create_exception": {
      const ex = await createRow(admin, "exceptions", orgId, {
        exception_type: "policy_control",
        title,
        details: summary,
        severity: evaluation.breaches.some((b) => b.severity === "high") ? "high" : "medium",
        status: "open",
        linked_entity_type: "control_policy",
        linked_entity_id: evaluation.policy_id,
        assurance_finding_id: ctx.findingId ?? null,
        escalation_json: { v6_assurance_context_json: v6Context },
      });
      if (ex.error) errors.push(ex.error);
      if (ex.data?.id) actions.push({ kind: "exception", id: String(ex.data.id) });
      break;
    }
    case "require_decision_workspace": {
      const dw = await createRow(admin, "decision_workspaces", orgId, {
        decision_type: "policy_exception_decision",
        status: "open",
        title,
        linked_contract_ids: linked,
        created_by: ctx.actorUserId ?? undefined,
        owner_user_id: ctx.actorUserId ?? undefined,
        v6_assurance_context_json: {
          ...v6Context,
          policy_enforcement: mode,
          assurance_finding_id: ctx.findingId ?? null,
        },
      });
      if (dw.error) errors.push(dw.error);
      if (dw.data?.id) actions.push({ kind: "decision_workspace", id: String(dw.data.id) });
      break;
    }
    case "trigger_campaign": {
      const camp = await createRow(admin, "portfolio_campaigns", orgId, {
        campaign_type: "remediation_push",
        status: "draft",
        name: `Remediation: ${evaluation.policy_name}`,
        eligibility_json: {
          control_policy_id: evaluation.policy_id,
          evaluation_unit_key: evaluation.evaluation_unit_key,
          scoped_contract_ids: linked,
        },
        assignment_json: {},
        preview_summary_json: {
          policy_breach: true,
          assurance_finding_id: ctx.findingId,
          scope_label: evaluation.scope.label,
        },
        v6_effectiveness_json: {
          source: "policy_enforcement",
          policy_id: evaluation.policy_id,
          assignment_id: evaluation.scope.assignment_id,
        },
        created_by: ctx.actorUserId ?? undefined,
      });
      if (camp.error) errors.push(camp.error);
      if (camp.data?.id && linked.length > 0) {
        const rows = linked.map((contract_id) => ({
          organization_id: orgId,
          campaign_id: String(camp.data!.id),
          contract_id,
          status: "pending" as const,
        }));
        const ins = await admin.from("portfolio_campaign_contracts").insert(rows);
        if (ins.error) errors.push(ins.error);
      }
      if (camp.data?.id) {
        actions.push({ kind: "campaign", id: String(camp.data.id) });
        const sim = await createRow(admin, "change_simulations", orgId, {
          simulation_type: "control_policy_breach",
          name: `Breach preview · ${evaluation.policy_name.slice(0, 48)}`,
          input_json: {
            control_policy_id: evaluation.policy_id,
            draft_campaign_id: String(camp.data.id),
            evaluation_unit_key: evaluation.evaluation_unit_key,
          },
          v6_scope_json: {
            source: "policy_enforcement_trigger_campaign",
            assurance_finding_id: ctx.findingId ?? null,
          },
          created_by: ctx.actorUserId ?? undefined,
        });
        if (sim.error) {
          errors.push(sim.error);
        } else if (sim.data?.id) {
          const runSim = await createRow(admin, "change_simulation_runs", orgId, {
            simulation_id: String(sim.data.id),
            status: "completed",
            result_json: {
              note: "auto_preview_from_policy_breach",
              campaign_id: String(camp.data.id),
            },
            promoted_campaign_id: String(camp.data.id),
            created_by: ctx.actorUserId ?? undefined,
          });
          if (runSim.error) errors.push(runSim.error);
          actions.push({ kind: "policy_breach_simulation", id: String(sim.data.id) });
        }
      }
      break;
    }
    case "trigger_autopilot_action": {
      const rule = await selectAutopilotRuleForPolicy(admin, orgId, evaluation.policy_id);
      if (rule?.id) {
        const exec = await executeAutopilotAction(admin, orgId, ctx.actorUserId, rule, false, {
          findingId: ctx.findingId,
        });
        await admin.from("autopilot_run_logs").insert({
          organization_id: orgId,
          autopilot_rule_id: rule.id,
          status: "executed",
          action_type: rule.action_type,
          finding_id: ctx.findingId ?? null,
          input_json: { policy_id: evaluation.policy_id, source: "policy_enforcement" },
          output_json: exec.output,
          reason: "Policy enforcement triggered autopilot",
        });
        actions.push({ kind: "autopilot", id: rule.id, detail: exec.output });
      } else {
        const link = await createRow(admin, "external_action_links", orgId, {
          token: `pe-${randomUUID()}`,
          action_type: "evidence_refresh_loop",
          status: "open",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          scope_json: {
            reason: "policy_autopilot_fallback",
            policy_id: evaluation.policy_id,
            workflow_chain: [{ type: "policy_breach", at: nowIso() }],
          },
          created_by: ctx.actorUserId ?? undefined,
        });
        if (link.error) errors.push(link.error);
        actions.push({ kind: "autopilot_fallback_external_link", id: link.data?.id as string | undefined });
      }
      break;
    }
    case "escalate_immediately": {
      if (ctx.findingId) {
        await admin
          .from("assurance_findings")
          .update({
            severity: "critical",
            updated_at: nowIso(),
          })
          .eq("organization_id", orgId)
          .eq("id", ctx.findingId);
        await admin.from("assurance_finding_events").insert({
          organization_id: orgId,
          finding_id: ctx.findingId,
          event_type: "finding.escalated_policy",
          actor_user_id: ctx.actorUserId,
          payload_json: { policy_id: evaluation.policy_id },
        });
      }
      const ex = await createRow(admin, "exceptions", orgId, {
        exception_type: "policy_escalation",
        title: `Escalated: ${title}`,
        details: summary,
        severity: "critical",
        status: "open",
        linked_entity_type: "control_policy",
        linked_entity_id: evaluation.policy_id,
        assurance_finding_id: ctx.findingId ?? null,
        escalation_json: { immediate: true, v6_assurance_context_json: v6Context },
        last_escalated_at: nowIso(),
      });
      if (ex.error) errors.push(ex.error);
      actions.push({ kind: "escalation", id: ex.data?.id as string | undefined });
      break;
    }
    default: {
      actions.push({ kind: "unknown_mode", detail: { mode } });
      const rec = await createRow(admin, "operational_recommendations", orgId, {
        recommendation_type: "v6_policy_enforcement_unknown_mode",
        target_ref_type: "control_policy",
        target_ref_id: evaluation.policy_id,
        recommendation_text: `Control policy "${evaluation.policy_name}" breached with enforcement mode "${mode}" that has no automated router. Review policy configuration.`,
        reason_json: [
          {
            source: "policy_enforcement_router",
            mode,
            policy_id: evaluation.policy_id,
            evaluation_unit_key: evaluation.evaluation_unit_key,
          },
        ],
        confidence: 88,
      });
      if (!rec.error && rec.data?.id) {
        actions.push({ kind: "operational_recommendation", id: String(rec.data.id) });
      } else if (rec.error) {
        errors.push(rec.error);
      }
    }
  }

  return { actions, errors };
}

/**
 * Apply enforcement for each failed policy evaluation (dedupe by policy id).
 */
export async function applyPolicyEnforcementForEvaluations(
  admin: AdminClient,
  orgId: string,
  failedEvaluations: PolicyEvaluationResult[],
  ctx: {
    findingIdByEvaluationUnit?: Map<string, string>;
    /** @deprecated use findingIdByEvaluationUnit */
    findingIdByPolicyId?: Map<string, string>;
    actorUserId: string | null;
    sourceCheckRunId?: string | null;
  }
): Promise<{ allActions: EnforcementActionRecord[]; errors: unknown[] }> {
  const allActions: EnforcementActionRecord[] = [];
  const errors: unknown[] = [];

  for (const ev of failedEvaluations) {
    const findingId =
      ctx.findingIdByEvaluationUnit?.get(ev.evaluation_unit_key) ??
      ctx.findingIdByPolicyId?.get(ev.policy_id) ??
      null;
    const { actions, errors: e } = await routePolicyEnforcement(admin, orgId, ev, {
      findingId,
      actorUserId: ctx.actorUserId,
      sourceCheckRunId: ctx.sourceCheckRunId,
      linkedContractIds: ev.scope.contract_ids,
    });
    allActions.push(...actions);
    errors.push(...e);
  }

  return { allActions, errors };
}
