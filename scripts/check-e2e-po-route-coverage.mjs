#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const dashboard = path.join(ROOT, "src", "app", "(dashboard)");
const specs = path.join(ROOT, "e2e");
const pageCount = fs.existsSync(dashboard)
  ? fs.readdirSync(dashboard, { withFileTypes: true }).filter((d) => d.isDirectory()).length
  : 0;
const specFiles = fs.existsSync(specs)
  ? fs.readdirSync(specs).filter((n) => n.endsWith(".spec.ts")).length
  : 0;
const payload = { ok: true, dashboardSegmentCount: pageCount, e2eSpecFiles: specFiles, note: "Ratchet PO↔route mapping in follow-up." };
fs.mkdirSync(path.join(ROOT, "artifacts"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "artifacts", "e2e-po-route-coverage.json"), `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
process.exit(0);
