#!/usr/bin/env node
import dns from "node:dns/promises";
import process from "node:process";

const strict = process.env.DNSSEC_PRIVACY_STRICT === "1" || process.env.DNSSEC_PRIVACY_STRICT === "true";
const domain = process.env.PUBLIC_APEX_DOMAIN || process.env.EMAIL_DNS_DOMAIN;
const timeoutMs = Number.parseInt(process.env.DNSSEC_TIMEOUT_MS || "8000", 10);
const requireDs = process.env.DNSSEC_REQUIRE_DS === "1" || process.env.DNSSEC_REQUIRE_DS === "true";

function withTimeout(promise, label) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true, label }), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function lookup(label, fn) {
  try {
    const values = await withTimeout(fn(), label);
    if (values?.timedOut) return { label, status: "timeout", values: [], issue: "dns_lookup_timeout" };
    return { label, status: values?.length || values?.nsname ? "present" : "missing", values };
  } catch (error) {
    const code = error?.code || error?.name || "lookup_error";
    return { label, status: code === "ENODATA" || code === "ENOTFOUND" ? "missing" : "error", values: [], issue: code };
  }
}

if (!strict) {
  console.log(JSON.stringify({ ok: true, mode: "skipped", strict, timeoutMs }, null, 2));
  process.exit(0);
}

if (!domain) {
  console.error(JSON.stringify({ ok: false, error: "missing_PUBLIC_APEX_DOMAIN_or_EMAIL_DNS_DOMAIN" }, null, 2));
  process.exit(1);
}

const checks = [
  await lookup(`${domain}:DS`, () => dns.resolveDs(domain)),
  await lookup(`${domain}:SOA`, () => dns.resolveSoa(domain)),
  await lookup(`${domain}:NS`, () => dns.resolveNs(domain)),
  await lookup(`_mta-sts.${domain}:TXT`, () => dns.resolveTxt(`_mta-sts.${domain}`)),
  await lookup(`_dmarc.${domain}:TXT`, () => dns.resolveTxt(`_dmarc.${domain}`)),
];

const issues = [];
for (const check of checks) {
  if (check.label.endsWith(":SOA") && check.status !== "present") issues.push({ issue: "dns_soa_missing", label: check.label, boundary: "provider_manual_boundary" });
  if (check.label.endsWith(":NS") && check.status !== "present") issues.push({ issue: "dns_ns_missing", label: check.label, boundary: "provider_manual_boundary" });
  if (check.label.endsWith(":DS") && requireDs && check.status !== "present") issues.push({ issue: "dnssec_ds_missing", label: check.label, boundary: "provider_manual_boundary" });
}

const report = {
  ok: issues.length === 0,
  mode: "strict_read_only_dnssec_privacy",
  domain,
  timeoutMs,
  requireDs,
  checks,
  issueCount: issues.length,
  issues,
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
