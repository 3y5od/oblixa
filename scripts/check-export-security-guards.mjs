#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:export-security-guards"];
const REQUIRED_CI_COMMANDS = ["npm run check:export-security-guards"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:export-security-guards"'];
const REQUIRED_FILE_MARKERS = {
  "src/app/api/export/contracts/route.ts": [
    'rateLimitCheck(`export-contracts:${user.id}:${ip}`, RATE_LIMITS.exportContractsCsv)',
    '.eq("organization_id", orgId)',
    '.eq("organization_id", orgId);',
    '"Cache-Control": "private, no-store"',
  ],
  "src/lib/export/contracts-csv.ts": [
    'recordV10AuditEvent(admin, {',
    'action: "export_job.created"',
    'action: "export_job.completed"',
    'escapeCsvCellForSpreadsheet',
    'sanitizeExportFileName(`contracts-export-${new Date().toISOString().slice(0, 10)}.csv`)',
    "contentDispositionAttachment(filename)",
    '"Cache-Control": "private, no-store"',
  ],
  "src/lib/csv-formula-safe.ts": [
    "export function stripCsvBidiControlCharacters(value: string): string {",
    "\\u202a-\\u202e\\u2066-\\u2069",
    "const trimmedStart = t.trimStart();",
    "if (/^[\\t\\r]/.test(t) || /^[=+\\-@]/.test(trimmedStart)) {",
  ],
  "src/lib/csv-formula-safe.v9.test.ts": [
    'it("neutralizes leading formula characters"',
    'it("neutralizes leading whitespace formula variants"',
    'it("strips bidi controls before formula neutralization"',
    'escapeCsvCellForSpreadsheet(" =1+1")',
    'escapeCsvCellForSpreadsheet("  +cmd")',
    'escapeCsvCellForSpreadsheet("\\t=cmd")',
    'escapeCsvCellForSpreadsheet(" \\r=cmd")',
  ],
  "src/app/api/export/contracts/[jobId]/route.ts": [
    '.eq("id", jobId)',
    '.eq("organization_id", membership.organization_id)',
    'action: "export_job.retry_requested"',
    'apiPath: "/api/export/contracts/[jobId]"',
  ],
  "src/app/api/export/calendar/route.ts": [
    'rateLimitCheck(`export-calendar:${user.id}:${ip}`, RATE_LIMITS.exportCalendar)',
    'buildOrganizationCalendarIcs(admin, membership.organization_id',
    'recordV10AuditEvent(admin, {',
    'action: "export.calendar.completed"',
    'sanitizeExportFileName("oblixa-calendar.ics")',
    "contentDispositionAttachment(fileName)",
    '"Cache-Control": "private, no-store"',
  ],
  "src/app/api/export/review-packet/route.ts": [
    'rateLimitCheck(`export-review-packet:${user.id}:${ip}`, RATE_LIMITS.exportReviewPacket)',
    'escapeCsvCellForSpreadsheet',
    'sanitizeExportFileName(`review-packet-${today}.csv`)',
    "contentDispositionAttachment(fileName)",
    '"Cache-Control": "private, no-store"',
    'product.v9.export_completed',
    'product.v9.export_failed',
  ],
  "src/app/api/report-packs/[id]/runs/route.ts": [
    'escapeCsvCellForSpreadsheet',
    'rejectUnsafeRouteParams({ id }, ["id"], "/api/report-packs/[id]/runs")',
    'sanitizeExportFileNameToken(id)',
    'sanitizeExportFileName(`report-pack-${safePackId}-run.csv`)',
    'sanitizeExportFileName(`report-pack-${safePackId}.html`)',
    "contentDispositionAttachment(csvFileName)",
    "contentDispositionInline(htmlFileName)",
    '.eq("organization_id", ctx.orgId)',
    '.eq("report_pack_id", id)',
    '"cache-control": "private, no-store"',
    '"Cache-Control": "private, no-store"',
  ],
  "src/app/api/campaigns/[id]/export/route.ts": [
    'escapeCsvCellForSpreadsheet',
    'rejectUnsafeRouteParams({ id }, ["id"], "/api/campaigns/[id]/export")',
    'sanitizeExportFileNameToken(id)',
    'sanitizeExportFileName(`campaign-${safeCampaignId}.csv`)',
    "contentDispositionAttachment(fileName)",
    '.eq("organization_id", ctx.orgId)',
    '.eq("campaign_id", id)',
    '"Cache-Control": "private, no-store"',
  ],
  "src/app/api/review-boards/runs/[id]/route.ts": [
    'escapeCsvCellForSpreadsheet',
    'rejectUnsafeRouteParams({ id: runId }, ["id"], "/api/review-boards/runs/[id]")',
    'sanitizeExportFileNameToken(runId)',
    'sanitizeExportFileName(`review-board-run-${safeRunId}.json`)',
    'sanitizeExportFileName(`review-board-run-${safeRunId}.csv`)',
    "contentDispositionAttachment(jsonFileName)",
    "contentDispositionAttachment(csvFileName)",
    '.eq("organization_id", ctx.orgId)',
    '"cache-control": "private, no-store"',
  ],
  "src/app/api/evidence/export/[contractId]/route.ts": [
    'rejectUnsafeRouteParams({ contractId }, ["contractId"], "/api/evidence/export/[contractId]")',
    "sanitizeExportFileNameToken(contractId)",
    "contentDispositionAttachment(fileName)",
    '"cache-control": "private, no-store"',
  ],
  "src/app/api/me/export/route.ts": [
    'rateLimitCheck(`dsr-export:${user.id}:${ip}`, RATE_LIMITS.dsrSelfExport)',
    "sanitizeExportFileNameToken(user.id)",
    "contentDispositionAttachment(fileName)",
    '"Cache-Control": "private, no-store"',
  ],
  "src/lib/security/export-filename.ts": [
    "export function sanitizeExportFileName(name: string): string {",
    "export function sanitizeExportFileNameToken(value: string): string {",
    "export function contentDispositionAttachment(name: string): string {",
    "export function contentDispositionInline(name: string): string {",
    'name.split(/[/\\\\]/).pop() ?? "export"',
    "\\u202a-\\u202e\\u2066-\\u2069",
    "filename*=UTF-8''",
  ],
  "src/lib/security/export-filename.test.ts": [
    'it("uses the basename after path separators"',
    'it("strips header-breaking and bidi characters"',
    'it("creates bounded filename tokens for route ids"',
    'it("builds RFC 5987 attachment headers with ASCII fallback"',
    'it("builds inline content disposition headers with sanitized filenames"',
  ],
  "src/lib/export/calendar-text-guard.ts": [
    "export function escapeIcsTextValue(value: string): string {",
    "foldIcsTextLine",
  ],
  "src/lib/export/calendar-text-guard.test.ts": [
    'it("escapes ICS structural characters"',
  ],
  "src/lib/integrations/calendar.ts": [
    "function safeIcsUid(value: string): string {",
    "`UID:${safeIcsUid(uid)}`",
    'escapeIcsTextValue(summary.replace(/\\r?\\n/g, " "))',
  ],
  "src/lib/integrations/calendar.test.ts": [
    'it("escapes calendar text and prevents uid line injection"',
    "ATTENDEE:mailto:evil@example.com",
    "Acme\\\\, Inc\\\\;\\\\nRenewal",
  ],
  "src/app/api/export/contracts/route.test.ts": [
    'it("returns 429 with retry metadata when rate limited"',
    'it("keeps GET exports read-only while returning CSV"',
    "'=SUM(1,1)",
    'it("exports owner emails only from the selected workspace membership"',
  ],
  "src/app/api/export/contracts/[jobId]/route.test.ts": [
    'it("returns visible headline + detail for a queued job"',
    'it("POST queues an export retry with V10 idempotent envelope semantics"',
  ],
  "src/app/api/report-packs/[id]/runs/route.test.ts": [
    'it("neutralizes spreadsheet formulas in CSV export"',
    'it("sanitizes report pack export filenames and private cache headers"',
    "p1\\r\\nX-Bad: yes",
    "private, no-store",
  ],
  "src/app/api/campaigns/[id]/export/route.test.ts": [
    'it("returns CSV attachment when format=csv"',
    'it("rejects unsafe route params before export"',
    "'=SUM(1,1)",
    'details: { reason: "invalid_route_param", param: "id" }',
    "private, no-store",
  ],
  "src/app/api/review-boards/runs/[id]/route.test.ts": [
    'it("returns CSV with formula-safe cells and sanitized private export headers"',
    'it("rejects unsafe route params before export"',
    'details: { reason: "invalid_route_param", param: "id" }',
    "'=SUM(1,1)",
  ],
};

function fileExists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeExportSecurityGuards(root = ROOT) {
  const issues = [];
  for (const rel of Object.keys(REQUIRED_FILE_MARKERS)) {
    if (!fileExists(root, rel)) issues.push({ issue: "missing_required_file", rel });
  }

  const pkg = JSON.parse(read(root, "package.json"));
  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push({ issue: "missing_package_script", script });
  }

  const ci = read(root, ".github/workflows/ci.yml");
  for (const cmd of REQUIRED_CI_COMMANDS) {
    if (!ci.includes(cmd)) issues.push({ issue: "missing_ci_reference", cmd });
  }

  const securityPipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  for (const step of REQUIRED_SECURITY_PIPELINE_STEPS) {
    if (!securityPipeline.includes(step)) issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
  }

  for (const [rel, markers] of Object.entries(REQUIRED_FILE_MARKERS)) {
    if (!fileExists(root, rel)) continue;
    const content = read(root, rel);
    for (const marker of collectMissingMarkers(content, markers)) {
      issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  return { checkId: "export-security-guards", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeExportSecurityGuards();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
