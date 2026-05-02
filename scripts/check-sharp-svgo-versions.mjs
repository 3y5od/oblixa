#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const strict = process.env.SHARP_SVGO_CVE_STRICT === "1" || process.env.SHARP_SVGO_CVE_STRICT === "true";
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const sharp = pkg.dependencies?.sharp || pkg.devDependencies?.sharp || null;
const svgo = pkg.dependencies?.svgo || pkg.devDependencies?.svgo || null;
let lockSharp = null;
try {
  const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
  lockSharp = lock.packages?.["node_modules/sharp"]?.version ?? null;
} catch {
  lockSharp = null;
}
/** Placeholder for OSV/CVE allowlist; extend when advisories target pinned majors. */
const knownBadSharp = [];
const sharpOk = !sharp || !lockSharp || !knownBadSharp.some((v) => String(lockSharp).startsWith(v));
const ok = !strict || sharpOk;
const payload = { ok, strict, sharp, svgo, lockSharp, sharpOk };
console.log(JSON.stringify(payload, null, 2));
process.exit(ok ? 0 : 1);
