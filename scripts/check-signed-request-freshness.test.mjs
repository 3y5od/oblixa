import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeSignedRequestFreshness } from "./check-signed-request-freshness.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeSignedRequestFreshness validates expiry, revocation, and one-time consumption anchors", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-signed-request-freshness-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:signed-request-freshness": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:signed-request-freshness\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:signed-request-freshness"\n');
  write(root, "src/app/auth/callback/route.ts", '.select("id, organization_id, email, role, expires_at, consumed_at, revoked_at")\nif (inv.consumed_at ||\ninv.revoked_at ||\nnew Date(inv.expires_at).getTime() < Date.now()) {}\n.update({ consumed_at: new Date().toISOString() })\n');
  write(root, "src/app/auth/refinement-auth-callback.test.ts", 'it("rejects invite callbacks when the signed-in email does not match the invite target", async () => {})\nit("rejects invite callbacks when the invite is expired", async () => {})\n');
  write(root, "src/app/api/integrations/oauth/callback/route.ts", '.select(\n"id, organization_id, provider, requested_by, consumed_at, expires_at, redirect_uri, code_verifier, code_challenge_method"\n)\nif (authState.consumed_at) {\ncode: "state_already_used"\n}\nif (new Date(authState.expires_at).getTime() < Date.now()) {\ncode: "state_expired"\n}\n.update({ consumed_at: new Date().toISOString() })\n');
  write(root, "src/app/api/integrations/oauth/callback/route.test.ts", 'it("returns 400 when oauth state already used", async () => {})\nit("returns 400 when oauth state is expired", async () => {})\n');
  write(root, "src/app/api/export/calendar/feed/[token]/route.ts", '.select("id, organization_id, active, token_hash, expires_at, revoked_at")\nconst feedCandidate = (feedRows ?? []).find((row) => !!row.token_hash && secureCompareUtf8(row.token_hash, tokenHash));\nconst expired = !!row.expires_at && new Date(row.expires_at).getTime() <= Date.now();\nif (!row.active || row.revoked_at) {\nrecordPublicTokenMiss({ surface: "calendar_feed"\n');
  write(root, "src/app/api/export/calendar/feed/[token]/route.test.ts", 'it("returns 404 when token is not found", async () => {})\nit("returns 404 when feed is expired or revoked", async () => {})\n');
  write(root, "src/app/api/external-actions/[token]/submit/route.ts", 'if (link.expires_at < nowIso()) {\n.from("external_action_links")\n.update({ status: "expired" })\ncode: "external_action_expired",\n}\nif (link.status === "submitted") {\n}\n');
  write(root, "src/app/api/external-actions/[token]/submit/route.test.ts", 'it("returns 409 when one-time link already submitted", async () => {})\nit("returns 410 when external action link is expired", async () => {})\n');

  const report = analyzeSignedRequestFreshness(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
