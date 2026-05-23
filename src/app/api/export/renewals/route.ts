import { NextResponse } from "next/server";
import { escapeCsvCellForSpreadsheet } from "@/lib/csv-formula-safe";
import { jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { RATE_LIMITS, getClientIpFromHeaders, rateLimitCheck } from "@/lib/rate-limit";
import { loadRenewalsPageModel } from "@/lib/renewals/model";
import { RENEWAL_ROW_LABELS } from "@/lib/renewals/spec-strings";
import { contentDispositionAttachment, sanitizeExportFileName } from "@/lib/security/export-filename";
import { recordApiRouteAuditEvent } from "@/lib/security/api-mutation-audit";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";

const ROUTE = "/api/export/renewals";

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
      diagnostic_id: "renewals_export_organization_missing",
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

  void recordApiRouteAuditEvent(admin, {
    organizationId: orgId,
    actorUserId: user.id,
    route: ROUTE,
    method: "GET",
    action: "api.sensitive_read_authorized",
  }).catch(() => undefined);

  const ip = await getClientIpFromHeaders();
  const rl = await rateLimitCheck(`export-renewals:${user.id}:${ip}`, RATE_LIMITS.exportReviewPacket);
  if (!rl.ok) return jsonRateLimited(rl.retryAfterMs, ROUTE);

  const url = new URL(request.url);
  await emitProductTelemetryEvent(admin, {
    organizationId: orgId,
    userId: user.id,
    action: "product.v9.export_started",
    details: {
      export_type: "renewal_report",
      window: url.searchParams.get("window") ?? "",
      has_owner_filter: url.searchParams.has("owner"),
      has_counterparty_filter: url.searchParams.has("counterparty"),
      has_status_filter: url.searchParams.has("status"),
    },
  });

  try {
    const model = await loadRenewalsPageModel(admin, orgId, {
      userId: user.id,
      role: membership.role,
      workspaceMode: "core",
      window: url.searchParams.get("window"),
      horizon: url.searchParams.get("horizon"),
      owner: url.searchParams.get("owner"),
      counterparty: url.searchParams.get("counterparty"),
      status: url.searchParams.get("status"),
    });

    const headers = [
      RENEWAL_ROW_LABELS.contract,
      RENEWAL_ROW_LABELS.counterparty,
      RENEWAL_ROW_LABELS.renewalDate,
      RENEWAL_ROW_LABELS.noticeDate,
      RENEWAL_ROW_LABELS.owner,
      RENEWAL_ROW_LABELS.status,
      RENEWAL_ROW_LABELS.nextAction,
    ];
    const lines = [
      headers.map(escapeCsvCellForSpreadsheet).join(","),
      ...model.rows.map((row) =>
        [
          row.title,
          row.counterparty,
          row.renewalDate ?? "",
          row.noticeDate ?? "",
          row.ownerLabel,
          row.statusLabel,
          row.nextActionLabel,
        ]
          .map(escapeCsvCellForSpreadsheet)
          .join(",")
      ),
    ];
    const csv = lines.join("\r\n");
    const today = new Date().toISOString().slice(0, 10);
    const fileName = sanitizeExportFileName(`renewals-${today}.csv`);

    await emitProductTelemetryEvent(admin, {
      organizationId: orgId,
      userId: user.id,
      action: "product.v9.export_completed",
      details: {
        export_type: "renewal_report",
        row_count: model.rows.length,
        warning_count: model.warnings.length,
      },
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDispositionAttachment(fileName),
      },
    });
  } catch (error) {
    console.error("[export/renewals]", error);
    await emitProductTelemetryEvent(admin, {
      organizationId: orgId,
      userId: user.id,
      action: "product.v9.export_failed",
      details: {
        export_type: "renewal_report",
        reason: "renewals_export_failed",
      },
    });
    return jsonProblem(500, {
      error: "Could not export renewals",
      code: "renewals_export_failed",
      diagnostic_id: "renewals_export_failed",
      route: ROUTE,
    });
  }
}
