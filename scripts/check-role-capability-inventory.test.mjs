import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeRoleCapabilityInventory } from "./check-role-capability-inventory.mjs";

function withFixture(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "role-capability-"));
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

const REQUIRED_TESTS = {
  "src/lib/access-control.test.ts": `
    it("exhaustive baseline matrix", () => {});
    it("allows role-policy overrides", () => {});
    it("override false revokes", () => {});
    it("unknown roles never grant", () => {});
    it("viewer has no baseline mutation capabilities", () => {});
  `,
  "src/lib/permissions.test.ts": `it("unsupported roles", () => {});`,
  "src/lib/security/api-guards.test.ts": `it("unsupported roles", () => {});`,
  "scripts/check-role-capability-inventory.test.mjs": `
    it("rejects settings mutations without settings_manage", () => {});
    it("rejects automation execution without manage capability", () => {});
    it("rejects export routes without nearest export capability", () => {});
    it("rejects assurance mutations without manage capability", () => {});
    it("rejects user integration mutations without capability gate", () => {});
    it("requires route-level lowest-privilege denial tests for sensitive mutations", () => {});
  `,
};

test("analyzeRoleCapabilityInventory inventories valid role and capability checks", () => {
  const report = withFixture(
    {
      "src/actions/contracts.ts": `
        async function save(ctx, role) {
          if (!(await canManageCapability(ctx, "contracts_edit"))) return;
          if (!canEditContracts(role)) return;
        }
      `,
      ...REQUIRED_TESTS,
    },
    analyzeRoleCapabilityInventory
  );

  assert.equal(report.ok, true);
  assert.equal(report.byKind.api_capability_check, 1);
  assert.equal(report.byKind.legacy_contract_edit, 1);
});

test("analyzeRoleCapabilityInventory rejects unknown capability literals", () => {
  const report = withFixture(
    {
      "src/actions/contracts.ts": `async function save(ctx) { return canManageCapability(ctx, "contracts_delete_everything"); }`,
      ...REQUIRED_TESTS,
    },
    analyzeRoleCapabilityInventory
  );

  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "unknown_capability_literal"), true);
});

test("analyzeRoleCapabilityInventory rejects missing required denial tests", () => {
  const report = withFixture(
    {
      "src/actions/contracts.ts": `async function save(ctx) { return canManageCapability(ctx, "contracts_edit"); }`,
    },
    analyzeRoleCapabilityInventory
  );

  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "missing_unknown_role_capability_denial_test"), true);
});

test("analyzeRoleCapabilityInventory rejects settings mutations without settings_manage", () => {
  const report = withFixture(
    {
      "src/app/api/workspace/v6-settings/route.ts": `export async function PATCH() { return Response.json({ ok: true }); }`,
      ...REQUIRED_TESTS,
    },
    analyzeRoleCapabilityInventory
  );

  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "settings_mutation_without_settings_manage"), true);
});

test("analyzeRoleCapabilityInventory rejects automation execution without manage capability", () => {
  const report = withFixture(
    {
      "src/app/api/autopilot/rules/route.ts": `export async function POST() { return Response.json({ ok: true }); }`,
      ...REQUIRED_TESTS,
    },
    analyzeRoleCapabilityInventory
  );

  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "automation_mutation_without_manage_capability"), true);
});

test("analyzeRoleCapabilityInventory rejects export routes without nearest export capability", () => {
  const report = withFixture(
    {
      "src/app/api/export/contracts/route.ts": `export async function GET() { return Response.json({ ok: true }); }`,
      ...REQUIRED_TESTS,
    },
    analyzeRoleCapabilityInventory
  );

  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "export_route_without_nearest_capability"), true);
});

test("analyzeRoleCapabilityInventory rejects assurance mutations without manage capability", () => {
  const report = withFixture(
    {
      "src/app/api/assurance/checks/run/route.ts": `export async function POST() { return Response.json({ ok: true }); }`,
      ...REQUIRED_TESTS,
    },
    analyzeRoleCapabilityInventory
  );

  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "assurance_mutation_without_manage_capability"), true);
});

test("analyzeRoleCapabilityInventory rejects user integration mutations without capability gate", () => {
  const report = withFixture(
    {
      "src/app/api/integrations/oauth/start/route.ts": `export async function POST() { return Response.json({ ok: true }); }`,
      ...REQUIRED_TESTS,
    },
    analyzeRoleCapabilityInventory
  );

  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "integration_mutation_without_capability_gate"), true);
});

test("analyzeRoleCapabilityInventory requires route-level lowest-privilege denial tests for sensitive mutations", () => {
  const report = withFixture(
    {
      "src/app/api/campaigns/route.ts": `
        async function canManageCapability() { return true; }
        export async function POST() { return Response.json({ ok: true }); }
      `,
      ...REQUIRED_TESTS,
    },
    analyzeRoleCapabilityInventory
  );

  assert.equal(report.ok, false);
  assert.equal(
    report.issues.some((issue) => issue.issue === "sensitive_route_missing_lowest_privilege_denial_test"),
    true
  );
});
