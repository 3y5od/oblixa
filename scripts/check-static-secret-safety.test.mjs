import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { analyzeStaticSecretSafety } from "./check-static-secret-safety.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-static-secret-safety-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeAllowlist(root, extra = "") {
  write(
    root,
    "scripts/static-secret-placeholder-allowlist.json",
    `{
  "schemaVersion": 1,
  "entries": [
    {
      "marker": "security:test-fixture-secret-placeholder",
      "owner": "security",
      "reason": "fake placeholder fixture"
      ${extra}
    }
  ]
}
`,
  );
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function fakeJwt(payload) {
  return `${base64UrlJson({ alg: "HS256", typ: "JWT" })}.${base64UrlJson(payload)}.${"a".repeat(32)}`;
}

test("analyzeStaticSecretSafety accepts safe files and allowlist metadata", () => {
  const root = makeRoot();
  writeAllowlist(root);
  write(root, "src/safe.ts", 'export const example = "no secrets here";\n');

  const report = analyzeStaticSecretSafety(root, { includeAggregates: false, files: ["src/safe.ts"] });

  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.allowlist.markerCount, 1);
});

test("analyzeStaticSecretSafety rejects Supabase DB URLs with embedded credentials", () => {
  const root = makeRoot();
  writeAllowlist(root);
  write(root, "scripts/example.txt", "DATABASE_URL=postgresql://postgres:actual-password@db.abcdefghijklmnop.supabase.co:5432/postgres\n"); // security:test-fixture-secret-placeholder

  const report = analyzeStaticSecretSafety(root, { includeAggregates: false, files: ["scripts/example.txt"] });

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "supabase_db_url_embeds_credentials"));
  assert(!JSON.stringify(report.issues).includes("actual-password"));
});

test("analyzeStaticSecretSafety rejects service-role-shaped Supabase JWTs", () => {
  const root = makeRoot();
  writeAllowlist(root);
  write(root, "src/token.txt", `SUPABASE_SERVICE_ROLE_KEY=${fakeJwt({ role: "service_role", iss: "supabase" })}\n`); // security:test-fixture-secret-placeholder

  const report = analyzeStaticSecretSafety(root, { includeAggregates: false, files: ["src/token.txt"] });

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "supabase_service_role_jwt"));
});

test("analyzeStaticSecretSafety rejects provider webhook secrets", () => {
  const root = makeRoot();
  writeAllowlist(root);
  write(root, "src/webhook.txt", "STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdefghijklmnop\n"); // security:test-fixture-secret-placeholder

  const report = analyzeStaticSecretSafety(root, { includeAggregates: false, files: ["src/webhook.txt"] });

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "provider_webhook_secret"));
});

test("analyzeStaticSecretSafety allows explicitly marked fake placeholders", () => {
  const root = makeRoot();
  writeAllowlist(root);
  write(
    root,
    "scripts/fixture.txt",
    "DATABASE_URL=postgresql://postgres:fake-password@db.abcdefghijklmnop.supabase.co/postgres # security:test-fixture-secret-placeholder\n",
  );

  const report = analyzeStaticSecretSafety(root, { includeAggregates: false, files: ["scripts/fixture.txt"] });

  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
});

test("analyzeStaticSecretSafety rejects allowlist entries that store secret values", () => {
  const root = makeRoot();
  writeAllowlist(root, ',\n      "secret": "do-not-store-values-here"');
  write(root, "src/safe.ts", "export {};\n");

  const report = analyzeStaticSecretSafety(root, { includeAggregates: false, files: ["src/safe.ts"] });

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "secret_placeholder_allowlist_entry_must_not_store_secret_values"));
});
