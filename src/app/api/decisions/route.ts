import { NextResponse } from "next/server";
import { jsonForbidden, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { parseIsoTimestampParam } from "@/lib/security/validation";
import { canManageCapability, getApiAuthContext } from "@/lib/contract-operations/api-auth";
import { readJsonBody, toSafeString } from "@/lib/decision-intelligence/api";
import {
  decisionTypeValidationError,
  isValidDecisionType,
  mergeRequiredInputs,
} from "@/lib/decision-intelligence/decision-types";
import { requireV5ApiFeature } from "@/lib/decision-intelligence/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";

const ROUTE = "/api/decisions";
const DECISION_DUE_AT_WINDOW_DAYS = 3660;

function parseDecisionDueAt(value: string | null | undefined): { ok: true; value: string | null } | { ok: false } {
  const raw = toSafeString(value);
  if (!raw) return { ok: true, value: null };
  const parsed = parseIsoTimestampParam(raw, {
    maxLookbackDays: DECISION_DUE_AT_WINDOW_DAYS,
    maxFutureSkewMinutes: DECISION_DUE_AT_WINDOW_DAYS * 24 * 60,
  });
  if (!parsed.ok) return { ok: false };
  return { ok: true, value: parsed.value ?? null };
}

export async function GET() {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
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
    return jsonProblem(400, {
      error: "Failed to process request",
      code: "decisions_list_failed",
      diagnostic_id: "decisions_list_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ decisions: data ?? [] });
}

export async function POST(request: Request) {
  const disabled = requireV5ApiFeature("v5DecisionFoundation");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  if (!(await canManageCapability(ctx, "renewals_manage"))) {
    return jsonForbidden(ROUTE);
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/decisions",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.decisions",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/decisions",
    method: "POST",
  }).catch(() => undefined);

  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
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
  if (!title) {
    return jsonProblem(400, {
      error: "title is required",
      code: "title_required",
      diagnostic_id: "decision_title_required",
      route: ROUTE,
    });
  }
  const rawType = toSafeString(body.decisionType) || "renewal";
  if (!isValidDecisionType(rawType)) {
    return jsonProblem(400, {
      error: decisionTypeValidationError(),
      code: "invalid_decision_type",
      diagnostic_id: "decision_type_invalid",
      route: ROUTE,
    });
  }
  const decisionType = rawType;
  const requiredInputs = mergeRequiredInputs({}, body.requiredInputs);
  const dueAt = parseDecisionDueAt(body.dueAt);
  if (!dueAt.ok) {
    return jsonProblem(400, {
      error: "dueAt must be a bounded UTC ISO timestamp",
      code: "invalid_due_at",
      diagnostic_id: "decision_due_at_invalid",
      route: ROUTE,
    });
  }

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
      due_at: dueAt.value,
      required_inputs_json: requiredInputs,
      created_by: ctx.userId,
    })
    .select("id, title, decision_type, status, due_at, required_inputs_json")
    .single();
  if (error) {
    console.error("[api/decisions] POST error:", error.message);
    return jsonProblem(400, {
      error: "Failed to process request",
      code: "decision_create_failed",
      diagnostic_id: "decision_create_failed",
      route: ROUTE,
    });
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
