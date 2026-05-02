#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const jsonPath = path.join(root, "artifacts", "subprocessors.json");
const baselinePath = path.join(__dirname, "subprocessors-baseline.sha256");
const strict = process.argv.includes("--strict");

function sha256File(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function main() {
  if (!fs.existsSync(jsonPath)) {
    console.log("OK: no artifacts/subprocessors.json");
    return;
  }
  const hash = sha256File(jsonPath);
  if (!fs.existsSync(baselinePath)) {
    fs.writeFileSync(baselinePath, `${hash}  artifacts/subprocessors.json\n`);
    console.log(`OK: wrote baseline ${baselinePath}`);
    return;
  }
  const expected = fs.readFileSync(baselinePath, "utf8").trim().split(/\s+/)[0];
  if (expected !== hash) {
    const msg = `subprocessors.json changed (hash ${hash} vs baseline ${expected}). Update scripts/subprocessors-baseline.sha256 after review.`;
    if (strict) {
      console.error(msg);
      process.exit(1);
    }
    console.warn(`WARN: ${msg}`);
  } else {
    console.log("OK: subprocessors baseline matches.");
  }
}

main();
