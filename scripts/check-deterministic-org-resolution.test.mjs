import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzeDeterministicOrgResolution } from "./check-deterministic-org-resolution.mjs";

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "org-resolution-check-"));
  write(
    root,
    "src/lib/supabase/org-scoped-admin.ts",
    `
      export function resolveSensitiveOrgContext() {}
      export function getExplicitOrgIdFromInput() {}
      export function getExplicitOrgIdFromRequestWithBody() {}
      export function orgResolutionHttpStatus() {}
      export function createOrgScopedAdminContext() {}
    `
  );
  write(
    root,
    "src/lib/supabase/server.ts",
    `
      export async function getDeterministicMembership(admin, userId) {
        const resolution = await resolveExplicitOrSingleMembership(admin, userId);
        if (!resolution.ok) return null;
        return resolution.membership;
      }
      export async function getOrEnsureDeterministicMembership(admin, user) {
        const resolution = await resolveExplicitOrSingleMembership(admin, user.id);
        if (resolution.reason !== "organization_membership_missing") return null;
        return null;
      }
    `
  );
  return root;
}

test("deterministic org resolution check accepts explicit-or-single delegation", () => {
  const root = makeFixture();
  const report = analyzeDeterministicOrgResolution(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("deterministic org resolution check rejects earliest-org fallback patterns", () => {
  const root = makeFixture();
  write(
    root,
    "src/actions/bad.ts",
    `
      "use server";
      export async function bad(admin, userId) {
        return admin.from("organization_members").select("organization_id, created_at").eq("user_id", userId).order("created_at", { ascending: true }).limit(1);
      }
    `
  );
  const report = analyzeDeterministicOrgResolution(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "sensitive_code_uses_earliest_org_fallback"), true);
});
