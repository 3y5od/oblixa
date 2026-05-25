import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDependencyRiskReport,
  dependencyRiskReportExitCode,
} from "./report-dependency-risk.mjs";

const NOW = new Date("2026-05-11T00:00:00.000Z");

function auditResult(stdout, overrides = {}) {
  return { stdout, status: 0, ...overrides };
}

test("dependency risk report passes on valid audit metadata with no high or critical vulnerabilities", () => {
  const report = buildDependencyRiskReport(
    auditResult(
      JSON.stringify({
        metadata: {
          vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, total: 0 },
          dependencies: { prod: 10, dev: 5 },
        },
        vulnerabilities: {},
      })
    ),
    NOW
  );

  assert.equal(report.ok, true);
  assert.equal(report.auditUnavailable, false);
  assert.equal(report.summary.riskLevel, "low");
  assert.equal(report.generatedAt, NOW.toISOString());
});

test("dependency risk report fails on high vulnerabilities", () => {
  const report = buildDependencyRiskReport(
    auditResult(
      JSON.stringify({
        metadata: {
          vulnerabilities: { critical: 0, high: 1, moderate: 0, low: 0, total: 1 },
          dependencies: {},
        },
        vulnerabilities: { next: {} },
      }),
      { status: 1 }
    ),
    NOW
  );

  assert.equal(report.ok, false);
  assert.equal(report.auditUnavailable, false);
  assert.equal(report.summary.riskLevel, "high");
  assert.equal(report.summary.highOrCriticalCount, 1);
  assert.equal(dependencyRiskReportExitCode(report), 1);
});

test("dependency risk report fails closed on malformed audit output", () => {
  const report = buildDependencyRiskReport(auditResult("{not-json", { status: 1 }), NOW);

  assert.equal(report.ok, false);
  assert.equal(report.auditUnavailable, true);
  assert.equal(report.summary.riskLevel, "unknown");
  assert.match(report.auditError, /JSON/);
  assert.equal(dependencyRiskReportExitCode(report), 0);
});

test("dependency risk report fails closed on empty audit output", () => {
  const report = buildDependencyRiskReport(auditResult("", { status: 1 }), NOW);

  assert.equal(report.ok, false);
  assert.equal(report.auditUnavailable, true);
  assert.equal(report.auditError, "empty npm audit JSON output");
});

test("dependency risk report fails closed on audit command errors", () => {
  const report = buildDependencyRiskReport(
    auditResult(
      JSON.stringify({
        metadata: {
          vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, total: 0 },
          dependencies: {},
        },
        vulnerabilities: {},
      }),
      { status: 1, error: new Error("registry unavailable") }
    ),
    NOW
  );

  assert.equal(report.ok, false);
  assert.equal(report.auditUnavailable, true);
  assert.match(report.auditError, /registry unavailable/);
});
