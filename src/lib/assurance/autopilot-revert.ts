import type { AdminClient } from "@/lib/assurance/service";
import { nowIso } from "@/lib/decision-intelligence/api";

type RevertHint = {
  table?: string;
  id?: string;
  action?: string;
};

/**
 * Best-effort reversal for reversible autopilot rows (v6.md §9.4).
 */
export async function revertAutopilotRunLog(admin: AdminClient, orgId: string, logId: string, userId: string) {
  const { data: log, error } = await admin
    .from("autopilot_run_logs")
    .select("id, status, output_json, autopilot_rule_id")
    .eq("organization_id", orgId)
    .eq("id", logId)
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message };
  if (!log) return { ok: false as const, error: "log_not_found" };

  const out = (log as { output_json?: Record<string, unknown> }).output_json ?? {};
  const hint = (out.revert_hint ?? out.revertHint) as RevertHint | undefined;
  if (!hint?.table || !hint?.id) {
    return { ok: false as const, error: "no_revert_hint" };
  }

  if (hint.action !== "delete_or_close") {
    return { ok: false as const, error: "unsupported_revert_action" };
  }

  if (hint.table === "external_action_links") {
    const { error: delErr } = await admin
      .from("external_action_links")
      .delete()
      .eq("organization_id", orgId)
      .eq("id", hint.id)
      .eq("status", "open");
    if (delErr) return { ok: false as const, error: delErr.message };
  } else if (hint.table === "decision_workspaces") {
    const { error: upErr } = await admin
      .from("decision_workspaces")
      .update({ status: "closed", updated_at: nowIso() })
      .eq("organization_id", orgId)
      .eq("id", hint.id);
    if (upErr) return { ok: false as const, error: upErr.message };
  } else if (hint.table === "operational_recommendations") {
    const { error: delErr } = await admin
      .from("operational_recommendations")
      .delete()
      .eq("organization_id", orgId)
      .eq("id", hint.id);
    if (delErr) return { ok: false as const, error: delErr.message };
  } else if (hint.table === "portfolio_campaigns") {
    const { error: upErr } = await admin
      .from("portfolio_campaigns")
      .update({ status: "closed", updated_at: nowIso() })
      .eq("organization_id", orgId)
      .eq("id", hint.id);
    if (upErr) return { ok: false as const, error: upErr.message };
  } else if (hint.table === "report_packs") {
    const { error: delErr } = await admin.from("report_packs").delete().eq("organization_id", orgId).eq("id", hint.id);
    if (delErr) return { ok: false as const, error: delErr.message };
  } else if (hint.table === "contract_tasks") {
    const { error: taskErr } = await admin
      .from("contract_tasks")
      .update({ status: "closed", updated_at: nowIso() })
      .eq("organization_id", orgId)
      .eq("id", hint.id);
    if (taskErr) return { ok: false as const, error: taskErr.message };
  } else {
    return { ok: false as const, error: "unsupported_table" };
  }

  const { error: logErr } = await admin
    .from("autopilot_run_logs")
    .update({
      status: "reverted",
      output_json: { ...out, reverted_at: nowIso(), reverted_by: userId },
    })
    .eq("organization_id", orgId)
    .eq("id", logId);

  if (logErr) return { ok: false as const, error: logErr.message };

  return { ok: true as const };
}
