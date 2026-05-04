#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { CI_PARITY_STEPS } from "./pipelines/pipeline-ci-parity.mjs";
import { SECURITY_COMPREHENSIVE_STEPS } from "./pipelines/pipeline-security-comprehensive.mjs";
import { VERIFY_DOMAIN_PASS_STEPS, VERIFY_FIRST_PASS_STEPS, VERIFY_PARITY_STEPS } from "./pipelines/pipeline-verify.mjs";

export const REQUIRED_SECURITY_CHECK_SCRIPTS = [
  "check:api-route-auth-contract",
  "check:api-route-admin-org-scope",
  "check:outbound-fetch",
  "check:outbound-domain-allowlist",
  "check:ssrf-guards",
  "check:browser-isolation-headers",
  "check:permissions-policy-security",
  "check:sensitive-cache-controls",
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
  "check:security-headers",
  "check:security-event-contract",
  "check:server-action-auth-contract",
  "check:server-action-org-scope",
  "check:server-action-exports",
  "check:cron-route-auth",
  "check:ci-verify-extras",
  "check:security-env-contract",
  "check:required-security-checkset",
  "check:type-lint-ratchet",
  "check:test-skip-governance",
  "pipeline:ci-parity",
];

export const VERIFY_PIPELINE_REQUIRED = [
  "check:api-route-auth-contract",
  "check:api-route-admin-org-scope",
  "check:server-action-auth-contract",
  "check:server-action-org-scope",
  "check:server-action-exports",
  "check:ci-verify-extras",
  "pipeline:ci-parity",
];

export const SECURITY_PIPELINE_REQUIRED = [
  "check:api-route-auth-contract",
  "check:api-route-admin-org-scope",
  "check:server-action-auth-contract",
  "check:server-action-org-scope",
  "check:server-action-exports",
  "check:outbound-fetch",
  "check:outbound-domain-allowlist",
  "check:ssrf-guards",
  "check:browser-isolation-headers",
  "check:permissions-policy-security",
  "check:sensitive-cache-controls",
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
  "check:security-headers",
  "check:security-event-contract",
];

const CI_REQUIRED_COMMANDS = [
  "npm run check:api-route-auth-contract",
  "npm run check:api-route-admin-org-scope",
  "npm run check:outbound-fetch",
  "npm run check:outbound-domain-allowlist",
  "npm run check:ssrf-guards",
  "npm run check:browser-isolation-headers",
  "npm run check:permissions-policy-security",
  "npm run check:sensitive-cache-controls",
  "npm run check:auth-cookie-attributes",
  "npm run check:session-fixation-defenses",
  "npm run check:session-lifecycle-security",
  "npm run check:open-redirect-guards",
  "npm run check:callback-domain-strictness",
  "npm run check:trusted-host-handling",
  "npm run check:oauth-state-integrity",
  "npm run check:oauth-pkce-enforcement",
  "npm run check:callback-destination-integrity",
  "npm run check:origin-referrer-enforcement",
  "npm run check:csrf-surface-guards",
  "npm run check:http-method-policy",
  "npm run check:storage-path-safety",
  "npm run check:path-traversal-guards",
  "npm run check:upload-security-guards",
  "npm run check:account-recovery-abuse-guards",
  "npm run check:lockout-reset-safety",
  "npm run check:email-identity-spoof-guards",
  "npm run check:inbound-identity-boundaries",
  "npm run check:internal-api-boundaries",
  "npm run check:realtime-auth-boundaries",
  "npm run check:request-framing-guards",
  "npm run check:signed-link-nonce-policy",
  "npm run check:signed-link-scope-narrowing",
  "npm run check:signed-request-freshness",
  "npm run check:duplicate-execution-policy",
  "npm run check:poison-message-containment",
  "npm run check:queue-message-authenticity",
  "npm run check:outbound-message-safety",
  "npm run check:notification-payload-scrub-contract",
  "npm run check:security-headers",
  "npm run check:security-event-contract",
  "npm run check:server-action-auth-contract",
  "npm run check:server-action-org-scope",
  "npm run check:server-action-exports",
  "npm run check:cron-route-auth",
  "npm run check:ci-verify-extras",
  "npm run check:type-lint-ratchet",
  "npm run check:test-skip-governance",
];

export function analyzeRequiredSecurityCheckset(root = process.cwd()) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const ci = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
  const issues = [];
  const verifySteps = new Set([...VERIFY_FIRST_PASS_STEPS, ...VERIFY_DOMAIN_PASS_STEPS, ...VERIFY_PARITY_STEPS]);
  const securitySteps = new Set(SECURITY_COMPREHENSIVE_STEPS);
  const paritySteps = new Set(CI_PARITY_STEPS);

  for (const script of REQUIRED_SECURITY_CHECK_SCRIPTS) {
    if (!pkg.scripts?.[script]) {
      issues.push({ issue: "missing_package_script", script });
    }
  }

  for (const script of VERIFY_PIPELINE_REQUIRED) {
    if (!verifySteps.has(script)) {
      issues.push({ issue: "missing_verify_pipeline_step", script });
    }
  }

  for (const script of SECURITY_PIPELINE_REQUIRED) {
    if (!securitySteps.has(script)) {
      issues.push({ issue: "missing_security_pipeline_step", script });
    }
  }

  for (const script of [
    "check:github-workflows-security",
    "check:e2e:skip-baseline",
    "check:semgrep-rulepack-integrity",
    "check:wrapper-reintroduction",
  ]) {
    if (!paritySteps.has(script)) {
      issues.push({ issue: "missing_ci_parity_pipeline_step", script });
    }
  }

  for (const cmd of CI_REQUIRED_COMMANDS) {
    if (!ci.includes(cmd)) {
      issues.push({ issue: "missing_ci_reference", cmd });
    }
  }

  return { issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeRequiredSecurityCheckset();
  console.log(JSON.stringify(report, null, 2));
  if (report.issueCount > 0) process.exit(1);
}
