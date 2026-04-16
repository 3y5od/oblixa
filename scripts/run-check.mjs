#!/usr/bin/env node

import { buildCheckRegistry, listCheckIds } from "./check-registry.mjs";
import { createResult, finishWithResult } from "./lib/result.mjs";
import { nowMs } from "./lib/timing.mjs";
import { runNodeScript } from "./lib/process.mjs";

async function main() {
  const startedAt = nowMs();
  const [, , checkId, ...forwardedArgs] = process.argv;
  const registry = buildCheckRegistry();

  if (!checkId || checkId === "--help" || checkId === "-h") {
    finishWithResult(
      createResult({
        checkId: "run-check",
        ok: false,
        errors: ["missing check id"],
        meta: { availableChecks: listCheckIds() },
        startMs: startedAt,
      })
    );
  }

  const entry = registry.get(checkId);
  if (!entry) {
    finishWithResult(
      createResult({
        checkId: "run-check",
        ok: false,
        errors: [`unknown check id: ${checkId}`],
        meta: { availableChecks: listCheckIds() },
        startMs: startedAt,
      })
    );
  }

  const run = await runNodeScript(entry.file, forwardedArgs, { stdio: "inherit" });
  finishWithResult(
    createResult({
      checkId,
      ok: run.ok,
      strict: forwardedArgs.includes("--strict"),
      errors: run.ok ? [] : [`check failed with exit code ${run.code}`],
      meta: {
        relativeFile: entry.relativeFile,
      },
      startMs: startedAt,
      exitCode: run.code,
    })
  );
}

main().catch((error) => {
  finishWithResult(
    createResult({
      checkId: "run-check",
      ok: false,
      errors: [error instanceof Error ? error.message : String(error)],
      exitCode: 1,
    })
  );
});
