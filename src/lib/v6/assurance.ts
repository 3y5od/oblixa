import type { PostgrestError } from "@supabase/supabase-js";
import type { AdminClient } from "@/lib/v6/service";
import { createRow, listRows } from "@/lib/v6/service";
import { createFindingEvent, recomputeScorecards, runAssuranceChecks } from "@/lib/v6/service";

export type ListFindingsFilters = {
  status?: string;
  severity?: string;
  finding_type?: string;
};

const FINDING_NOT_ACTIVE_ERROR: PostgrestError = {
  name: "PostgrestError",
  message: "finding_not_active",
  details: "Finding is already resolved or dismissed.",
  hint: "",
  code: "409",
  toJSON() {
    const { name, message, details, hint, code } = this;
    return { name, message, details, hint, code };
  },
};

export async function listFindings(admin: AdminClient, orgId: string, filters?: ListFindingsFilters) {
  let q = admin
    .from("assurance_findings")
    .select("id, finding_type, title, severity, confidence, status, recommended_playbook_id, updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.severity) q = q.eq("severity", filters.severity);
  if (filters?.finding_type) q = q.eq("finding_type", filters.finding_type);
  const { data, error } = await q;
  return { data: data ?? [], error };
}

export async function resolveFinding(
  admin: AdminClient,
  orgId: string,
  userId: string,
  findingId: string,
  resolutionNote?: string,
  signalFeedback?: string | null
) {
  const { data, error } = await admin
    .from("assurance_findings")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      analyst_note: resolutionNote ?? null,
    })
    .eq("organization_id", orgId)
    .eq("id", findingId)
    .neq("status", "resolved")
    .neq("status", "dismissed")
    .select("id,organization_id,created_at,updated_at")
    .maybeSingle();
  const result = {
    data: (data ?? null) as Record<string, unknown> | null,
    error: error ?? (data ? null : FINDING_NOT_ACTIVE_ERROR),
  };

  if (result.data?.id) {
    await createFindingEvent(admin, orgId, String(result.data.id), "finding.resolved", userId, {
      note: resolutionNote ?? null,
      signal_feedback: signalFeedback ?? null,
    });
  }

  return result;
}

export async function dismissFinding(
  admin: AdminClient,
  orgId: string,
  userId: string,
  findingId: string,
  resolutionNote?: string,
  signalFeedback?: string | null
) {
  const { data, error } = await admin
    .from("assurance_findings")
    .update({
      status: "dismissed",
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      analyst_note: resolutionNote ?? null,
    })
    .eq("organization_id", orgId)
    .eq("id", findingId)
    .neq("status", "resolved")
    .neq("status", "dismissed")
    .select("id,organization_id,created_at,updated_at")
    .maybeSingle();
  const result = {
    data: (data ?? null) as Record<string, unknown> | null,
    error: error ?? (data ? null : FINDING_NOT_ACTIVE_ERROR),
  };

  if (result.data?.id) {
    await createFindingEvent(admin, orgId, String(result.data.id), "finding.dismissed", userId, {
      note: resolutionNote ?? null,
      signal_feedback: signalFeedback ?? null,
    });
  }

  return result;
}

export async function runChecks(admin: AdminClient, orgId: string, userId: string) {
  return runAssuranceChecks(admin, orgId, userId);
}

export function listScorecards(admin: AdminClient, orgId: string) {
  return listRows(
    admin,
    "assurance_scorecards",
    orgId,
    "id, scorecard_type, entity_ref_id, overall_score, dimensions_json, score_drivers_json, updated_at"
  );
}

export function recomputeScorecardsForOrg(admin: AdminClient, orgId: string) {
  return recomputeScorecards(admin, orgId);
}

export function listHealthGraph(admin: AdminClient, orgId: string) {
  return Promise.all([
    listRows(
      admin,
      "portfolio_health_graph_nodes",
      orgId,
      "id, node_type, node_ref_id, label, risk_score, concentration_score"
    ),
    listRows(admin, "portfolio_health_graph_edges", orgId, "id, source_node_id, target_node_id, relationship_type, propagation_risk"),
  ]).then(([nodes, edges]) => ({ nodes: nodes.data ?? [], edges: edges.data ?? [], error: nodes.error ?? edges.error }));
}

export function createDefaultFinding(admin: AdminClient, orgId: string, userId: string) {
  return createRow(admin, "assurance_findings", orgId, {
    finding_type: "watch_signal",
    title: "Assurance watch signal",
    severity: "low",
    confidence: 60,
    status: "open",
    analyst_note: "Auto-created from assurance checks",
    created_by: userId,
  });
}
