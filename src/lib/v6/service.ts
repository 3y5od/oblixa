import { nowIso } from "@/lib/v5/api";
import { createAdminClient } from "@/lib/supabase/server";
import { runModularAssuranceChecks } from "@/lib/v6/assurance-checks";
import { recomputeScorecards as recomputeScorecardsEngine } from "@/lib/v6/scorecards";

export type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

export async function listRows(admin: AdminClient, table: string, orgId: string, columns = "*") {
  const { data, error } = await admin
    .from(table)
    .select(columns)
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(200);
  return { data: data ?? [], error };
}

export async function createRow(admin: AdminClient, table: string, orgId: string, payload: Record<string, unknown>) {
  const { data, error } = await admin
    .from(table)
    .insert({ organization_id: orgId, ...payload })
    .select("*")
    .single();
  return { data, error };
}

export async function updateRowById(
  admin: AdminClient,
  table: string,
  orgId: string,
  id: string,
  payload: Record<string, unknown>
) {
  const { data, error } = await admin
    .from(table)
    .update(payload)
    .eq("organization_id", orgId)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  return { data, error };
}

export async function createFindingEvent(
  admin: AdminClient,
  orgId: string,
  findingId: string,
  eventType: string,
  actorUserId: string,
  payloadJson: Record<string, unknown> = {}
) {
  const { error } = await admin.from("assurance_finding_events").insert({
    organization_id: orgId,
    finding_id: findingId,
    event_type: eventType,
    actor_user_id: actorUserId,
    payload_json: { ...payloadJson, at: nowIso() },
  });
  if (error) console.error("createFindingEvent insert failed:", error);
  return { error };
}

export async function runAssuranceChecks(admin: AdminClient, orgId: string, actorUserId: string | null) {
  const triggerType = actorUserId ? "manual" : "scheduled";
  const result = await runModularAssuranceChecks(admin, orgId, actorUserId, triggerType);
  const firstFinding = result.findings[0] ?? null;
  return {
    checkRun: result.checkRun,
    finding: firstFinding,
    findings: result.findings,
    metrics: result.metrics,
    policyResults: result.policyResults,
    errors: result.errors.filter(Boolean),
  };
}

export async function recomputeScorecards(admin: AdminClient, orgId: string) {
  return recomputeScorecardsEngine(admin, orgId);
}
