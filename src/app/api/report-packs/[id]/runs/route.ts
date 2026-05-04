import { NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/v4/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { parseWorkspaceMode } from "@/lib/product-surface/context";
import { workspaceModeAllowsReportType } from "@/lib/product-surface/feature-registry";
import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";
import { escapeCsvCellForSpreadsheet } from "@/lib/csv-formula-safe";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/report-packs/[id]/runs",
  });
  if (modeGate) return modeGate;

  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const runId = url.searchParams.get("runId");

  const { data: pack } = await ctx.admin
    .from("report_packs")
    .select("id, name, report_type, annotations_json")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!pack) return NextResponse.json({ error: "Report pack not found" }, { status: 404 });

  const v6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  const mode = parseWorkspaceMode(v6);
  if (!workspaceModeAllowsReportType(mode, String(pack.report_type ?? ""))) {
    return NextResponse.json({ error: "Feature not available in workspace mode" }, { status: 404 });
  }

  const { data, error } = await ctx.admin
    .from("report_pack_runs")
    .select("id, status, started_at, completed_at, metrics_json, output_refs_json, error, created_at")
    .eq("organization_id", ctx.orgId)
    .eq("report_pack_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const runs = data ?? [];
  const target = runId ? runs.find((r) => r.id === runId) : runs[0];

  if (format === "csv") {
    if (!target) return new NextResponse("No runs to export", { status: 404 });
    const metrics = (target.metrics_json ?? {}) as Record<string, unknown>;
    const lines = ["key,value"];
    for (const [k, v] of Object.entries(metrics)) {
      lines.push(
        `${escapeCsvCellForSpreadsheet(k)},${escapeCsvCellForSpreadsheet(
          typeof v === "object" ? JSON.stringify(v) : String(v)
        )}`
      );
    }
    return new NextResponse(lines.join("\r\n"), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="report-pack-${id}-run.csv"`,
        "cache-control": "no-store",
      },
    });
  }

  if (format === "html" || format === "pdf") {
    if (!target) return new NextResponse("No runs to export", { status: 404 });
    const metrics = (target.metrics_json ?? {}) as Record<string, unknown>;
    const annotations = (pack.annotations_json as unknown[] | null) ?? [];
    const rows = Object.entries(metrics)
      .map(
        ([k, v]) =>
          `<tr><th style="text-align:left;padding:6px;border-bottom:1px solid #e4e4e7">${escapeHtml(k)}</th><td style="padding:6px;border-bottom:1px solid #e4e4e7">${escapeHtml(
            typeof v === "object" ? JSON.stringify(v) : String(v)
          )}</td></tr>`
      )
      .join("");
    const annRows = annotations
      .map((a, i) => `<li>${escapeHtml(typeof a === "object" ? JSON.stringify(a) : String(a))} (${i + 1})</li>`)
      .join("");
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Report pack — ${escapeHtml(
      pack.name ?? id
    )}</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#18181b}h1{font-size:20px}table{border-collapse:collapse;width:100%;max-width:720px}@media print{body{padding:12px}}</style></head><body><h1>${escapeHtml(
      pack.name ?? "Report pack"
    )}</h1><p style="color:#52525b">Type: ${escapeHtml(pack.report_type)} · Run: ${escapeHtml(
      target.id
    )} · Generated ${escapeHtml(target.completed_at ?? target.created_at)}</p><table><tbody>${rows}</tbody></table>${
      annRows
        ? `<h2 style="margin-top:24px;font-size:16px">Annotations</h2><ol>${annRows}</ol>`
        : ""
    }<p style="margin-top:32px;font-size:12px;color:#71717a">Print this page or save as PDF from your browser.</p></body></html>`;
    const headers: Record<string, string> = {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    };
    if (format === "pdf") {
      headers["x-oblixa-print-hint"] = "Save as PDF from browser print dialog";
      headers["content-disposition"] = `inline; filename="report-pack-${id}.html"`;
    }
    return new NextResponse(html, { status: 200, headers });
  }

  return NextResponse.json({ runs });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
