import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeServerActionsInventory } from "./check-server-actions-inventory.mjs";

function withFixture(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "server-actions-inventory-"));
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

test("analyzeServerActionsInventory classifies guarded server action exports", () => {
  const report = withFixture(
    {
      "src/actions/contracts.ts": `
        "use server";
        import { redirect } from "next/navigation";
        export async function updateContract() {
          const ctx = await getAuthContext();
          await ctx.admin.from("contracts").update({ title: "x" }).eq("organization_id", ctx.orgId);
          redirect("/contracts");
        }
      `,
    },
    analyzeServerActionsInventory
  );

  assert.equal(report.issueCount, 0);
  assert.deepEqual(report.inventory[0]?.classifications, ["authenticated", "org_scoped"]);
});

test("analyzeServerActionsInventory flags unclassified exported server actions", () => {
  const report = withFixture(
    {
      "src/actions/unsafe.ts": `
        "use server";
        export async function unsafeAction() {
          return { ok: true };
        }
      `,
    },
    analyzeServerActionsInventory
  );

  assert.equal(report.issues.some((issue) => issue.issue === "server_action_unclassified"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "server_action_missing_auth_classification"), true);
});

test("analyzeServerActionsInventory rejects dynamic redirects from server actions", () => {
  const report = withFixture(
    {
      "src/actions/redirects.ts": `
        "use server";
        export async function unsafeRedirect(nextPath) {
          const ctx = await getAuthContext();
          redirect(nextPath);
        }
      `,
    },
    analyzeServerActionsInventory
  );

  assert.equal(report.issues.some((issue) => issue.issue === "server_action_unsafe_redirect"), true);
});

test("analyzeServerActionsInventory rejects raw provider and database error returns", () => {
  const report = withFixture(
    {
      "src/actions/errors.ts": `
        "use server";
        export async function unsafeErrorReturn() {
          const ctx = await getAuthContext();
          const { error } = await ctx.admin.from("contracts").insert({});
          if (error) return { error: error.message };
          return { ok: true };
        }
      `,
    },
    analyzeServerActionsInventory
  );

  assert.equal(report.issues.some((issue) => issue.issue === "server_action_raw_error_return"), true);
});

test("analyzeServerActionsInventory allows mapped user-facing error returns", () => {
  const report = withFixture(
    {
      "src/actions/errors.ts": `
        "use server";
        export async function safeErrorReturn() {
          const ctx = await getAuthContext();
          const { error } = await ctx.admin.from("contracts").insert({});
          if (error) return { error: mapDataSourceError(error.message) };
          return { ok: true };
        }
      `,
    },
    analyzeServerActionsInventory
  );

  assert.equal(report.issueCount, 0);
});
