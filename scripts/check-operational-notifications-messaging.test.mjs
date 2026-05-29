import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { validateMarkerRows } from "./check-operational-notifications-messaging.mjs";

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), "operational-notifications-"));
  mkdirSync(join(root, "src/lib"), { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ scripts: { "check:fixture": "node fixture.mjs" } })
  );
  return root;
}

test("notification marker rows require owners, validation commands, files, markers, and required ids", () => {
  const root = fixtureRoot();
  writeFileSync(join(root, "src/lib/example.ts"), "alpha beta");
  const issues = [];
  const rows = validateMarkerRows(
    root,
    [
      {
        id: "covered",
        path: "src/lib/example.ts",
        markers: ["alpha"],
        owner: "@notifications",
        validationCommand: "check:fixture",
      },
      {
        id: "broken",
        path: "src/lib/example.ts",
        markers: ["missing"],
        owner: "notifications",
        validationCommand: "check:missing",
      },
    ],
    new Set(["covered", "missing-required"]),
    "fixture",
    issues,
    { "check:fixture": "node fixture.mjs" }
  );

  assert.equal(rows.find((row) => row.id === "covered")?.ok, true);
  assert.equal(rows.find((row) => row.id === "broken")?.ok, false);
  assert.ok(issues.some((entry) => entry.issue === "fixture_missing_marker"));
  assert.ok(issues.some((entry) => entry.issue === "fixture_missing_owner"));
  assert.ok(issues.some((entry) => entry.issue === "fixture_missing_validation_command"));
  assert.ok(issues.some((entry) => entry.issue === "fixture_missing_required_id"));
});
