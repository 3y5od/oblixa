import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeQaLoadingRoutes } from "./check-qa-loading-routes.mjs";

test("analyzeQaLoadingRoutes rejects non-smoke routes and missing checklist coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-qa-loading-"));
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(root, "e2e", "generated"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "app", "(auth)"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "scripts", "qa-loading-routes-checklist.txt"),
    "/login src/app/(auth)/loading.tsx\n/bogus src/app/(auth)/loading.tsx\n"
  );
  fs.writeFileSync(
    path.join(root, "e2e", "generated", "route-states.ts"),
    'export const GENERATED_ROUTE_STATES = [{"route":"/login","kind":"loading","sourcePath":"src/app/(auth)/loading.tsx","shellFamily":"auth"}] as const;\n'
  );
  fs.writeFileSync(path.join(root, "src", "app", "(auth)", "loading.tsx"), "export default function Loading() { return null; }\n");

  const report = analyzeQaLoadingRoutes(root);

  assert.equal(report.ok, false);
  assert.deepEqual(report.notSmokeCovered.map((row) => row.route), ["/bogus"]);
  assert.ok(report.missingFromChecklist.includes("/privacy"));
});