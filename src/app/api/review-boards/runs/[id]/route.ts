import { NextResponse } from "next/server";
import { jsonNotFound, jsonProblem } from "@/lib/http/problem";
import { parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";
import { nowIso, readJsonBody, toSafeString } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { escapeCsvCellForSpreadsheet } from "@/lib/csv-formula-safe";
import {
  contentDispositionAttachment,
  sanitizeExportFileName,
  sanitizeExportFileNameToken,
} from "@/lib/security/export-filename";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";
import { parseFixedEnumParam } from "@/lib/security/validation";

const ROUTE = "/api/review-boards/runs/[id]";

function csvEscape(value: string): string {
  const safe = escapeCsvCellForSpreadsheet(value);
  const v = safe.replace(/"/g, '""');
  return `"${v}"`;
}

/** Full run export for board archives and integrations (review board packet + actions). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6ReviewBoards");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/review-boards/runs/[id]",
  });
  if (modeGate) return modeGate;

  const runId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: runId }, ["id"], "/api/review-boards/runs/[id]");

  if (routeParamRejection) return routeParamRejection;
  const format = parseFixedEnumParam(new URL(request.url).searchParams.get("format"), ["json", "csv"] as const, "json");

  const { data: run, error } = await ctx.admin
    .from("review_board_runs")
    .select(
      "id, review_board_id, status, agenda_json, packet_json, unresolved_findings_json, action_capture_json, decision_log_json, generated_at, reviewed_at, created_at"
    )
    .eq("organization_id", ctx.orgId)
    .eq("id", runId)
    .maybeSingle();

  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "review_board_run_lookup_failed",
      diagnostic_id: "review_board_run_lookup_failed",
      route: ROUTE,
    });
  }
  if (!run) return jsonNotFound(ROUTE);

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_review_board_run_export_total", 1).catch(
    () => undefined
  );

  const boardId = String((run as { review_board_id: string }).review_board_id);
  const { data: board } = await ctx.admin
    .from("review_boards")
    .select("id, name, board_type, cadence, active")
    .eq("organization_id", ctx.orgId)
    .eq("id", boardId)
    .maybeSingle();

  const exportedAt = nowIso();
  const safeRunId = sanitizeExportFileNameToken(runId);
  const payload = {
    exported_at: exportedAt,
    review_board: board,
    run,
  };

  if (format === "json") {
    const jsonFileName = sanitizeExportFileName(`review-board-run-${safeRunId}.json`);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": contentDispositionAttachment(jsonFileName),
        "cache-control": "private, no-store",
      },
    });
  }

  const csvFileName = sanitizeExportFileName(`review-board-run-${safeRunId}.csv`);
  const packet = (run as { packet_json?: Record<string, unknown> }).packet_json ?? {};
  const summary = (packet.summary as Record<string, unknown> | undefined) ?? {};
  const lines = [
    "field,value",
    `run_id,${csvEscape(runId)}`,
    `board_id,${csvEscape(boardId)}`,
    `board_name,${csvEscape(String((board as { name?: string } | null)?.name ?? ""))}`,
    `generated_at,${csvEscape(String((run as { generated_at?: string }).generated_at ?? ""))}`,
    `reviewed_at,${csvEscape(String((run as { reviewed_at?: string | null }).reviewed_at ?? ""))}`,
    `status,${csvEscape(String((run as { status?: string }).status ?? ""))}`,
    `open_findings,${csvEscape(String(summary.open_findings ?? ""))}`,
    `open_decisions,${csvEscape(String(summary.open_decisions ?? ""))}`,
    `active_campaigns,${csvEscape(String(summary.active_campaigns ?? ""))}`,
    `campaigns_with_drift_signal,${csvEscape(String(summary.campaigns_with_drift_signal ?? ""))}`,
  ];
  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": contentDispositionAttachment(csvFileName),
      "cache-control": "private, no-store",
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6ReviewBoards");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("maintenance_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/review-boards/runs/[id]",
  });
  if (modeGate) return modeGate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/review-boards/runs/[id]",
    method: "PATCH",
  }).catch(() => undefined);

  const runId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: runId }, ["id"], "/api/review-boards/runs/[id]");

  if (routeParamRejection) return routeParamRejection;
  const parsedBody = await parseJsonBodyWithLimit(request, (raw) =>
    readJsonBody<{
      status?: string;
      actionCapture?: Record<string, unknown>;
      decisionLog?: Record<string, unknown>;
    }>(raw ?? {}, {})
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const patch: Record<string, unknown> = {};
  if (body.status === "reviewed" || body.status === "closed") {
    patch.status = body.status;
    if (body.status === "reviewed") patch.reviewed_at = nowIso();
  }
  if (body.actionCapture && typeof body.actionCapture === "object") {
    const { data: prior } = await ctx.admin
      .from("review_board_runs")
      .select("action_capture_json")
      .eq("organization_id", ctx.orgId)
      .eq("id", runId)
      .maybeSingle();
    const prev = Array.isArray(prior?.action_capture_json)
      ? (prior?.action_capture_json as unknown[])
      : [];
    patch.action_capture_json = [...prev, { ...body.actionCapture, at: nowIso() }];
  }
  if (body.decisionLog && typeof body.decisionLog === "object") {
    const { data: prior } = await ctx.admin
      .from("review_board_runs")
      .select("decision_log_json")
      .eq("organization_id", ctx.orgId)
      .eq("id", runId)
      .maybeSingle();
    const prev = Array.isArray(prior?.decision_log_json) ? (prior?.decision_log_json as unknown[]) : [];
    patch.decision_log_json = [...prev, { ...body.decisionLog, at: nowIso() }];
  }

  if (Object.keys(patch).length === 0) {
    return jsonProblem(400, {
      error: "No valid fields",
      code: "no_valid_fields",
      diagnostic_id: "review_board_run_no_valid_fields",
      route: ROUTE,
    });
  }

  const { data, error } = await ctx.admin
    .from("review_board_runs")
    .update(patch)
    .eq("organization_id", ctx.orgId)
    .eq("id", runId)
    .select("id, status, reviewed_at, action_capture_json, decision_log_json")
    .maybeSingle();

  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "review_board_run_update_failed",
      diagnostic_id: "review_board_run_update_failed",
      route: ROUTE,
    });
  }
  if (!data) return jsonNotFound(ROUTE);
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_patch_review_board_run_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ run: data });
}
