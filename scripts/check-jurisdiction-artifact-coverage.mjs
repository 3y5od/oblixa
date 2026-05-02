#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const strict =
  process.env.JURISDICTION_MATRIX_STRICT === "1" || process.env.JURISDICTION_MATRIX_STRICT === "true";
const required = [
  "artifacts/gdpr-soc2-control-map.json",
  "artifacts/subprocessors.json",
  "artifacts/pci-cde-inventory.json",
];
const missing = required.filter((rel) => !fs.existsSync(path.join(root, rel)));
const regionTest = path.join(root, "src", "lib", "compliance", "jurisdiction-region.contract.test.ts");
const regionTestOk = fs.existsSync(regionTest);
const ok = missing.length === 0 && (!strict || regionTestOk);
console.log(
  JSON.stringify(
    { ok, checkId: "jurisdiction-artifact-coverage", strict, missing, regionTestOk },
    null,
    2
  )
);
process.exit(ok ? 0 : 1);
