import { randomUUID } from "node:crypto";
import type { AdminClient } from "@/lib/v6/service";
import { createRow } from "@/lib/v6/service";
import { nowIso } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { isOrgAutopilotExecutionAllowed } from "@/lib/v6/org-settings";

export type AutopilotRuleRow = {
  id: string;
  action_type: string;
  allowlist_json?: unknown;
  requires_approval?: boolean;
  enabled?: boolean;
  reversible?: boolean;
  guardrails_json?: Record<string, unknown>;
};

export type AutopilotExecutionContext = {
  /** When set, must appear in allowlist (if allowlist non-empty) */
  targetRefId?: string;
  findingId?: string | null;
};

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function allowlistPermits(rule: AutopilotRuleRow, ctx: AutopilotExecutionContext): boolean {
  const allow = Array.isArray(rule.allowlist_json) ? (rule.allowlist_json as string[]) : [];
  if (allow.length === 0) return true;
  const target = ctx.targetRefId ?? ctx.findingId;
  if (!target) return false;
  return allow.includes(target);
}

function withRevert(
  rule: AutopilotRuleRow,
  output: Record<string, unknown>,
  created: { table: string; id: string }
) {
  if (rule.reversible) {
    output.reversible = true;
    output.revert_hint = { table: created.table, id: created.id, action: "delete_or_close" };
  }
  return output;
}

/**
 * Bounded autopilot actions (v6 spec §9.4). Each case maps to the “Autopilot-suitable actions” list there;
 * unknown `action_type` values fall through to `logged_only`. When dryRun is true, no mutating side effects.
 */
export async function executeAutopilotAction(
  admin: AdminClient,
  orgId: string,
  userId: string | null,
  rule: AutopilotRuleRow,
  dryRun: boolean,
  ctx: AutopilotExecutionContext = {}
): Promise<{ output: Record<string, unknown>; wouldExecute: boolean }> {
  const allow = Array.isArray(rule.allowlist_json) ? (rule.allowlist_json as string[]) : [];
  const output: Record<string, unknown> = {
    action_type: rule.action_type,
    allowlist: allow,
    at: nowIso(),
    guardrails: rule.guardrails_json ?? {},
  };

  if (!allowlistPermits(rule, ctx)) {
    output.blocked = "allowlist_mismatch";
    return { output, wouldExecute: false };
  }

  if (dryRun) {
    output.mode = "dry_run";
    return { output: { ...output, safe: true, would_create: rule.action_type }, wouldExecute: true };
  }

  if (!isFeatureEnabled("v6AutopilotAllowExecution")) {
    output.blocked = "autopilot_execution_master_disabled";
    output.hint = "Enable the global autopilot execution gate to allow mutating autopilot actions.";
    return { output, wouldExecute: false };
  }

  const orgAllows = await isOrgAutopilotExecutionAllowed(admin, orgId);
  if (!orgAllows) {
    output.blocked = "autopilot_org_disabled";
    output.hint = "This organization has disabled mutating autopilot in assurance settings.";
    return { output, wouldExecute: false };
  }

  switch (rule.action_type) {
    case "evidence_refresh_request": {
      const link = await createRow(admin, "external_action_links", orgId, {
        token: `ap-${randomUUID()}`,
        action_type: "evidence_refresh_loop",
        status: "open",
        expires_at: daysFromNow(7),
        scope_json: { reason: "autopilot", autopilot_rule_id: rule.id, workflow_chain: [] },
        created_by: userId,
      });
      output.external_link_id = link.data?.id;
      output.created = !link.error;
      if (link.data?.id) withRevert(rule, output, { table: "external_action_links", id: String(link.data.id) });
      break;
    }
    case "open_decision_workspace": {
      const dw = await createRow(admin, "decision_workspaces", orgId, {
        decision_type: "policy_exception_decision",
        status: "open",
        title: "Autopilot: review workspace",
        linked_contract_ids: [],
        created_by: userId ?? undefined,
        owner_user_id: userId ?? undefined,
        v6_assurance_context_json: { source: "autopilot", rule_id: rule.id, finding_id: ctx.findingId },
      });
      output.decision_workspace_id = dw.data?.id;
      output.created = !dw.error;
      if (dw.data?.id) withRevert(rule, output, { table: "decision_workspaces", id: String(dw.data.id) });
      break;
    }
    case "add_to_maintenance_campaign":
    case "add_contract_to_campaign": {
      const camp = await createRow(admin, "portfolio_campaigns", orgId, {
        campaign_type: "remediation_push",
        status: "draft",
        name: "Autopilot maintenance touch",
        eligibility_json: { autopilot_rule_id: rule.id },
        assignment_json: {},
        created_by: userId ?? undefined,
      });
      output.campaign_id = camp.data?.id;
      output.created = !camp.error;
      if (camp.data?.id) withRevert(rule, output, { table: "portfolio_campaigns", id: String(camp.data.id) });
      break;
    }
    case "attach_default_playbook": {
      const pbId = rule.guardrails_json?.playbook_id as string | undefined;
      const contractId = (rule.guardrails_json?.contract_id as string | undefined) ?? ctx.targetRefId;
      if (!pbId) {
        output.note = "attach_default_playbook requires guardrails_json.playbook_id";
        output.created = false;
        break;
      }
      if (!contractId) {
        output.note = "attach_default_playbook requires guardrails_json.contract_id or targetRefId";
        output.created = false;
        break;
      }
      const rec = await createRow(admin, "operational_recommendations", orgId, {
        recommendation_type: "v6_default_playbook_attachment",
        target_ref_type: "contract",
        target_ref_id: String(contractId),
        recommendation_text: `Run adaptive playbook ${pbId} for assurance follow-up.`,
        reason_json: [{ source: "autopilot", rule_id: rule.id, adaptive_playbook_id: pbId }],
        confidence: 75,
        v6_outcome_tracking_json: { autopilot_playbook_attachment: pbId, contract_id: contractId },
      });
      output.recommendation_id = rec.data?.id;
      output.linked_playbook_id = pbId;
      output.created = !rec.error;
      if (rec.data?.id) withRevert(rule, output, { table: "operational_recommendations", id: String(rec.data.id) });
      break;
    }
    case "assign_reminder_recipients": {
      const { data: findings } = await admin
        .from("assurance_findings")
        .select("id, title, linked_entities_json")
        .eq("organization_id", orgId)
        .in("status", ["open", "in_review"])
        .order("updated_at", { ascending: false })
        .limit(12);
      const taskIds: string[] = [];
      const seenContracts = new Set<string>();
      for (const f of findings ?? []) {
        const le = (f as { linked_entities_json?: unknown }).linked_entities_json;
        if (!Array.isArray(le)) continue;
        for (const ent of le) {
          if (!ent || typeof ent !== "object") continue;
          const o = ent as { type?: string; id?: string };
          if (o.type !== "contract" || !o.id) continue;
          const cid = String(o.id);
          if (seenContracts.has(cid)) continue;
          seenContracts.add(cid);
          const { data: c } = await admin
            .from("contracts")
            .select("owner_id")
            .eq("organization_id", orgId)
            .eq("id", cid)
            .maybeSingle();
          const assignee = (c as { owner_id?: string | null } | null)?.owner_id ?? userId;
          if (!assignee) continue;
          const task = await createRow(admin, "contract_tasks", orgId, {
            contract_id: cid,
            title: "Assurance: confirm reminder recipient coverage",
            details: `Autopilot rule ${rule.id}: ensure renewal/obligations reminders reach the right owners. Finding ${String((f as { id: string }).id)} — ${String((f as { title?: string }).title ?? "")}.`,
            status: "open",
            priority: "low",
            created_by: userId ?? undefined,
            assignee_id: String(assignee),
            created_via: "rule",
          });
          if (task.data?.id) taskIds.push(String(task.data.id));
          if (taskIds.length >= 5) break;
        }
        if (taskIds.length >= 5) break;
      }
      if (taskIds.length > 0 && rule.reversible) {
        output.reversible = true;
        output.revert_hint = { table: "contract_tasks", id: taskIds[0], action: "delete_or_close" };
      }
      if (taskIds.length === 0) {
        const rec = await createRow(admin, "operational_recommendations", orgId, {
          recommendation_type: "autopilot_reminder_routing",
          target_ref_type: "organization",
          target_ref_id: orgId,
          recommendation_text:
            "Review reminder recipient coverage for active assurance findings (no contract-linked findings to task).",
          reason_json: [{ source: "autopilot", rule_id: rule.id }],
          confidence: 70,
        });
        output.recommendation_id = rec.data?.id;
        output.created = !rec.error;
        output.fallback = "no_contract_linked_findings";
        break;
      }
      output.task_ids = taskIds;
      output.created = true;
      output.note = `created_${taskIds.length}_tasks`;
      break;
    }
    case "request_stakeholder_input": {
      const link = await createRow(admin, "external_action_links", orgId, {
        token: `ap-${randomUUID()}`,
        action_type: "bounded_request",
        status: "open",
        expires_at: daysFromNow(10),
        scope_json: { autopilot: true, rule_id: rule.id },
        created_by: userId,
      });
      output.external_link_id = link.data?.id;
      output.created = !link.error;
      break;
    }
    case "send_follow_up_nudge": {
      const link = await createRow(admin, "external_action_links", orgId, {
        token: `ap-${randomUUID()}`,
        action_type: "nudge",
        status: "open",
        expires_at: daysFromNow(3),
        scope_json: { nudge: true, rule_id: rule.id },
        created_by: userId,
      });
      output.external_link_id = link.data?.id;
      output.created = !link.error;
      break;
    }
    case "generate_review_packets": {
      const pack = await createRow(admin, "report_packs", orgId, {
        name: "Autopilot review packet",
        report_type: "assurance_summary",
        config_json: { autopilot: true, rule_id: rule.id },
        v6_assurance_pack_json: { source: "autopilot" },
        created_by: userId,
      });
      output.report_pack_id = pack.data?.id;
      output.created = !pack.error;
      break;
    }
    case "schedule_report_pack_delivery": {
      const pack = await createRow(admin, "report_packs", orgId, {
        name: "Autopilot scheduled pack",
        report_type: "focused_operational",
        schedule: "weekly",
        config_json: { autopilot_scheduled: true },
        v6_assurance_pack_json: { scheduled: true },
        created_by: userId,
      });
      output.report_pack_id = pack.data?.id;
      output.created = !pack.error;
      break;
    }
    default:
      output.mode = "logged_only";
      output.note = "action_type_not_implemented";
      output.created = false;
  }

  return { output, wouldExecute: true };
}
