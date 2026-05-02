#!/usr/bin/env node
/**
 * Optional: when scripts/debugging-sweep/revisions/*.json exists, ensure each file is valid JSON
 * and includes string fields `seq` and `prevSha256` (tamper-evident chain is policy-defined).
 * Full chain math is deferred to operators when they adopt revisions/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const revDir = path.join(__dirname, "revisions");

function main() {
  if (!fs.existsSync(revDir)) {
    console.log("OK: no revisions/ directory (chain disabled).");
    return;
  }
  const files = fs.readdirSync(revDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.log("OK: revisions/ empty (chain disabled).");
    return;
  }
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(path.join(revDir, f), "utf8"));
    if (typeof j.seq !== "number" && typeof j.seq !== "string") {
      throw new Error(`${f}: missing seq`);
    }
    if (typeof j.prevSha256 !== "string") {
      throw new Error(`${f}: missing prevSha256`);
    }
  }
  console.log(`OK: ${files.length} revision file(s) structurally valid (chain verification manual).`);
}

main();
