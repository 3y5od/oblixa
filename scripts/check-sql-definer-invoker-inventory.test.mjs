import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeSqlDefinerInvokerInventory } from "./check-sql-definer-invoker-inventory.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeSmoke(root) {
  write(
    root,
    "supabase/tests/view_invoker_smoke.sql",
    `begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select 1 from public.contract_operational_dates where contract_id = '00000000-0000-0000-0000-00000000c001';
do $$
begin
  if false then
    raise exception 'view_security_invoker_same_org_allowed failed';
  end if;
  if false then
    raise exception 'view_security_invoker_cross_org_denied failed';
  end if;
end $$;
rollback;
`
  );
}

test("analyzeSqlDefinerInvokerInventory accepts hardened definers and tenant security_invoker views", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-sql-definer-ok-"));
  write(
    root,
    "supabase/migrations/001_ok.sql",
    `create table public.organizations (id uuid primary key);
create table public.organization_members (
  id uuid primary key,
  organization_id uuid not null,
  user_id uuid not null
);
create table public.contracts (
  id uuid primary key,
  organization_id uuid not null
);
create table public.extracted_fields (
  id uuid primary key,
  contract_id uuid not null
);

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_org and user_id = auth.uid()
  )
$$;
revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;

create or replace function public.service_snapshot(p_org_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$ select count(*)::integer from public.contracts where organization_id = p_org_id $$;
revoke all on function public.service_snapshot(uuid) from public;
grant execute on function public.service_snapshot(uuid) to service_role;

create or replace view public.contract_operational_dates
with (security_invoker = true)
as
select c.id as contract_id, c.organization_id
from public.contracts c
left join public.extracted_fields ef on ef.contract_id = c.id;
`
  );
  writeSmoke(root);

  const report = analyzeSqlDefinerInvokerInventory(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.securityDefinerFunctionCount, 2);
  assert.equal(report.tenantViewCount, 1);
});

test("analyzeSqlDefinerInvokerInventory rejects unsafe definer and view patterns", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-sql-definer-bad-"));
  write(
    root,
    "supabase/migrations/001_bad.sql",
    `create table public.contracts (
  id uuid primary key,
  organization_id uuid not null
);

create or replace function public.bad_definer()
returns integer
language sql
security definer
as $$ select count(*)::integer from public.contracts $$;
grant execute on function public.bad_definer() to authenticated;

create or replace view public.contract_operational_dates as
select id as contract_id, organization_id
from public.contracts;
`
  );

  const report = analyzeSqlDefinerInvokerInventory(root);
  assert.equal(report.ok, false);
  assert.deepEqual(
    report.issues.map((issue) => issue.issue).sort(),
    [
      "missing_view_security_invoker_authenticated_smoke",
      "security_definer_authenticated_grant_not_allowlisted",
      "security_definer_missing_public_revoke",
      "security_definer_missing_public_search_path",
      "tenant_view_missing_security_invoker",
    ].sort()
  );
});

test("analyzeSqlDefinerInvokerInventory uses the latest function and view definitions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-sql-definer-latest-"));
  write(
    root,
    "supabase/migrations/001_legacy.sql",
    `create table public.contracts (
  id uuid primary key,
  organization_id uuid not null
);
create or replace function public.create_user_org(user_id uuid, org_name text)
returns void
language plpgsql
security definer
as $$ begin null; end $$;
create or replace view public.contract_operational_dates as
select id as contract_id, organization_id from public.contracts;
`
  );
  write(
    root,
    "supabase/migrations/002_harden.sql",
    `create or replace function public.create_user_org(user_id uuid, org_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> user_id then
    raise exception 'forbidden';
  end if;
end $$;
revoke all on function public.create_user_org(uuid, text) from public;
grant execute on function public.create_user_org(uuid, text) to authenticated;

create or replace view public.contract_operational_dates
with (security_invoker = true)
as
select id as contract_id, organization_id from public.contracts;
`
  );
  writeSmoke(root);

  const report = analyzeSqlDefinerInvokerInventory(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.securityDefinerFunctionCount, 1);
});
