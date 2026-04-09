import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { inboundOrgNotAllowedResponse } from "@/lib/security/inbound-org-allowlist";
import { isInboundAutomationAuthorized } from "@/lib/security/inbound-automation-token";
import { RATE_LIMITS, getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rate = await rateLimitCheck(
    `inbound:integrations-actions:${ip}`,
    RATE_LIMITS.integrationsActionsInbound
  );
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests", retryAfterMs: rate.retryAfterMs }, { status: 429 });
  }

  if (!isInboundAutomationAuthorized(request, "integrations_callback")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    organizationId?: string;
    action?:
      | "create_task"
      | "create_exception"
      | "ack_complete"
      | "approve_evidence"
      | "reject_evidence"
      | "delegate_approval"
      | "resolve_exception";
    title?: string;
    details?: string;
    contractId?: string;
    id?: string;
    delegateUserId?: string;
    reason?: string;
  };
  const organizationId = String(body.organizationId ?? "").trim();
  if (!organizationId) return NextResponse.json({ error: "organizationId is required" }, { status: 400 });

  const blocked = inboundOrgNotAllowedResponse(organizationId);
  if (blocked) return blocked;

  const admin = await createAdminClient();
  if (body.action === "create_task") {
    const { data, error } = await admin
      .from("contract_tasks")
      .insert({
        organization_id: organizationId,
        contract_id: body.contractId ?? null,
        created_by: null,
        assignee_id: null,
        title: body.title?.trim() || "Inbound action task",
        details: body.details?.trim() || null,
        status: "open",
        priority: "medium",
        created_via: "integration",
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, taskId: data.id });
  }

  if (body.action === "create_exception") {
    const { data, error } = await admin
      .from("exceptions")
      .insert({
        organization_id: organizationId,
        contract_id: body.contractId ?? null,
        title: body.title?.trim() || "Inbound action exception",
        details: body.details?.trim() || null,
        exception_type: "inbound_action",
        severity: "medium",
        status: "open",
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, exceptionId: data.id });
  }

  if (body.action === "ack_complete") {
    if (!body.contractId) return NextResponse.json({ error: "contractId is required" }, { status: 400 });
    await admin.from("operational_casefile_events").insert({
      organization_id: organizationId,
      contract_id: body.contractId,
      event_type: "integration.action_acknowledged",
      details_json: { title: body.title ?? null, details: body.details ?? null },
      source: "integration",
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "approve_evidence") {
    const submissionId = String(body.id ?? "").trim();
    if (!submissionId) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await admin
      .from("evidence_submissions")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", submissionId)
      .eq("organization_id", organizationId);
    return NextResponse.json({ ok: true, submissionId });
  }

  if (body.action === "reject_evidence") {
    const submissionId = String(body.id ?? "").trim();
    if (!submissionId) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await admin
      .from("evidence_submissions")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        rejection_reason: String(body.reason ?? "").trim() || "Rejected via integration callback",
      })
      .eq("id", submissionId)
      .eq("organization_id", organizationId);
    return NextResponse.json({ ok: true, submissionId });
  }

  if (body.action === "delegate_approval") {
    const approvalId = String(body.id ?? "").trim();
    const delegateUserId = String(body.delegateUserId ?? "").trim();
    if (!approvalId || !delegateUserId) {
      return NextResponse.json({ error: "id and delegateUserId are required" }, { status: 400 });
    }
    await admin
      .from("contract_approvals")
      .update({
        approver_id: delegateUserId,
        escalation_status: "none",
        escalation_at: null,
      })
      .eq("id", approvalId)
      .eq("organization_id", organizationId);
    return NextResponse.json({ ok: true, approvalId, delegateUserId });
  }

  if (body.action === "resolve_exception") {
    const exceptionId = String(body.id ?? "").trim();
    if (!exceptionId) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await admin
      .from("exceptions")
      .update({
        status: "resolved",
        resolution_note: String(body.reason ?? "").trim() || "Resolved via integration callback",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", exceptionId)
      .eq("organization_id", organizationId);
    return NextResponse.json({ ok: true, exceptionId });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
