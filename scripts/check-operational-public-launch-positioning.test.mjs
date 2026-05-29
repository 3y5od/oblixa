import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateMarkerRows } from "./check-operational-public-launch-positioning.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("operational public-launch marker rows enforce required ids, owners, commands, and source markers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "operational-public-launch-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:example": "node example.mjs" } }));
  write(root, "src/example.ts", "not a full CLM\nDisallow: /assurance/\n");

  const issues = [];
  const rows = validateMarkerRows(
    root,
    [
      {
        id: "not-full-clm",
        path: "src/example.ts",
        owner: "@product-marketing",
        validationCommand: "check:example",
        markers: ["not a full CLM"],
      },
      {
        id: "robots-private-disallow",
        path: "src/example.ts",
        owner: "@product-marketing",
        validationCommand: "check:example",
        markers: ["Disallow: /assurance/"],
      },
    ],
    new Set(["not-full-clm", "robots-private-disallow"]),
    "example",
    issues
  );

  assert.equal(issues.length, 0);
  assert.equal(rows.length, 2);
  assert.equal(rows.every((row) => row.ok), true);
});

test("operational public-launch marker rows report missing coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "operational-public-launch-missing-"));
  write(root, "package.json", JSON.stringify({ scripts: {} }));
  write(root, "src/example.ts", "present\n");

  const issues = [];
  validateMarkerRows(
    root,
    [
      {
        id: "not-full-clm",
        path: "src/example.ts",
        owner: "product",
        validationCommand: "check:missing",
        markers: ["absent"],
      },
    ],
    new Set(["not-full-clm", "robots-private-disallow"]),
    "example",
    issues
  );

  assert.deepEqual(
    issues.map((row) => row.issue).sort(),
    [
      "example_missing_marker",
      "example_missing_owner",
      "example_missing_required_id",
      "example_missing_validation_command",
    ]
  );
});
