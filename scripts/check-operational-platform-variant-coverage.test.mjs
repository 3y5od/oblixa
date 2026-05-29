import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  summarizeRouteFamilyPolicies,
  validateMarkerRows,
} from "./check-operational-platform-variant-coverage.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-platform-variant-"));
}

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

test("marker rows require owner, validation command, file, and markers", () => {
  const root = makeRoot();
  const packageScripts = { "check:example": "node example.mjs" };
  write(root, "e2e/example.spec.ts", "test('covers webkit mobile', () => {});\n");

  const issues = [];
  const rows = validateMarkerRows(
    root,
    [
      {
        id: "webkit-mobile",
        path: "e2e/example.spec.ts",
        markers: ["webkit mobile"],
        owner: "@frontend-platform",
        validationCommand: "check:example",
      },
    ],
    new Set(["webkit-mobile"]),
    "variant",
    issues,
    packageScripts
  );

  assert.equal(rows[0].ok, true);
  assert.equal(issues.length, 0);

  const badIssues = [];
  validateMarkerRows(
    root,
    [{ id: "missing", path: "e2e/example.spec.ts", markers: ["absent"], validationCommand: "missing:script" }],
    new Set(["missing"]),
    "variant",
    badIssues,
    packageScripts
  );

  assert.ok(badIssues.some((entry) => entry.issue === "variant_missing_owner"));
  assert.ok(badIssues.some((entry) => entry.issue === "variant_missing_validation_command"));
  assert.ok(badIssues.some((entry) => entry.issue === "variant_missing_marker"));
});

test("route family policies require waiver coverage when no multi-browser route exists", () => {
  const routeManifest = [
    { route: "/advanced", routeFamily: "advanced", coverage: ["smoke"] },
    { route: "/login", routeFamily: "auth", coverage: ["smoke", "multi_browser"] },
  ];
  const packageScripts = {
    "check:operational-platform-variant-coverage": "node scripts/check-operational-platform-variant-coverage.mjs",
    "test:e2e:multi-browser": "playwright test",
  };
  const waivers = new Map([["qa_taxonomy_gap_phase2_feature", { id: "qa_taxonomy_gap_phase2_feature" }]]);
  const issues = [];

  const rows = summarizeRouteFamilyPolicies(
    routeManifest,
    [
      {
        family: "advanced",
        supportLevel: "chromium-primary-pre-ga",
        owner: "@frontend-platform",
        validationCommand: "check:operational-platform-variant-coverage",
        waiverId: "qa_taxonomy_gap_phase2_feature",
      },
      {
        family: "auth",
        supportLevel: "multi-browser-representative",
        owner: "@auth-security",
        validationCommand: "test:e2e:multi-browser",
      },
    ],
    waivers,
    packageScripts,
    issues
  );

  assert.equal(rows.find((row) => row.family === "advanced").ok, true);
  assert.equal(issues.length, 0);

  const missingWaiverIssues = [];
  summarizeRouteFamilyPolicies(
    routeManifest,
    [
      {
        family: "advanced",
        supportLevel: "chromium-primary-pre-ga",
        owner: "@frontend-platform",
        validationCommand: "check:operational-platform-variant-coverage",
      },
      {
        family: "auth",
        supportLevel: "multi-browser-representative",
        owner: "@auth-security",
        validationCommand: "test:e2e:multi-browser",
      },
    ],
    waivers,
    packageScripts,
    missingWaiverIssues
  );

  assert.ok(
    missingWaiverIssues.some((entry) => entry.issue === "operational_platform_variant_route_family_no_multibrowser_or_waiver")
  );
});
