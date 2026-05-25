import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeVersionedExportedSymbols,
  buildVersionedExportedSymbolInventory,
  findExportedSymbols,
  suggestedNeutralExportName,
} from "./check-versioned-exported-symbols.mjs";

function makeRoot(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "versioned-exported-symbols-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
}

test("suggestedNeutralExportName strips leading and embedded product version labels", () => {
  assert.equal(suggestedNeutralExportName("V9_DUE_SOON_DAYS"), "DUE_SOON_DAYS");
  assert.equal(suggestedNeutralExportName("V10RecoverableState"), "RecoverableState");
  assert.equal(suggestedNeutralExportName("parseV5SignalQualityForDisplay"), "parseSignalQualityForDisplay");
  assert.equal(suggestedNeutralExportName("v8DiscoverabilityForFeature"), "discoverabilityForFeature");
  assert.equal(suggestedNeutralExportName("PlainName"), null);
});

test("findExportedSymbols captures declaration and named barrel exports", () => {
  const rows = findExportedSymbols({
    rel: "src/lib/example.ts",
    text: [
      "export type V8Legacy = string;",
      "const Local = 1;",
      "export { Local as V9LocalAlias };",
    ].join("\n"),
  });

  assert.deepEqual(
    rows.map((row) => [row.exportKind, row.exportedName]),
    [
      ["declaration", "V8Legacy"],
      ["named_export", "V9LocalAlias"],
    ],
  );
});

test("inventory classifies neutral alias coverage and manual route exports", () => {
  const root = makeRoot({
    "src/lib/example.ts": [
      "export type NewThing = string;",
      "export type V10NewThing = NewThing;",
      "export function V9NeedsAlias() { return true; }",
    ].join("\n"),
    "src/app/api/v10/example/route.ts": "export function V10RouteHelper() { return true; }\n",
  });

  const inventory = buildVersionedExportedSymbolInventory(root);
  const added = inventory.symbols.find((row) => row.exportedName === "V10NewThing");
  const candidate = inventory.symbols.find((row) => row.exportedName === "V9NeedsAlias");
  const route = inventory.symbols.find((row) => row.exportedName === "V10RouteHelper");

  assert.equal(added.compatibilityAction, "alias_added");
  assert.equal(added.neutralExportPresent, true);
  assert.equal(candidate.compatibilityAction, "alias_candidate");
  assert.equal(route.compatibilityAction, "queue_only");
  assert.equal(route.manualOnly, true);
});

test("analyzeVersionedExportedSymbols detects artifact drift", () => {
  const root = makeRoot({
    "src/lib/example.ts": "export type V10Thing = string;\n",
  });
  writeJson(root, "artifacts/compatibility/versioned-exported-symbol-inventory.json", {
    stale: true,
  });

  const report = analyzeVersionedExportedSymbols({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_exported_symbol_inventory_drift"));
});

test("analyzeVersionedExportedSymbols accepts current artifact", () => {
  const root = makeRoot({
    "src/lib/example.ts": "export type Thing = string;\nexport type V10Thing = Thing;\n",
  });
  writeJson(
    root,
    "artifacts/compatibility/versioned-exported-symbol-inventory.json",
    buildVersionedExportedSymbolInventory(root),
  );

  const report = analyzeVersionedExportedSymbols({ root });

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
