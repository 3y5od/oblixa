import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeMigrationSecurityPatterns } from "./check-migration-security-patterns.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeMigrationSecurityPatterns accepts org-scoped tenant tables with RLS, policy, and index", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-migration-security-ok-"));
  write(
    root,
    "supabase/migrations/001_ok.sql",
    `create table public.contracts (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade
);
alter table public.organizations enable row level security;
alter table public.contracts enable row level security;
create index idx_contracts_organization_id on public.contracts (organization_id);
create policy "Members can read contracts"
  on public.contracts for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));
create or replace function public.safe_contracts(p_org_id uuid)
returns setof public.contracts
language sql
security definer
set search_path = public
as $$ select * from public.contracts where organization_id = p_org_id $$;
`
  );

  const report = analyzeMigrationSecurityPatterns(root, { strict: true });
  assert.equal(report.issueCount, 0);
});

test("analyzeMigrationSecurityPatterns rejects tenant, grant, definer, policy, index, and token gaps", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-migration-security-bad-"));
  write(
    root,
    "supabase/migrations/001_bad.sql",
    `create table public.tenant_records (
  id uuid primary key,
  name text
);
create table public.org_records (
  id uuid primary key,
  organization_id uuid not null,
  token text not null
);
alter table public.org_records enable row level security;
create policy "Bad org policy" on public.org_records for select using (true);
create policy "Bad write policy" on public.org_records for insert;
grant select on public.org_records to authenticated;
create or replace function public.bad_definer()
returns void
language sql
security definer
as $$ select 1 $$;
create or replace function public.broad_definer()
returns void
language sql
security definer
set search_path = public
as $$ select 1 $$;
grant execute on function public.broad_definer() to authenticated;
`
  );

  const report = analyzeMigrationSecurityPatterns(root, { strict: true });
  assert.equal(report.ok, undefined);
  assert.deepEqual(
    report.issues.map((issue) => issue.issue).sort(),
    [
      "broad_grant_to_client_role",
      "creates_table_without_rls_enable",
      "missing_org_lookup_index",
      "plaintext_secret_or_token_column_without_hash",
      "policy_missing_org_membership_constraint",
      "security_definer_broad_execute_grant",
      "security_definer_function_missing_set_search_path",
      "tenant_table_missing_org_id_or_classification",
      "tenant_org_id_missing_org_fk_cascade",
      "write_policy_missing_with_check",
    ].sort()
  );
});

test("analyzeMigrationSecurityPatterns rejects nullable org ids, missing scoped unique indexes, and implicit delete behavior", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-migration-schema-safety-bad-"));
  write(
    root,
    "supabase/migrations/001_bad.sql",
    `create table public.organizations (
  id uuid primary key
);
create table public.integration_api_keys (
  id uuid primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  key_hash text not null,
  created_by uuid references auth.users(id)
);
alter table public.organizations enable row level security;
alter table public.integration_api_keys enable row level security;
create index idx_integration_api_keys_org on public.integration_api_keys (organization_id);
create policy "Members can read keys"
  on public.integration_api_keys for select
  using (organization_id in (select organization_id from public.organization_members where user_id = auth.uid()));
`
  );

  const report = analyzeMigrationSecurityPatterns(root, { strict: true });
  assert.deepEqual(
    report.issues.map((issue) => issue.issue).sort(),
    [
      "foreign_key_missing_explicit_on_delete",
      "nullable_org_id_requires_justification",
      "sensitive_table_missing_org_scoped_unique",
    ].sort()
  );
});

test("analyzeMigrationSecurityPatterns ignores comments when enforcing migration contracts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-migration-comments-bad-"));
  write(
    root,
    "supabase/migrations/001_bad.sql",
    `-- organization_id uuid not null references public.organizations(id) on delete cascade
-- create unique index idx_commented_org_token on public.integration_api_keys (organization_id, key_hash);
create table public.integration_api_keys (
  id uuid primary key,
  key_hash text not null
);
`
  );

  const report = analyzeMigrationSecurityPatterns(root, { strict: true });
  assert(report.issues.some((issue) => issue.issue === "tenant_table_missing_org_id_or_classification"));
  assert(report.issues.some((issue) => issue.issue === "creates_table_without_rls_enable"));
});

test("analyzeMigrationSecurityPatterns accepts audited neutral SQL alias grants", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-migration-neutral-alias-ok-"));
  write(
    root,
    "supabase/migrations/088_sql_neutral_function_aliases.sql",
    `create or replace function public.role_rank(role_name text)
returns integer
language sql
stable
security definer
set search_path = public
as $$ select public.v10_role_rank(role_name) $$;
grant execute on function public.role_rank(text) to authenticated;

create or replace function public.member_can_read(row_organization_id uuid, row_required_role_minimum text, row_visibility_state text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.v10_member_can_read(row_organization_id, row_required_role_minimum, row_visibility_state) $$;
grant execute on function public.member_can_read(uuid, text, text) to authenticated;
`
  );
  write(
    root,
    "supabase/migrations/089_sql_neutral_table_view_aliases.sql",
    `create or replace view public.activation_state
with (security_invoker = true)
as
select * from public.v10_activation_state;

revoke all on table public.activation_state from public;
grant select on table public.activation_state to authenticated;
grant select on table public.activation_state to service_role;
`
  );

  const report = analyzeMigrationSecurityPatterns(root, { strict: true });
  assert.equal(report.issueCount, 0);
});

test("analyzeMigrationSecurityPatterns rejects neutral alias grants without scoped security-invoker evidence", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-migration-neutral-alias-bad-"));
  write(
    root,
    "supabase/migrations/089_sql_neutral_table_view_aliases.sql",
    `create or replace view public.activation_state
as
select * from public.v10_activation_state;

revoke all on table public.activation_state from public;
grant select on table public.activation_state to authenticated;
`
  );

  const report = analyzeMigrationSecurityPatterns(root, { strict: true });
  assert(report.issues.some((issue) => issue.issue === "broad_grant_to_client_role"));
});
