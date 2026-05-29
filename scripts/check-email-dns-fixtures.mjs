#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const FIXTURE_REL = "config/email-auth-dns-fixtures.json";
const MTA_STS_CONTRACT_REL = "artifacts/mta-sts-contract.json";
const REQUIRED_TYPES = ["SPF", "DKIM", "DMARC", "MX", "MTA-STS"];

function readJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

export function analyzeEmailDnsFixtures(root = ROOT, env = process.env) {
  const issues = [];
  const fixturePath = path.join(root, FIXTURE_REL);
  const mtaStsPath = path.join(root, MTA_STS_CONTRACT_REL);
  if (!fs.existsSync(fixturePath)) {
    issues.push(issue("email_dns_fixture_missing", { path: FIXTURE_REL }));
  }
  if (!fs.existsSync(mtaStsPath)) {
    issues.push(issue("email_dns_mta_sts_contract_missing", { path: MTA_STS_CONTRACT_REL }));
  }

  const fixture = fs.existsSync(fixturePath) ? readJson(root, FIXTURE_REL) : {};
  if (fixture.schemaVersion !== 1 || fixture.source !== "code-owned-email-auth-dns-fixtures") {
    issues.push(issue("email_dns_invalid_fixture_metadata"));
  }

  const records = Array.isArray(fixture.records) ? fixture.records : [];
  const byType = new Map(records.map((record) => [String(record.type).toUpperCase(), record]));
  for (const type of REQUIRED_TYPES) {
    const record = byType.get(type);
    if (!record) {
      issues.push(issue("email_dns_required_record_missing", { type }));
      continue;
    }
    for (const field of ["host", "expected"]) {
      if (typeof record[field] !== "string" || record[field].trim().length === 0) {
        issues.push(issue("email_dns_record_field_missing", { type, field }));
      }
    }
    if (record.required !== true) {
      issues.push(issue("email_dns_record_not_required", { type }));
    }
  }

  const dmarc = byType.get("DMARC");
  if (dmarc && !/p=(quarantine|reject)/i.test(String(dmarc.expected))) {
    issues.push(issue("email_dns_dmarc_policy_not_enforcing"));
  }
  const spf = byType.get("SPF");
  if (spf && !/(?:-all|~all)\b/i.test(String(spf.expected))) {
    issues.push(issue("email_dns_spf_missing_all_policy"));
  }

  const live = env.CHECK_EMAIL_DNS_LIVE === "1";
  return {
    checkId: "email-dns-fixtures",
    ok: issues.length === 0,
    mode: live ? "live_dns_requested_code_fixture_validated" : "fixtures_only",
    fixture: FIXTURE_REL,
    mtaStsContract: MTA_STS_CONTRACT_REL,
    domain: fixture.domain ?? null,
    requiredRecordTypes: REQUIRED_TYPES,
    recordCount: records.length,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeEmailDnsFixtures();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
