import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeServerLibAdminUsage } from "./check-server-lib-admin.mjs";

function withFixture(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "server-lib-admin-"));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const file = path.join(root, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("analyzeServerLibAdminUsage accepts allowlisted admin callers with metadata", () => {
  const report = withFixture(
    {
      "src/lib/foo.ts": "import { createAdminClient } from '@/lib/supabase/server'; export async function foo() { return createAdminClient(); }",
      "scripts/server-lib-admin-allowlist.txt": "# meta: owner=security expiry=2099-01-01 classification=session-scoped reason=org_guarded compensatingTest=scripts/check-server-lib-admin.test.mjs\nsrc/lib/foo.ts\n",
      "scripts/check-server-lib-admin.test.mjs": "",
    },
    analyzeServerLibAdminUsage
  );

  assert.equal(report.ok, true);
  assert.deepEqual(report.violations, []);
});

test("analyzeServerLibAdminUsage rejects new admin callers not in allowlist", () => {
  const report = withFixture(
    {
      "src/lib/foo.ts": "import { createAdminClient } from '@/lib/supabase/server'; export async function foo() { return createAdminClient(); }",
      "scripts/server-lib-admin-allowlist.txt": "",
    },
    analyzeServerLibAdminUsage
  );

  assert.equal(report.ok, false);
  assert.equal(report.violations.some((violation) => violation.issue === "unallowlisted_create_admin_client"), true);
});

test("analyzeServerLibAdminUsage rejects allowlist entries without complete metadata", () => {
  const report = withFixture(
    {
      "src/lib/foo.ts": "import { createAdminClient } from '@/lib/supabase/server'; export async function foo() { return createAdminClient(); }",
      "scripts/server-lib-admin-allowlist.txt": "src/lib/foo.ts\n",
    },
    analyzeServerLibAdminUsage
  );

  assert.equal(report.ok, false);
  assert.equal(report.violations.some((violation) => violation.issue === "missing_allowlist_metadata"), true);
});

test("analyzeServerLibAdminUsage rejects stale allowlist entries", () => {
  const report = withFixture(
    {
      "src/lib/foo.ts": "export const foo = 1;",
      "scripts/server-lib-admin-allowlist.txt": "# meta: owner=security expiry=2099-01-01 classification=session-scoped reason=org_guarded compensatingTest=scripts/check-server-lib-admin.test.mjs\nsrc/lib/foo.ts\n",
      "scripts/check-server-lib-admin.test.mjs": "",
    },
    analyzeServerLibAdminUsage
  );

  assert.equal(report.ok, false);
  assert.equal(report.violations.some((violation) => violation.issue === "stale_allowlist_entry"), true);
});

test("analyzeServerLibAdminUsage ignores type-only admin references", () => {
  const report = withFixture(
    {
      "src/lib/foo.ts": "import type { createAdminClient } from '@/lib/supabase/server'; type Admin = Awaited<ReturnType<typeof createAdminClient>>; export function foo(admin: Admin) { return admin; }",
      "scripts/server-lib-admin-allowlist.txt": "",
    },
    analyzeServerLibAdminUsage
  );

  assert.equal(report.ok, true);
  assert.equal(report.hitCount, 0);
});

test("analyzeServerLibAdminUsage rejects service-role imports in client components", () => {
  const report = withFixture(
    {
      "src/components/bad-client.tsx": "\"use client\";\nimport { createAdminClient } from '@/lib/supabase/server';\nexport function Bad() { return null; }\n",
      "scripts/server-lib-admin-allowlist.txt": "",
    },
    analyzeServerLibAdminUsage
  );

  assert.equal(report.ok, false);
  assert.equal(report.violations.some((violation) => violation.issue === "client_importable_service_role_access"), true);
});

test("analyzeServerLibAdminUsage rejects service-role reads by id without org predicates", () => {
  const report = withFixture(
    {
      "src/lib/foo.ts": "import { createAdminClient } from '@/lib/supabase/server'; export async function foo(admin = await createAdminClient(), contractId: string) { return admin.from('contracts').select('id').eq('id', contractId).single(); }",
      "scripts/server-lib-admin-allowlist.txt": "# meta: owner=security expiry=2099-01-01 classification=session-scoped reason=org_guarded compensatingTest=scripts/check-server-lib-admin.test.mjs\nsrc/lib/foo.ts\n",
      "scripts/check-server-lib-admin.test.mjs": "",
    },
    analyzeServerLibAdminUsage
  );

  assert.equal(report.ok, false);
  assert.equal(report.violations.some((violation) => violation.issue === "service_role_query_without_org_predicate"), true);
});

test("analyzeServerLibAdminUsage rejects service-role updates by id without org predicates", () => {
  const report = withFixture(
    {
      "src/lib/foo.ts": "import { createAdminClient } from '@/lib/supabase/server'; export async function foo(admin = await createAdminClient(), contractId: string) { return admin.from('contracts').update({ title: 'x' }).eq('id', contractId); }",
      "scripts/server-lib-admin-allowlist.txt": "# meta: owner=security expiry=2099-01-01 classification=session-scoped reason=org_guarded compensatingTest=scripts/check-server-lib-admin.test.mjs\nsrc/lib/foo.ts\n",
      "scripts/check-server-lib-admin.test.mjs": "",
    },
    analyzeServerLibAdminUsage
  );

  assert.equal(report.ok, false);
  assert.equal(report.violations.some((violation) => violation.issue === "service_role_query_without_org_predicate"), true);
});

test("analyzeServerLibAdminUsage accepts service-role reads and writes with org predicates", () => {
  const report = withFixture(
    {
      "src/lib/foo.ts": "import { createAdminClient } from '@/lib/supabase/server'; export async function foo(admin = await createAdminClient(), contractId: string, orgId: string) { await admin.from('contracts').select('id').eq('organization_id', orgId).eq('id', contractId).single(); return admin.from('contracts').update({ title: 'x' }).eq('organization_id', orgId).eq('id', contractId); }",
      "scripts/server-lib-admin-allowlist.txt": "# meta: owner=security expiry=2099-01-01 classification=session-scoped reason=org_guarded compensatingTest=scripts/check-server-lib-admin.test.mjs\nsrc/lib/foo.ts\n",
      "scripts/check-server-lib-admin.test.mjs": "",
    },
    analyzeServerLibAdminUsage
  );

  assert.equal(report.ok, true);
});
