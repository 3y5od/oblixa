import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateMarkerRows } from "./check-operational-oauth-integration-sync.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("operational OAuth marker rows enforce required ids, owners, commands, and source markers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "operational-oauth-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:example": "node example.mjs" } }));
  write(root, "src/example.ts", "oauth_callback_state_replay\nsecurity.integration_disconnected\n");

  const issues = [];
  const rows = validateMarkerRows(
    root,
    [
      {
        id: "oauth-callback",
        path: "src/example.ts",
        owner: "@integrations",
        validationCommand: "check:example",
        markers: ["oauth_callback_state_replay"],
      },
      {
        id: "disconnect",
        path: "src/example.ts",
        owner: "@integrations",
        validationCommand: "check:example",
        markers: ["security.integration_disconnected"],
      },
    ],
    new Set(["oauth-callback", "disconnect"]),
    "example",
    issues
  );

  assert.equal(issues.length, 0);
  assert.equal(rows.length, 2);
  assert.equal(rows.every((row) => row.ok), true);
});

test("operational OAuth marker rows report missing objective coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "operational-oauth-missing-"));
  write(root, "package.json", JSON.stringify({ scripts: {} }));
  write(root, "src/example.ts", "present\n");

  const issues = [];
  validateMarkerRows(
    root,
    [
      {
        id: "oauth-callback",
        path: "src/example.ts",
        owner: "integrations",
        validationCommand: "check:missing",
        markers: ["absent"],
      },
    ],
    new Set(["oauth-callback", "disconnect"]),
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
