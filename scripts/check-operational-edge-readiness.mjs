#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { analyzeEmailDnsFixtures } from "./check-email-dns-fixtures.mjs";
import { analyzePublicSeoSurface } from "./check-public-seo-surface.mjs";
import { analyzeSensitiveCacheControls } from "./check-sensitive-cache-controls.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-edge-readiness.json";
const ARTIFACT_REL = "artifacts/operational-edge-readiness.json";
const WRITE = process.argv.includes("--write");

const REQUIRED_DNS_TYPES = ["A", "AAAA", "CNAME", "CAA", "TXT", "SPF", "DKIM", "DMARC", "verification"];
const REQUIRED_TLS_CHECKS = ["expiry", "issuer", "san", "protocol-minimum", "http-to-https-redirect", "hsts", "mixed-content-risk"];
const REQUIRED_EMAIL_CHECKS = ["spf", "dkim", "dmarc", "mx", "mta-sts", "sending-domain", "bounce-domain", "reply-to", "staging-production-separation"];
const REQUIRED_PUBLIC_METADATA_CHECKS = ["robots", "sitemap", "canonical", "open-graph", "twitter", "icon-assets", "security.txt", "private-route-leakage"];
const REQUIRED_CACHE_CHECKS = ["cache-control", "vary", "stale-while-revalidate", "purge-boundary", "cache-poisoning-guards", "sensitive-no-store"];

const SCRIPT_MARKERS = {
  "scripts/dns-caa-smoke.mjs": [
    "resolve4",
    "resolve6",
    "resolveCaa",
    "resolveTxt",
    "resolveCname",
    "DNS_REQUIRED_TYPES",
    "provider_manual_boundary",
    "redacted",
    "timeoutMs",
  ],
  "scripts/email-auth-dns-smoke.mjs": [
    "config/email-auth-dns-fixtures.json",
    "resolveMx",
    "resolveTxt",
    "DKIM",
    "DMARC",
    "MTA-STS",
    "EMAIL_DNS_STRICT",
    "redacted",
  ],
  "scripts/cert-expiry-smoke.mjs": [
    "getPeerCertificate",
    "getProtocol",
    "subjectaltname",
    "strict-transport-security",
    "mixedContentUrls",
    "redirectsToHttps",
    "CERT_MIN_DAYS",
  ],
  "scripts/dnssec-privacy-smoke.mjs": [
    "resolveDs",
    "resolveSoa",
    "resolveNs",
    "_mta-sts",
    "DNSSEC_REQUIRE_DS",
    "provider_manual_boundary",
  ],
};

const FILE_MARKERS = {
  "src/app/layout.tsx": ["metadataBase", "openGraph", "twitter", "icons"],
  "src/app/robots.ts": ['process.env.VERCEL_ENV === "preview"', "sitemap", "GPTBot", "OAI-SearchBot"],
  "src/app/sitemap.ts": ["SITEMAP_PATHS", "getAppBaseUrlFromEnv"],
  "src/lib/marketing/public-paths.ts": ["PUBLIC_INFORMATION_PATHS", "SITEMAP_PATHS", "isMetadataImageRoute"],
  "public/robots.txt": ["User-agent: *", "Disallow: /api/", "Disallow: /dashboard/"],
  "public/.well-known/security.txt": ["Contact:", "Canonical:", "Policy:"],
  "next.config.ts": ["buildApiNoStoreHeaders", "headers: apiNoStoreHeaders"],
};

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readText(rel) {
  const abs = path.join(ROOT, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(rel, fallback = null) {
  const text = readText(rel);
  return text ? JSON.parse(text) : fallback;
}

function writeJson(rel, value) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function requirePackageScript(packageScripts, script, issues, fields = {}) {
  if (!packageScripts[script]) issues.push(issue("operational_edge_missing_package_script", { ...fields, script }));
}

function requireCoverage(values, required, code, issues, field = "value") {
  const actual = new Set(Array.isArray(values) ? values : []);
  for (const value of required) {
    if (!actual.has(value)) issues.push(issue(code, { [field]: value }));
  }
}

function collectMarkerRows(markerMap, issues, issuePrefix) {
  const rows = [];
  for (const [rel, markers] of Object.entries(markerMap)) {
    const source = readText(rel);
    const missing = [];
    if (!source) {
      missing.push(...markers);
      issues.push(issue(`${issuePrefix}_missing_file`, { path: rel }));
    } else {
      for (const marker of markers) {
        if (!source.includes(marker)) {
          missing.push(marker);
          issues.push(issue(`${issuePrefix}_missing_marker`, { path: rel, marker }));
        }
      }
    }
    rows.push({ path: rel, markerCount: markers.length, missingCount: missing.length, ok: missing.length === 0 });
  }
  return rows;
}

function validateConfig(config, packageScripts, ci, issues) {
  if (config?.schemaVersion !== 1 || config?.source !== "code-owned-operational-edge-readiness") {
    issues.push(issue("operational_edge_invalid_config_metadata"));
  }
  if (config?.generatedArtifact !== ARTIFACT_REL) {
    issues.push(issue("operational_edge_unexpected_artifact", { generatedArtifact: config?.generatedArtifact ?? null }));
  }
  for (const rel of config?.sourceFiles ?? []) {
    if (!readText(rel)) issues.push(issue("operational_edge_source_file_missing", { path: rel }));
  }
  for (const script of config?.requiredValidationCommands ?? []) {
    requirePackageScript(packageScripts, script, issues, { source: "requiredValidationCommands" });
  }
  requirePackageScript(packageScripts, "check:operational-edge-readiness", issues);
  if (!ci.includes("npm run check:operational-edge-readiness")) {
    issues.push(issue("operational_edge_missing_ci_command", { command: "npm run check:operational-edge-readiness" }));
  }

  requireCoverage(config?.dnsReadiness?.recordTypes, REQUIRED_DNS_TYPES, "operational_edge_missing_dns_record_type", issues, "type");
  requireCoverage(config?.tlsReadiness?.checks, REQUIRED_TLS_CHECKS, "operational_edge_missing_tls_check", issues, "check");
  requireCoverage(config?.emailAuthReadiness?.checks, REQUIRED_EMAIL_CHECKS, "operational_edge_missing_email_auth_check", issues, "check");
  requireCoverage(config?.publicMetadataReadiness?.checks, REQUIRED_PUBLIC_METADATA_CHECKS, "operational_edge_missing_public_metadata_check", issues, "check");
  requireCoverage(config?.edgeCacheReadiness?.checks, REQUIRED_CACHE_CHECKS, "operational_edge_missing_cache_check", issues, "check");

  if (config?.dnsReadiness?.mode !== "read-only-env-gated") issues.push(issue("operational_edge_dns_not_read_only_env_gated"));
  if (config?.tlsReadiness?.mode !== "read-only-env-gated") issues.push(issue("operational_edge_tls_not_read_only_env_gated"));
  if (config?.emailAuthReadiness?.fixture !== "config/email-auth-dns-fixtures.json") {
    issues.push(issue("operational_edge_email_fixture_unexpected", { fixture: config?.emailAuthReadiness?.fixture ?? null }));
  }
  if ((config?.tlsReadiness?.minimumDaysRemaining ?? 0) < 30) issues.push(issue("operational_edge_tls_minimum_days_too_low"));
  if ((config?.dnsReadiness?.timeoutMs ?? 0) <= 0 || (config?.tlsReadiness?.timeoutMs ?? 0) <= 0) {
    issues.push(issue("operational_edge_missing_timeout_bounds"));
  }
  const privatePrefixes = new Set(config?.publicMetadataReadiness?.privatePrefixes ?? []);
  for (const prefix of ["/api", "/dashboard", "/settings", "/search"]) {
    if (!privatePrefixes.has(prefix)) issues.push(issue("operational_edge_private_prefix_missing", { prefix }));
  }

  const classes = new Set((config?.edgeCacheReadiness?.classifications ?? []).map((row) => row.cacheClass));
  for (const requiredClass of ["public-cacheable", "public-metadata-asset", "private-no-store"]) {
    if (!classes.has(requiredClass)) issues.push(issue("operational_edge_cache_class_missing", { cacheClass: requiredClass }));
  }
}

function summarize(checkId, report) {
  return {
    checkId,
    ok: Boolean(report.ok),
    issueCount: Number(report.issueCount ?? report.issues?.length ?? 0),
  };
}

export function buildOperationalEdgeReadinessReport() {
  const config = readJson(CONFIG_REL, {});
  const packageScripts = readJson("package.json", { scripts: {} })?.scripts ?? {};
  const ci = readText(".github/workflows/ci.yml");
  const issues = [];
  validateConfig(config, packageScripts, ci, issues);
  const scriptMarkerRows = collectMarkerRows(SCRIPT_MARKERS, issues, "operational_edge_script");
  const fileMarkerRows = collectMarkerRows(FILE_MARKERS, issues, "operational_edge_file");

  const delegatedChecks = [
    summarize("email-dns-fixtures", analyzeEmailDnsFixtures(ROOT)),
    summarize("public-seo-surface", analyzePublicSeoSurface(ROOT)),
    summarize("sensitive-cache-controls", analyzeSensitiveCacheControls(ROOT)),
  ];
  for (const report of delegatedChecks) {
    if (!report.ok) issues.push(issue("operational_edge_delegated_check_failed", { checkId: report.checkId, issueCount: report.issueCount }));
  }

  return {
    schemaVersion: 1,
    source: "code-owned-operational-edge-readiness",
    generatedArtifact: ARTIFACT_REL,
    ok: issues.length === 0,
    summary: {
      dnsRecordTypeCount: config.dnsReadiness?.recordTypes?.length ?? 0,
      tlsCheckCount: config.tlsReadiness?.checks?.length ?? 0,
      emailAuthCheckCount: config.emailAuthReadiness?.checks?.length ?? 0,
      publicMetadataCheckCount: config.publicMetadataReadiness?.checks?.length ?? 0,
      cacheClassificationCount: config.edgeCacheReadiness?.classifications?.length ?? 0,
    },
    requiredValidationCommands: config.requiredValidationCommands ?? [],
    dnsReadiness: config.dnsReadiness ?? null,
    tlsReadiness: config.tlsReadiness ?? null,
    emailAuthReadiness: config.emailAuthReadiness ?? null,
    publicMetadataReadiness: config.publicMetadataReadiness ?? null,
    edgeCacheReadiness: config.edgeCacheReadiness ?? null,
    scriptMarkerRows,
    fileMarkerRows,
    delegatedChecks,
    manualBoundary: config.manualBoundary ?? null,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

const report = buildOperationalEdgeReadinessReport();

if (WRITE) {
  writeJson(ARTIFACT_REL, report);
} else {
  const existing = readJson(ARTIFACT_REL, null);
  if (!existing) {
    report.issues.push(issue("operational_edge_artifact_missing", { artifact: ARTIFACT_REL }));
    report.issueCount = report.issues.length;
    report.ok = false;
  } else if (stableStringify(existing) !== stableStringify(report)) {
    report.issues.push(issue("operational_edge_artifact_drift", { artifact: ARTIFACT_REL, writeCommand: "npm run write:operational-edge-readiness" }));
    report.issueCount = report.issues.length;
    report.ok = false;
  }
}

console.log(stableStringify(report));

if (!report.ok) {
  process.exitCode = 1;
}
