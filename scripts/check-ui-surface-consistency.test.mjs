import test from "node:test";
import assert from "node:assert/strict";
import { analyzeUiSurfaceConsistency } from "./check-ui-surface-consistency.mjs";

test("analyzeUiSurfaceConsistency passes for the committed route closure surface", () => {
  const report = analyzeUiSurfaceConsistency();
  assert.equal(report.issueCount, 0);
  assert.ok(report.counts.manifestRoutes > 0);
  assert.ok(report.counts.navigationHrefsChecked > 0);
});