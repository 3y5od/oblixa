import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildVersionedNamingBaseline,
  governanceForVersionedNamingPath,
  compareVersionedNamingBaseline,
  findVersionedNamingHits,
  scanVersionedNaming,
  suggestedNeutralNameForVersionedPath,
} from "./check-versioned-naming.mjs";

function makeRoot(files) {
  const root = mkdtempSync(path.join(tmpdir(), "versioned-naming-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

test("findVersionedNamingHits ignores semver and IPv6 while catching product version labels", () => {
  const hits = findVersionedNamingHits({
    rel: "src/lib/plain.ts",
    text: [
      "const protocol = 'IPv6';",
      "const cli = 'v2.101.0';",
      "type V10Mutation = {};",
      "const route = '/api/cron/v6/refresh';",
    ].join("\n"),
  });

  assert.deepEqual(
    hits.map((hit) => [hit.canonicalToken, hit.line]),
    [
      ["v10", 3],
      ["v6", 4],
    ]
  );
});

test("compareVersionedNamingBaseline allows ratcheting existing debt down", () => {
  const baselineRoot = makeRoot({
    "src/lib/current.ts": "type V10One = {};\ntype V10Two = {};",
  });
  const currentRoot = makeRoot({
    "src/lib/current.ts": "type V10One = {};",
  });

  const baseline = buildVersionedNamingBaseline(scanVersionedNaming(baselineRoot));
  const comparison = compareVersionedNamingBaseline({
    baseline,
    scan: scanVersionedNaming(currentRoot),
  });

  assert.equal(comparison.ok, true);
  assert.equal(comparison.violationCount, 0);
  assert.equal(comparison.reductionCount, 1);
});

test("buildVersionedNamingBaseline annotates each row with governance metadata", () => {
  const root = makeRoot({
    "docs/version-name-removal-code-only-checklist.md": "remove `v10` after reviewed cleanup.\n",
    "src/app/api/v10/example/route.ts": "export function GET() {}\n",
  });

  const baseline = buildVersionedNamingBaseline(scanVersionedNaming(root));
  const docsRow = baseline.files.find((row) => row.path === "docs/version-name-removal-code-only-checklist.md");
  const routeRow = baseline.files.find((row) => row.path === "src/app/api/v10/example/route.ts");

  assert.equal(docsRow.governance.surface, "documentation");
  assert.equal(docsRow.surfaceClass, "documentation");
  assert.equal(docsRow.governance.owner, "docs-platform");
  assert.equal(docsRow.owner, "docs-platform");
  assert.equal(docsRow.governance.manualOnly, false);
  assert.equal(docsRow.manualOnly, false);
  assert.equal(docsRow.validationCommand, "npm run check:versioned-naming");
  assert.equal(routeRow.governance.surface, "api_routes");
  assert.equal(routeRow.surfaceClass, "api_routes");
  assert.equal(routeRow.governance.manualOnly, true);
  assert.equal(routeRow.manualOnly, true);
  assert.deepEqual(routeRow.suggestedNeutralName, {
    value: "src/app/api/example/route.ts",
    type: "compatibility_alias_or_manual_cutover",
    surface: "api_routes",
    manualOnly: true,
  });
  assert.equal(governanceForVersionedNamingPath("src/lib/v6/telemetry.ts").owner, "platform-telemetry");
  assert.equal(governanceForVersionedNamingPath("src/lib/v6/telemetry.ts").manualOnly, true);
  assert.equal(governanceForVersionedNamingPath("public/manifest-v1.json").surface, "external_contracts");
});

test("suggestedNeutralNameForVersionedPath strips path and basename version labels deterministically", () => {
  assert.deepEqual(suggestedNeutralNameForVersionedPath("src/components/v4/example-widget.v10.test.tsx"), {
    value: "src/components/example-widget.test.tsx",
    type: "local_rename_candidate",
    surface: "components",
    manualOnly: false,
  });
  assert.equal(suggestedNeutralNameForVersionedPath("src/lib/plain.ts"), null);
});

test("compareVersionedNamingBaseline rejects new files with versioned naming", () => {
  const baselineRoot = makeRoot({
    "src/lib/current.ts": "export const current = true;",
  });
  const currentRoot = makeRoot({
    "src/lib/current.ts": "export const current = true;",
    "src/lib/v11-new.ts": "export type V11Thing = {};",
  });

  const baseline = buildVersionedNamingBaseline(scanVersionedNaming(baselineRoot));
  const comparison = compareVersionedNamingBaseline({
    baseline,
    scan: scanVersionedNaming(currentRoot),
  });

  assert.equal(comparison.ok, false);
  assert.equal(comparison.violations[0].issue, "new_file_with_versioned_naming");
  assert.equal(comparison.violations[0].path, "src/lib/v11-new.ts");
});

test("compareVersionedNamingBaseline rejects token increases in existing files", () => {
  const legacySuiteScript = `check:${"v"}10-suite`;
  const baselineRoot = makeRoot({
    "package.json": JSON.stringify({ scripts: { [legacySuiteScript]: "node old.mjs" } }),
  });
  const currentRoot = makeRoot({
    "package.json": JSON.stringify({
      scripts: {
        [legacySuiteScript]: "node old.mjs",
        "check:v11-suite": "node new.mjs",
      },
    }),
  });

  const baseline = buildVersionedNamingBaseline(scanVersionedNaming(baselineRoot));
  const comparison = compareVersionedNamingBaseline({
    baseline,
    scan: scanVersionedNaming(currentRoot),
  });

  assert.equal(comparison.ok, false);
  assert.equal(
    comparison.violations.some(
      (violation) =>
        violation.issue === "versioned_naming_token_count_increased" &&
        violation.path === "package.json" &&
        violation.token === "v11"
    ),
    true
  );
});
