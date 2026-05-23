import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeTrackedSecretsHygiene } from "./check-tracked-secrets-hygiene.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeValidFixture(root) {
  write(root, ".gitignore", ".env*\n!.env.example\ncoverage/\n*.pem\n");
  write(
    root,
    ".env.example",
    [
      "NEXT_PUBLIC_APP_URL=http://localhost:3000",
      "NEXT_PUBLIC_SUPABASE_URL=",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY=",
      "SUPABASE_SERVICE_ROLE_KEY=",
      "OPENAI_API_KEY=",
      "CRON_SECRET=",
      "# STRIPE_WEBHOOK_SECRET=",
      "# OPENAI_EXTRACTION_MODEL=gpt-4o-mini",
      "",
    ].join("\n")
  );
}

test("analyzeTrackedSecretsHygiene accepts safe env ignore and empty secret samples", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-tracked-secrets-ok-"));
  writeValidFixture(root);
  const report = analyzeTrackedSecretsHygiene(root, {
    trackedFiles: ["package.json", ".env.example", "src/index.ts"],
  });
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.issueCount, 0);
});

test("analyzeTrackedSecretsHygiene rejects tracked env, key, and coverage files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-tracked-secrets-files-"));
  writeValidFixture(root);
  const report = analyzeTrackedSecretsHygiene(root, {
    trackedFiles: [".env.production", "certs/local.pem", "coverage/index.html"],
  });
  assert.equal(report.ok, false);
  assert(report.issues.some((i) => i.issue === "tracked_env_file" && i.file === ".env.production"));
  assert(report.issues.some((i) => i.issue === "tracked_key_material" && i.file === "certs/local.pem"));
  assert(report.issues.some((i) => i.issue === "tracked_coverage_output" && i.file === "coverage/index.html"));
});

test("analyzeTrackedSecretsHygiene rejects missing or unsafe env ignore rules", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-tracked-secrets-ignore-"));
  write(root, ".gitignore", ".env.local\n!.env.local\n!.env.example\n.env*\n");
  write(root, ".env.example", "CRON_SECRET=\n");
  const report = analyzeTrackedSecretsHygiene(root, { trackedFiles: [".env.example"] });
  assert.equal(report.ok, false);
  assert(report.issues.some((i) => i.issue === "unsafe_env_unignore_pattern" && i.pattern === "!.env.local"));
  assert(report.issues.some((i) => i.issue === "env_example_unignore_shadowed"));
});

test("analyzeTrackedSecretsHygiene rejects real-looking .env.example secret values", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-tracked-secrets-env-example-"));
  write(root, ".gitignore", ".env*\n!.env.example\n");
  const openAiLike = `sk-proj-${"abcdefghijklmnopqrstuvwxyz"}${"ABCDEFGHIJKLMNOPQRSTUVWXYZ"}${"0123456789"}`;
  const jwtLike = `${"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"}.${"eyJzdWIiOiIxMjM0NTY3ODkwIn0"}.${"signaturevalue"}`;
  write(
    root,
    ".env.example",
    [
      `OPENAI_API_KEY=${openAiLike}`,
      "DATABASE_URL=postgres://user:password@example.com/db",
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=${jwtLike}`,
      "",
    ].join("\n")
  );
  const report = analyzeTrackedSecretsHygiene(root, { trackedFiles: [".env.example"] });
  assert.equal(report.ok, false);
  assert(report.issues.some((i) => i.issue === "env_example_secret_value_must_be_empty" && i.key === "OPENAI_API_KEY"));
  assert(report.issues.some((i) => i.issue === "env_example_url_embeds_credentials" && i.key === "DATABASE_URL"));
  assert(report.issues.some((i) => i.issue === "env_example_secret_value_must_be_empty" && i.key === "NEXT_PUBLIC_SUPABASE_ANON_KEY"));
});
