import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  analyzeSupabaseRetentionInventory,
  buildSupabaseRetentionInventory,
} from "./check-supabase-retention-inventory.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-retention-inventory-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeFixture(root, options = {}) {
  const includeIndex = options.includeIndex !== false;
  const cronAuthenticated = options.cronAuthenticated !== false;
  const scheduled = options.scheduled !== false;

  write(
    root,
    "src/lib/security/retention-policy.ts",
    `export const CODE_OWNED_RETENTION_POLICIES = [
  {
    dataClass: "oauth_callback_state",
    table: "integration_oauth_states",
    timestampField: "expires_at",
    retentionDays: 7,
    strategy: "delete_expired",
    cleanupRpc: "cleanup_code_owned_transient_data",
    fields: ["state", "code_verifier"],
  },
];
`,
  );
  write(
    root,
    "supabase/migrations/001_retention.sql",
    `create table public.integration_oauth_states (
  id uuid primary key,
  expires_at timestamptz not null
);
${includeIndex ? "create index if not exists idx_integration_oauth_states_expires_at on public.integration_oauth_states (expires_at);\n" : ""}
create or replace function public.cleanup_code_owned_transient_data(retention_cutoff timestamptz default now())
returns jsonb
language plpgsql
as $$
begin
  delete from public.integration_oauth_states where expires_at < retention_cutoff;
  return '{}'::jsonb;
end $$;
`,
  );
  write(
    root,
    "src/app/api/cron/security/retention-cleanup/route.ts",
    cronAuthenticated
      ? `import { withCronRoute } from "@/lib/cron/route-runner";
export const GET = withCronRoute({
  route: "/api/cron/security/retention-cleanup",
  handler: async ({ admin }) => {
    const retentionCutoff = new Date().toISOString();
    return admin.rpc("cleanup_code_owned_transient_data", { retention_cutoff: retentionCutoff });
  },
});
`
      : `export async function GET() {
  return Response.json({ ok: true, rpc: "cleanup_code_owned_transient_data" });
}
`,
  );
  write(
    root,
    "vercel.json",
    JSON.stringify(
      scheduled
        ? { crons: [{ path: "/api/cron/security/retention-cleanup", schedule: "0 * * * *" }] }
        : { crons: [] },
      null,
      2,
    ),
  );
}

test("buildSupabaseRetentionInventory reports retained tables, cleanup route, index, and cron auth coverage", () => {
  const root = makeRoot();
  writeFixture(root);

  const inventory = buildSupabaseRetentionInventory(root);

  assert.equal(inventory.policyCount, 1);
  assert.equal(inventory.cleanupRouteCronAuthenticated, true);
  assert.equal(inventory.cleanupRouteIdempotencyGuarded, true);
  assert.equal(inventory.cleanupRouteScheduled, true);
  assert.equal(inventory.tables[0].table, "integration_oauth_states");
  assert.equal(inventory.tables[0].cleanupIndexPresent, true);
  assert.equal(inventory.tables[0].cleanupRpcReferenced, true);
});

test("analyzeSupabaseRetentionInventory accepts a matching committed inventory", () => {
  const root = makeRoot();
  writeFixture(root);
  const artifactRel = "artifacts/supabase/data-retention-inventory.json";
  write(root, artifactRel, `${JSON.stringify(buildSupabaseRetentionInventory(root), null, 2)}\n`);

  const report = analyzeSupabaseRetentionInventory({ root, inventoryRel: artifactRel });

  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.issueCount, 0);
});

test("analyzeSupabaseRetentionInventory rejects missing cleanup index, cron auth, idempotency guard, and schedule", () => {
  const root = makeRoot();
  writeFixture(root, { includeIndex: false, cronAuthenticated: false, scheduled: false });
  const artifactRel = "artifacts/supabase/data-retention-inventory.json";
  write(root, artifactRel, `${JSON.stringify(buildSupabaseRetentionInventory(root), null, 2)}\n`);

  const report = analyzeSupabaseRetentionInventory({ root, inventoryRel: artifactRel });

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "retention_cleanup_index_missing"));
  assert(report.issues.some((issue) => issue.issue === "retention_cleanup_route_missing_cron_auth"));
  assert(report.issues.some((issue) => issue.issue === "retention_cleanup_route_idempotency_not_guarded"));
  assert(report.issues.some((issue) => issue.issue === "retention_cleanup_route_missing_schedule"));
});
