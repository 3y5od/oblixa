import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { analyzeClientHashDetails } from "./check-client-hash-details.mjs";

function makeRoot(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "client-hash-details-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

test("passes when hash links target static ids", async () => {
  const root = makeRoot({
    "src/app/page.tsx": '<a href="#details">Details</a><section id="details" />',
  });

  const report = await analyzeClientHashDetails(root);

  assert.equal(report.ok, true);
  assert.equal(report.missing.length, 0);
});

test("recognizes product section data ids as rendered section ids", async () => {
  const root = makeRoot({
    "src/app/(marketing)/product/page.tsx": '<a href="#replace">See workflow</a>',
    "src/components/landing/product-sections-data.ts": 'export const PRODUCT_SECTIONS = [{ id: "replace" }] as const;',
  });

  const report = await analyzeClientHashDetails(root);

  assert.equal(report.ok, true);
  assert.equal(report.missing.length, 0);
});

test("reports hash links with no matching id", async () => {
  const root = makeRoot({
    "src/app/page.tsx": '<a href="#missing">Missing</a>',
  });

  const report = await analyzeClientHashDetails(root);

  assert.equal(report.ok, false);
  assert.deepEqual(report.missing, [{ id: "missing", file: "src/app/page.tsx" }]);
});
