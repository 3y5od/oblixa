#!/usr/bin/env node
/**
 * Emit artifacts/assurance/epic-closure.json + refresh na-bulk-registry.json NA carrier row.
 * Run with --write after changing scripts/lib/maximal-epic-evidence-registry.mjs or epics.json shape.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { maximalEpicEvidence } from "./lib/maximal-epic-evidence-registry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const epicsPath = path.join(root, "artifacts", "assurance", "epics.json");
const closurePath = path.join(root, "artifacts", "assurance", "epic-closure.json");
const naBulkPath = path.join(root, "artifacts", "assurance", "na-bulk-registry.json");

const NA_BULK_ID = "oblixa_maximal_na_residual_epics";

const epicsDoc = JSON.parse(fs.readFileSync(epicsPath, "utf8"));
const epics = epicsDoc.epics ?? [];
if (epics.length !== 176) {
  console.error(`Expected 176 epics, got ${epics.length}`);
  process.exit(1);
}

const closures = [];
const naEpicNumbers = [];

for (const row of epics) {
  const n = row.epicNumber;
  const evidence = maximalEpicEvidence[n];
  if (evidence) {
    closures.push({
      epicNumber: n,
      todoKey: row.todoKey,
      mode: "evidence",
      evidence,
    });
  } else {
    closures.push({
      epicNumber: n,
      todoKey: row.todoKey,
      mode: "na",
      naBulkId: NA_BULK_ID,
    });
    naEpicNumbers.push(n);
  }
}

naEpicNumbers.sort((a, b) => a - b);

const closurePayload = {
  version: 1,
  program: "maximal-assurance-epic-closure",
  generatedAt: new Date().toISOString(),
  notes:
    "Each epic is either evidence (automated command) or explicit bulk N/A. NA set reviewed quarterly; promote rows to evidence when shipping scope.",
  closures,
};

const naBulkPayload = {
  version: 1,
  notes:
    "Appendix H — bulk N/A dimensions without repo-local automated evidence in this revision (see epic-closure.json).",
  entries: [
    {
      id: NA_BULK_ID,
      owner: "@assurance",
      expiresOn: "2027-12-31",
      reason:
        "Maximal-assurance epics listed in coveredEpicNumbers have no dedicated automated gate in this repo revision yet; tracked explicitly until phased evidence lands per vendored plan.",
      scope: "artifacts/assurance/epic-closure.json",
      coveredEpicNumbers: naEpicNumbers,
    },
  ],
};

if (!process.argv.includes("--write")) {
  console.log(
    JSON.stringify(
      {
        evidenceCount: closures.filter((c) => c.mode === "evidence").length,
        naCount: naEpicNumbers.length,
      },
      null,
      2
    )
  );
  console.error("Dry run. Pass --write.");
  process.exit(0);
}

fs.mkdirSync(path.dirname(closurePath), { recursive: true });
fs.writeFileSync(closurePath, `${JSON.stringify(closurePayload, null, 2)}\n`);
fs.writeFileSync(naBulkPath, `${JSON.stringify(naBulkPayload, null, 2)}\n`);
console.log(`Wrote ${closures.length} closures (${naEpicNumbers.length} NA) → epic-closure.json + na-bulk-registry.json`);
