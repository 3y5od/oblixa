#!/usr/bin/env node
/** ADR process optional until ADR_DIR exists (plan: adr-required-paths-lint). */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const adr = path.join(root, "docs", "adr");
const strict = process.env.ADR_REQUIRED_STRICT === "1";
const hasAdr = fs.existsSync(adr);
console.log(JSON.stringify({ checkId: "adr-required-paths-lint", strict, hasAdr }, null, 2));
process.exit(strict && !hasAdr ? 1 : 0);
