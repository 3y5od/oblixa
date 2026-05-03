#!/usr/bin/env node
/** Epic 13 child — drift gate for scripts-to-epic-map.json vs filesystem / package.json */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildScriptsToEpicMapPayload } from "./lib/build-scripts-to-epic-map.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mapPath = path.join(root, "artifacts", "assurance", "scripts-to-epic-map.json");

function norm(payload) {
  return {
    check: payload.checkScripts.map((x) => x.path).sort(),
    report: payload.reportScripts.map((x) => x.path).sort(),
    npmTest: payload.npmTestScripts.map((x) => x.name).sort(),
  };
}

const committed = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const fresh = buildScriptsToEpicMapPayload(root);
const a = norm(committed);
const b = norm(fresh);
if (JSON.stringify(a) !== JSON.stringify(b)) {
  console.error("scripts-to-epic-map.json drifts from repo. Run: npm run generate:scripts-to-epic-map");
  process.exit(1);
}
console.log(
  `OK: scripts-to-epic-map (${b.check.length} check, ${b.report.length} report, ${b.npmTest.length} npm test scripts).`
);
