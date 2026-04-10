import { randomUUID } from "node:crypto";
import type { AdminClient } from "@/lib/v6/service";
import { createRow } from "@/lib/v6/service";
import { nowIso } from "@/lib/v5/api";

export type PlaybookExecutionContext = {
  sourceFindingId?: string | null;
};

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Executes adaptive playbook side effects keyed by playbook_type (§9.3).
 */
/** v6.md §9.3 playbook_type values (snake_case). */
const KNOWN_PLAYBOOK_TYPES = new Set([
  "create_decision_workspace",
  "start_campaign",
  "escalate_manager",
  "assign_backup_owner",
  "request_evidence_refresh",
  "reopen_exception",
  "trigger_stakeholder_review",
  "generate_packet",
  "send_bounded_external_request",
  "schedule_focused_report_pack",
  "route_contracts_into_maintenance_campaign",
  "finding_to_intervention",
]);

export async function executePlaybookSideEffects(
  admin: AdminClient,
  orgId: string,
  userId: string,
  playbookType: string,
  executionTemplate: Record<string, unknown>,
  ctx: PlaybookExecutionContext
): Promise<{ records: Record<string, unknown>; error?: unknown }> {
  const records: Record<string, unknown> = {};
  if (!KNOWN_PLAYBOOK_TYPES.has(playbookType)) {
    return {
      records,
      error: { message: `unknown_playbook_type:${playbookType}` },
    };
  }
  const title = String(executionTemplate.title ?? "Assurance playbook action");
  const v6Context = {
    source: "adaptive_playbook",
    finding_id: ctx.sourceFindingId ?? null,
    template: executionTemplate,
  };
  const contractId = executionTemplate.contract_id ? String(executionTemplate.contract_id) : null;
  const exceptionId = executionTemplate.exception_id ? String(executionTemplate.exception_id) : null;

  switch (playbookType) {
    case "create_decision_workspace": {
      const dw = await createRow(admin, "decision_workspaces", orgId, {
        decision_type: "policy_exception_decision",
        status: "open",
        title,
        linked_contract_ids: contractId ? [contractId] : [],
        created_by: userId,
        owner_user_id: userId,
        v6_assurance_context_json: v6Context,
      });
      records.decision_workspace = dw.data;
      if (dw.error) return { records, error: dw.error };
      break;
    }
    case "start_campaign": {
      const camp = await createRow(admin, "portfolio_campaigns", orgId, {
        campaign_type: "remediation_push",
        status: "draft",
        name: String(executionTemplate.name ?? title),
        eligibility_json: { v6_playbook: true },
        assignment_json: {},
        preview_summary_json: { playbook_finding_id: ctx.sourceFindingId },
        v6_effectiveness_json: { source: "adaptive_playbook", seeded_at: nowIso() },
        created_by: userId,
      });
      records.campaign = camp.data;
      if (camp.error) return { records, error: camp.error };
      break;
    }
    case "request_evidence_refresh": {
      const link = await createRow(admin, "external_action_links", orgId, {
        token: `pb-${randomUUID()}`,
        action_type: "evidence_refresh_loop",
        status: "open",
        expires_at: daysFromNow(7),
        scope_json: {
          reason: "playbook_evidence_refresh",
          workflow_chain: [{ type: "request_refresh", at: nowIso() }],
          v6_context: v6Context,
        },
        created_by: userId,
      });
      records.external_link = link.data;
      if (link.error) return { records, error: link.error };
      break;
    }
    case "escalate_manager": {
      const ex = await createRow(admin, "exceptions", orgId, {
        exception_type: "escalation",
        title: String(executionTemplate.title ?? "Manager escalation"),
        details: String(executionTemplate.details ?? "Escalated from assurance playbook"),
        severity: "high",
        status: "open",
        contract_id: contractId,
        escalation_json: { v6_assurance_context_json: v6Context, source: "playbook" },
        last_escalated_at: nowIso(),
      });
      records.exception = ex.data;
      if (ex.error) return { records, error: ex.error };
      break;
    }
    case "assign_backup_owner": {
      if (!contractId) {
        return { records, error: { message: "contract_id required in execution template" } };
      }
      const task = await createRow(admin, "contract_tasks", orgId, {
        contract_id: contractId,
        title: String(executionTemplate.task_title ?? "Backup owner review"),
        details: String(executionTemplate.task_details ?? "Assigned by assurance playbook"),
        status: "open",
        priority: "medium",
        created_by: userId,
        assignee_id: executionTemplate.assignee_id ? String(executionTemplate.assignee_id) : userId,
        created_via: "manual",
      });
      records.task = task.data;
      if (task.error) return { records, error: task.error };
      break;
    }
    case "reopen_exception": {
      if (!exceptionId) {
        return { records, error: { message: "exception_id required in execution template" } };
      }
      const { data, error } = await admin
        .from("exceptions")
        .update({ status: "open", updated_at: nowIso() })
        .eq("organization_id", orgId)
        .eq("id", exceptionId)
        .select("id")
        .maybeSingle();
      records.exception = data;
      if (error) return { records, error };
      break;
    }
    case "trigger_stakeholder_review": {
      const dw = await createRow(admin, "decision_workspaces", orgId, {
        decision_type: "remediation_acceptance_decision",
        status: "open",
        title: String(executionTemplate.title ?? "Stakeholder review"),
        linked_contract_ids: contractId ? [contractId] : [],
        created_by: userId,
        owner_user_id: userId,
        v6_assurance_context_json: { ...v6Context, review: true },
      });
      records.decision_workspace = dw.data;
      if (dw.error) return { records, error: dw.error };
      break;
    }
    case "generate_packet": {
      const pack = await createRow(admin, "report_packs", orgId, {
        name: String(executionTemplate.title ?? "Assurance packet"),
        report_type: "assurance_summary",
        config_json: { source: "adaptive_playbook" },
        v6_assurance_pack_json: { source: "playbook", finding_id: ctx.sourceFindingId },
        created_by: userId,
      });
      records.report_pack = pack.data;
      if (pack.error) return { records, error: pack.error };
      break;
    }
    case "send_bounded_external_request": {
      const link = await createRow(admin, "external_action_links", orgId, {
        token: `pb-${randomUUID()}`,
        action_type: "bounded_request",
        status: "open",
        expires_at: daysFromNow(Number(executionTemplate.expires_days) || 14),
        scope_json: { workflow_chain: [], v6_context: v6Context, contract_id: contractId },
        created_by: userId,
      });
      records.external_link = link.data;
      if (link.error) return { records, error: link.error };
      break;
    }
    case "schedule_focused_report_pack": {
      const pack = await createRow(admin, "report_packs", orgId, {
        name: String(executionTemplate.title ?? "Focused report pack"),
        report_type: "focused_operational",
        schedule: "weekly",
        config_json: { scheduled: true },
        v6_assurance_pack_json: { scheduled: true, playbook: true },
        created_by: userId,
      });
      records.report_pack = pack.data;
      if (pack.error) return { records, error: pack.error };
      break;
    }
    case "route_contracts_into_maintenance_campaign": {
      const camp = await createRow(admin, "portfolio_campaigns", orgId, {
        campaign_type: "remediation_push",
        status: "draft",
        name: String(executionTemplate.name ?? "Maintenance touch"),
        eligibility_json: { v6_playbook_maintenance: true },
        assignment_json: {},
        preview_summary_json: { finding_id: ctx.sourceFindingId },
        v6_effectiveness_json: { maintenance_route: true },
        created_by: userId,
      });
      records.campaign = camp.data;
      if (camp.error) return { records, error: camp.error };
      break;
    }
    case "finding_to_intervention": {
      if (!ctx.sourceFindingId) {
        return { records, error: { message: "sourceFindingId required for finding_to_intervention" } };
      }
      const { data: finding } = await admin
        .from("assurance_findings")
        .select("recommended_playbook_id, title")
        .eq("organization_id", orgId)
        .eq("id", ctx.sourceFindingId)
        .maybeSingle();
      const pbId = (finding as { recommended_playbook_id?: string | null } | null)?.recommended_playbook_id;
      if (!pbId) {
        const rec = await createRow(admin, "operational_recommendations", orgId, {
          recommendation_type: "v6_finding_intervention_seed",
          target_ref_type: "assurance_finding",
          target_ref_id: String(ctx.sourceFindingId),
          recommendation_text: `Link a remediation playbook to finding: ${String((finding as { title?: string })?.title ?? ctx.sourceFindingId)}`,
          reason_json: [{ source: "finding_to_intervention", finding_id: ctx.sourceFindingId }],
          confidence: 62,
          created_by: userId,
        });
        records.recommendation = rec.data;
        if (rec.error) return { records, error: rec.error };
        break;
      }
      const { data: linkedPb } = await admin
        .from("adaptive_playbooks")
        .select("playbook_type, execution_template_json")
        .eq("organization_id", orgId)
        .eq("id", String(pbId))
        .maybeSingle();
      if (!linkedPb) {
        return { records, error: { message: "recommended_playbook_not_found" } };
      }
      const linkedType = String((linkedPb as { playbook_type: string }).playbook_type);
      if (linkedType === "finding_to_intervention") {
        records.note = "nested_finding_to_intervention_skipped";
        break;
      }
      const nested = await executePlaybookSideEffects(
        admin,
        orgId,
        userId,
        linkedType,
        ((linkedPb as { execution_template_json?: unknown }).execution_template_json as Record<string, unknown>) ?? {},
        ctx
      );
      Object.assign(records, nested.records);
      if (nested.error) return { records, error: nested.error };
      break;
    }
    default: {
      return {
        records,
        error: { message: `unhandled_playbook_type:${playbookType}` },
      };
    }
  }

  return { records };
}
