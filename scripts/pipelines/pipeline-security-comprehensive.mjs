#!/usr/bin/env node

import { runSequential } from "../lib/scheduler.mjs";

const startedAt = Date.now();

const steps = [
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
  "check:outbound-domain-allowlist",
  "check:ssrf-guards",
  "check:security-headers",
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

const results = await runSequential(steps);
const failed = results.find((result) => !result.ok && result.required);
console.log(
  JSON.stringify(
    {
      pipeline: "security-comprehensive",
      durationMs: Date.now() - startedAt,
      results,
    },
    null,
    2
  )
);
process.exit(failed ? failed.code : 0);
