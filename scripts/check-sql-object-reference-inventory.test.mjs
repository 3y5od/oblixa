import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeSqlObjectReferenceInventory,
  buildSqlObjectReferenceInventory,
  collectSqlObjectReferencesFromText,
} from "./check-sql-object-reference-inventory.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sql-object-reference-inventory-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

function writeLocalSchema(root) {
  write(
    root,
    "supabase/migrations/001_initial_schema.sql",
    `
      create table if not exists public.accounts (id uuid primary key);
      create view public.account_summary as select id from public.accounts;
      create or replace function public.calculate_score(account_id uuid) returns int language sql as $$ select 1; $$;
      create or replace function public.is_org_member(org_id uuid) returns boolean language sql as $$ select true; $$;
      create policy "Members can read accounts" on public.accounts for select using (public.is_org_member(id));
    `,
  );
  write(root, "supabase/seed.sql", "insert into storage.buckets (id, name, public) values ('contract-files', 'contract-files', false);\n");
}

function writeInventory(root, inventory = buildSqlObjectReferenceInventory(root)) {
  write(root, "artifacts/supabase/sql-object-reference-inventory.json", `${JSON.stringify(inventory, null, 2)}\n`);
}

test("collectSqlObjectReferencesFromText extracts route handler table, RPC, and storage references", () => {
  const refs = collectSqlObjectReferencesFromText({
    sourcePath: "src/app/api/accounts/route.ts",
    text: `
      await supabase.from("accounts").select("*");
      await supabase.from("accounts").insert({ id });
      await supabase.rpc("calculate_score", { account_id: id });
      await supabase.storage.from("contract-files").upload("a", body);
    `,
  });

  assert.deepEqual(
    refs.map((row) => `${row.kind}:${row.ref}:${row.objectType}`),
    [
      "read:public.accounts:table_or_view",
      "write:public.accounts:table_or_view",
      "rpc:public.calculate_score:function",
      "storage:storage.contract-files:storage_bucket",
    ],
  );
});

test("collectSqlObjectReferencesFromText ignores non-database from calls and string assertions", () => {
  const refs = collectSqlObjectReferencesFromText({
    sourcePath: "src/lib/encoding.test.ts",
    text: `
      const b64 = Buffer.from("hello").toString("base64");
      const rows = Array.from(items);
      expect(raw).not.toContain('.from("legacy_table")');
      await supabase.from("accounts").select("*");
    `,
  });

  assert.deepEqual(
    refs.map((row) => row.ref),
    ["public.accounts"],
  );
});

test("collectSqlObjectReferencesFromText does not classify SQL table inserts as function calls", () => {
  const refs = collectSqlObjectReferencesFromText({
    sourcePath: "supabase/tests/account_smoke.sql",
    text: `
      insert into public.accounts(id) values ('00000000-0000-0000-0000-000000000001');
      select public.is_org_member('00000000-0000-0000-0000-000000000001');
    `,
  });

  assert.deepEqual(
    refs.map((row) => `${row.kind}:${row.ref}:${row.objectType}`),
    ["write:public.accounts:table_or_view", "policy_helper:public.is_org_member:function"],
  );
});

test("buildSqlObjectReferenceInventory includes route handlers, server actions, and SQL files", () => {
  const root = makeRoot();
  writeLocalSchema(root);
  write(root, "src/app/api/accounts/route.ts", 'await supabase.from("accounts").select("*");\n');
  write(root, "src/actions/accounts.ts", 'await supabase.rpc("calculate_score", { account_id: id });\n');
  write(root, "supabase/tests/account_smoke.sql", "select * from public.account_summary; select public.is_org_member('00000000-0000-0000-0000-000000000001');\n");

  const inventory = buildSqlObjectReferenceInventory(root);

  assert.equal(inventory.missingReferenceCount, 0);
  assert.ok(inventory.referencedObjects.some((row) => row.ref === "public.accounts" && row.kinds.includes("read")));
  assert.ok(inventory.referencedObjects.some((row) => row.ref === "public.calculate_score" && row.kinds.includes("rpc")));
  assert.ok(inventory.referencedObjects.some((row) => row.ref === "public.is_org_member" && row.kinds.includes("policy_helper")));
});

test("analyzeSqlObjectReferenceInventory accepts a current inventory", () => {
  const root = makeRoot();
  writeLocalSchema(root);
  write(root, "src/app/api/accounts/route.ts", 'await supabase.from("accounts").select("*");\n');
  writeInventory(root);

  const report = analyzeSqlObjectReferenceInventory({ root });

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzeSqlObjectReferenceInventory fails on missing app table references", () => {
  const root = makeRoot();
  writeLocalSchema(root);
  write(root, "src/app/api/accounts/route.ts", 'await supabase.from("missing_accounts").select("*");\n');
  writeInventory(root);

  const report = analyzeSqlObjectReferenceInventory({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "missing_sql_object_reference" && row.ref === "public.missing_accounts"));
});

test("analyzeSqlObjectReferenceInventory fails when committed inventory drifts", () => {
  const root = makeRoot();
  writeLocalSchema(root);
  write(root, "src/app/api/accounts/route.ts", 'await supabase.from("accounts").select("*");\n');
  const inventory = buildSqlObjectReferenceInventory(root);
  inventory.references = [];
  writeInventory(root, inventory);

  const report = analyzeSqlObjectReferenceInventory({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((row) => row.issue === "sql_object_reference_inventory_drift"));
});
