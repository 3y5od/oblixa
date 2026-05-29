import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateMarkerRows } from "./check-operational-search-reporting-analytics-exports.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-search-reporting-"));
}

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

test("marker rows require owners, validation commands, files, and required ids", () => {
  const root = makeRoot();
  const scripts = { "check:example": "node example.mjs" };
  write(root, "src/example.ts", "rateLimitCheck(`command-search:${ctx.user.id}:${ip}`, RATE_LIMITS.commandPaletteSearch);\n");
  const issues = [];

  const rows = validateMarkerRows(
    root,
    [
      {
        id: "rate-limits",
        path: "src/example.ts",
        markers: ["rateLimitCheck(`command-search:${ctx.user.id}:${ip}`", "RATE_LIMITS.commandPaletteSearch"],
        owner: "@product-operations",
        validationCommand: "check:example",
      },
    ],
    new Set(["rate-limits"]),
    "section31",
    issues,
    scripts
  );

  assert.equal(rows[0].ok, true);
  assert.equal(issues.length, 0);

  const badIssues = [];
  validateMarkerRows(
    root,
    [
      {
        id: "missing",
        path: "src/example.ts",
        markers: ["absent marker"],
        validationCommand: "missing:script",
      },
    ],
    new Set(["missing", "another-required"]),
    "section31",
    badIssues,
    scripts
  );

  assert.ok(badIssues.some((entry) => entry.issue === "section31_missing_owner"));
  assert.ok(badIssues.some((entry) => entry.issue === "section31_missing_validation_command"));
  assert.ok(badIssues.some((entry) => entry.issue === "section31_missing_marker"));
  assert.ok(badIssues.some((entry) => entry.issue === "section31_missing_required_id" && entry.id === "another-required"));
});
