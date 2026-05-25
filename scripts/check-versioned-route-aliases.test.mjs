import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeVersionedRouteAliases,
  buildVersionedRouteAliasPlan,
  writeVersionedRouteAliases,
} from "./check-versioned-route-aliases.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "versioned-route-aliases-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("buildVersionedRouteAliasPlan maps cron and workspace routes to neutral aliases", () => {
  const root = makeRoot();
  write(root, "src/app/api/cron/v10/read-model-refresh/route.ts", "export function GET() {}\n");
  write(root, "src/app/api/workspace/v6-settings/route.ts", "export function GET() {}\n");

  const plan = buildVersionedRouteAliasPlan(root);

  assert.deepEqual(
    plan.map((row) => [row.legacyPath, row.neutralPath, row.neutralRouteFile]),
    [
      ["/api/cron/v10/read-model-refresh", "/api/cron/read-model-refresh", "src/app/api/cron/read-model-refresh/route.ts"],
      ["/api/workspace/v6-settings", "/api/workspace/settings", "src/app/api/workspace/settings/route.ts"],
    ],
  );
});

test("writeVersionedRouteAliases creates neutral re-export routes and static tests", () => {
  const root = makeRoot();
  write(root, "src/app/api/cron/v5/example-job/route.ts", "export function GET() {}\n");

  const writeReport = writeVersionedRouteAliases({ root });
  const checkReport = analyzeVersionedRouteAliases({ root });

  assert.equal(writeReport.ok, true);
  assert.equal(checkReport.ok, true);
  assert.equal(fs.readFileSync(path.join(root, "src/app/api/cron/example-job/route.ts"), "utf8"), 'export * from "../v5/example-job/route";\n');
  assert.ok(fs.existsSync(path.join(root, "src/app/api/cron/example-job/route.test.ts")));
});

test("analyzeVersionedRouteAliases rejects missing alias files", () => {
  const root = makeRoot();
  write(root, "src/app/api/cron/v6/example-job/route.ts", "export function GET() {}\n");

  const report = analyzeVersionedRouteAliases({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_route_alias_file_missing"));
});
