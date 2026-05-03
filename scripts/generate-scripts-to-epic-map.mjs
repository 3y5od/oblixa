#!/usr/bin/env node
/** Appendix D — regenerate artifacts/assurance/scripts-to-epic-map.json */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildScriptsToEpicMapPayload } from "./lib/build-scripts-to-epic-map.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "artifacts", "assurance", "scripts-to-epic-map.json");

function main() {
  const write = process.argv.includes("--write");
  const payload = buildScriptsToEpicMapPayload(root);
  if (!write) {
    console.log(
      JSON.stringify(
        {
          checkScripts: payload.checkScripts.length,
          reportScripts: payload.reportScripts.length,
          npmTestScripts: payload.npmTestScripts.length,
        },
        null,
        2
      )
    );
    console.error("Dry run. Pass --write.");
    return;
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `Wrote scripts-to-epic-map (${payload.checkScripts.length} check, ${payload.reportScripts.length} report, ${payload.npmTestScripts.length} test npm scripts).`
  );
}

main();
