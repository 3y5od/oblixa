import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { compareZapBaseline, extractZapAlerts } from "./zap-baseline-compare.mjs";

function makeRoot({ baseline, report }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-zap-"));
  fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
  fs.writeFileSync(path.join(root, "artifacts", "zap-baseline.json"), JSON.stringify(baseline));
  fs.writeFileSync(path.join(root, "zap-report.json"), JSON.stringify(report));
  return root;
}

test("extractZapAlerts parses common ZAP site alert reports", () => {
  const alerts = extractZapAlerts({
    site: [
      {
        "@name": "https://app.example.test",
        alerts: [{ pluginid: "10038", alert: "Content Security Policy Header Not Set", riskdesc: "High (Medium)" }],
      },
    ],
  });

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].risk, "high");
  assert.equal(alerts[0].pluginId, "10038");
});

test("strict compare fails on new high-risk alerts", () => {
  const root = makeRoot({
    baseline: { rules: [] },
    report: { alerts: [{ pluginId: "1", alert: "High Alert", riskcode: "3", url: "https://app.example.test/" }] },
  });

  const report = compareZapBaseline({ root, strict: true, nowMs: Date.parse("2026-01-01T00:00:00Z") });
  assert.equal(report.ok, false);
  assert.equal(report.issues[0].issue, "new_high_risk_zap_alert");
});

test("strict compare allows accepted high alerts only with owner, reason, and future expiry", () => {
  const root = makeRoot({
    baseline: {
      rules: [
        {
          pluginId: "1",
          alert: "High Alert",
          url: "https://app.example.test/",
          risk: "high",
          owner: "security",
          reason: "known upstream test fixture",
          expiresAt: "2026-02-01T00:00:00.000Z",
        },
      ],
    },
    report: { alerts: [{ pluginId: "1", alert: "High Alert", riskcode: "3", url: "https://app.example.test/" }] },
  });

  const report = compareZapBaseline({ root, strict: true, nowMs: Date.parse("2026-01-01T00:00:00Z") });
  assert.equal(report.ok, true);
});

test("strict compare rejects accepted high alerts with expired metadata", () => {
  const root = makeRoot({
    baseline: {
      rules: [
        {
          pluginId: "1",
          alert: "High Alert",
          url: "https://app.example.test/",
          risk: "high",
          owner: "security",
          reason: "temporary",
          expiresAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    },
    report: { alerts: [] },
  });

  const report = compareZapBaseline({ root, strict: true, nowMs: Date.parse("2026-01-01T00:00:00Z") });
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "accepted_high_alert_missing_metadata" && issue.reason === "expired"));
});
