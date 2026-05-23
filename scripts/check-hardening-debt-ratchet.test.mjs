import test from "node:test";
import assert from "node:assert/strict";
import { analyzeHardeningDebtRatchet } from "./check-hardening-debt-ratchet.mjs";

test("analyzeHardeningDebtRatchet rejects regressions above the baseline", () => {
  const report = analyzeHardeningDebtRatchet({
    strict: true,
    baseline: {
      skipCount: 1,
      allowlistEntryCount: 2,
      maxDelta: 0,
    },
    current: {
      skipCount: 2,
      allowlistEntryCount: 2,
    },
  });

  assert.equal(report.ok, false);
  assert.equal(report.violationCount, 1);
  assert.equal(report.violations[0].key, "skipCount");
});

test("analyzeHardeningDebtRatchet requires strict downward ratchets", () => {
  const report = analyzeHardeningDebtRatchet({
    strict: true,
    baseline: {
      skipCount: 5,
      allowlistEntryCount: 10,
      maxDelta: 0,
    },
    current: {
      skipCount: 4,
      allowlistEntryCount: 8,
    },
  });

  assert.equal(report.ok, false);
  assert.equal(report.violationCount, 0);
  assert.equal(report.ratchetCandidateCount, 2);
});

test("analyzeHardeningDebtRatchet can report non-strict downward ratchet candidates", () => {
  const report = analyzeHardeningDebtRatchet({
    strict: false,
    baseline: {
      skipCount: 5,
      allowlistEntryCount: 10,
      maxDelta: 0,
    },
    current: {
      skipCount: 4,
      allowlistEntryCount: 8,
    },
  });

  assert.equal(report.ok, true);
  assert.equal(report.ratchetCandidateCount, 2);
});

test("analyzeHardeningDebtRatchet honors explicit ratchet-down opt out", () => {
  const report = analyzeHardeningDebtRatchet({
    strict: true,
    baseline: {
      skipCount: 5,
      allowlistEntryCount: 10,
      enforceRatchetDown: false,
      maxDelta: 0,
    },
    current: {
      skipCount: 4,
      allowlistEntryCount: 8,
    },
  });

  assert.equal(report.ok, true);
  assert.equal(report.ratchetCandidateCount, 0);
});
