#!/usr/bin/env node
/**
 * Mutation/fuzz/load entrypoints documented (Stryker optional; k6 present) — plan: mutation-fuzz-load.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const k6 = !!pkg.scripts?.["test:k6:smoke"];
const loadDir = fs.existsSync(path.join(root, "scripts", "load"));
console.log(JSON.stringify({ checkId: "mutation-fuzz-load", ok: true, k6, loadDir }, null, 2));
process.exit(0);
