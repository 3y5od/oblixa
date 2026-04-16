import type { AdminClient } from "@/lib/v6/service";
import { createRow, listRows, updateRowById } from "@/lib/v6/service";
import { nowIso } from "@/lib/v5/api";
import { executeAutopilotAction, type AutopilotRuleRow } from "@/lib/v6/autopilot-executors";

export function listAutopilotRules(admin: AdminClient, orgId: string) {
  return listRows(
    admin,
    "autopilot_rules",
    orgId,
    "id, name, action_type, enabled, requires_approval, dry_run_count, allowlist_json, guardrails_json, updated_at"
  );
}

export async function createAutopilotRule(
  admin: AdminClient,
  orgId: string,
  userId: string,
  payload: { name: string; actionType: string; requiresApproval?: boolean }
) {
  const trimmedName = (payload.name ?? "").trim();
  if (!trimmedName || trimmedName.length > 240) {
    return { data: null, error: { message: "name must be non-empty and at most 240 characters" } };
  }
  const trimmedAction = (payload.actionType ?? "").trim();
  if (!trimmedAction) {
    return { data: null, error: { message: "actionType must be non-empty" } };
  }
  return createRow(admin, "autopilot_rules", orgId, {
    name: trimmedName,
    action_type: trimmedAction,
    requires_approval: payload.requiresApproval ?? true,
    created_by: userId,
  });
}

export async function dryRunAutopilotRule(admin: AdminClient, orgId: string, ruleId: string, userId: string) {
  const { data: row, error: fetchErr } = await admin
    .from("autopilot_rules")
    .select(
      "id, action_type, allowlist_json, requires_approval, enabled, reversible, guardrails_json, dry_run_count"
    )
    .eq("organization_id", orgId)
    .eq("id", ruleId)
    .maybeSingle();

  if (fetchErr || !row) {
    return { rule: null, run: null, error: fetchErr ?? { message: "rule_not_found" } };
  }

  const nextDry = Number((row as { dry_run_count?: number }).dry_run_count ?? 0) + 1;
  const rulePatch = await updateRowById(admin, "autopilot_rules", orgId, ruleId, {
    dry_run_count: nextDry,
  });

  const exec = await executeAutopilotAction(admin, orgId, userId, row as AutopilotRuleRow, true, {});

  const run = await createRow(admin, "autopilot_run_logs", orgId, {
    autopilot_rule_id: ruleId,
    status: "dry_run",
    action_type: String((row as { action_type: string }).action_type),
    reason: "Manual dry run (simulated output)",
    input_json: { initiated_at: nowIso() },
    output_json: exec.output,
  });

  return { rule: rulePatch.data, run: run.data, error: rulePatch.error ?? run.error };
}

export function enableAutopilotRule(admin: AdminClient, orgId: string, ruleId: string) {
  return updateRowById(admin, "autopilot_rules", orgId, ruleId, { enabled: true });
}

export function disableAutopilotRule(admin: AdminClient, orgId: string, ruleId: string) {
  return updateRowById(admin, "autopilot_rules", orgId, ruleId, { enabled: false });
}

export function patchAutopilotRule(
  admin: AdminClient,
  orgId: string,
  ruleId: string,
  patch: {
    allowlist?: string[];
    enabled?: boolean;
    guardrails?: Record<string, unknown>;
  }
) {
  const payload: Record<string, unknown> = {};
  if (patch.allowlist) payload.allowlist_json = patch.allowlist;
  if (patch.enabled !== undefined) payload.enabled = patch.enabled;
  if (patch.guardrails) payload.guardrails_json = patch.guardrails;
  return updateRowById(admin, "autopilot_rules", orgId, ruleId, payload);
}

export function listAutopilotRuns(admin: AdminClient, orgId: string) {
  return listRows(
    admin,
    "autopilot_run_logs",
    orgId,
    "id, autopilot_rule_id, status, action_type, reason, created_at, output_json"
  );
}
