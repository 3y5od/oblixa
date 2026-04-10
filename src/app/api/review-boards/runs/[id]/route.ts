import { NextResponse } from "next/server";
import { nowIso, readJsonBody, toSafeString } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

function csvEscape(value: string): string {
  const v = value.replace(/"/g, '""');
  return `"${v}"`;
}

/** Full run export for board archives and integrations (review board packet + actions). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6ReviewBoards");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const runId = toSafeString((await params).id);
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";

  const { data: run, error } = await ctx.admin
    .from("review_board_runs")
    .select(
      "id, review_board_id, status, agenda_json, packet_json, unresolved_findings_json, action_capture_json, decision_log_json, generated_at, reviewed_at, created_at"
    )
    .eq("organization_id", ctx.orgId)
    .eq("id", runId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

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
  const payload = {
    exported_at: exportedAt,
    review_board: board,
    run,
  };

  if (format === "json") {
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="review-board-run-${runId}.json"`,
      },
    });
  }

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
      "content-disposition": `attachment; filename="review-board-run-${runId}.csv"`,
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6ReviewBoards");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("maintenance_manage");
  if (!ctx) return errorResponse!;

  const runId = toSafeString((await params).id);
  const body = readJsonBody<{
    status?: string;
    actionCapture?: Record<string, unknown>;
    decisionLog?: Record<string, unknown>;
  }>(await request.json().catch(() => ({})), {});

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
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { data, error } = await ctx.admin
    .from("review_board_runs")
    .update(patch)
    .eq("organization_id", ctx.orgId)
    .eq("id", runId)
    .select("id, status, reviewed_at, action_capture_json, decision_log_json")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_patch_review_board_run_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ run: data });
}
