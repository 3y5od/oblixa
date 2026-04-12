import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readWorkflow(name: string): string {
  return fs.readFileSync(path.join(process.cwd(), ".github", "workflows", name), "utf8");
}

const CI_YML_REQUIRED = [
  "quality_static",
  "quality_unit",
  "quality_security",
  "quality_build_e2e",
  "needs: [quality_static, quality_unit, quality_security, quality_build_e2e]",
  "npm audit --audit-level=high",
  "npm run check:security-static:strict:grep",
  "npm run check:github-workflows-security",
  "npm run check:pwa-well-known",
  "npm run check:env-example-parity",
  "npm run check:server-lib-admin",
  "npm run check:tracked-secrets-hygiene",
  "npm run check:performance-static:strict",
  "npm run check:migrations",
  "npm run check:api-route-tests",
  "npm run check:api-route-rate-limit-coverage",
  "npm run check:cron-route-auth",
  "npm run check:vercel-cron",
  "npm run lint",
  "npm run typecheck",
  "npm run test:coverage",
  "semgrep/oblixa-security.yml",
  "semgrep/oblixa-performance.yml",
  "osv-scanner-action",
  "gitleaks/gitleaks-action",
  "npm run build",
  "npm run test:e2e",
  "runtime_comprehensive_pass",
  "npm run check:comprehensive-pass",
];

describe(".github/workflows/ci.yml", () => {
  it("contains required jobs and commands", () => {
    const text = readWorkflow("ci.yml");
    for (const s of CI_YML_REQUIRED) {
      expect(text.includes(s), `Missing expected substring: ${s}`).toBe(true);
    }
  });
});

describe(".github/workflows auxiliary", () => {
  it("slo-monitor.yml runs slo script", () => {
    const text = readWorkflow("slo-monitor.yml");
    expect(text).toContain("node scripts/slo-monitor.mjs");
    expect(text).toContain("jobs:");
  });

  it("cron-canary.yml runs check:cron-canary", () => {
    const text = readWorkflow("cron-canary.yml");
    expect(text).toContain("npm run check:cron-canary");
  });

  it("refinement-deletion-notice.yml references API and migrations paths", () => {
    const text = readWorkflow("refinement-deletion-notice.yml");
    expect(text).toContain("src/app/api/**");
    expect(text).toContain("supabase/migrations/**");
  });
});

describe(".github/workflows directory inventory", () => {
  it("keeps expected workflow files", () => {
    const dir = path.join(process.cwd(), ".github", "workflows");
    const names = fs.readdirSync(dir).filter((f) => f.endsWith(".yml")).sort();
    expect(names).toEqual(
      [
        "ci.yml",
        "cron-canary.yml",
        "refinement-deletion-notice.yml",
        "security-audit-weekly.yml",
        "slo-monitor.yml",
      ].sort()
    );
  });
});
