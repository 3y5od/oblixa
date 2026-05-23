#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

const REQUIRED_PACKAGE_SCRIPTS = ["check:forwarded-header-safety"];
const REQUIRED_FILE_MARKERS = {
  "src/lib/security/trusted-forwarded.ts": [
    "OBLIXA_TRUST_FORWARDED_IP",
    "export function isForwardedClientIpTrusted",
    "export function requireTrustedClientIpConfigForProduction",
    "Missing ${TRUST_FORWARDED_IP_ENV}=1",
    "export function getTrustedClientIpFromHeaders",
    "export function getTrustedClientIpFromRequest",
    "normalizeForwardedClientIp(headers.get(\"x-forwarded-for\"))",
    "normalizeForwardedClientIp(headers.get(\"x-real-ip\"))",
  ],
  "src/lib/rate-limit.ts": [
    "getTrustedClientIpFromHeaders",
    "getTrustedClientIpFromRequest",
    "return getTrustedClientIpFromRequest(request)",
    "return getTrustedClientIpFromHeaders(h)",
  ],
  "src/lib/security/trusted-forwarded.test.ts": [
    "ignores client IP forwarding headers unless a trusted proxy is configured",
    "uses the first forwarded client IP when running behind a trusted proxy",
    "fails closed in non-Vercel production when trusted client IP config is absent",
    "falls back safely when trusted forwarded IP headers are malformed",
  ],
  ".env.example": [
    "OBLIXA_TRUST_FORWARDED_IP",
    "Vercel is trusted automatically",
  ],
};

const FORBIDDEN_RATE_LIMIT_MARKERS = [
  "forwarded.split(\",\")[0]",
  "request.headers.get(\"x-forwarded-for\")",
  "request.headers.get('x-forwarded-for')",
  "h.get(\"x-forwarded-for\")",
  "h.get('x-forwarded-for')",
  "request.headers.get(\"x-real-ip\")",
  "request.headers.get('x-real-ip')",
  "h.get(\"x-real-ip\")",
  "h.get('x-real-ip')",
];

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeForwardedHeaderSafety(root = ROOT) {
  const issues = [];
  for (const rel of Object.keys(REQUIRED_FILE_MARKERS)) {
    if (!exists(root, rel)) issues.push({ issue: "missing_required_file", rel });
  }

  const pkg = JSON.parse(read(root, "package.json"));
  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push({ issue: "missing_package_script", script });
  }

  for (const [rel, markers] of Object.entries(REQUIRED_FILE_MARKERS)) {
    if (!exists(root, rel)) continue;
    const content = read(root, rel);
    for (const marker of collectMissingMarkers(content, markers)) {
      issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  if (exists(root, "src/lib/rate-limit.ts")) {
    const content = read(root, "src/lib/rate-limit.ts");
    for (const marker of FORBIDDEN_RATE_LIMIT_MARKERS) {
      if (content.includes(marker)) {
        issues.push({
          issue: "raw_forwarded_header_used_in_rate_limit",
          rel: "src/lib/rate-limit.ts",
          marker,
        });
      }
    }
  }

  return {
    checkId: "forwarded-header-safety",
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeForwardedHeaderSafety();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
