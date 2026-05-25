import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeInternalApiBoundaries } from "./check-internal-api-boundaries.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeInternalApiBoundaries validates internal worker and diagnostics auth boundaries", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-internal-boundaries-"));
  write(
    root,
    "package.json",
    JSON.stringify({ scripts: { "check:internal-api-boundaries": "x", "check:scheduled-cron-route-wrappers": "x" } })
  );
  write(root, ".github/workflows/ci.yml", "npm run check:internal-api-boundaries\nnpm run check:scheduled-cron-route-wrappers\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:internal-api-boundaries"\n"check:scheduled-cron-route-wrappers"\n');
  write(root, "src/lib/security/api-guards.ts", 'export function requireCronAuthorized(request: Request): NextResponse | null {\nreturn gateCronRequest(request, { headers: API_PRIVATE_NO_STORE_HEADERS });\n}\nexport function requireBearerSecret(\nrequest: Request,\nenvVarName: BearerSecretEnvVarName\n): NextResponse | null {\ntype BearerSecretEnvVarName =\n| "EXTRACTION_WORKER_SECRET"\n| "OBLIXA_INTERNAL_DIAG_SECRET";\nreturn null;\n}\n');
  write(root, "src/lib/security/api-guards.test.ts", 'describe("requireCronAuthorized", () => {\nit("503 when CRON_SECRET unset (misconfiguration, not caller fault)", () => {})\nit("null when x-cron-secret matches", () => {})\n})\ndescribe("requireBearerSecret", () => {\nit("supports custom missing-secret responses", () => {})\nit("supports custom unauthorized responses", () => {})\n})\n');
  write(root, "src/lib/security/internal-hmac.ts", 'export const INTERNAL_HMAC_SIGNATURE_HEADER = "x";\nexport const INTERNAL_HMAC_TIMESTAMP_HEADER = "x";\nexport const INTERNAL_HMAC_BODY_SHA256_HEADER = "x";\nexport const INTERNAL_HMAC_KEY_ID_HEADER = "x";\nexport const INTERNAL_HMAC_PREVIOUS_SECRET_ENV = "OBLIXA_INTERNAL_HMAC_PREVIOUS_SECRET";\nexport const INTERNAL_HMAC_PREVIOUS_SECRET_EXPIRES_AT_ENV = "OBLIXA_INTERNAL_HMAC_PREVIOUS_EXPIRES_AT";\nexport function signInternalRequest() {}\nexport function verifyInternalHmacRequest() {}\nconst a = "timestamp_skew";\nconst b = "body_hash_mismatch";\nconst c = "previous_secret_expired";\n');
  write(root, "src/lib/security/internal-hmac.test.ts", 'it("accepts previous secret during rotation", () => {})\nit("previous_secret_expiry_required", () => {})\nit("previous_secret_expired", () => {})\nit("rejects missing or unknown key ids", () => {})\nit("rejects stale timestamps and tampered bodies", () => {})\n');
  write(root, "src/app/api/extract/run/route.ts", 'readJsonBodyLimitedWithRaw\nOBLIXA_INTERNAL_HMAC_SECRET\nOBLIXA_INTERNAL_HMAC_PREVIOUS_SECRET\nOBLIXA_INTERNAL_HMAC_PREVIOUS_EXPIRES_AT\nisStrictSecretRotationEnv\nverifyInternalHmacRequest\nconst auth = requireBearerSecret(request, "EXTRACTION_WORKER_SECRET", {\ndiagnostic_id: "extract_worker_not_configured"\nmissingSecretResponse: () =>\nNextResponse.json({ error: "Worker not configured" }, { status: 503 }),\n});\nconst _lim = await readJsonBodyLimitedWithRaw(request, BODY_LIMIT_LARGE_JSON);\nif (!_lim.ok) return _lim.response;\n');
  write(root, "src/app/api/extract/run/route.test.ts", 'it("returns 401 when bearer token is missing", async () => {})\nit("accepts timestamped HMAC signed worker requests when configured", async () => {})\nit("accepts previous HMAC secret only with future expiry metadata", async () => {})\nit("rejects previous HMAC secret with expired metadata", async () => {})\nit("rejects stale or missing worker HMAC signatures without falling back to bearer", async () => {})\nit("returns 400 for invalid ids", async () => {})\nit("runs pipeline and returns ok for valid request", async () => {})\n');
  write(root, "src/app/api/extract/route.ts", 'signInternalRequest\nOBLIXA_INTERNAL_HMAC_SECRET\nconst workerBody = JSON.stringify({\nconst workerHeaders: Record<string, string>\n');
  write(root, "src/app/api/internal/debugging-sweep/route.ts", 'const auth = requireBearerSecret(request, "OBLIXA_INTERNAL_DIAG_SECRET", {\nmissingSecretResponse: () => null,\nunauthorizedResponse: () => {\nerrors.push({ code: "UNAUTHORIZED", detail: "invalid or missing bearer" });\nreturn null;\n},\n});\nconst rl = await rateLimitCheck(`internal-debugging-sweep:${ip}`, RATE_LIMITS.internalDebuggingSweep);\nconst allow = parseInternalDiagAllowlist(process.env.OBLIXA_INTERNAL_DIAG_IP_ALLOWLIST);\nclientIpMatchesAllowlist(ip, allow.rules)\nfunction sanitizeDiagnosticPayload(value: unknown): unknown {\ndeepRedactEmailLikeInUnknown(value)\n}\n');
  write(root, "src/app/api/internal/debugging-sweep/route.test.ts", 'it("returns 404 when endpoint disabled", async () => {})\nit("returns 404 when internal diagnostics secret is missing", async () => {})\nit("returns 403 for wrong bearer secret", async () => {})\nit("returns 429 when internal diagnostics rate limit is exceeded", async () => {})\nit("returns 403 when allowlist parsing fails closed", async () => {})\nit("returns 403 for allowlist denial", async () => {})\nit("returns JSON with kind and sorted keys for allowed secret and allowlisted IP", async () => {})\nit("redacts sensitive diagnostic payload values", async () => {})\n');
  write(root, "src/lib/debugging-sweep/internal-diag-allowlist.ts", 'import { isIP } from "node:net";\nfunction isValidIpv4Cidr(rule: string): boolean {\nreturn prefix >= 0 && prefix <= 32\n}\n} else if (isIP(r) === 0) {\n');
  write(root, "src/lib/debugging-sweep/internal-diag-allowlist.test.ts", 'it("fails closed on malformed addresses and CIDR prefixes", () => {\nexpect(parseInternalDiagAllowlist("10.0.0.0/99").ok).toBe(false);\nexpect(parseInternalDiagAllowlist("999.999.999.999").ok).toBe(false);\n})\n');

  const report = analyzeInternalApiBoundaries(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
