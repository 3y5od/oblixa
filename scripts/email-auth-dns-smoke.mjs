#!/usr/bin/env node
import dns from "node:dns/promises";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const strict = process.env.EMAIL_DNS_STRICT === "1" || process.env.EMAIL_DNS_STRICT === "true";
const root = process.cwd();
const fixtureRel = "config/email-auth-dns-fixtures.json";
const timeoutMs = Number.parseInt(process.env.EMAIL_DNS_TIMEOUT_MS || "8000", 10);
const domain = process.env.EMAIL_DNS_DOMAIN;

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function redacted(value) {
  const text = String(value);
  if (/^v=DKIM1\b/i.test(text)) return text.replace(/\bp=[A-Za-z0-9/+_-]{12,}/g, "p=<redacted>");
  if (/verification|token|secret/i.test(text)) return `[redacted-dns-token:${stableHash(text)}]`;
  return text.length > 160 ? `[redacted-dns-value:${stableHash(text)}]` : text;
}

function flattenTxt(rows) {
  return rows.map((parts) => parts.join(""));
}

function withTimeout(promise, label) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true, label }), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function lookupTxt(host) {
  try {
    const rows = await withTimeout(dns.resolveTxt(host), `${host}:TXT`);
    if (rows?.timedOut) return { host, status: "timeout", values: [], issue: "dns_lookup_timeout" };
    const textValues = flattenTxt(rows);
    return { host, status: textValues.length ? "present" : "missing", values: textValues.map(redacted).sort() };
  } catch (error) {
    const code = error?.code || error?.name || "lookup_error";
    return { host, status: code === "ENODATA" || code === "ENOTFOUND" ? "missing" : "error", values: [], issue: code };
  }
}

async function lookupMx(host) {
  try {
    const values = await withTimeout(dns.resolveMx(host), `${host}:MX`);
    if (values?.timedOut) return { host, status: "timeout", values: [], issue: "dns_lookup_timeout" };
    return {
      host,
      status: values.length ? "present" : "missing",
      values: values.map((value) => `${value.priority} ${value.exchange}`).sort(),
    };
  } catch (error) {
    const code = error?.code || error?.name || "lookup_error";
    return { host, status: code === "ENODATA" || code === "ENOTFOUND" ? "missing" : "error", values: [], issue: code };
  }
}

if (!strict) {
  console.log(JSON.stringify({ ok: true, mode: "skipped", strict, fixture: fixtureRel }, null, 2));
  process.exit(0);
}

if (!domain) {
  console.error(JSON.stringify({ ok: false, error: "missing_EMAIL_DNS_DOMAIN" }, null, 2));
  process.exit(1);
}

const fixture = JSON.parse(fs.readFileSync(path.join(root, fixtureRel), "utf8"));
const records = fixture.records || [];
const checks = [];
for (const record of records) {
  const type = String(record.type).toUpperCase();
  if (type === "MX") checks.push({ ...record, type, result: await lookupMx(record.host) });
  else checks.push({ ...record, type, result: await lookupTxt(record.host) });
}

const issues = [];
for (const check of checks) {
  const values = check.result.values || [];
  if (check.required && check.result.status !== "present") {
    issues.push({ issue: "email_dns_record_missing", type: check.type, host: check.host, boundary: "provider_manual_boundary" });
  }
  if (check.type === "SPF" && !values.some((value) => /^v=spf1\b.*(?:~all|-all)\b/i.test(value))) {
    issues.push({ issue: "email_dns_spf_not_enforcing", host: check.host });
  }
  if (check.type === "DKIM" && !values.some((value) => /^v=DKIM1\b/i.test(value))) {
    issues.push({ issue: "email_dns_dkim_missing", host: check.host });
  }
  if (check.type === "DMARC" && !values.some((value) => /^v=DMARC1\b.*\bp=(?:quarantine|reject)\b/i.test(value))) {
    issues.push({ issue: "email_dns_dmarc_not_enforcing", host: check.host });
  }
  if (check.type === "MTA-STS" && !values.some((value) => /^v=STSv1\b/i.test(value))) {
    issues.push({ issue: "email_dns_mta_sts_missing", host: check.host });
  }
}

const report = {
  ok: issues.length === 0,
  mode: "strict_read_only_email_dns",
  domain,
  fixture: fixtureRel,
  timeoutMs,
  checks: checks.map((check) => ({ type: check.type, host: check.host, required: Boolean(check.required), result: check.result })),
  issueCount: issues.length,
  issues,
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
