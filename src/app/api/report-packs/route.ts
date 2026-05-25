import { NextResponse } from "next/server";
import { jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { getApiAuthContext, canManageCapability } from "@/lib/contract-operations/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { parseWorkspaceMode } from "@/lib/product-surface/context";
import { workspaceModeAllowsReportType } from "@/lib/product-surface/feature-registry";
import { getOrgSettingsJson } from "@/lib/assurance/org-settings";
import { buildV10MutationResponse, buildV10MutationResponseInit } from "@/lib/mutation-envelope";
import {
  executeV10AuditedMutation,
  getV10ExpectedVersionFromRequest,
  getV10IdempotencyKeyFromRequest,
  recordV10AuditEvent,
} from "@/lib/server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/read-model-refresh";
import { recordApiRouteAuditEvent } from "@/lib/security/api-mutation-audit";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const ROUTE = "/api/report-packs";

function jsonV10(response: ReturnType<typeof buildV10MutationResponse>, replayed = false, successStatus = 200) {
  return NextResponse.json(response, {
    ...buildV10MutationResponseInit(response, { replayed, headers: PRIVATE_NO_STORE_HEADERS }),
    status: v10MutationStatus(response.outcome, successStatus),
  });
}

function v10MutationStatus(outcome: string, successStatus = 200): number {
  if (outcome === "success") return successStatus;
  if (outcome === "conflict") return 409;
  if (outcome === "validation_failed") return 400;
  if (outcome === "forbidden") return 403;
  if (outcome === "unauthorized") return 401;
  if (outcome === "not_found") return 404;
  if (outcome === "mode_required" || outcome === "plan_required") return 403;
  if (outcome === "hidden_module") return 404;
  return 500;
}

export async function GET() {
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/report-packs",
  });
  if (modeGate) return modeGate;

  void recordApiRouteAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: ROUTE,
    method: "GET",
    action: "api.sensitive_read_authorized",
  }).catch(() => undefined);

  const v6 = await getOrgSettingsJson(ctx.admin, ctx.orgId);
  const mode = parseWorkspaceMode(v6);

  const { data, error } = await ctx.admin
    .from("report_packs")
    .select("id, name, description, report_type, schedule, active, updated_at")
    .eq("organization_id", ctx.orgId)
    .order("updated_at", { ascending: false });
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "report_packs_list_failed",
      diagnostic_id: "report_packs_list_failed",
      route: ROUTE,
    });
  }
  const rows = (data ?? []).filter((row) =>
    workspaceModeAllowsReportType(mode, String((row as { report_type?: string }).report_type ?? ""))
  );
  return NextResponse.json({ reportPacks: rows }, { headers: PRIVATE_NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "unauthorized",
        message: "Not authenticated.",
        diagnosticId: "v10_report_pack_create_unauthorized",
        nextDestinationHref: "/login",
      })
    );
  }
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "forbidden",
        message: "Access denied.",
        diagnosticId: "v10_report_pack_create_forbidden",
        nextDestinationHref: "/reports",
      })
    );
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/report-packs",
    v10MutationResponse: true,
  });
  if (modeGate) return modeGate;

  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? {}) as {
    name?: string;
    description?: string;
    reportType?: string;
    schedule?: string;
    config?: Record<string, unknown>;
    delivery?: Record<string, unknown>;
  };
  const name = String(body.name ?? "").trim();
  if (!name) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "validation_failed",
        message: "name is required.",
        diagnosticId: "v10_report_pack_name_required",
        validationFailures: [
          {
            field: "name",
            code: "required",
            user_visible_message: "Name the report before creating it.",
            self_fixable: true,
          },
        ],
      })
    );
  }

  const reportType = body.reportType?.trim() || "weekly_execution_health";
  const v6 = await getOrgSettingsJson(ctx.admin, ctx.orgId);
  const mode = parseWorkspaceMode(v6);
  if (!workspaceModeAllowsReportType(mode, reportType)) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "mode_required",
        message: "Feature not available in workspace mode.",
        diagnosticId: "v10_report_pack_workspace_mode_required",
        nextDestinationHref: "/settings/product",
      })
    );
  }

  const idempotencyKey = getV10IdempotencyKeyFromRequest(request);
  const mutation = await executeV10AuditedMutation(
    ctx.admin,
    {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      mutationName: "report_pack.create",
      targetType: "report_run",
      targetId: `pending:${idempotencyKey ?? "missing"}`,
      idempotencyKey,
      expectedVersion: getV10ExpectedVersionFromRequest(request),
      currentVersion: ctx.orgId,
      payload: { name, reportType, schedule: body.schedule ?? null, config: body.config ?? {}, delivery: body.delivery ?? {} },
      auditAction: "report_run.created",
    },
    async () => {
      const { data, error } = await ctx.admin
        .from("report_packs")
        .insert({
          organization_id: ctx.orgId,
          name,
          description: body.description?.trim() || null,
          report_type: reportType,
          schedule: body.schedule?.trim() || null,
          config_json: body.config ?? {},
          delivery_json: body.delivery ?? {},
          created_by: ctx.userId,
          active: true,
        })
        .select("id, name, report_type, schedule, active")
        .single();
      if (error) {
        return {
          response: buildV10MutationResponse({
            outcome: "validation_failed",
            message: error.message,
            diagnosticId: "v10_report_pack_create_failed",
            validationFailures: [
              {
                field: "report_pack",
                code: "insert_failed",
                user_visible_message: "Report pack could not be created.",
                self_fixable: false,
              },
            ],
          }) as ReturnType<typeof buildV10MutationResponse> & { reportPack?: unknown },
          auditEventId: null,
        };
      }
      const auditEventId = await recordV10AuditEvent(ctx.admin, {
        organizationId: ctx.orgId,
        actorUserId: ctx.userId,
        action: "report_run.created",
        targetType: "report_run",
        targetId: data.id,
        outcome: "success",
        safeMetadata: {
          report_type: reportType,
          schedule_state: body.schedule?.trim() ? "provided" : "not_provided",
        },
      });
      if (!auditEventId) {
        return {
          response: {
            ...buildV10MutationResponse({
              outcome: "success",
              message: "Report pack created.",
              changedObjectType: "report_run",
              changedObjectId: data.id,
              nextDestinationHref: "/reports",
            }),
            reportPack: data,
          },
          auditEventId: null,
          rollback: async () => {
            await ctx.admin.from("report_packs").delete().eq("id", data.id).eq("organization_id", ctx.orgId);
            await refreshV10ReadModelsForOrganization(ctx.admin, ctx.orgId, {
              refreshScope: "one_model",
              reason: "report_run_mutation_rollback",
              modelKeys: ["work_items", "report_run_visibility", "contract_activity_events", "audit_events", "command_search_index"],
            });
          },
        };
      }
      await refreshV10ReadModelsForOrganization(ctx.admin, ctx.orgId, {
        refreshScope: "one_model",
        reason: "report_run_mutation",
        modelKeys: ["work_items", "report_run_visibility", "contract_activity_events", "audit_events", "command_search_index"],
      });
      return {
        response: {
          ...buildV10MutationResponse({
            outcome: "success",
            message: "Report pack created.",
            changedObjectType: "report_run",
            changedObjectId: data.id,
            nextDestinationHref: "/reports",
            auditEventId,
          }),
          reportPack: data,
        },
        auditEventId,
      };
    }
  );

  return jsonV10(mutation.response, mutation.replayed, mutation.replayed ? 200 : 201);
}
