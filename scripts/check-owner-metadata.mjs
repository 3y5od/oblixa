#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const reportOnly = process.argv.includes("--report");
const issues = [];
const warnings = [];
const todayIso = new Date().toISOString().slice(0, 10);
const warningWindowDays = 30;

function toDayNumber(value) {
  if (typeof value !== "string") return null;
  const dt = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) return null;
  return Math.floor(dt.getTime() / 86_400_000);
}

const allowlist = readFileSync(path.join(ROOT, "scripts", "api-route-test-allowlist.txt"), "utf8").split("\n");
const metaRe = /^#\s*meta:\s*owner=([^\s]+)\s+expiry=(\d{4}-\d{2}-\d{2})\s+reason=(.+)$/;
let currentMeta = null;
let allowlistRouteCount = 0;
let allowlistExpiredCount = 0;
let allowlistExpiringSoonCount = 0;
const todayDay = toDayNumber(todayIso) ?? 0;
for (const [idx, line] of allowlist.entries()) {
  const t = line.trim();
  if (!t) continue;
  if (t.startsWith("#")) {
    const m = t.match(metaRe);
    if (m) {
      currentMeta = { owner: m[1], expiry: m[2], reason: m[3] };
      if (!currentMeta.owner.startsWith("@")) {
        issues.push({ file: "scripts/api-route-test-allowlist.txt", line: idx + 1, issue: "owner_must_start_with_at" });
      }
      if (!currentMeta.reason.trim()) {
        issues.push({ file: "scripts/api-route-test-allowlist.txt", line: idx + 1, issue: "reason_must_be_non_empty" });
      }
      const expiryDay = toDayNumber(currentMeta.expiry);
      if (expiryDay === null) {
        issues.push({
          file: "scripts/api-route-test-allowlist.txt",
          line: idx + 1,
          issue: "invalid_expiry_format",
        });
      } else {
        const daysUntilExpiry = expiryDay - todayDay;
        if (daysUntilExpiry < 0) {
          allowlistExpiredCount += 1;
          issues.push({
            file: "scripts/api-route-test-allowlist.txt",
            line: idx + 1,
            issue: "expired_allowlist_meta",
            expiry: currentMeta.expiry,
            daysPastExpiry: Math.abs(daysUntilExpiry),
          });
        } else if (daysUntilExpiry <= warningWindowDays) {
          allowlistExpiringSoonCount += 1;
          warnings.push({
            file: "scripts/api-route-test-allowlist.txt",
            line: idx + 1,
            warning: "allowlist_meta_expiring_soon",
            expiry: currentMeta.expiry,
            daysUntilExpiry,
          });
        }
      }
    }
    continue;
  }
  allowlistRouteCount += 1;
  if (!currentMeta) {
    issues.push({ file: "scripts/api-route-test-allowlist.txt", line: idx + 1, issue: "missing_meta_for_route" });
  }
}

const exemptions = JSON.parse(
  readFileSync(path.join(ROOT, "src/lib/product-surface/v8-test-exemptions.json"), "utf8")
);
let exemptionCount = 0;
let exemptionExpiredCount = 0;
let exemptionExpiringSoonCount = 0;
for (const [idx, row] of (Array.isArray(exemptions) ? exemptions : []).entries()) {
  exemptionCount += 1;
  if (!row.owner || typeof row.owner !== "string" || !row.owner.startsWith("@")) {
    issues.push({ file: "src/lib/product-surface/v8-test-exemptions.json", row: idx, issue: "owner_must_start_with_at" });
  }
  if (!row.reason || typeof row.reason !== "string" || !row.reason.trim()) {
    issues.push({ file: "src/lib/product-surface/v8-test-exemptions.json", row: idx, issue: "reason_must_be_non_empty" });
  }
  if (!row.expiresOn || typeof row.expiresOn !== "string") {
    issues.push({ file: "src/lib/product-surface/v8-test-exemptions.json", row: idx, issue: "missing_expires_on" });
    continue;
  }
  const expiryDay = toDayNumber(row.expiresOn);
  if (expiryDay === null) {
    issues.push({
      file: "src/lib/product-surface/v8-test-exemptions.json",
      row: idx,
      issue: "invalid_expires_on_format",
    });
    continue;
  }
  const daysUntilExpiry = expiryDay - todayDay;
  if (daysUntilExpiry < 0) {
    exemptionExpiredCount += 1;
    issues.push({
      file: "src/lib/product-surface/v8-test-exemptions.json",
      row: idx,
      issue: "expired_exemption",
      expiry: row.expiresOn,
      daysPastExpiry: Math.abs(daysUntilExpiry),
    });
  } else if (daysUntilExpiry <= warningWindowDays) {
    exemptionExpiringSoonCount += 1;
    warnings.push({
      file: "src/lib/product-surface/v8-test-exemptions.json",
      row: idx,
      warning: "exemption_expiring_soon",
      expiry: row.expiresOn,
      daysUntilExpiry,
    });
  }
}

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      issueCount: issues.length,
      warningCount: warnings.length,
      allowlistRouteCount,
      allowlistExpiredCount,
      allowlistExpiringSoonCount,
      exemptionCount,
      exemptionExpiredCount,
      exemptionExpiringSoonCount,
      issues,
      warnings,
    },
    null,
    2
  )
);

if (!reportOnly && issues.length > 0) {
  process.exit(1);
}
