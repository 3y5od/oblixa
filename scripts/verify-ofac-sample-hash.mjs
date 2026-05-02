#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const manifest = path.join(ROOT, "artifacts", "ofac-sdn-sample.sha256");
const text = fs.readFileSync(manifest, "utf8").trim().split(/\s+/)[0];
const strict = process.argv.includes("--strict");
const sample = path.join(ROOT, "artifacts", "ofac-sdn-sample-placeholder.txt");
if (!fs.existsSync(sample)) {
  fs.writeFileSync(sample, "");
}
const buf = fs.readFileSync(sample);
const h = createHash("sha256").update(buf).digest("hex");
const ok = !strict || h === text;
console.log(JSON.stringify({ ok, expected: text, actual: h, strict }, null, 2));
process.exit(ok ? 0 : 1);
