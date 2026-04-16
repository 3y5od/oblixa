import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import {
  decisionTypeValidationError,
  isValidDecisionType,
  mergeRequiredInputs,
} from "@/lib/v5/decision-types";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

export async function GET() {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/decisions",
  });
  if (modeGate) return modeGate;

  const { data, error } = await ctx.admin
    .from("decision_workspaces")
    .select(
      "id, decision_type, status, title, linked_contract_ids, linked_account_key, linked_counterparty_key, owner_user_id, due_at, updated_at"
    )
    .eq("organization_id", ctx.orgId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[api/decisions] GET error:", error.message);
    return NextResponse.json({ error: "Failed to process request" }, { status: 400 });
  }
  return NextResponse.json({ decisions: data ?? [] });
}

export async function POST(request: Request) {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/decisions",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "renewals_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const raw = await request.json().catch(() => ({}));
  const body = readJsonBody<{
    title?: string;
    decisionType?: string;
    linkedContractIds?: string[];
    linkedAccountKey?: string;
    linkedCounterpartyKey?: string;
    dueAt?: string;
    requiredInputs?: Record<string, unknown>;
  }>(raw, {});

  const title = toSafeString(body.title);
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  const rawType = toSafeString(body.decisionType) || "renewal";
  if (!isValidDecisionType(rawType)) {
    return NextResponse.json({ error: decisionTypeValidationError() }, { status: 400 });
  }
  const decisionType = rawType;
  const requiredInputs = mergeRequiredInputs({}, body.requiredInputs);

  const { data, error } = await ctx.admin
    .from("decision_workspaces")
    .insert({
      organization_id: ctx.orgId,
      title,
      decision_type: decisionType,
      status: "open",
      linked_contract_ids: Array.isArray(body.linkedContractIds) ? body.linkedContractIds : [],
      linked_account_key: toSafeString(body.linkedAccountKey) || null,
      linked_counterparty_key: toSafeString(body.linkedCounterpartyKey) || null,
      owner_user_id: ctx.userId,
      due_at: toSafeString(body.dueAt) || null,
      required_inputs_json: requiredInputs,
      created_by: ctx.userId,
    })
    .select("id, title, decision_type, status, due_at, required_inputs_json")
    .single();
  if (error) {
    console.error("[api/decisions] POST error:", error.message);
    return NextResponse.json({ error: "Failed to process request" }, { status: 400 });
  }

  await ctx.admin.from("decision_workspace_events").insert({
    organization_id: ctx.orgId,
    decision_workspace_id: data.id,
    event_type: "decision.created",
    payload_json: { decision_type: data.decision_type },
    actor_user_id: ctx.userId,
  });

  return NextResponse.json({ decision: data }, { status: 201 });
}

