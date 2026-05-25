import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeExportSecurityGuards } from "./check-export-security-guards.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeExportSecurityGuards validates export scope, audit, no-store, filename, CSV and ICS controls", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-export-guards-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:export-security-guards": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:export-security-guards\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:export-security-guards"\n');
  write(root, "src/app/api/export/contracts/route.ts", 'rateLimitCheck(`export-contracts:${user.id}:${ip}`, RATE_LIMITS.exportContractsCsv)\n.eq("organization_id", orgId)\n.eq("organization_id", orgId);\n"Cache-Control": "private, no-store"\n');
  write(root, "src/lib/export/contracts-csv.ts", 'recordV10AuditEvent(admin, {\naction: "export_job.created"\naction: "export_job.completed"\nescapeCsvCellForSpreadsheet\nsanitizeExportFileName(`contracts-export-${new Date().toISOString().slice(0, 10)}.csv`)\ncontentDispositionAttachment(filename)\n"Cache-Control": "private, no-store"\n');
  write(root, "src/app/api/export/contracts/[jobId]/route.ts", '.eq("id", jobId)\n.eq("organization_id", membership.organization_id)\naction: "export_job.retry_requested"\napiPath: "/api/export/contracts/[jobId]"\n');
  write(root, "src/app/api/export/calendar/route.ts", 'rateLimitCheck(`export-calendar:${user.id}:${ip}`, RATE_LIMITS.exportCalendar)\nbuildOrganizationCalendarIcs(admin, membership.organization_id\nrecordV10AuditEvent(admin, {\naction: "export.calendar.completed"\nsanitizeExportFileName("oblixa-calendar.ics")\ncontentDispositionAttachment(fileName)\n"Cache-Control": "private, no-store"\n');
  write(root, "src/app/api/export/review-packet/route.ts", 'rateLimitCheck(`export-review-packet:${user.id}:${ip}`, RATE_LIMITS.exportReviewPacket)\nescapeCsvCellForSpreadsheet\nsanitizeExportFileName(`review-packet-${today}.csv`)\ncontentDispositionAttachment(fileName)\n"Cache-Control": "private, no-store"\nproduct.v9.export_completed\nproduct.v9.export_failed\n');
  write(root, "src/app/api/report-packs/[id]/runs/route.ts", 'escapeCsvCellForSpreadsheet\nrejectUnsafeRouteParams({ id }, ["id"], "/api/report-packs/[id]/runs")\nsanitizeExportFileNameToken(id)\nsanitizeExportFileName(`report-pack-${safePackId}-run.csv`)\nsanitizeExportFileName(`report-pack-${safePackId}.html`)\ncontentDispositionAttachment(csvFileName)\ncontentDispositionInline(htmlFileName)\n.eq("organization_id", ctx.orgId)\n.eq("report_pack_id", id)\n"cache-control": "private, no-store"\n"Cache-Control": "private, no-store"\n');
  write(root, "src/app/api/campaigns/[id]/export/route.ts", 'escapeCsvCellForSpreadsheet\nrejectUnsafeRouteParams({ id }, ["id"], "/api/campaigns/[id]/export")\nsanitizeExportFileNameToken(id)\nsanitizeExportFileName(`campaign-${safeCampaignId}.csv`)\ncontentDispositionAttachment(fileName)\n.eq("organization_id", ctx.orgId)\n.eq("campaign_id", id)\n"Cache-Control": "private, no-store"\n');
  write(root, "src/app/api/review-boards/runs/[id]/route.ts", 'escapeCsvCellForSpreadsheet\nrejectUnsafeRouteParams({ id: runId }, ["id"], "/api/review-boards/runs/[id]")\nsanitizeExportFileNameToken(runId)\nsanitizeExportFileName(`review-board-run-${safeRunId}.json`)\nsanitizeExportFileName(`review-board-run-${safeRunId}.csv`)\ncontentDispositionAttachment(jsonFileName)\ncontentDispositionAttachment(csvFileName)\n.eq("organization_id", ctx.orgId)\n"cache-control": "private, no-store"\n');
  write(root, "src/app/api/evidence/export/[contractId]/route.ts", 'rejectUnsafeRouteParams({ contractId }, ["contractId"], "/api/evidence/export/[contractId]")\nsanitizeExportFileNameToken(contractId)\ncontentDispositionAttachment(fileName)\n"cache-control": "private, no-store"\n');
  write(root, "src/app/api/me/export/route.ts", 'rateLimitCheck(`dsr-export:${user.id}:${ip}`, RATE_LIMITS.dsrSelfExport)\nsanitizeExportFileNameToken(user.id)\ncontentDispositionAttachment(fileName)\n"Cache-Control": "private, no-store"\n');
  write(root, "src/lib/security/export-filename.ts", 'export function sanitizeExportFileName(name: string): string {\nexport function sanitizeExportFileNameToken(value: string): string {\nexport function contentDispositionAttachment(name: string): string {\nexport function contentDispositionInline(name: string): string {\nname.split(/[/\\\\]/).pop() ?? "export"\n\\u202a-\\u202e\\u2066-\\u2069\nfilename*=UTF-8\'\'\n');
  write(root, "src/lib/security/export-filename.test.ts", 'it("uses the basename after path separators", () => {})\nit("strips header-breaking and bidi characters", () => {})\nit("creates bounded filename tokens for route ids", () => {})\nit("builds RFC 5987 attachment headers with ASCII fallback", () => {})\nit("builds inline content disposition headers with sanitized filenames", () => {})\n');
  write(root, "src/lib/csv-formula-safe.ts", 'export function stripCsvBidiControlCharacters(value: string): string {\n\\u202a-\\u202e\\u2066-\\u2069\nconst trimmedStart = t.trimStart();\nif (/^[\\t\\r]/.test(t) || /^[=+\\-@]/.test(trimmedStart)) {\n');
  write(root, "src/lib/csv-formula-safe.test.ts", 'it("neutralizes leading formula characters", () => {})\nit("neutralizes leading whitespace formula variants", () => {})\nit("strips bidi controls before formula neutralization", () => {})\nescapeCsvCellForSpreadsheet(" =1+1")\nescapeCsvCellForSpreadsheet("  +cmd")\nescapeCsvCellForSpreadsheet("\\t=cmd")\nescapeCsvCellForSpreadsheet(" \\r=cmd")\n');
  write(root, "src/lib/export/calendar-text-guard.ts", 'export function escapeIcsTextValue(value: string): string {\n}\nfoldIcsTextLine\n');
  write(root, "src/lib/export/calendar-text-guard.test.ts", 'it("escapes ICS structural characters", () => {})\n');
  write(root, "src/lib/integrations/calendar.ts", 'function safeIcsUid(value: string): string {\n`UID:${safeIcsUid(uid)}`\nescapeIcsTextValue(summary.replace(/\\r?\\n/g, " "))\n');
  write(root, "src/lib/integrations/calendar.test.ts", 'it("escapes calendar text and prevents uid line injection", () => {})\nATTENDEE:mailto:evil@example.com\nAcme\\\\, Inc\\\\;\\\\nRenewal\n');
  write(root, "src/app/api/export/contracts/route.test.ts", 'it("returns 429 with retry metadata when rate limited", () => {})\nit("keeps GET exports read-only while returning CSV", () => {})\n\'=SUM(1,1)\nit("exports owner emails only from the selected workspace membership", () => {})\n');
  write(root, "src/app/api/export/contracts/[jobId]/route.test.ts", 'it("returns visible headline + detail for a queued job", () => {})\nit("POST queues an export retry with V10 idempotent envelope semantics", () => {})\n');
  write(root, "src/app/api/report-packs/[id]/runs/route.test.ts", 'it("neutralizes spreadsheet formulas in CSV export", () => {})\nit("sanitizes report pack export filenames and private cache headers", () => {})\np1\\r\\nX-Bad: yes\nprivate, no-store\n');
  write(root, "src/app/api/campaigns/[id]/export/route.test.ts", 'it("returns CSV attachment when format=csv", () => {})\nit("rejects unsafe route params before export", () => {})\n\'=SUM(1,1)\ndetails: { reason: "invalid_route_param", param: "id" }\nprivate, no-store\n');
  write(root, "src/app/api/review-boards/runs/[id]/route.test.ts", 'it("returns CSV with formula-safe cells and sanitized private export headers", () => {})\nit("rejects unsafe route params before export", () => {})\ndetails: { reason: "invalid_route_param", param: "id" }\n\'=SUM(1,1)\n');

  const report = analyzeExportSecurityGuards(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.issueCount, 0);
});
