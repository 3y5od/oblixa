#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const inv = JSON.parse(fs.readFileSync(path.join(ROOT, "artifacts", "pci-cde-inventory.json"), "utf8"));
const rows = inv.cardholderDataFields || [];
console.log(JSON.stringify({ ok: true, pciFieldRows: rows.length }, null, 2));
process.exit(0);
