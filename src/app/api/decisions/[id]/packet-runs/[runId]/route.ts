import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { canManageCapability, getApiAuthContext } from "@/lib/contract-operations/api-auth";
import { isDecisionPacketServerPdfEnabled } from "@/lib/decision-intelligence/decision-packet-export";
import { buildDecisionPacketRunHtml } from "@/lib/decision-intelligence/decision-packet-html";
import {
  DECISION_PACKET_SIGNED_URL_TTL_SECONDS,
  createDecisionPacketArtifactSignedUrl,
  getDecisionPacketBucket,
  isDecisionPacketArtifactStoragePathScoped,
} from "@/lib/decision-intelligence/decision-packet-storage";
import { requireV5ApiFeature } from "@/lib/decision-intelligence/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import {
  contentDispositionAttachment,
  sanitizeExportFileName,
  sanitizeExportFileNameToken,
} from "@/lib/security/export-filename";
import { recordV10AuditEvent } from "@/lib/server-contracts";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";
import { parseFixedEnumParam } from "@/lib/security/validation";

const ROUTE = "/api/decisions/[id]/packet-runs/[runId]";

/**
 * Download a packet run as JSON (default), or HTML / print-ready HTML for browser PDF
 * (`format=html` | `format=pdf`, same pattern as report-pack exports).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
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
    apiPath: "/api/decisions/[id]/packet-runs/[runId]",
  });
  if (modeGate) return modeGate;

  const { id: decisionId, runId } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id: decisionId, runId }, ["id", "runId"], "/api/decisions/[id]/packet-runs/[runId]");

  if (routeParamRejection) return routeParamRejection;
  const { data: run, error } = await ctx.admin
    .from("decision_packet_runs")
    .select(
      "id, packet_type, payload_json, exported_at, created_at, decision_workspace_id, artifact_storage_path, artifact_pdf_storage_path"
    )
    .eq("organization_id", ctx.orgId)
    .eq("id", runId)
    .maybeSingle();
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "decision_packet_run_lookup_failed",
      diagnostic_id: "decision_packet_run_lookup_failed",
      route: ROUTE,
    });
  }
  if (!run) return jsonNotFound(ROUTE);
  if (String(run.decision_workspace_id) !== decisionId) {
    return jsonNotFound(ROUTE);
  }

  const url = new URL(request.url);
  if (url.searchParams.get("signed") === "1") {
    if (!getDecisionPacketBucket()) {
      return jsonProblem(503, {
        error: "Signed artifact URLs require DECISION_PACKET_BUCKET to be configured.",
        code: "packet_bucket_not_configured",
        diagnostic_id: "packet_bucket_not_configured",
        route: ROUTE,
      });
    }
    const kind = parseFixedEnumParam(url.searchParams.get("artifact"), ["json", "pdf"] as const, "json");
    const rawStoragePath = kind === "pdf" ? run.artifact_pdf_storage_path : run.artifact_storage_path;
    const storagePath =
      typeof rawStoragePath === "string" && rawStoragePath.trim() ? rawStoragePath.trim() : null;
    if (!storagePath) {
      return jsonProblem(404, {
        error: `No stored ${kind.toUpperCase()} artifact for this run. Enable DECISION_PACKET_BUCKET and regenerate the packet.`,
        code: "packet_artifact_not_found",
        diagnostic_id: "packet_artifact_not_found",
        route: ROUTE,
      });
    }
    if (
      !isDecisionPacketArtifactStoragePathScoped(storagePath, {
        orgId: ctx.orgId,
        runId,
        artifact: kind,
      })
    ) {
      return jsonNotFound(ROUTE);
    }
    const expiresIn = DECISION_PACKET_SIGNED_URL_TTL_SECONDS;
    const signed = await createDecisionPacketArtifactSignedUrl(ctx.admin, storagePath, expiresIn);
    if (!signed) {
      return jsonProblem(502, {
        error: "Could not create signed URL.",
        code: "packet_signed_url_failed",
        diagnostic_id: "packet_signed_url_failed",
        route: ROUTE,
      });
    }
    await recordV10AuditEvent(ctx.admin, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      action: "decision_packet_artifact.download_url_created",
      targetType: "decision_packet_run",
      targetId: runId,
      outcome: "success",
      safeMetadata: {
        artifact: kind,
        expires_in_seconds: signed.expiresIn,
        storage_scope: "org_run_packet",
      },
    });
    return NextResponse.json(
      {
        signedUrl: signed.signedUrl,
        expiresIn: signed.expiresIn,
        expiresAt: new Date(Date.now() + signed.expiresIn * 1000).toISOString(),
        artifact: kind,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const rawFormat = url.searchParams.get("format");
  const format = parseFixedEnumParam(rawFormat, ["json", "html", "pdf"] as const, "json");
  if (rawFormat && rawFormat !== format) {
    return jsonProblem(400, {
      error: "Invalid format. Use json, html, or pdf.",
      code: "invalid_format",
      diagnostic_id: "decision_packet_run_invalid_format",
      route: ROUTE,
    });
  }

  const serverPdfEnabled = isDecisionPacketServerPdfEnabled();

  if (format === "pdf" && serverPdfEnabled) {
    const payload = run.payload_json ?? {};
    const p =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};
    const decision =
      p.decision && typeof p.decision === "object" && !Array.isArray(p.decision)
        ? (p.decision as Record<string, unknown>)
        : {};
    const title =
      typeof decision.title === "string" && decision.title.trim()
        ? decision.title
        : "Decision packet";
    const bodyText = JSON.stringify(payload, null, 2);
    const { renderDecisionPacketPdfBuffer } = await import("@/lib/decision-intelligence/decision-packet-pdf");
    const buf = await renderDecisionPacketPdfBuffer({
      title,
      packetType: String(run.packet_type ?? "packet"),
      exportedAt: run.exported_at,
      bodyText,
    });
    const filename = sanitizeExportFileName(
      `decision-packet-${sanitizeExportFileNameToken(decisionId).slice(0, 8)}-${sanitizeExportFileNameToken(runId).slice(0, 8)}.pdf`
    );
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "cache-control": "private, no-store",
        "content-disposition": contentDispositionAttachment(filename),
      },
    });
  }

  if (format === "html") {
    const html = buildDecisionPacketRunHtml({
      decisionId,
      runId,
      packetType: String(run.packet_type ?? "packet"),
      exportedAt: run.exported_at,
      createdAt: run.created_at,
      payload: run.payload_json ?? {},
    });
    const headers: Record<string, string> = {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
    };
    return new NextResponse(html, { status: 200, headers });
  }

  if (format !== "json") {
    return jsonProblem(400, {
      error: "Invalid format. Use json, html, or pdf.",
      code: "invalid_format",
      diagnostic_id: "decision_packet_run_invalid_format",
      route: ROUTE,
    });
  }

  const body = JSON.stringify(run.payload_json ?? {}, null, 2);
  const filename = sanitizeExportFileName(
    `decision-packet-${sanitizeExportFileNameToken(decisionId).slice(0, 8)}-${sanitizeExportFileNameToken(String(run.packet_type ?? "packet"))}-${sanitizeExportFileNameToken(runId).slice(0, 8)}.json`
  );
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": contentDispositionAttachment(filename),
      "Cache-Control": "private, no-store",
    },
  });
}
