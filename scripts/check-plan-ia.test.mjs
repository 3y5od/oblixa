import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { analyzePlanIaReferences } from "./check-plan-ia.mjs";

function write(root, rel, content) {
  const absolute = path.join(root, rel);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
}

test("plan IA check ignores billing files and rejects navigation references", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "plan-ia-"));
  write(root, "src/lib/billing/status.ts", "orgHasActivePlan();\n");
  write(root, "src/components/layout/sidebar.tsx", "isPlanEnforcementEnabled();\n");

  const report = analyzePlanIaReferences(root);

  assert.equal(report.ok, false);
  assert.deepEqual(report.suspicious, ["src/components/layout/sidebar.tsx"]);
});

test("plan IA check passes when plan helpers stay out of IA paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "plan-ia-"));
  write(root, "src/lib/billing/status.ts", "orgHasActivePlan();\n");
  write(root, "src/components/layout/sidebar.tsx", "export const label = 'Contracts';\n");

  const report = analyzePlanIaReferences(root);

  assert.equal(report.ok, true);
  assert.deepEqual(report.suspicious, []);
});
