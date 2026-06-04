import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("release inventory lock classifies current route boundaries", () => {
  const result = spawnSync("node", ["scripts/check-release-inventory-lock.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const output = result.stdout || result.stderr;
  assert.equal(result.status, 0, output);
  const payload = JSON.parse(output);
  assert.equal(payload.ok, true);
  assert.equal(
    payload.residualCoverageWork.uncategorizedRouteBoundaries.some(
      (row) => row.routePath === "/contracts/imports/[jobId]"
    ),
    false
  );
});
