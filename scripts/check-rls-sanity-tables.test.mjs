import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeRlsSanityTables } from "./check-rls-sanity-tables.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeBase(root, { includeForce = true, includeSmoke = true, artifactTables = ["tenant_records"] } = {}) {
  write(root, "package.json", JSON.stringify({ scripts: { "check:rls-sanity-tables": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:rls-sanity-tables\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:rls-sanity-tables"\n');
  write(
    root,
    "supabase/migrations/001_tenant.sql",
    `create table public.tenant_records (
  id uuid primary key,
  organization_id uuid not null
);
alter table public.tenant_records enable row level security;
create policy "Members can view tenant records"
  on public.tenant_records for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));
create policy "Editors can manage tenant records"
  on public.tenant_records for all
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));
`
  );
  write(
    root,
    "artifacts/assurance/rls-sanity-tables.json",
    JSON.stringify(
      {
        version: 2,
        generated_from: "supabase/migrations",
        service_role_bypass: "service_role bypass remains explicit via Supabase service role clients only",
        tables: artifactTables,
      },
      null,
      2
    )
  );
  if (includeForce) {
    write(
      root,
      "supabase/migrations/072_force_rls_tenant_tables.sql",
      "relrowsecurity\nforce row level security\nNo direct tenant insert by default\nNo direct tenant update by default\nNo direct tenant delete by default\nservice_role bypass remains explicit\n"
    );
  }
  if (includeSmoke) {
    write(
      root,
      "supabase/tests/rls_sanity_smoke.sql",
      "begin;\nset local role authenticated;\nselect set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001', true);\n-- same_org_allowed\n-- cross_org_denied\nrollback;\n"
    );
    write(
      root,
      "supabase/tests/rls_default_deny_smoke.sql",
      "begin;\nset local role anon;\n-- anon_direct_insert_denied\nset local role authenticated;\n-- authenticated_direct_update_denied\n-- authenticated_direct_delete_denied\n-- RLS default-deny smoke checks failed\nrollback;\n"
    );
  }
}

test("analyzeRlsSanityTables accepts tenant inventory, force RLS, policies, and smoke coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-rls-ok-"));
  writeBase(root);
  const report = analyzeRlsSanityTables(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.tenantTableCount, 1);
});

test("analyzeRlsSanityTables rejects empty inventory plus missing force and smoke coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-rls-missing-"));
  writeBase(root, { includeForce: false, includeSmoke: false, artifactTables: [] });
  const report = analyzeRlsSanityTables(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "rls_inventory_empty"));
  assert(report.issues.some((issue) => issue.issue === "rls_inventory_drift"));
  assert(report.issues.some((issue) => issue.issue === "missing_force_rls_default_deny_migration"));
  assert(report.issues.some((issue) => issue.issue === "missing_rls_smoke_sql"));
  assert(report.issues.some((issue) => issue.issue === "missing_rls_default_deny_smoke_sql"));
});

test("analyzeRlsSanityTables rejects tenant tables without RLS or tenant-bounded read policy", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-rls-bad-table-"));
  writeBase(root);
  write(
    root,
    "supabase/migrations/001_tenant.sql",
    `create table public.tenant_records (
  id uuid primary key,
  organization_id uuid not null
);
create policy "Bad read"
  on public.tenant_records for select
  using (true);
`
  );
  const report = analyzeRlsSanityTables(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "tenant_table_missing_rls_enable"));
  assert(report.issues.some((issue) => issue.issue === "tenant_table_policy_missing_tenant_boundary"));
});

test("analyzeRlsSanityTables rejects public grants on tenant tables", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-rls-public-grant-"));
  writeBase(root);
  write(
    root,
    "supabase/migrations/002_public_grant.sql",
    "grant select on table public.tenant_records to public;\n",
  );

  const report = analyzeRlsSanityTables(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "tenant_table_granted_to_public"));
});
