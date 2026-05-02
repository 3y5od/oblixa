#!/usr/bin/env node
/**
 * SAR (financial-crimes workflow) surface absent — stub parity with artifacts/sar-surface-absent.json.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const manifest = path.join(ROOT, "artifacts", "sar-surface-absent.json");
const data = JSON.parse(fs.readFileSync(manifest, "utf8"));
const needles = ["sar-sdk", "fin-crimes-sdk", "aml-screening-sdk"];
const pkgPath = path.join(ROOT, "package.json");
const pkg = fs.readFileSync(pkgPath, "utf8");
const hits = needles.filter((n) => pkg.includes(n));
const ok = hits.length === 0 && data.sarWorkflowPresent === false;
console.log(JSON.stringify({ ok, manifest: data, packageHits: hits }, null, 2));
process.exit(ok ? 0 : 1);
