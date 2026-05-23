/**
 * Inbound automation: call from a Slack slash command or workflow step (HTTP) with Bearer
 * INBOUND_AUTOMATION_TOKEN. Body: organizationId, contractId, title, optional details, assigneeId, dueDate.
 */
import { jsonOk, jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited, readTextBodyLimited } from "@/lib/security/read-json-body-limited";
import { createAdminClient } from "@/lib/supabase/server";
import { inboundOrgNotAllowedResponse } from "@/lib/security/inbound-org-allowlist";
import { RATE_LIMITS, getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { isInboundAutomationAuthorized } from "@/lib/security/inbound-automation-token";
import { isIsoDateOnly, isUuid } from "@/lib/security/validation";
import { verifySlackSigningSecret } from "@/lib/security/slack-signing";
import { isKillInboundAutomation, killSwitchJsonResponse } from "@/lib/security/kill-switches";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";

type SlackTaskPayload = {
  organizationId: string;
  contractId: string;
  externalMessageId?: string;
  title: string;
  details?: string;
  assigneeId?: string;
  dueDate?: string;
  priority?: "low" | "medium" | "high";
  teamKey?: string;
};

const EXTERNAL_MESSAGE_ID_RE = /^[a-zA-Z0-9._:@\-]{1,200}$/;
const TEAM_KEY_RE = /^[a-z0-9_-]{1,50}$/;
const ROUTE = "/api/tasks/from-slack";
const SLACK_INBOUND_BODY_MAX = 262_144;

function validationError(error: string, diagnosticId: string, status = 400) {
  return jsonProblem(status, {
    error,
    code: "validation_failed",
    diagnostic_id: diagnosticId,
    route: ROUTE,
  });
}

function persistenceError(error: string, diagnosticId: string) {
  return jsonProblem(400, {
    error,
    code: "persistence_failed",
    diagnostic_id: diagnosticId,
    route: ROUTE,
  });
}

function isAuthorized(request: Request): boolean {
  return isInboundAutomationAuthorized(request, "slack");
}

export async function POST(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`tasks-slack:${ip}`, RATE_LIMITS.tasksFromSlackInbound);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }
  if (!isAuthorized(request)) {
    return jsonUnauthorized(ROUTE);
  }
  if (isKillInboundAutomation()) {
    return killSwitchJsonResponse("inbound_automation");
  }

  const slackSecret = process.env.SLACK_SIGNING_SECRET?.trim();
  let body: SlackTaskPayload | null = null;
  if (slackSecret) {
    const _lb_raw = await readTextBodyLimited(request, SLACK_INBOUND_BODY_MAX);
    if (!_lb_raw.ok) return validationError("Body too large", "slack_inbound_body_too_large", 413);
    const raw = _lb_raw.body;
    const sig = verifySlackSigningSecret({
      signingSecret: slackSecret,
      rawBody: raw,
      slackSignatureHeader: request.headers.get("X-Slack-Signature"),
      slackTimestampHeader: request.headers.get("X-Slack-Request-Timestamp"),
    });
    if (!sig.ok) {
      return jsonProblem(401, {
        error: "Invalid Slack signature",
        code: "invalid_signature",
        diagnostic_id: "slack_inbound_signature_invalid",
        route: ROUTE,
      });
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      body = parsed && typeof parsed === "object" ? (parsed as SlackTaskPayload) : null;
    } catch {
      return validationError("Invalid JSON body", "slack_inbound_invalid_json_body");
    }
  } else {
    const _lb_body = await readJsonBodyLimited(request);
    if (!_lb_body.ok) return _lb_body.response;
    body = (_lb_body.body ?? null) as SlackTaskPayload | null;
  }
  if (!body || typeof body !== "object") {
    return validationError("Invalid JSON body", "slack_inbound_invalid_json_body");
  }
  if (!body.organizationId || !body.contractId || !body.title?.trim()) {
    return validationError(
      "organizationId, contractId, and title are required.",
      "slack_inbound_required_fields_missing"
    );
  }
  if (!isUuid(body.organizationId) || !isUuid(body.contractId)) {
    return validationError(
      "organizationId and contractId must be valid UUIDs",
      "slack_inbound_ids_invalid"
    );
  }
  const orgRate = await rateLimitCheck(
    `tasks-slack:org:${body.organizationId}`,
    RATE_LIMITS.tasksFromSlackInbound
  );
  if (!orgRate.ok) {
    return jsonRateLimited(orgRate.retryAfterMs, ROUTE);
  }
  const orgBlocked = inboundOrgNotAllowedResponse(body.organizationId);
  if (orgBlocked) return orgBlocked;
  if (body.assigneeId && !isUuid(body.assigneeId)) {
    return validationError("assigneeId must be a valid UUID", "slack_inbound_assignee_id_invalid");
  }
  if (body.dueDate && !isIsoDateOnly(body.dueDate)) {
    return validationError("dueDate must be ISO date (YYYY-MM-DD)", "slack_inbound_due_date_invalid");
  }
  if (body.title.trim().length > 240) {
    return validationError("title must be 240 characters or fewer", "slack_inbound_title_too_long");
  }
  if (body.details && body.details.length > 10_000) {
    return validationError("details must be 10000 characters or fewer", "slack_inbound_details_too_long");
  }
  if (body.externalMessageId && !EXTERNAL_MESSAGE_ID_RE.test(body.externalMessageId.trim())) {
    return validationError(
      "externalMessageId contains invalid characters or is too long",
      "slack_inbound_external_message_id_invalid"
    );
  }
  if (body.teamKey && !TEAM_KEY_RE.test(body.teamKey.trim())) {
    return validationError("teamKey contains invalid characters or is too long", "slack_inbound_team_key_invalid");
  }
  if (body.priority && !["low", "medium", "high"].includes(body.priority)) {
    return validationError("priority must be one of low, medium, high", "slack_inbound_priority_invalid");
  }

  const admin = await createAdminClient();
  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", body.contractId)
    .eq("organization_id", body.organizationId)
    .maybeSingle();
  if (!contract) {
    return validationError("Contract not found in organization", "slack_inbound_contract_not_found");
  }
  void recordApiMutationAuditEvent(admin, {
    organizationId: body.organizationId,
    actorUserId: null,
    actorType: "system",
    route: "/api/tasks/from-slack",
    method: "POST",
  }).catch(() => undefined);
  if (body.assigneeId) {
    const { data: assigneeMember } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", body.organizationId)
      .eq("user_id", body.assigneeId)
      .maybeSingle();
    if (!assigneeMember) {
      return validationError("assigneeId must belong to the organization", "slack_inbound_assignee_not_member");
    }
  }
  if (body.externalMessageId?.trim()) {
    const replayRate = await rateLimitCheck(
      `tasks-slack:event:${body.organizationId}:${body.externalMessageId.trim()}`,
      RATE_LIMITS.tasksFromSlackInbound
    );
    if (!replayRate.ok) {
      return jsonRateLimited(replayRate.retryAfterMs, ROUTE);
    }
    const existing = await admin
      .from("contract_tasks")
      .select("id")
      .eq("contract_id", body.contractId)
      .eq("created_via", "integration")
      .eq("team_key", "slack")
      .ilike("details", `%external_message_id:${body.externalMessageId.trim().replace(/[_%]/g, "\\$&")}%`)
      .limit(1)
      .maybeSingle();
    if (existing.data) {
      return jsonOk({ success: true, deduped: true, taskId: existing.data.id });
    }
  }
  const { data: task, error } = await admin
    .from("contract_tasks")
    .insert({
      organization_id: body.organizationId,
      contract_id: body.contractId,
      title: body.title.trim(),
      details:
        [body.details?.trim() || null, body.externalMessageId?.trim() ? `external_message_id:${body.externalMessageId.trim()}` : null]
          .filter(Boolean)
          .join("\n") || null,
      assignee_id: body.assigneeId || null,
      due_date: body.dueDate?.trim() || null,
      priority: body.priority ?? "medium",
      status: "open",
      created_via: "integration",
      team_key: body.teamKey?.trim() || "slack",
    })
    .select("id")
    .single();
  if (error) return persistenceError(error.message, "slack_inbound_task_create_failed");

  await admin.from("contract_task_events").insert({
    organization_id: body.organizationId,
    contract_id: body.contractId,
    task_id: task.id,
    actor_id: null,
    event_type: "created",
    details: { created_via: "integration", source: "slack", external_message_id: body.externalMessageId ?? null },
  });

  return jsonOk({ success: true, taskId: task.id });
}
