import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildRouteUniversePayload } from "./lib/build-route-universe.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-route-universe-"));
}

function writeText(root, rel, text = "") {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

test("server action inventory excludes tests specs and declarations", () => {
  const root = makeRoot();

  writeText(
    root,
    "src/actions/real-action.ts",
    `"use server";

export async function createRealAction() {
  return { ok: true };
}
`,
  );
  writeText(
    root,
    "src/actions/real-action.test.ts",
    `export async function testOnlyAction() {
  return { ok: true };
}
`,
  );
  writeText(
    root,
    "src/actions/nested/spec-action.spec.tsx",
    `export async function specOnlyAction() {
  return { ok: true };
}
`,
  );
  writeText(root, "src/actions/action-types.d.ts", "export declare function declaredAction(): Promise<void>;\n");

  const { universe } = buildRouteUniversePayload(root);
  const actionRows = universe.routes.filter((row) => row.kind === "server_action");

  assert.equal(actionRows.length, 1);
  assert.equal(actionRows[0].route, "action:createRealAction");
  assert.equal(actionRows[0].sourcePath, "src/actions/real-action.ts");
  assert.ok(actionRows.every((row) => !/\.(test|spec)\.(ts|tsx)$/.test(row.sourcePath)));
  assert.ok(actionRows.every((row) => !/\.d\.ts$/.test(row.sourcePath)));
});
