#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const res = spawnSync("npm", ["audit", "--json", "--audit-level=high"], {
  encoding: "utf8",
  env: process.env,
});

let parsed = {};
try {
  parsed = JSON.parse(res.stdout || "{}");
} catch {
  parsed = {};
}

const vulns = parsed.metadata?.vulnerabilities ?? {};
const output = {
  generatedAt: new Date().toISOString(),
  auditExitCode: res.status ?? 1,
  vulnerabilities: {
    critical: vulns.critical ?? 0,
    high: vulns.high ?? 0,
    moderate: vulns.moderate ?? 0,
    low: vulns.low ?? 0,
    total: vulns.total ?? 0,
  },
  dependencyCounts: parsed.metadata?.dependencies ?? {},
  advisoryCount: parsed.vulnerabilities ? Object.keys(parsed.vulnerabilities).length : 0,
  ok: (vulns.critical ?? 0) === 0 && (vulns.high ?? 0) === 0,
  summary: {
    highOrCriticalCount: (vulns.high ?? 0) + (vulns.critical ?? 0),
    riskLevel:
      (vulns.critical ?? 0) > 0
        ? "critical"
        : (vulns.high ?? 0) > 0
          ? "high"
          : (vulns.moderate ?? 0) > 0
            ? "moderate"
            : "low",
  },
};

console.log(JSON.stringify(output, null, 2));
