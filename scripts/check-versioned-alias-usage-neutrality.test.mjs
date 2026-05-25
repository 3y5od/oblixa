import assert from "node:assert/strict";
import { test } from "node:test";

import { analyzeVersionedAliasUsageNeutrality } from "./check-versioned-alias-usage-neutrality.mjs";

test("versioned alias usage neutrality covers retained legacy aliases with queues", () => {
  const report = analyzeVersionedAliasUsageNeutrality();
  assert.equal(report.current.totals.aliasCount > 0, true);
  assert.equal(report.current.totals.queueCoveredCount, report.current.totals.aliasCount);
  assert.equal(report.current.totals.neutralReferenceCount > 0, true);
  assert.equal(report.current.issues.length, 0);
});
