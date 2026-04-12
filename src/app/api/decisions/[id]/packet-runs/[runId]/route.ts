import { NextResponse } from "next/server";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import { isDecisionPacketServerPdfEnabled } from "@/lib/v5/decision-packet-export";
import { buildDecisionPacketRunHtml } from "@/lib/v5/decision-packet-html";
import {
  createDecisionPacketArtifactSignedUrl,
  getV5DecisionPacketBucket,
} from "@/lib/v5/decision-packet-storage";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

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
  const { id: decisionId, runId } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/decisions/[id]/packet-runs/[runId]",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "renewals_manage"))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { data: run, error } = await ctx.admin
    .from("decision_packet_runs")
    .select(
      "id, packet_type, payload_json, exported_at, created_at, decision_workspace_id, artifact_storage_path, artifact_pdf_storage_path"
    )
    .eq("organization_id", ctx.orgId)
    .eq("id", runId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!run) return NextResponse.json({ error: "Packet run not found" }, { status: 404 });
  if (String(run.decision_workspace_id) !== decisionId) {
    return NextResponse.json({ error: "Packet run does not belong to this decision" }, { status: 404 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("signed") === "1") {
    if (!getV5DecisionPacketBucket()) {
      return NextResponse.json(
        { error: "Signed artifact URLs require V5_DECISION_PACKET_BUCKET to be configured." },
        { status: 503 }
      );
    }
    const kind = url.searchParams.get("artifact") === "pdf" ? "pdf" : "json";
    const rawStoragePath = kind === "pdf" ? run.artifact_pdf_storage_path : run.artifact_storage_path;
    const storagePath =
      typeof rawStoragePath === "string" && rawStoragePath.trim() ? rawStoragePath.trim() : null;
    if (!storagePath) {
      return NextResponse.json(
        {
          error: `No stored ${kind.toUpperCase()} artifact for this run. Enable V5_DECISION_PACKET_BUCKET and regenerate the packet.`,
        },
        { status: 404 }
      );
    }
    const expiresIn = 3600;
    const signed = await createDecisionPacketArtifactSignedUrl(ctx.admin, storagePath, expiresIn);
    if (!signed) {
      return NextResponse.json({ error: "Could not create signed URL." }, { status: 502 });
    }
    return NextResponse.json({ signedUrl: signed.signedUrl, expiresIn, artifact: kind });
  }

  const format = url.searchParams.get("format") ?? "json";

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
    const { renderDecisionPacketPdfBuffer } = await import("@/lib/v5/decision-packet-pdf");
    const buf = await renderDecisionPacketPdfBuffer({
      title,
      packetType: String(run.packet_type ?? "packet"),
      exportedAt: run.exported_at,
      bodyText,
    });
    const filename = `decision-packet-${decisionId.slice(0, 8)}-${runId.slice(0, 8)}.pdf`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="${filename}"`,
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
      "cache-control": "no-store",
    };
    return new NextResponse(html, { status: 200, headers });
  }

  if (format !== "json") {
    return NextResponse.json({ error: "Invalid format. Use json, html, or pdf." }, { status: 400 });
  }

  const body = JSON.stringify(run.payload_json ?? {}, null, 2);
  const filename = `decision-packet-${decisionId.slice(0, 8)}-${run.packet_type}-${runId.slice(0, 8)}.json`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
