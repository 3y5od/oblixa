#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function numberOrZero(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseAuditJson(stdout) {
  if (!stdout || !stdout.trim()) {
    return { parsed: {}, parseError: "empty npm audit JSON output" };
  }
  try {
    return { parsed: JSON.parse(stdout), parseError: null };
  } catch (err) {
    return {
      parsed: {},
      parseError: err instanceof Error ? err.message : "invalid npm audit JSON output",
    };
  }
}

function hasVulnerabilityMetadata(parsed) {
  const vulns = parsed?.metadata?.vulnerabilities;
  return vulns && typeof vulns === "object";
}

export function buildDependencyRiskReport(auditResult, now = new Date()) {
  const { parsed, parseError } = parseAuditJson(auditResult.stdout ?? "");
  const hasMetadata = hasVulnerabilityMetadata(parsed);
  const vulns = hasMetadata ? parsed.metadata.vulnerabilities : {};
  const vulnerabilities = {
    critical: numberOrZero(vulns.critical),
    high: numberOrZero(vulns.high),
    moderate: numberOrZero(vulns.moderate),
    low: numberOrZero(vulns.low),
    total: numberOrZero(vulns.total),
  };
  const highOrCriticalCount = vulnerabilities.high + vulnerabilities.critical;
  const auditExitCode = auditResult.status ?? 1;
  const auditUnavailable =
    Boolean(parseError) ||
    !hasMetadata ||
    Boolean(auditResult.error) ||
    Boolean(auditResult.signal) ||
    Boolean(parsed.error);

  return {
    generatedAt: now.toISOString(),
    auditExitCode,
    auditUnavailable,
    auditError:
      parseError ||
      (auditResult.error ? String(auditResult.error.message ?? auditResult.error) : "") ||
      (auditResult.signal ? `npm audit terminated by signal ${auditResult.signal}` : "") ||
      (parsed.error ? JSON.stringify(parsed.error) : ""),
    vulnerabilities,
    dependencyCounts: parsed.metadata?.dependencies ?? {},
    advisoryCount: parsed.vulnerabilities ? Object.keys(parsed.vulnerabilities).length : 0,
    ok: !auditUnavailable && highOrCriticalCount === 0,
    summary: {
      highOrCriticalCount,
      riskLevel:
        auditUnavailable
          ? "unknown"
          : vulnerabilities.critical > 0
            ? "critical"
            : vulnerabilities.high > 0
              ? "high"
              : vulnerabilities.moderate > 0
                ? "moderate"
                : "low",
    },
  };
}

export function runDependencyRiskReport() {
  const res = spawnSync("npm", ["audit", "--json", "--audit-level=high"], {
    encoding: "utf8",
    env: process.env,
  });
  return buildDependencyRiskReport(res);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = runDependencyRiskReport();
  console.log(JSON.stringify(output, null, 2));
  process.exit(output.ok ? 0 : 1);
}
