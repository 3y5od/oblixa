import assert from "node:assert/strict";
import { test } from "node:test";

import { analyzeVersionedEnvFlagAliases } from "./check-versioned-env-flag-aliases.mjs";

test("versioned env flag aliases stay source, example, queue, and test covered", () => {
  const report = analyzeVersionedEnvFlagAliases();
  assert.equal(report.current.totals.aliasCount, 22);
  assert.equal(report.current.totals.sourceCoveredCount, 22);
  assert.equal(report.current.totals.exampleCoveredCount, 22);
  assert.equal(report.current.totals.queueCoveredCount, 22);
  assert.equal(report.current.externalCollaborationFallbackCovered, true);
});
