#!/usr/bin/env node
/**
 * Maps a few CWE-style classes to existing check:* scripts (presence-only gate).
 */
import fs from "node:fs";
import path from "node:path";

const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
const scripts = pkg.scripts || {};
const required = [
  "check:open-redirect-guards",
  "check:csrf-surface-guards",
  "check:template-injection-guards",
];
const missing = required.filter((k) => !(k in scripts));
const ok = missing.length === 0;
console.log(JSON.stringify({ ok, checkId: "qa-injection-class-matrix", missing }, null, 2));
process.exit(ok ? 0 : 1);
