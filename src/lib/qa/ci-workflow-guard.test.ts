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
  "needs: [quality_static_security, quality_static_surface, quality_static_governance, quality_static_codehealth, quality_unit, quality_security]",
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
  "REQUIRE_CI_E2E_AUTH",
  "REQUIRE_RUNTIME_COMPREHENSIVE",
  "scripts/github-actions/secret-gate.sh",
];

describe(".github/workflows/ci.yml", () => {
  it("contains required jobs and commands", () => {
    const text = readWorkflow("ci.yml");
    for (const s of CI_YML_REQUIRED) {
      expect(text.includes(s), `Missing expected substring: ${s}`).toBe(true);
    }
  });

  it("keeps runtime comprehensive local fallback env available before next start", () => {
    const text = readWorkflow("ci.yml");
    const fallback = text.slice(text.indexOf("Runtime comprehensive pass (staging + local Next fallback)"));
    const localFallback = fallback.slice(fallback.indexOf("building local Next for comprehensive-pass fallback"));
    expect(fallback).toContain("NEXT_PUBLIC_APP_URL: https://www.oblixa.io");
    expect(fallback).toContain("APP_BASE_URL: https://www.oblixa.io");
    expect(fallback).toContain("RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}");
    expect(fallback).toContain("EMAIL_FROM: ${{ secrets.EMAIL_FROM }}");
    expect(fallback.indexOf('export RESEND_API_KEY="${RESEND_API_KEY:-runtime-comprehensive-local-placeholder}"')).toBeLessThan(
      fallback.indexOf("npm run build")
    );
    expect(localFallback.indexOf("export COMPREHENSIVE_PASS_BASE_URL=http://127.0.0.1:3000")).toBeLessThan(
      localFallback.lastIndexOf("npm run check:comprehensive-pass")
    );
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
    const required = [
      "ci.yml",
      "codeql.yml",
      "cron-canary.yml",
      "dependency-review.yml",
      "load-smoke-optional.yml",
      "openssf-scorecard.yml",
      "pr-process-stub.yml",
      "qa-android-webview.yml",
      "qa-cdn-purge.yml",
      "qa-code-maximal.yml",
      "qa-dast-zap.yml",
      "qa-debugging-sweep.yml",
      "qa-external-stubs.yml",
      "qa-game-day.yml",
      "qa-helm-lint.yml",
      "qa-ios-wkwebview.yml",
      "qa-ipv6-smoke.yml",
      "qa-k8s-smoke.yml",
      "qa-macos-a11y-optional.yml",
      "qa-max-nightly.yml",
      "qa-merge-queue-canary.yml",
      "qa-ofac-hash-verify.yml",
      "qa-post-merge-smoke.yml",
      "qa-release-candidate.yml",
      "qa-secrets-history-scan-optional.yml",
      "qa-secrets-rotation-drill.yml",
      "qa-stryker-monthly.yml",
      "qa-taxonomy-closure.yml",
      "qa-terraform-plan.yml",
      "qa-visual-update.yml",
      "qa-windows-edge-optional.yml",
      "refinement-deletion-notice.yml",
      "reusable-qa-ultimate.yml",
      "secretlint-optional.yml",
      "security-audit-weekly.yml",
      "semgrep-sarif.yml",
      "slo-monitor.yml",
      "trivy-fs.yml",
    ].sort();
    expect(names).toEqual(required);
  });
});
