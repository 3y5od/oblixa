import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import {
  decisionTypeValidationError,
  isValidDecisionType,
  mergeRequiredInputs,
} from "@/lib/v5/decision-types";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/decisions/[id]",
  });
  if (modeGate) return modeGate;

  const { data, error } = await ctx.admin
    .from("decision_workspaces")
    .select(
      "id, title, decision_type, status, linked_contract_ids, linked_account_key, linked_counterparty_key, owner_user_id, due_at, required_inputs_json, approval_path_json, recommendation_json, rationale_markdown, final_disposition_json, post_decision_actions_json, metadata_json, updated_at"
    )
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[api/decisions/[id]] GET error:", error.message);
    return NextResponse.json({ error: "Failed to process request" }, { status: 400 });
  }
  if (!data) return NextResponse.json({ error: "Decision not found" }, { status: 404 });

  const [
    { data: stakeholders },
    { data: events },
    { data: recommendations },
    { data: packetRuns },
  ] = await Promise.all([
    ctx.admin
      .from("decision_workspace_stakeholders")
      .select("id, stakeholder_user_id, stakeholder_role, status, notes, responded_at")
      .eq("organization_id", ctx.orgId)
      .eq("decision_workspace_id", id)
      .order("created_at", { ascending: true }),
    ctx.admin
      .from("decision_workspace_events")
      .select("id, event_type, payload_json, actor_user_id, created_at")
      .eq("organization_id", ctx.orgId)
      .eq("decision_workspace_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    ctx.admin
      .from("decision_recommendations")
      .select(
        "id, recommendation_type, recommendation_text, confidence, reasons_json, source_object_refs_json, accepted, created_at"
      )
      .eq("organization_id", ctx.orgId)
      .eq("decision_workspace_id", id)
      .order("created_at", { ascending: false }),
    ctx.admin
      .from("decision_packet_runs")
      .select("id, packet_type, exported_at, created_at")
      .eq("organization_id", ctx.orgId)
      .eq("decision_workspace_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({
    decision: data,
    stakeholders: stakeholders ?? [],
    events: events ?? [],
    recommendations: recommendations ?? [],
    packetRuns: packetRuns ?? [],
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/decisions/[id]",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "renewals_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
  const body = readJsonBody<{
    title?: string;
    decisionType?: string;
    dueAt?: string | null;
    ownerUserId?: string | null;
    rationaleMarkdown?: string | null;
    requiredInputs?: Record<string, unknown>;
    mergeRequiredInputs?: boolean;
    approvalPath?: unknown[];
    status?: string;
  }>(raw, {});

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const t = toSafeString(body.title);
    if (!t) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    patch.title = t;
  }
  if (body.decisionType !== undefined) {
    const dt = toSafeString(body.decisionType);
    if (!dt || !isValidDecisionType(dt)) {
      return NextResponse.json({ error: decisionTypeValidationError() }, { status: 400 });
    }
    patch.decision_type = dt;
  }
  if (body.dueAt !== undefined) {
    patch.due_at = body.dueAt === null || body.dueAt === "" ? null : toSafeString(body.dueAt);
  }
  if (body.ownerUserId !== undefined) {
    patch.owner_user_id = body.ownerUserId === null || body.ownerUserId === "" ? null : body.ownerUserId;
  }
  if (body.rationaleMarkdown !== undefined) {
    patch.rationale_markdown =
      body.rationaleMarkdown === null ? null : toSafeString(body.rationaleMarkdown);
  }
  if (body.requiredInputs !== undefined) {
    if (body.mergeRequiredInputs) {
      const { data: prior } = await ctx.admin
        .from("decision_workspaces")
        .select("required_inputs_json")
        .eq("organization_id", ctx.orgId)
        .eq("id", id)
        .maybeSingle();
      patch.required_inputs_json = mergeRequiredInputs(prior?.required_inputs_json, body.requiredInputs);
    } else {
      patch.required_inputs_json =
        body.requiredInputs && typeof body.requiredInputs === "object" ? body.requiredInputs : {};
    }
  }
  if (body.approvalPath !== undefined) {
    patch.approval_path_json = Array.isArray(body.approvalPath) ? body.approvalPath : [];
  }
  if (body.status !== undefined) {
    const s = toSafeString(body.status);
    if (s && ["draft", "open", "in_review"].includes(s)) {
      patch.status = s;
    } else if (s) {
      return NextResponse.json(
        { error: "status may only be set to draft, open, or in_review via PATCH" },
        { status: 400 }
      );
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await ctx.admin
    .from("decision_workspaces")
    .update(patch)
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .select(
      "id, title, decision_type, status, owner_user_id, due_at, required_inputs_json, approval_path_json, rationale_markdown, updated_at"
    )
    .maybeSingle();
  if (error) {
    console.error("[api/decisions/[id]] PATCH error:", error.message);
    return NextResponse.json({ error: "Failed to process request" }, { status: 400 });
  }
  if (!data) return NextResponse.json({ error: "Decision not found" }, { status: 404 });

  await ctx.admin.from("decision_workspace_events").insert({
    organization_id: ctx.orgId,
    decision_workspace_id: id,
    event_type: "decision.updated",
    payload_json: { fields: Object.keys(patch) },
    actor_user_id: ctx.userId,
  });

  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }

  return NextResponse.json({ decision: data });
}

