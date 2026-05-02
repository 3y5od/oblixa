#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const inv = JSON.parse(fs.readFileSync(path.join(ROOT, "artifacts", "pci-cde-inventory.json"), "utf8"));
console.log(JSON.stringify({ ok: true, routeCount: (inv.routes || []).length }, null, 2));
process.exit(0);
