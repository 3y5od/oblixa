import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeOAuthStateIntegrity } from "./check-oauth-state-integrity.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeOAuthStateIntegrity validates persisted/consumed state handling", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-oauth-state-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:oauth-state-integrity": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:oauth-state-integrity\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:oauth-state-integrity"\n');
  write(root, "src/app/api/integrations/oauth/start/route.ts", 'const state = randomBytes(16).toString("hex")\n.from("integration_oauth_states").insert({\nrequested_by: user.id,\nexpires_at: expiresAt,\nredirect_uri: redirect.toString(),\n})\n');
  write(root, "src/app/api/integrations/oauth/callback/route.ts", '.from("integration_oauth_states")\n.eq("state", state)\nif (!authState) return NextResponse.json({ error: "Invalid state" }, { status: 400 })\nif (authState.consumed_at){}\nif (new Date(authState.expires_at).getTime() < Date.now()){}\n.update({ consumed_at: new Date().toISOString() })\n');
  write(root, "src/app/api/integrations/oauth/start/route.test.ts", 'it("returns 500 when oauth state insert fails", () => {})\nit("blocks duplicate replay of oauth start with x-idempotency-key", () => {})\n');
  write(root, "src/app/api/integrations/oauth/callback/route.test.ts", 'it("returns 400 when oauth state row is missing (invalid state)", () => {})\nexpect(body).toEqual({ error: "Invalid state" })\nexpect(body).toEqual({ error: "Failed to load oauth state" })\n');

  const report = analyzeOAuthStateIntegrity(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});