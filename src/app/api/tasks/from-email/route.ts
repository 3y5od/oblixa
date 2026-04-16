import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { inboundOrgNotAllowedResponse } from "@/lib/security/inbound-org-allowlist";
import { RATE_LIMITS, getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { isInboundAutomationAuthorized } from "@/lib/security/inbound-automation-token";
import { isIsoDateOnly, isUuid } from "@/lib/security/validation";

type EmailTaskPayload = {
  organizationId: string;
  contractId: string;
  intakeType?: "task" | "exception" | "evidence_submission";
  evidenceRequirementId?: string;
  externalMessageId?: string;
  subject: string;
  body?: string;
  from?: string;
  dueDate?: string;
};

const EXTERNAL_MESSAGE_ID_RE = /^[a-zA-Z0-9._:@\-]{1,200}$/;

function isAuthorized(request: Request): boolean {
  return isInboundAutomationAuthorized(request, "email");
}

export async function POST(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`tasks-email:${ip}`, RATE_LIMITS.tasksFromEmailInbound);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))),
        },
      }
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | EmailTaskPayload
    | null;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!payload.organizationId || !payload.contractId || !payload.subject?.trim()) {
    return NextResponse.json(
      { error: "organizationId, contractId, and subject are required." },
      { status: 400 }
    );
  }
  if (!isUuid(payload.organizationId) || !isUuid(payload.contractId)) {
    return NextResponse.json(
      { error: "organizationId and contractId must be valid UUIDs" },
      { status: 400 }
    );
  }
  const orgRate = await rateLimitCheck(
    `tasks-email:org:${payload.organizationId}`,
    RATE_LIMITS.tasksFromEmailInbound
  );
  if (!orgRate.ok) {
    return NextResponse.json(
      { error: "Too many requests for this organization" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(orgRate.retryAfterMs / 1000))),
        },
      }
    );
  }
  const orgBlocked = inboundOrgNotAllowedResponse(payload.organizationId);
  if (orgBlocked) return orgBlocked;
  if (payload.subject.trim().length > 240) {
    return NextResponse.json({ error: "subject must be 240 characters or fewer" }, { status: 400 });
  }
  if (payload.body && payload.body.length > 10_000) {
    return NextResponse.json({ error: "body must be 10000 characters or fewer" }, { status: 400 });
  }
  if (payload.from && payload.from.length > 320) {
    return NextResponse.json({ error: "from must be 320 characters or fewer" }, { status: 400 });
  }
  if (payload.dueDate && !isIsoDateOnly(payload.dueDate)) {
    return NextResponse.json({ error: "dueDate must be ISO date (YYYY-MM-DD)" }, { status: 400 });
  }
  if (payload.externalMessageId && !EXTERNAL_MESSAGE_ID_RE.test(payload.externalMessageId.trim())) {
    return NextResponse.json(
      { error: "externalMessageId contains invalid characters or is too long" },
      { status: 400 }
    );
  }

  const headerIntake = request.headers.get("x-oblixa-intake")?.trim().toLowerCase();
  let intakeType: EmailTaskPayload["intakeType"] = payload.intakeType ?? "task";
  if (headerIntake === "exception") intakeType = "exception";
  if (headerIntake === "evidence" || headerIntake === "evidence_submission") {
    intakeType = "evidence_submission";
  }
  if (headerIntake === "task") intakeType = "task";
  const title =
    intakeType === "exception"
      ? `Email exception: ${payload.subject.trim()}`
      : `Email follow-up: ${payload.subject.trim()}`;
  const details = [
    payload.body?.trim(),
    payload.from ? `From: ${payload.from}` : null,
    payload.externalMessageId?.trim() ? `external_message_id:${payload.externalMessageId.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const admin = await createAdminClient();
  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", payload.contractId)
    .eq("organization_id", payload.organizationId)
    .maybeSingle();
  if (!contract) {
    return NextResponse.json({ error: "Contract not found in organization" }, { status: 400 });
  }
  if (payload.externalMessageId?.trim()) {
    const existing = await admin
      .from("contract_tasks")
      .select("id")
      .eq("contract_id", payload.contractId)
      .eq("created_via", "integration")
      .eq("team_key", "email")
      .ilike("details", `%external_message_id:${payload.externalMessageId.trim().replace(/[_%]/g, "\\$&")}%`)
      .limit(1)
      .maybeSingle();
    if (existing.data) {
      return NextResponse.json({ success: true, deduped: true, taskId: existing.data.id });
    }
  }
  if (intakeType === "exception") {
    const { data: exception, error } = await admin
      .from("exceptions")
      .insert({
        organization_id: payload.organizationId,
        contract_id: payload.contractId,
        title,
        details: details || null,
        exception_type: "inbound_email",
        severity: "medium",
        status: "open",
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, exceptionId: exception.id });
  }

  if (intakeType === "evidence_submission") {
    const requirementId = String(payload.evidenceRequirementId ?? "").trim();
    if (!requirementId) {
      return NextResponse.json({ error: "evidenceRequirementId is required for evidence_submission" }, { status: 400 });
    }
    const { data: submission, error } = await admin
      .from("evidence_submissions")
      .insert({
        organization_id: payload.organizationId,
        requirement_id: requirementId,
        submitted_by: null,
        status: "submitted",
        payload_json: {
          source: "email",
          subject: payload.subject.trim(),
          body: payload.body?.trim() || null,
          from: payload.from?.trim() || null,
          external_message_id: payload.externalMessageId?.trim() || null,
        },
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await admin
      .from("evidence_requirements")
      .update({ status: "submitted" })
      .eq("organization_id", payload.organizationId)
      .eq("id", requirementId);
    return NextResponse.json({ success: true, submissionId: submission.id });
  }

  const { data: task, error } = await admin
    .from("contract_tasks")
    .insert({
      organization_id: payload.organizationId,
      contract_id: payload.contractId,
      title,
      details: details || null,
      due_date: payload.dueDate?.trim() || null,
      priority: "medium",
      status: "open",
      created_via: "integration",
      team_key: "email",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from("contract_task_events").insert({
    organization_id: payload.organizationId,
    contract_id: payload.contractId,
    task_id: task.id,
    actor_id: null,
    event_type: "created",
    details: { created_via: "integration", source: "email", external_message_id: payload.externalMessageId ?? null },
  });
  return NextResponse.json({ success: true, taskId: task.id });
}
