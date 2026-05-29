#!/usr/bin/env node
import dns from "node:dns/promises";
import process from "node:process";

const strict = process.env.DOMAIN_STRICT === "1" || process.env.DOMAIN_STRICT === "true";
const apex = process.env.PUBLIC_APEX_DOMAIN;
const timeoutMs = Number.parseInt(process.env.DNS_TIMEOUT_MS || "8000", 10);
const requiredTypes = new Set(
  (process.env.DNS_REQUIRED_TYPES || "A,CAA,TXT")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean),
);

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
  if (/google-site-verification|verification|token|secret/i.test(text)) return `[redacted-dns-token:${stableHash(text)}]`;
  if (/^v=(?:spf1|dmarc1|dkim1|stsv1)\b/i.test(text)) return text.replace(/\bp=[A-Za-z0-9/+_-]{12,}/g, "p=<redacted>");
  if (text.length > 120) return `[redacted-dns-value:${stableHash(text)}]`;
  return text;
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

async function lookupRecord(type, host) {
  try {
    let values;
    if (type === "A") values = await withTimeout(dns.resolve4(host), `${host}:A`);
    else if (type === "AAAA") values = await withTimeout(dns.resolve6(host), `${host}:AAAA`);
    else if (type === "CAA") values = await withTimeout(dns.resolveCaa(host), `${host}:CAA`);
    else if (type === "CNAME") values = await withTimeout(dns.resolveCname(host), `${host}:CNAME`);
    else if (type === "TXT") {
      const txtRows = await withTimeout(dns.resolveTxt(host), `${host}:TXT`);
      if (txtRows?.timedOut) return { host, type, status: "timeout", values: [], issue: "dns_lookup_timeout" };
      values = flattenTxt(txtRows);
    }
    else throw new Error(`Unsupported DNS type ${type}`);
    if (values?.timedOut) return { host, type, status: "timeout", values: [], issue: "dns_lookup_timeout" };
    const normalizedValues = (values || []).map((value) => (typeof value === "object" ? JSON.stringify(value) : String(value)));
    return { host, type, status: normalizedValues.length ? "present" : "missing", values: normalizedValues.map(redacted).sort() };
  } catch (error) {
    const code = error?.code || error?.name || "lookup_error";
    return { host, type, status: code === "ENODATA" || code === "ENOTFOUND" ? "missing" : "error", values: [], issue: code };
  }
}

if (!strict) {
  console.log(JSON.stringify({ ok: true, mode: "skipped", strict, timeoutMs }, null, 2));
  process.exit(0);
}

if (!apex) {
  console.error(JSON.stringify({ ok: false, error: "missing_PUBLIC_APEX_DOMAIN" }, null, 2));
  process.exit(1);
}

const cnameHosts = (process.env.PUBLIC_DNS_CNAME_HOSTS || `www.${apex}`).split(",").map((value) => value.trim()).filter(Boolean);
const txtHosts = (process.env.PUBLIC_DNS_TXT_HOSTS || apex).split(",").map((value) => value.trim()).filter(Boolean);
const checks = [
  { type: "A", host: apex },
  { type: "AAAA", host: apex },
  { type: "CAA", host: apex },
  ...txtHosts.map((host) => ({ type: "TXT", host })),
  ...cnameHosts.map((host) => ({ type: "CNAME", host })),
];

const results = [];
for (const check of checks) {
  results.push(await lookupRecord(check.type, check.host));
}

const issues = results
  .filter((result) => requiredTypes.has(result.type) && result.status !== "present")
  .map((result) => ({
    issue: result.issue || "dns_record_missing",
    host: result.host,
    type: result.type,
    boundary: "provider_manual_boundary",
  }));

const report = {
  ok: issues.length === 0,
  mode: "strict_read_only_dns",
  apex,
  timeoutMs,
  requiredTypes: [...requiredTypes].sort(),
  results,
  issueCount: issues.length,
  issues,
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
