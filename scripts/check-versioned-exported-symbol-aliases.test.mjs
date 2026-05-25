import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeVersionedExportedSymbolAliases,
  buildVersionedExportedSymbolAliasPlan,
  runVersionedExportedSymbolAliases,
} from "./check-versioned-exported-symbol-aliases.mjs";

function makeRoot(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "versioned-exported-symbol-aliases-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function label(number, suffix = "") {
  return `V${number}${suffix}`;
}

test("buildVersionedExportedSymbolAliasPlan plans declaration and barrel aliases", () => {
  const typeName = label(10, "Thing");
  const shapeName = label(9, "Shape");
  const factoryName = label(8, "Factory");
  const legacyName = label(7, "LegacyThing");
  const root = makeRoot({
    "src/lib/example.ts": [
      `export type ${typeName} = string;`,
      `export interface ${shapeName} { id: string }`,
      `export function ${factoryName}() { return true; }`,
      `export { LegacyThing as ${legacyName} } from "./legacy";`,
    ].join("\n"),
  });

  const plan = buildVersionedExportedSymbolAliasPlan(root);

  assert.equal(plan.pendingAliasCount, 4);
  assert.equal(plan.fileCount, 1);
  assert.deepEqual(
    new Set(plan.files[0].aliases.map((row) => row.statement)),
    new Set([
      "export { LegacyThing as LegacyThing } from \"./legacy\";",
      `export { ${factoryName} as Factory };`,
      `export type { ${typeName} as Thing };`,
      `export type { ${shapeName} as Shape };`,
    ]),
  );
});

test("write mode adds neutral aliases and makes check mode pass", () => {
  const typeName = label(10, "Thing");
  const factoryName = label(9, "Factory");
  const root = makeRoot({
    "src/lib/example.ts": [
      `export type ${typeName} = string;`,
      `export function ${factoryName}() { return true; }`,
    ].join("\n"),
  });

  const before = analyzeVersionedExportedSymbolAliases({ root });
  assert.equal(before.ok, false);
  assert.equal(before.pendingAliasCount, 2);

  const writeReport = runVersionedExportedSymbolAliases({ root, write: true });
  assert.equal(writeReport.wroteFileCount, 1);
  assert.match(read(root, "src/lib/example.ts"), new RegExp(`export type \\{ ${typeName} as Thing \\};`, "u"));
  assert.match(read(root, "src/lib/example.ts"), new RegExp(`export \\{ ${factoryName} as Factory \\};`, "u"));

  const after = analyzeVersionedExportedSymbolAliases({ root });
  assert.equal(after.ok, true);
  assert.equal(after.pendingAliasCount, 0);

  const secondWrite = runVersionedExportedSymbolAliases({ root, write: true });
  assert.equal(secondWrite.wroteFileCount, 0);
});

test("existing neutral exports block duplicate alias writes", () => {
  const typeName = label(10, "Thing");
  const root = makeRoot({
    "src/lib/example.ts": [
      "export type Thing = string;",
      `export type ${typeName} = Thing;`,
    ].join("\n"),
  });

  const plan = buildVersionedExportedSymbolAliasPlan(root);

  assert.equal(plan.pendingAliasCount, 0);
  assert.equal(plan.blockedAliasCount, 0);
  assert.equal(analyzeVersionedExportedSymbolAliases({ root }).ok, true);
});
