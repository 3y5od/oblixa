import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeServerActionOrgScope } from "./check-server-action-org-scope.mjs";

function withFixture(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "server-action-org-scope-"));
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

test("analyzeServerActionOrgScope exempts delegated public auth wrappers", () => {
  const report = withFixture(
    {
      "src/actions/auth.ts": `
        "use server";
        import { signIn as signInImpl } from "@/lib/auth/auth-action-impl";
        export async function signIn(formData) {
          return signInImpl(formData);
        }
      `,
    },
    analyzeServerActionOrgScope
  );

  assert.deepEqual(report.violations, []);
  assert.equal(report.coverage[0]?.publicAuthFlow, true);
});

test("analyzeServerActionOrgScope rejects unscoped non-auth server actions", () => {
  const report = withFixture(
    {
      "src/actions/unsafe.ts": `
        "use server";
        export async function unsafeAction() {
          return { ok: true };
        }
      `,
    },
    analyzeServerActionOrgScope
  );

  assert.deepEqual(report.violations, ["src/actions/unsafe.ts"]);
});

test("analyzeServerActionOrgScope accepts organization-scoped server actions", () => {
  const report = withFixture(
    {
      "src/actions/contracts.ts": `
        "use server";
        export async function updateContract() {
          const orgId = "org_123";
          await client.from("contracts").update({ title: "x" }).eq("organization_id", orgId);
        }
      `,
    },
    analyzeServerActionOrgScope
  );

  assert.deepEqual(report.violations, []);
  assert.equal(report.coverage[0]?.scopeSignalCount > 0, true);
});
