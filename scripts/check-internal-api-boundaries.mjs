#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:internal-api-boundaries", "check:scheduled-cron-route-wrappers"];
const REQUIRED_CI_COMMANDS = ["npm run check:internal-api-boundaries", "npm run check:scheduled-cron-route-wrappers"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:internal-api-boundaries"', '"check:scheduled-cron-route-wrappers"'];
const REQUIRED_FILE_MARKERS = {
  "src/lib/security/api-guards.ts": [
    'export function requireCronAuthorized(request: Request): NextResponse | null {',
    'return gateCronRequest(request, { headers: API_PRIVATE_NO_STORE_HEADERS });',
    'export function requireBearerSecret(',
    '| "EXTRACTION_WORKER_SECRET"',
    '| "OBLIXA_INTERNAL_DIAG_SECRET";',
  ],
  "src/lib/security/api-guards.test.ts": [
    'describe("requireCronAuthorized", () => {',
    'it("503 when CRON_SECRET unset (misconfiguration, not caller fault)", () => {',
    'it("null when x-cron-secret matches", () => {',
    'describe("requireBearerSecret", () => {',
    'it("supports custom missing-secret responses", () => {',
    'it("supports custom unauthorized responses", () => {',
  ],
  "src/lib/security/internal-hmac.ts": [
    "INTERNAL_HMAC_SIGNATURE_HEADER",
    "INTERNAL_HMAC_TIMESTAMP_HEADER",
    "INTERNAL_HMAC_BODY_SHA256_HEADER",
    "INTERNAL_HMAC_KEY_ID_HEADER",
    "INTERNAL_HMAC_PREVIOUS_SECRET_ENV",
    "INTERNAL_HMAC_PREVIOUS_SECRET_EXPIRES_AT_ENV",
    "signInternalRequest",
    "verifyInternalHmacRequest",
    "timestamp_skew",
    "body_hash_mismatch",
    "previous_secret_expired",
  ],
  "src/lib/security/internal-hmac.test.ts": [
    "accepts previous secret during rotation",
    "previous_secret_expiry_required",
    "previous_secret_expired",
    "rejects missing or unknown key ids",
    "rejects stale timestamps and tampered bodies",
  ],
  "src/app/api/extract/run/route.ts": [
    "readJsonBodyLimitedWithRaw",
    "OBLIXA_INTERNAL_HMAC_SECRET",
    "OBLIXA_INTERNAL_HMAC_PREVIOUS_SECRET",
    "OBLIXA_INTERNAL_HMAC_PREVIOUS_EXPIRES_AT",
    "isStrictSecretRotationEnv",
    "verifyInternalHmacRequest",
    'const auth = requireBearerSecret(request, "EXTRACTION_WORKER_SECRET", {',
    'diagnostic_id: "extract_worker_not_configured"',
    'const _lim = await readJsonBodyLimitedWithRaw(request, BODY_LIMIT_LARGE_JSON);',
    'if (!_lim.ok) return _lim.response;',
  ],
  "src/app/api/extract/run/route.test.ts": [
    'it("returns 401 when bearer token is missing", async () => {',
    'it("accepts timestamped HMAC signed worker requests when configured", async () => {',
    'it("accepts previous HMAC secret only with future expiry metadata", async () => {',
    'it("rejects previous HMAC secret with expired metadata", async () => {',
    'it("rejects stale or missing worker HMAC signatures without falling back to bearer", async () => {',
    'it("returns 400 for invalid ids", async () => {',
    'it("runs pipeline and returns ok for valid request", async () => {',
  ],
  "src/app/api/extract/route.ts": [
    "signInternalRequest",
    "OBLIXA_INTERNAL_HMAC_SECRET",
    "const workerBody = JSON.stringify({",
    "const workerHeaders: Record<string, string>",
  ],
  "src/app/api/internal/debugging-sweep/route.ts": [
    'const auth = requireBearerSecret(request, "OBLIXA_INTERNAL_DIAG_SECRET", {',
    'missingSecretResponse: () =>',
    'errors.push({ code: "UNAUTHORIZED", detail: "invalid or missing bearer" });',
    'const rl = await rateLimitCheck(`internal-debugging-sweep:${ip}`, RATE_LIMITS.internalDebuggingSweep);',
    'const allow = parseInternalDiagAllowlist(process.env.OBLIXA_INTERNAL_DIAG_IP_ALLOWLIST);',
    'clientIpMatchesAllowlist(ip, allow.rules)',
    'deepRedactEmailLikeInUnknown(value)',
    'function sanitizeDiagnosticPayload(value: unknown): unknown {',
  ],
  "src/app/api/internal/debugging-sweep/route.test.ts": [
    'it("returns 404 when endpoint disabled", async () => {',
    'it("returns 404 when internal diagnostics secret is missing", async () => {',
    'it("returns 403 for wrong bearer secret", async () => {',
    'it("returns 429 when internal diagnostics rate limit is exceeded", async () => {',
    'it("returns 403 when allowlist parsing fails closed", async () => {',
    'it("returns 403 for allowlist denial", async () => {',
    'it("returns JSON with kind and sorted keys for allowed secret and allowlisted IP", async () => {',
    'it("redacts sensitive diagnostic payload values", async () => {',
  ],
  "src/lib/debugging-sweep/internal-diag-allowlist.ts": [
    'import { isIP } from "node:net";',
    'function isValidIpv4Cidr(rule: string): boolean {',
    "prefix >= 0 && prefix <= 32",
    "} else if (isIP(r) === 0) {",
  ],
  "src/lib/debugging-sweep/internal-diag-allowlist.test.ts": [
    'it("fails closed on malformed addresses and CIDR prefixes", () => {',
    'expect(parseInternalDiagAllowlist("10.0.0.0/99").ok).toBe(false);',
    'expect(parseInternalDiagAllowlist("999.999.999.999").ok).toBe(false);',
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

export function analyzeInternalApiBoundaries(root = ROOT) {
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
    if (!securityPipeline.includes(step)) {
      issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
    }
  }

  for (const [rel, markers] of Object.entries(REQUIRED_FILE_MARKERS)) {
    if (!fileExists(root, rel)) continue;
    const content = read(root, rel);
    for (const marker of collectMissingMarkers(content, markers)) {
      issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  return { checkId: "internal-api-boundaries", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeInternalApiBoundaries();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
