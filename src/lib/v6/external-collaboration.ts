import type { AdminClient } from "@/lib/v6/service";
import { createRow } from "@/lib/v6/service";
import { nowIso } from "@/lib/v5/api";
import { redactForPersistence } from "@/lib/security/persistence-redaction";

/**
 * When an external link is past expiry and still open, record a single assurance finding (Workflow 3 escalation).
 */
export async function recordMissedExternalDeadlineFinding(
  admin: AdminClient,
  orgId: string,
  linkId: string,
  actionType: string
) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await admin
    .from("assurance_findings")
    .select("id, summary")
    .eq("organization_id", orgId)
    .eq("finding_type", "external_response_miss")
    .in("status", ["open", "in_review"])
    .gte("created_at", since)
    .limit(20);
  if ((recent ?? []).some((r) => String((r as { summary?: string }).summary ?? "").includes(linkId))) {
    return { created: false };
  }

  const f = await createRow(admin, "assurance_findings", orgId, {
    finding_type: "external_response_miss",
    title: "External action deadline passed",
    summary: `Link ${linkId} expired before completion (${actionType}).`,
    severity: "medium",
    confidence: 80,
    scope_json: { external_link_id: linkId, action_type: actionType },
    linked_controls_json: [],
    linked_entities_json: [{ type: "external_action_link", id: linkId }],
    status: "open",
  });
  return { created: Boolean(f.data?.id), finding: f.data };
}

export async function appendExternalWorkflowStep(
  admin: AdminClient,
  orgId: string,
  linkId: string,
  stepType: string,
  payload: Record<string, unknown>,
  actorUserId?: string
) {
  const { data: link, error: linkError } = await admin
    .from("external_action_links")
    .select("id, scope_json, expires_at, status")
    .eq("organization_id", orgId)
    .eq("id", linkId)
    .maybeSingle();
  if (linkError) {
    return { data: null, error: { message: "external_action_link_load_failed" } };
  }
  if (!link) {
    return { data: null, error: { message: "external_action_not_found" } };
  }

  const scope = (link?.scope_json as Record<string, unknown> | null) ?? {};
  const chain = Array.isArray(scope.workflow_chain) ? scope.workflow_chain : [];

  const workflowDeadline = scope.workflow_deadline_iso;
  if (workflowDeadline && Date.parse(String(workflowDeadline)) < Date.now()) {
    return { data: null, error: { message: "workflow_deadline_passed" } };
  }

  const nextScope = {
    ...scope,
    workflow_version: 2,
    workflow_chain: [
      ...chain,
      {
        type: stepType,
        payload: redactForPersistence(payload),
        at: nowIso(),
      },
    ],
    current_step_index: chain.length,
    last_step_at: nowIso(),
  };

  const result = await admin
    .from("external_action_links")
    .update({ scope_json: nextScope })
    .eq("organization_id", orgId)
    .eq("id", linkId)
    .select("id, status, scope_json")
    .single();

  if (!result.error) {
    const { error: eventError } = await admin.from("external_action_events").insert({
      organization_id: orgId,
      external_action_link_id: linkId,
      event_type: `external.workflow.${stepType}`,
      payload_json: redactForPersistence(payload),
      actor_user_id: actorUserId ?? null,
    });
    if (eventError) {
      return { data: result.data, error: { message: "external_action_event_insert_failed" } };
    }
  }

  return result;
}

/**
 * Sets acknowledgement deadline for multi-step external workflows (v6.md §9.9).
 */
export async function setExternalWorkflowAckDeadline(
  admin: AdminClient,
  orgId: string,
  linkId: string,
  deadlineIso: string
) {
  const { data: link, error: linkError } = await admin
    .from("external_action_links")
    .select("scope_json")
    .eq("organization_id", orgId)
    .eq("id", linkId)
    .maybeSingle();
  if (linkError) {
    return { data: null, error: { message: "external_action_link_load_failed" } };
  }
  if (!link) {
    return { data: null, error: { message: "external_action_not_found" } };
  }

  const scope = (link?.scope_json as Record<string, unknown> | null) ?? {};
  const nextScope = {
    ...scope,
    workflow_deadline_iso: deadlineIso,
    workflow_ack_required: true,
  };

  return admin
    .from("external_action_links")
    .update({ scope_json: nextScope })
    .eq("organization_id", orgId)
    .eq("id", linkId)
    .select("id, scope_json")
    .maybeSingle();
}

/** Attach counterparty response pack metadata for external collaboration v2. */
export async function mergeExternalResponsePack(
  admin: AdminClient,
  orgId: string,
  linkId: string,
  pack: Record<string, unknown>
) {
  const { data: link, error: linkError } = await admin
    .from("external_action_links")
    .select("scope_json")
    .eq("organization_id", orgId)
    .eq("id", linkId)
    .maybeSingle();
  if (linkError) {
    return { data: null, error: { message: "external_action_link_load_failed" } };
  }
  if (!link) {
    return { data: null, error: { message: "external_action_not_found" } };
  }

  const scope = (link?.scope_json as Record<string, unknown> | null) ?? {};
  const nextScope = {
    ...scope,
    response_pack: redactForPersistence({
      ...(typeof scope.response_pack === "object" ? (scope.response_pack as object) : {}),
      ...pack,
    }),
    workflow_version: 2,
  };

  return admin
    .from("external_action_links")
    .update({ scope_json: nextScope })
    .eq("organization_id", orgId)
    .eq("id", linkId)
    .select("id, scope_json")
    .maybeSingle();
}
