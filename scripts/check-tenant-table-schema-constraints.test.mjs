import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { analyzeTenantTableSchemaConstraints } from "./check-tenant-table-schema-constraints.mjs";

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

test("tenant-table schema check requires deploy-time NOT NULL and FK guards", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-tenant-schema-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:tenant-table-schema-constraints": "node scripts/check-tenant-table-schema-constraints.mjs" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:tenant-table-schema-constraints\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:tenant-table-schema-constraints"\n');
  write(root, "artifacts/assurance/rls-sanity-tables.json", '{"scope": "organization_id", "service_role_bypass": "explicit"}\n');
  write(
    root,
    "supabase/migrations/078_tenant_table_schema_constraints_guard.sql",
    `
organization_id
c.is_nullable <> 'NO'
tc.constraint_type = 'FOREIGN KEY'
ccu.table_schema = 'public'
ccu.table_name = 'organizations'
ccu.column_name = 'id'
tenant organization_id columns must be NOT NULL
tenant organization_id columns must reference public.organizations(id)
`
  );

  assert.equal(analyzeTenantTableSchemaConstraints(root).ok, true);
});

test("tenant-table schema check fails without FK enforcement marker", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-tenant-schema-missing-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:tenant-table-schema-constraints": "node scripts/check-tenant-table-schema-constraints.mjs" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:tenant-table-schema-constraints\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:tenant-table-schema-constraints"\n');
  write(root, "artifacts/assurance/rls-sanity-tables.json", '{"scope": "organization_id", "service_role_bypass": "explicit"}\n');
  write(root, "supabase/migrations/078_tenant_table_schema_constraints_guard.sql", "organization_id\nc.is_nullable <> 'NO'\n");

  const report = analyzeTenantTableSchemaConstraints(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "missing_marker" && issue.marker === "tc.constraint_type = 'FOREIGN KEY'"));
});
