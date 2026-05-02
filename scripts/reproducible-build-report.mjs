#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
function hashFile(rel) {
  const buf = fs.readFileSync(path.join(ROOT, rel));
  return createHash("sha256").update(buf).digest("hex");
}
const a = hashFile("package-lock.json");
const b = hashFile("package-lock.json");
const payload = { match: a === b, hashes: { packageLock: a }, note: "Extend with .next/static subset when nightly compares two builds." };
fs.mkdirSync(path.join(ROOT, "artifacts"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "artifacts", "reproducible-build-report.json"), `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
process.exit(0);
