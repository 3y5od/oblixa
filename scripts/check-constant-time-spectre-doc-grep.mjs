#!/usr/bin/env node
/** Complements bundle grep — ensures timingSafeEqual appears in integration contracts. */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const p = path.join(root, "src", "lib", "integration", "qa-ultimate-contracts.test.ts");
const body = fs.readFileSync(p, "utf8");
const ok = /timingSafeEqual/.test(body) && /spectre/i.test(body);
console.log(JSON.stringify({ checkId: "constant-time-spectre-doc-grep", ok }, null, 2));
process.exit(ok ? 0 : 1);
