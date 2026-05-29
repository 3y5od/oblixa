#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const strict = process.env.GAME_DAY_STRICT === "1" || process.env.GAME_DAY_STRICT === "true";

const checklistPath = path.join(root, "artifacts", "qa-game-day-checklist.json");
let steps = [];
if (strict) {
  if (!fs.existsSync(checklistPath)) {
    console.error(
      JSON.stringify({ ok: false, checkId: "game-day-exec", error: "missing_checklist", checklistPath }, null, 2)
    );
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(checklistPath, "utf8"));
  steps = raw.steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    console.error(JSON.stringify({ ok: false, checkId: "game-day-exec", error: "checklist_steps_empty" }, null, 2));
    process.exit(1);
  }
}

const p = path.join(root, "artifacts", "security-program-optional-declarations.json");
if (!fs.existsSync(p)) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        checkId: "game-day-exec",
        mode: "no_manifest",
        strict,
        mutatesProduction: false,
        redactionPolicy: "metadata-only",
        stepCount: steps.length,
        steps: steps.map((step) => step.id).sort(),
      },
      null,
      2
    )
  );
  process.exit(0);
}
JSON.parse(fs.readFileSync(p, "utf8"));
console.log(
  JSON.stringify(
    {
      ok: true,
      checkId: "game-day-exec",
      strict,
      mutatesProduction: false,
      redactionPolicy: "metadata-only",
      stepCount: steps.length,
      steps: steps.map((step) => step.id).sort(),
    },
    null,
    2
  )
);
process.exit(0);
