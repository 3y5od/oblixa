import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzePublicTokenPolicy } from "./check-public-token-policy.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzePublicTokenPolicy validates public-token inventory and signed-link controls", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-public-token-policy-"));
  write(
    root,
    "artifacts/security-route-matrix.json",
    JSON.stringify([
      { path: "/api/export/calendar/feed/[token]", method: "GET", auth_type: "public_token", rate_limit_policy: "explicit", rate_limit_key_shape: "org_route", idempotency_or_job_lock_policy: "not_applicable" },
      { path: "/api/external-actions/[token]/participant/workflow-step", method: "POST", auth_type: "public_token", rate_limit_policy: "explicit", rate_limit_key_shape: "token", idempotency_or_job_lock_policy: "idempotency_or_duplicate_guard" },
      { path: "/api/external-actions/[token]/status", method: "GET", auth_type: "public_token", rate_limit_policy: "explicit", rate_limit_key_shape: "token", idempotency_or_job_lock_policy: "not_applicable" },
      { path: "/api/external-actions/[token]/submit", method: "POST", auth_type: "public_token", rate_limit_policy: "explicit", rate_limit_key_shape: "token", idempotency_or_job_lock_policy: "idempotency_or_duplicate_guard" },
      { path: "/api/external-actions/[token]/workflow-step", method: "POST", auth_type: "public_token", rate_limit_policy: "explicit", rate_limit_key_shape: "org_user", idempotency_or_job_lock_policy: "idempotency_or_duplicate_guard" },
      { path: "/api/external-actions/create-link", method: "POST", auth_type: "public_token", rate_limit_policy: "workspace_gate_explicit", rate_limit_key_shape: "org_user", idempotency_or_job_lock_policy: "idempotency_or_duplicate_guard" },
      { path: "/api/reports/track/click/[token]", method: "GET", auth_type: "public_token", rate_limit_policy: "explicit", rate_limit_key_shape: "token", idempotency_or_job_lock_policy: "not_applicable" },
      { path: "/api/reports/track/open/[token]", method: "GET", auth_type: "public_token", rate_limit_policy: "explicit", rate_limit_key_shape: "token", idempotency_or_job_lock_policy: "not_applicable" }
    ])
  );
  write(root, "src/lib/security/public-token-key.ts", 'export function publicTokenHash(token: string): string {}\nexport function publicTokenPrefix(token: string): string {}\nexport function publicTokenStableKey(token: string): string {}\nexport function publicTokenHashMatches(storedHash: unknown, tokenHash: string): boolean {}\ntimingSafeEqual(Buffer.from(stored\n');
  write(root, "src/lib/v5/api.ts", 'export function externalActionTokenHash(token: string): string {}\nexport function externalActionTokenPrefix(token: string): string {}\nexport function externalActionTokenStableKey(token: string): string {}\nexport function externalActionTokenStorageFields(token: string) {}\nexport function externalActionTokenMatches(row: { token_hash?: unknown }, token: string): boolean {}\npublicTokenHashMatches(row.token_hash, hash)\n');
  write(root, "src/app/api/external-actions/create-link/route.ts", 'randomBytes(24).toString("hex")\nisSensitiveExternalActionType(actionType)\ntoken: null,\ntoken_hash: tokenHash,\ntoken_prefix: tokenPrefix,\nexpires_at: expiresAt,\nrequires_reauth: requiresReauth,\nPRIVATE_NO_STORE_HEADERS\n');
  write(root, "supabase/migrations/069_external_action_link_token_hashes.sql", 'alter table public.external_action_links\nadd column if not exists token_prefix text\nadd column if not exists token_hash text\nidx_external_action_links_token_hash_unique\n');
  write(root, "supabase/migrations/071_public_token_hash_only.sql", 'external_action_links_plaintext_token_null\ncalendar_feeds_plaintext_token_null\nset token = null\nvalidate constraint\n');
  write(root, "supabase/migrations/075_report_tracking_token_hashes.sql", 'engagement_token_prefix\nengagement_token_hash\nreport_run_recipients_plaintext_engagement_token_null\nset engagement_token = null\nvalidate constraint\n');
  write(root, "src/app/api/external-actions/[token]/status/route.ts", 'externalActionTokenHash(token)\nexternalActionTokenPrefix(token)\nexternalActionTokenStableKey(token)\nexternalActionTokenMatches(row, token)\neffectiveStatus = expired && data.status === "open" ? "expired" : data.status\nreturn jsonNotFound(ROUTE)\nexternal-status:token-hash:${tokenKey}\nPRIVATE_NO_STORE_HEADERS\n');
  write(root, "src/app/api/external-actions/[token]/submit/route.ts", 'externalActionTokenHash(token)\nexternalActionTokenPrefix(token)\nexternalActionTokenStableKey(token)\nexternalActionTokenMatches(row, token)\nif (link.expires_at < nowIso())\nif (link.status === "submitted")\nscope: "external-action.submit"\nactorKey: tokenKey\nexternal-submit:token-hash:${tokenKey}\nPRIVATE_NO_STORE_HEADERS\n');
  write(root, "src/app/api/external-actions/[token]/participant/workflow-step/route.ts", 'externalActionTokenHash(token)\nexternalActionTokenPrefix(token)\nexternalActionTokenStableKey(token)\nexternalActionTokenMatches(row, token)\nif (link.expires_at && link.expires_at < nowIso())\nscope: "external-workflow.participant-step"\nactorKey: tokenKey\nexternal-participant-workflow:token-hash:${tokenKey}\nPRIVATE_NO_STORE_HEADERS\n');
  write(root, "src/app/api/external-actions/[token]/workflow-step/route.ts", 'externalActionTokenHash(token)\nexternalActionTokenPrefix(token)\nexternalActionTokenStableKey(token)\nexternalActionTokenMatches(row, token)\n.eq("organization_id", ctx.orgId)\nscope: "external-workflow.internal-step"\nactorKey: `${ctx.orgId}:${ctx.userId}:${tokenKey}`\nPRIVATE_NO_STORE_HEADERS\n');
  write(root, "src/app/api/export/calendar/feed/[token]/route.ts", 'token_hash\ntoken_prefix\npublicTokenStableKey(token)\nrevoked_at\nsecureCompareUtf8(row.token_hash, tokenHash)\nreturn jsonNotFound(ROUTE)\ncalendar-feed-read:${ip}\ncalendar-feed-read:token-hash:${tokenKey}\n"Cache-Control": "no-store"\n');
  write(root, "src/app/api/reports/send-summaries/route.ts", 'engagement_token: null\nengagement_token_hash: engagementToken ? publicTokenHash(engagementToken) : null\nengagement_token_prefix: engagementToken ? publicTokenPrefix(engagementToken) : null\n');
  write(root, "src/app/api/reports/track/open/[token]/route.ts", 'if (!token || token.length < 8)\nreturn pixelResponse(200)\nreport-track-open:${ip}\nreport-track-open:token-hash:${tokenKey}\npublicTokenHashMatches(candidate.engagement_token_hash, tokenHash)\n.eq("engagement_token_hash", tokenHash)\n"Cache-Control": "no-store"\n');
  write(root, "src/app/api/reports/track/click/[token]/route.ts", 'if (token && token.length >= 8)\ngetSafeTarget(request)\nnormalizeClickedTargetForStorage(target)\nreport-track-click:${ip}\nreport-track-click:token-hash:${tokenKey}\npublicTokenHashMatches(candidate.engagement_token_hash, tokenHash)\n.eq("engagement_token_hash", tokenHash)\nres.headers.set("Cache-Control", "no-store")\n');

  const report = analyzePublicTokenPolicy(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
