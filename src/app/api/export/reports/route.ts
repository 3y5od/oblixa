import { NextResponse } from "next/server";
import { escapeCsvCellForSpreadsheet } from "@/lib/csv-formula-safe";
import { jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { RATE_LIMITS, getClientIpFromHeaders, rateLimitCheck } from "@/lib/rate-limit";
import { loadReportsPageModel, resolveReportKey } from "@/lib/reports/model";
import { REPORTS_PAGE_TITLE } from "@/lib/reports/spec-strings";
import type { ReportKey } from "@/lib/reports/types";
import { recordApiRouteAuditEvent } from "@/lib/security/api-mutation-audit";
import { contentDispositionAttachment, sanitizeExportFileName } from "@/lib/security/export-filename";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";

const ROUTE = "/api/export/reports";

export const maxDuration = 60;

export async function GET(request: Request) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonUnauthorized(ROUTE);

  const membership = await getDeterministicMembership(admin, user.id);
  if (!membership) {
    return jsonProblem(400, {
      error: "No organization",
      code: "organization_missing",
      diagnostic_id: "reports_export_organization_missing",
      route: ROUTE,
    });
  }

  const orgId = membership.organization_id;
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId,
    role: membership.role,
    apiPath: ROUTE,
  });
  if (modeGate) return modeGate;

  const url = new URL(request.url);
  const reportParam = url.searchParams.get("report");
  const report = resolveReportKey(reportParam);
  if (reportParam && !report) {
    return jsonProblem(400, {
      error: "Invalid report",
      code: "invalid_report_key",
      diagnostic_id: "reports_export_invalid_report_key",
      route: ROUTE,
    });
  }
  const reportKey: ReportKey = report ?? "upcoming_renewals";

  void recordApiRouteAuditEvent(admin, {
    organizationId: orgId,
    actorUserId: user.id,
    route: ROUTE,
    method: "GET",
    action: "api.sensitive_read_authorized",
  }).catch(() => undefined);

  const ip = await getClientIpFromHeaders();
  const rl = await rateLimitCheck(`export-reports:${user.id}:${ip}`, RATE_LIMITS.exportReviewPacket);
  if (!rl.ok) return jsonRateLimited(rl.retryAfterMs, ROUTE);

  await emitProductTelemetryEvent(admin, {
    organizationId: orgId,
    userId: user.id,
    action: "product.v9.export_started",
    details: {
      export_type: "reports",
      report_key: reportKey,
      window: url.searchParams.get("window") ?? "",
      has_owner_filter: url.searchParams.has("owner"),
      has_counterparty_filter: url.searchParams.has("counterparty"),
      has_status_filter: url.searchParams.has("status"),
    },
  });

  try {
    const model = await loadReportsPageModel(admin, orgId, {
      userId: user.id,
      role: membership.role,
      workspaceMode: "core",
      report: reportKey,
      window: url.searchParams.get("window"),
      owner: url.searchParams.get("owner"),
      counterparty: url.searchParams.get("counterparty"),
      status: url.searchParams.get("status"),
      previewLimit: null,
    });

    const lines = [
      model.previewColumns.map(escapeCsvCellForSpreadsheet).join(","),
      ...model.previewRows.map((row) =>
        model.previewColumns
          .map((column) => escapeCsvCellForSpreadsheet(row.cells[column] ?? ""))
          .join(",")
      ),
    ];
    const csv = lines.join("\r\n");
    const now = new Date().toISOString();

    void admin
      .from("contract_export_jobs")
      .insert({
        organization_id: orgId,
        created_by: user.id,
        scope: "workspace",
        status: "completed",
        export_format: "csv",
        selected_contract_count: model.totalPreviewRows,
        exported_rows: model.previewRows.length,
        truncated: false,
        filter_json: {
          page: REPORTS_PAGE_TITLE,
          report_key: model.activeReport,
          report_label: model.activeDefinition.label,
          filters: model.filters,
        },
        started_at: now,
        completed_at: now,
      })
      .then(() => undefined, () => undefined);

    await emitProductTelemetryEvent(admin, {
      organizationId: orgId,
      userId: user.id,
      action: "product.v9.export_completed",
      details: {
        export_type: "reports",
        report_key: model.activeReport,
        row_count: model.previewRows.length,
        warning_count: model.warnings.length,
      },
    });

    const today = now.slice(0, 10);
    const fileName = sanitizeExportFileName(`reports-${model.activeReport}-${today}.csv`);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDispositionAttachment(fileName),
      },
    });
  } catch (error) {
    console.error("[export/reports]", error);
    await emitProductTelemetryEvent(admin, {
      organizationId: orgId,
      userId: user.id,
      action: "product.v9.export_failed",
      details: {
        export_type: "reports",
        report_key: reportKey,
        reason: "reports_export_failed",
      },
    });
    return jsonProblem(500, {
      error: "Could not export reports",
      code: "reports_export_failed",
      diagnostic_id: "reports_export_failed",
      route: ROUTE,
    });
  }
}
