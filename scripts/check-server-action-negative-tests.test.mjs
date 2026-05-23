import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { analyzeServerActionNegativeTests } from "./check-server-action-negative-tests.mjs";

function fixtureRoot() {
  const root = join(tmpdir(), `oblixa-action-negative-${process.pid}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(join(root, "src/actions"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  return root;
}

test("server action negative-test inventory accepts covered actions", () => {
  const root = fixtureRoot();
  writeFileSync(
    join(root, "src/actions/settings.ts"),
    `"use server";
export async function updateThing(formData) {
  const ctx = await getAuthenticatedMembershipContext();
  if (!ctx) return { error: "Not authenticated" };
  if (!formData.get("name")) return { error: "Name is required" };
  return { ok: true };
}
`
  );
  writeFileSync(
    join(root, "src/actions/settings.test.ts"),
    `it("returns not authenticated without a user", () => {});
it("rejects invalid input before writes", () => {});
it("keeps organization_id scoped to org", () => {});
`
  );
  const report = analyzeServerActionNegativeTests(root);
  assert.equal(report.issueCount, 0);
});

test("server action negative-test inventory rejects missing categories", () => {
  const root = fixtureRoot();
  writeFileSync(
    join(root, "src/actions/settings.ts"),
    `"use server";
export async function updateThing(formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { ok: Boolean(user || formData) };
}
`
  );
  writeFileSync(join(root, "src/actions/settings.test.ts"), `it("has a happy path", () => {});\n`);
  const report = analyzeServerActionNegativeTests(root);
  assert.equal(
    report.issues.some((issue) => issue.issue === "missing_server_action_negative_test"),
    true
  );
});
