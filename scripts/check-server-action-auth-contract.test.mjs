import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeServerActionAuthContract } from "./check-server-action-auth-contract.mjs";

function withFixture(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "server-action-auth-contract-"));
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

test("analyzeServerActionAuthContract accepts delegated public auth wrappers", () => {
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
    analyzeServerActionAuthContract
  );

  assert.equal(report.ok, true);
  assert.deepEqual(report.violations, []);
});

test("analyzeServerActionAuthContract rejects unguarded server actions", () => {
  const report = withFixture(
    {
      "src/actions/unsafe.ts": `
        "use server";
        export async function unsafeAction() {
          return { ok: true };
        }
      `,
    },
    analyzeServerActionAuthContract
  );

  assert.equal(report.ok, false);
  assert.deepEqual(report.violations, ["src/actions/unsafe.ts"]);
});

test("analyzeServerActionAuthContract requires org membership for org FormData actions", () => {
  const report = withFixture(
    {
      "src/actions/org.ts": `
        "use server";
        export async function unsafeOrgAction(formData) {
          const client = createClient();
          const orgId = formData.get("organizationId");
          return { ok: Boolean(client && orgId) };
        }
      `,
    },
    analyzeServerActionAuthContract
  );

  assert.equal(report.ok, false);
  assert.deepEqual(report.orgScopeViolations, ["src/actions/org.ts"]);
});
