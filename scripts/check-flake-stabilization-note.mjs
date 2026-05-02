#!/usr/bin/env node
/** Ensures stability threshold script exists (plan: flake-stabilization). */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const ok = !!pkg.scripts?.["check:e2e:stability-threshold"];
console.log(JSON.stringify({ checkId: "flake-stabilization", ok }, null, 2));
process.exit(ok ? 0 : 1);
