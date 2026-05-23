#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

function readJson(abs) {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function riskLevel(alert) {
  const code = Number(alert.riskcode ?? alert.riskCode ?? alert.risk_code);
  if (Number.isFinite(code)) {
    if (code >= 3) return "high";
    if (code === 2) return "medium";
    if (code === 1) return "low";
  }
  const risk = String(alert.riskdesc ?? alert.riskDesc ?? alert.risk ?? "").toLowerCase();
  if (risk.startsWith("high")) return "high";
  if (risk.startsWith("medium")) return "medium";
  if (risk.startsWith("low")) return "low";
  return "informational";
}

function alertKey(alert) {
  const pluginId = String(alert.pluginid ?? alert.pluginId ?? alert.id ?? "").trim();
  const name = String(alert.alert ?? alert.name ?? "").trim().toLowerCase();
  const url = String(alert.url ?? alert.uri ?? alert.path ?? "").trim().toLowerCase();
  return `${pluginId}|${name}|${url}`;
}

export function extractZapAlerts(report) {
  const alerts = [];
  for (const alert of toArray(report?.alerts)) alerts.push(alert);
  for (const site of toArray(report?.site)) {
    for (const alert of toArray(site?.alerts)) alerts.push({ ...alert, site: site?.["@name"] ?? site?.name ?? null });
  }
  for (const site of toArray(report?.sites)) {
    for (const alert of toArray(site?.alerts)) alerts.push({ ...alert, site: site?.name ?? null });
  }
  return alerts.map((alert) => ({
    pluginId: String(alert.pluginid ?? alert.pluginId ?? alert.id ?? ""),
    alert: String(alert.alert ?? alert.name ?? ""),
    risk: riskLevel(alert),
    url: String(alert.url ?? alert.uri ?? alert.path ?? ""),
    key: alertKey(alert),
  }));
}

function acceptedRules(baseline) {
  return toArray(baseline?.rules).map((rule) => ({
    pluginId: String(rule.pluginId ?? rule.pluginid ?? ""),
    alert: String(rule.alert ?? rule.name ?? ""),
    url: String(rule.url ?? rule.path ?? ""),
    risk: String(rule.risk ?? "high").toLowerCase(),
    owner: String(rule.owner ?? ""),
    reason: String(rule.reason ?? ""),
    expiresAt: String(rule.expiresAt ?? rule.expires_at ?? ""),
    key: alertKey(rule),
  }));
}

function metadataIssue(rule, nowMs) {
  if (!rule.owner.trim()) return "missing_owner";
  if (!rule.reason.trim()) return "missing_reason";
  if (!rule.expiresAt.trim()) return "missing_expiry";
  const expiresMs = Date.parse(rule.expiresAt);
  if (!Number.isFinite(expiresMs)) return "invalid_expiry";
  if (expiresMs <= nowMs) return "expired";
  return null;
}

export function compareZapBaseline(options = {}) {
  const root = options.root ?? ROOT;
  const strict = options.strict ?? (process.env.ZAP_STRICT === "1" || process.env.ZAP_STRICT === "true");
  const baselineRel = options.baselineRel ?? "artifacts/zap-baseline.json";
  const reportRel = options.reportRel ?? process.env.ZAP_REPORT_PATH ?? "zap-report.json";
  const nowMs = options.nowMs ?? Date.now();
  const baselinePath = path.join(root, baselineRel);
  const reportPath = path.join(root, reportRel);
  const issues = [];

  if (!fs.existsSync(baselinePath)) issues.push({ issue: "missing_zap_baseline", rel: baselineRel });
  if (!fs.existsSync(reportPath)) issues.push({ issue: "missing_zap_report", rel: reportRel });
  if (issues.length > 0) {
    return { checkId: "zap-baseline-compare", ok: !strict, mode: strict ? "strict" : "advisory", issues, issueCount: issues.length };
  }

  const baseline = readJson(baselinePath);
  const report = readJson(reportPath);
  const rules = acceptedRules(baseline);
  const accepted = new Set(rules.map((rule) => rule.key));

  for (const rule of rules.filter((rule) => rule.risk === "high")) {
    const issue = metadataIssue(rule, nowMs);
    if (issue) issues.push({ issue: "accepted_high_alert_missing_metadata", reason: issue, rule });
  }

  const alerts = extractZapAlerts(report);
  const newHighAlerts = alerts.filter((alert) => alert.risk === "high" && !accepted.has(alert.key));
  for (const alert of newHighAlerts) issues.push({ issue: "new_high_risk_zap_alert", alert });

  return {
    checkId: "zap-baseline-compare",
    ok: issues.length === 0,
    mode: strict ? "strict" : "advisory",
    alertCount: alerts.length,
    highAlertCount: alerts.filter((alert) => alert.risk === "high").length,
    acceptedRuleCount: rules.length,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = compareZapBaseline();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
