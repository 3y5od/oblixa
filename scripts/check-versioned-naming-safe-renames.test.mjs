import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeVersionedNamingSafeRenames,
  applyVersionedNamingSafeRenames,
} from "./check-versioned-naming-safe-renames.mjs";
import { buildVersionedNamingBaseline, scanVersionedNaming } from "./check-versioned-naming.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "versioned-safe-renames-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeBaseline(root) {
  const baselinePath = path.join(root, "scripts/versioned-naming-baseline.json");
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(buildVersionedNamingBaseline(scanVersionedNaming(root)), null, 2)}\n`);
  return baselinePath;
}

test("analyzeVersionedNamingSafeRenames accepts report-approved local-only candidates", () => {
  const root = makeRoot();
  write(root, "src/lib/v5/example.test.ts", 'import { example } from "./example";\n');
  const baselinePath = writeBaseline(root);

  const report = analyzeVersionedNamingSafeRenames({
    root,
    baselinePath,
    mappings: [
      {
        from: "src/lib/v5/example.test.ts",
        to: "src/lib/example.test.ts",
        importRewrites: [{ from: "./example", to: "./v5/example" }],
      },
    ],
  });

  assert.equal(report.ok, true);
  assert.equal(report.pendingRenameCount, 1);
  assert.equal(report.plannedRenames[0].surface, "app_libraries");
  assert.equal(report.plannedRenames[0].beforePathHitCount, 1);
  assert.equal(report.plannedRenames[0].afterPathHitCount, 0);
  assert.deepEqual(report.plannedRenames[0].expectedReferenceUpdates, [{ from: "./example", to: "./v5/example" }]);
});

test("applyVersionedNamingSafeRenames moves files and rewrites relative imports", () => {
  const root = makeRoot();
  write(root, "src/lib/v5/example.test.ts", 'import { example } from "./example";\n');
  const baselinePath = writeBaseline(root);

  const report = applyVersionedNamingSafeRenames({
    root,
    baselinePath,
    mappings: [
      {
        from: "src/lib/v5/example.test.ts",
        to: "src/lib/example.test.ts",
        importRewrites: [{ from: "./example", to: "./v5/example" }],
      },
    ],
  });

  assert.equal(report.ok, true);
  assert.equal(report.appliedRenameCount, 1);
  assert.equal(fs.existsSync(path.join(root, "src/lib/v5/example.test.ts")), false);
  assert.equal(fs.readFileSync(path.join(root, "src/lib/example.test.ts"), "utf8"), 'import { example } from "./v5/example";\n');
  assert.equal(fs.existsSync(path.join(root, "artifacts/compatibility/versioned-naming-safe-rename-manifest.json")), true);
});

test("applyVersionedNamingSafeRenames rewrites only manifest-listed fixed-string references", () => {
  const root = makeRoot();
  write(root, "src/components/v4/example-widget.tsx", "export const ExampleWidget = true;\n");
  write(root, "src/app/page.tsx", 'import { ExampleWidget } from "@/components/v4/example-widget";\n');
  write(root, "docs/ui.md", "`src/components/v4/example-widget.tsx`\n");
  write(root, "artifacts/ignored.json", '"src/components/v4/example-widget.tsx"\n');
  const baselinePath = writeBaseline(root);

  const report = applyVersionedNamingSafeRenames({
    root,
    baselinePath,
    mappings: [
      {
        from: "src/components/v4/example-widget.tsx",
        to: "src/components/example-widget.tsx",
        referenceRewrites: [
          { from: "@/components/v4/example-widget", to: "@/components/example-widget" },
          { from: "src/components/v4/example-widget.tsx", to: "src/components/example-widget.tsx" },
        ],
      },
    ],
    reviewedMappings: [
      {
        from: "src/components/v4/example-widget.tsx",
        to: "src/components/example-widget.tsx",
      },
    ],
  });

  assert.equal(report.ok, true);
  assert.equal(fs.existsSync(path.join(root, "src/components/v4/example-widget.tsx")), false);
  assert.equal(fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8"), 'import { ExampleWidget } from "@/components/example-widget";\n');
  assert.equal(fs.readFileSync(path.join(root, "docs/ui.md"), "utf8"), "`src/components/example-widget.tsx`\n");
  assert.equal(fs.readFileSync(path.join(root, "artifacts/ignored.json"), "utf8"), '"src/components/v4/example-widget.tsx"\n');
  assert.ok(report.changedFiles.includes("src/app/page.tsx"));
  assert.ok(report.changedFiles.includes("docs/ui.md"));
  assert.deepEqual(report.plannedRenames[0].expectedFixedStringReferenceUpdates, [
    { from: "@/components/v4/example-widget", to: "@/components/example-widget" },
    { from: "src/components/v4/example-widget.tsx", to: "src/components/example-widget.tsx" },
  ]);
});

test("analyzeVersionedNamingSafeRenames refuses compatibility-sensitive and unapproved paths", () => {
  const root = makeRoot();
  write(root, "supabase/migrations/001_v9_bad.sql", "-- migration\n");
  write(root, "src/lib/v5/referenced.test.ts", "test\n");
  write(root, "src/lib/reference.ts", '"referenced.test"\n');
  const baselinePath = writeBaseline(root);

  const report = analyzeVersionedNamingSafeRenames({
    root,
    baselinePath,
    mappings: [
      { from: "supabase/migrations/001_v9_bad.sql", to: "supabase/migrations/001_bad.sql" },
      { from: "src/lib/v5/referenced.test.ts", to: "src/lib/referenced.test.ts" },
    ],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "safe_rename_refuses_compatibility_sensitive_path"));
  assert.ok(report.issues.some((issue) => issue.issue === "safe_rename_not_report_approved"));
});
