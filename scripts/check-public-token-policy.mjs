#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

const REQUIRED_PUBLIC_TOKEN_ROUTES = new Set([
  "/api/export/calendar/feed/[token]:GET",
  "/api/external-actions/[token]/participant/workflow-step:POST",
  "/api/external-actions/[token]/status:GET",
  "/api/external-actions/[token]/submit:POST",
  "/api/external-actions/[token]/workflow-step:POST",
  "/api/external-actions/create-link:POST",
  "/api/reports/track/click/[token]:GET",
  "/api/reports/track/open/[token]:GET",
]);

const REQUIRED_MARKERS = {
  "src/lib/security/public-token-key.ts": [
    "export function publicTokenHash(token: string): string",
    "export function publicTokenPrefix(token: string): string",
    "export function publicTokenStableKey(token: string): string",
    "export function publicTokenHashMatches(storedHash: unknown, tokenHash: string): boolean",
    "timingSafeEqual(Buffer.from(stored",
  ],
  "src/lib/security/public-token-telemetry.ts": [
    "export function recordPublicTokenMiss",
    "[security-event:public-token-miss]",
    "lookup_key",
    "formatUnknownForServerLog",
  ],
  "src/lib/security/public-token-telemetry.test.ts": [
    "logs token misses without raw bearer token material",
  ],
  "src/lib/v5/api.ts": [
    "export function externalActionTokenHash(token: string): string",
    "export function externalActionTokenPrefix(token: string): string",
    "export function externalActionTokenStableKey(token: string): string",
    "export function externalActionTokenStorageFields(token: string)",
    "export function externalActionTokenMatches(row: { token_hash?: unknown }, token: string): boolean",
    "publicTokenHashMatches(row.token_hash, hash)",
  ],
  "src/app/api/external-actions/create-link/route.ts": [
    "randomBytes(24).toString(\"hex\")",
    "isSensitiveExternalActionType(actionType)",
    "token: null,",
    "token_hash: tokenHash,",
    "token_prefix: tokenPrefix,",
    "expires_at: expiresAt,",
    "requires_reauth: requiresReauth,",
    "PRIVATE_NO_STORE_HEADERS",
  ],
  "supabase/migrations/069_external_action_link_token_hashes.sql": [
    "alter table public.external_action_links",
    "add column if not exists token_prefix text",
    "add column if not exists token_hash text",
    "idx_external_action_links_token_hash_unique",
  ],
  "supabase/migrations/071_public_token_hash_only.sql": [
    "external_action_links_plaintext_token_null",
    "calendar_feeds_plaintext_token_null",
    "set token = null",
    "validate constraint",
  ],
  "supabase/migrations/075_report_tracking_token_hashes.sql": [
    "engagement_token_prefix",
    "engagement_token_hash",
    "report_run_recipients_plaintext_engagement_token_null",
    "set engagement_token = null",
    "validate constraint",
  ],
  "supabase/migrations/076_report_tracking_token_revocation.sql": [
    "engagement_revoked_at timestamptz",
    "idx_report_run_recipients_engagement_revoked",
  ],
  "supabase/migrations/077_external_action_token_revocation_metadata.sql": [
    "add column if not exists revoked_at timestamptz",
    "add column if not exists revoked_by uuid references auth.users(id)",
    "external_action_links_revoked_metadata_consistency",
    "idx_external_action_links_token_revoked",
  ],
  "src/app/api/external-actions/[token]/status/route.ts": [
    "externalActionTokenHash(token)",
    "externalActionTokenPrefix(token)",
    "externalActionTokenStableKey(token)",
    "externalActionTokenMatches(row, token)",
    "revoked_at",
    "effectiveStatus = expired && data.status === \"open\" ? \"expired\" : data.status",
    "return jsonNotFound(ROUTE)",
    "recordPublicTokenMiss({ surface: \"external_action\"",
    "external_action_status_revoked",
    "external-status:token-hash:${tokenKey}",
    "PRIVATE_NO_STORE_HEADERS",
  ],
  "src/app/api/external-actions/[token]/submit/route.ts": [
    "externalActionTokenHash(token)",
    "externalActionTokenPrefix(token)",
    "externalActionTokenStableKey(token)",
    "externalActionTokenMatches(row, token)",
    "revoked_at",
    "if (link.expires_at < nowIso())",
    "external_action_submit_revoked",
    "recordPublicTokenMiss({ surface: \"external_action\"",
    "if (link.status === \"submitted\")",
    "scope: \"external-action.submit\"",
    "actorKey: tokenKey",
    "external-submit:token-hash:${tokenKey}",
    "PRIVATE_NO_STORE_HEADERS",
  ],
  "src/app/api/external-actions/[token]/participant/workflow-step/route.ts": [
    "externalActionTokenHash(token)",
    "externalActionTokenPrefix(token)",
    "externalActionTokenStableKey(token)",
    "externalActionTokenMatches(row, token)",
    "revoked_at",
    "if (link.expires_at && link.expires_at < nowIso())",
    "external_action_participant_revoked",
    "recordPublicTokenMiss({ surface: \"external_action\"",
    "scope: \"external-workflow.participant-step\"",
    "actorKey: tokenKey",
    "external-participant-workflow:token-hash:${tokenKey}",
    "PRIVATE_NO_STORE_HEADERS",
  ],
  "src/app/api/external-actions/[token]/workflow-step/route.ts": [
    "externalActionTokenHash(token)",
    "externalActionTokenPrefix(token)",
    "externalActionTokenStableKey(token)",
    "externalActionTokenMatches(row, token)",
    "revoked_at",
    "external_action_workflow_revoked",
    "external_action_workflow_expired",
    ".eq(\"organization_id\", ctx.orgId)",
    "scope: \"external-workflow.internal-step\"",
    "actorKey: `${ctx.orgId}:${ctx.userId}:${tokenKey}`",
    "PRIVATE_NO_STORE_HEADERS",
  ],
  "src/app/api/export/calendar/feed/[token]/route.ts": [
    "token_hash",
    "token_prefix",
    "publicTokenStableKey(token)",
    "revoked_at",
    "recordPublicTokenMiss({ surface: \"calendar_feed\"",
    "secureCompareUtf8(row.token_hash, tokenHash)",
    ".eq(\"organization_id\", feed.organization_id)",
    "return jsonNotFound(ROUTE)",
    "calendar-feed-read:${ip}",
    "calendar-feed-read:token-hash:${tokenKey}",
    "\"Cache-Control\": \"no-store\"",
  ],
  "src/app/api/reports/send-summaries/route.ts": [
    "engagement_token: null",
    "engagement_token_hash: engagementToken ? publicTokenHash(engagementToken) : null",
    "engagement_token_prefix: engagementToken ? publicTokenPrefix(engagementToken) : null",
  ],
  "src/app/api/reports/track/open/[token]/route.ts": [
    "if (!token || token.length < 8)",
    "return pixelResponse(200)",
    "report-track-open:${ip}",
    "report-track-open:token-hash:${tokenKey}",
    "publicTokenHashMatches(candidate.engagement_token_hash, tokenHash)",
    "engagement_revoked_at",
    "recordPublicTokenMiss({ surface: \"report_open\"",
    ".eq(\"engagement_token_hash\", tokenHash)",
    "\"Cache-Control\": \"no-store\"",
  ],
  "src/app/api/reports/track/click/[token]/route.ts": [
    "if (token && token.length >= 8)",
    "getSafeTarget(request)",
    "normalizeClickedTargetForStorage(target)",
    "report-track-click:${ip}",
    "report-track-click:token-hash:${tokenKey}",
    "publicTokenHashMatches(candidate.engagement_token_hash, tokenHash)",
    "engagement_revoked_at",
    "recordPublicTokenMiss({ surface: \"report_click\"",
    ".eq(\"engagement_token_hash\", tokenHash)",
    "res.headers.set(\"Cache-Control\", \"no-store\")",
  ],
};

const FORBIDDEN_MARKERS = {
  "src/lib/v5/api.ts": ["legacyToken", "token?: unknown"],
  "src/app/api/external-actions/[token]/status/route.ts": [
    "token.eq.${token}",
    ".eq(\"token\", token)",
    "external-status:token:${token}",
  ],
  "src/app/api/external-actions/[token]/submit/route.ts": [
    "token.eq.${token}",
    ".eq(\"token\", token)",
    "external-submit:token:${token}",
    "actorKey: token,",
  ],
  "src/app/api/external-actions/[token]/participant/workflow-step/route.ts": [
    "token.eq.${token}",
    ".eq(\"token\", token)",
    "external-participant-workflow:token:${token}",
    "actorKey: token,",
  ],
  "src/app/api/external-actions/[token]/workflow-step/route.ts": [
    "token.eq.${token}",
    ".eq(\"token\", token)",
    "actorKey: `${ctx.orgId}:${ctx.userId}:${token}`",
  ],
  "src/app/api/export/calendar/feed/[token]/route.ts": ["token.eq.${token}", "legacyMatch", "row.token &&"],
  "src/app/api/export/calendar/feed/route.ts": ["existing?.token", "select(\"id, token,"],
  "src/app/api/reports/send-summaries/route.ts": ["engagement_token: recipientTokens.get(recipient)"],
  "src/app/api/reports/track/open/[token]/route.ts": [".eq(\"engagement_token\", token)"],
  "src/app/api/reports/track/click/[token]/route.ts": [".eq(\"engagement_token\", token)"],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

export function analyzePublicTokenPolicy(root = ROOT) {
  const issues = [];

  const matrixPath = path.join(root, "artifacts", "security-route-matrix.json");
  if (!fs.existsSync(matrixPath)) {
    issues.push({ issue: "missing_security_route_matrix" });
  } else {
    const rows = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
    const publicTokenRows = rows.filter((row) => row.auth_type === "public_token");
    const actual = new Set(publicTokenRows.map((row) => `${row.path}:${row.method}`));
    for (const expected of REQUIRED_PUBLIC_TOKEN_ROUTES) {
      if (!actual.has(expected)) issues.push({ issue: "missing_public_token_inventory_row", route: expected });
    }
    for (const row of publicTokenRows) {
      const routeKey = `${row.path}:${row.method}`;
      const acceptableRateLimitPolicies =
        routeKey === "/api/external-actions/create-link:POST"
          ? ["explicit", "workspace_gate_explicit"]
          : ["explicit"];
      if (!acceptableRateLimitPolicies.includes(row.rate_limit_policy)) {
        issues.push({ issue: "public_token_route_missing_explicit_rate_limit", route: `${row.path}:${row.method}` });
      }
      if (!["token", "org_user", "org_route"].includes(row.rate_limit_key_shape)) {
        issues.push({ issue: "public_token_route_weak_rate_limit_key", route: `${row.path}:${row.method}`, keyShape: row.rate_limit_key_shape });
      }
      if (row.method !== "GET" && row.idempotency_or_job_lock_policy !== "idempotency_or_duplicate_guard") {
        issues.push({ issue: "public_token_mutation_missing_replay_guard", route: `${row.path}:${row.method}` });
      }
    }
  }

  for (const [rel, markers] of Object.entries(REQUIRED_MARKERS)) {
    if (!exists(root, rel)) {
      issues.push({ issue: "missing_required_file", rel });
      continue;
    }
    const source = read(root, rel);
    for (const marker of markers) {
      if (!source.includes(marker)) issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  for (const [rel, markers] of Object.entries(FORBIDDEN_MARKERS)) {
    if (!exists(root, rel)) continue;
    const source = read(root, rel);
    for (const marker of markers) {
      if (source.includes(marker)) issues.push({ issue: "forbidden_marker", rel, marker });
    }
  }

  return { checkId: "public-token-policy", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzePublicTokenPolicy();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
