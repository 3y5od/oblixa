import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeFeatureFlagSecurityBypass } from "./check-feature-flag-security-bypass.mjs";

function tempRoot(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `oblixa-feature-flag-${name}-`));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeFixture(root, overrides = {}) {
  const files = {
    "src/lib/feature-flags.ts": `
      export const TRUE_FLAG_VALUES = new Set(["1", "true", "yes", "on"]);
      export const FALSE_FLAG_VALUES = new Set(["0", "false", "no", "off"]);
      export const UNSAFE_FLAG_VALUE_RE = /bypass|skip_auth|no_auth/i;
      export function parseFeatureFlagEnv(value: string | undefined) {
        const normalized = value?.trim().toLowerCase();
        if (!normalized) return true;
        if (FALSE_FLAG_VALUES.has(normalized)) return false;
        if (TRUE_FLAG_VALUES.has(normalized) && !UNSAFE_FLAG_VALUE_RE.test(normalized)) return true;
        return false;
      }
    `,
    "src/lib/security/kill-switches.ts": `
      import { jsonProblem } from "@/lib/http/problem";
      export function killSwitchJsonResponse(subsystem: string) {
        return jsonProblem(503, {
          error: "Service temporarily unavailable",
          code: "service_temporarily_unavailable",
          diagnostic_id: "kill_switch_active",
          details: { subsystem },
        });
      }
    `,
    "src/lib/product-surface/feature-registry.ts": "export const PRODUCT_FEATURE_REGISTRY = [];\n",
    "src/lib/product-surface/context.ts": "export function load() { return getFeatureFlags(); }\n",
    "src/app/api/stripe/checkout/route.ts": `
      export async function POST() {
        if (!user) {}
        if (membership.role !== "admin") {}
        rateLimitCheck(\`stripe-checkout:\${user.id}\`);
        if (isKillBilling()) {}
      }
    `,
    "src/app/api/stripe/portal/route.ts": `
      export async function POST() {
        if (!user) {}
        if (membership.role !== "admin") {}
        rateLimitCheck(\`stripe-portal:\${user.id}\`);
        if (isKillBilling()) {}
      }
    `,
    "src/app/api/extract/route.ts": `
      export async function POST() {
        if (!user) {}
        secFetchSiteAllowsSensitiveMutation(request);
        if (isKillExtraction()) {}
      }
    `,
    "src/app/api/tasks/from-email/route.ts": `
      export async function POST(request: Request) {
        if (!isAuthorized(request)) {}
        if (isKillInboundAutomation()) {}
      }
    `,
    "src/app/api/tasks/from-slack/route.ts": `
      export async function POST(request: Request) {
        if (!isAuthorized(request)) {}
        if (isKillInboundAutomation()) {}
      }
    `,
    "src/actions/settings.ts": `
      async function inviteOrgMemberUnsafe() {
        if (!user) return { error: "Not authenticated" };
        if (membership.role !== "admin") {}
        if (isKillInvites()) {}
      }
    `,
    "src/lib/cron/route-runner.ts": `
      export async function runCronRoute(request: Request) {
        gateCronRequest(request);
        rateLimitCheck(rateLimitKey);
        options.preflight?.(request);
      }
    `,
    ...overrides,
  };
  for (const [rel, content] of Object.entries(files)) write(root, rel, content);
}

test("analyzeFeatureFlagSecurityBypass accepts strict feature flags and post-auth kill switches", () => {
  const root = tempRoot("ok");
  writeFixture(root);
  const report = analyzeFeatureFlagSecurityBypass(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzeFeatureFlagSecurityBypass rejects kill switches before required guards", () => {
  const root = tempRoot("kill-before-auth");
  writeFixture(root, {
    "src/app/api/stripe/checkout/route.ts": `
      export async function POST() {
        if (isKillBilling()) {}
        if (!user) {}
        if (membership.role !== "admin") {}
        rateLimitCheck(\`stripe-checkout:\${user.id}\`);
      }
    `,
  });
  const report = analyzeFeatureFlagSecurityBypass(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "kill_switch_before_required_guard"));
});

test("analyzeFeatureFlagSecurityBypass rejects bypass-shaped env flags in runtime source", () => {
  const root = tempRoot("bypass-env");
  writeFixture(root, {
    "src/lib/runtime.ts": "export const disabled = process.env.AUTH_DISABLED === '1';\n",
  });
  const report = analyzeFeatureFlagSecurityBypass(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "bypass_shaped_environment_flag" && issue.env === "AUTH_DISABLED"));
});

test("analyzeFeatureFlagSecurityBypass rejects client-exposed module flags", () => {
  const root = tempRoot("client-env");
  writeFixture(root, {
    "src/lib/feature-flags.ts": `
      export const TRUE_FLAG_VALUES = new Set(["1"]);
      export const FALSE_FLAG_VALUES = new Set(["0"]);
      export const UNSAFE_FLAG_VALUE_RE = /bypass/i;
      const env = "NEXT_PUBLIC_ENABLE_V6_ASSURANCE_CORE";
      export function parseFeatureFlagEnv(value: string | undefined) {
        const normalized = value?.trim().toLowerCase();
        if (!normalized) return true;
        return false;
      }
    `,
  });
  const report = analyzeFeatureFlagSecurityBypass(root);
  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "feature_flag_exposed_to_client_env"));
});
