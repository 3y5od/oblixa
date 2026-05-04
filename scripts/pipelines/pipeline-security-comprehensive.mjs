#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import { runSequential } from "../lib/scheduler.mjs";

export const SECURITY_COMPREHENSIVE_STEPS = [
  "check:api-route-auth-contract",
  "check:api-route-admin-org-scope",
  "check:cron-route-auth",
  "check:api-route-rate-limit-coverage",
  "check:security-static:strict:grep",
  "check:github-workflows-security",
  "check:incident-readiness:strict",
  "check:artifact-integrity",
  "check:required-security-checkset",
  "check:security-env-contract",
  "check:server-action-auth-contract",
  "check:server-action-org-scope",
  "check:server-action-exports",
  "check:ai-context-redaction",
  "check:ai-prompt-injection-guards",
  "check:ai-tool-call-authz",
  "check:token-security-quality",
  "check:report-redaction-contract",
  "check:outbound-fetch",
  "check:outbound-domain-allowlist",
  "check:ssrf-guards",
  "check:browser-isolation-headers",
  "check:permissions-policy-security",
  "check:security-headers",
  "check:auth-cookie-attributes",
  "check:session-fixation-defenses",
  "check:session-lifecycle-security",
  "check:open-redirect-guards",
  "check:callback-domain-strictness",
  "check:trusted-host-handling",
  "check:oauth-state-integrity",
  "check:oauth-pkce-enforcement",
  "check:callback-destination-integrity",
  "check:origin-referrer-enforcement",
  "check:csrf-surface-guards",
  "check:http-method-policy",
  "check:storage-path-safety",
  "check:path-traversal-guards",
  "check:upload-security-guards",
  "check:account-recovery-abuse-guards",
  "check:lockout-reset-safety",
  "check:email-identity-spoof-guards",
  "check:inbound-identity-boundaries",
  "check:internal-api-boundaries",
  "check:realtime-auth-boundaries",
  "check:request-framing-guards",
  "check:signed-link-nonce-policy",
  "check:signed-link-scope-narrowing",
  "check:signed-request-freshness",
  "check:duplicate-execution-policy",
  "check:poison-message-containment",
  "check:queue-message-authenticity",
  "check:outbound-message-safety",
  "check:notification-payload-scrub-contract",
  "check:security-event-contract",
  "report:security-route-matrix",
  "report:security-proxy-matrix",
  "build:security-control-coverage-matrix",
  "check:autonomous-security-program",
  "check:security-control-coverage",
  "check:security-fetch-sinks:strict",
  "check:dependency-policy",
  "check:lockfile-integrity-drift",
  "check:sbom-integrity",
  "check:release-artifact-provenance",
  "check:feature-flag-security-bypass",
  "check:security-fallback-paths",
  "check:rate-limit-key-cardinality",
  "check:rate-limit-distribution-safety",
  "check:idempotency-policy",
  "check:job-lock-guards",
  "check:timeout-budget-guards",
  "check:circuit-breaker-policy",
  "check:sensitive-cache-controls",
  "check:stream-payload-sensitivity",
  "check:concurrency-cap-guards",
  "check:checks-integrity-meta",
  "report:security-scorecard",
  "lint",
  "typecheck",
  "test",
];

export async function runPipelineSecurityComprehensive() {
  const startedAt = Date.now();
  const results = await runSequential(SECURITY_COMPREHENSIVE_STEPS);
  const failed = results.find((result) => !result.ok && result.required);
  return {
    pipeline: "security-comprehensive",
    durationMs: Date.now() - startedAt,
    results,
    exitCode: failed ? failed.code : 0,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runPipelineSecurityComprehensive();
  console.log(JSON.stringify({ pipeline: report.pipeline, durationMs: report.durationMs, results: report.results }, null, 2));
  process.exit(report.exitCode);
}
