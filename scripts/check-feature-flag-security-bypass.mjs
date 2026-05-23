#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_ROOT = process.cwd();

const REQUIRED_FEATURE_FLAG_MARKERS = [
  "TRUE_FLAG_VALUES",
  "FALSE_FLAG_VALUES",
  "UNSAFE_FLAG_VALUE_RE",
  "if (!normalized) return true;",
  "return false;",
];

const DANGEROUS_ENV_NAME_RE =
  /\bprocess\.env\.([A-Z0-9_]*(?:BYPASS|SKIP_AUTH|NO_AUTH|AUTH_DISABLED|DISABLE_AUTH|PERMISSIVE|SECURITY_DISABLED)[A-Z0-9_]*)\b/g;
const SOURCE_EXT_RE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const TEST_FILE_RE = /(?:^|[./\\])(?:__tests__|test|tests|fixtures?)(?:[./\\]|$)|\.(?:test|spec)\./;

const KILL_SWITCH_ORDER_CONTRACTS = [
  {
    file: "src/app/api/stripe/checkout/route.ts",
    after: "if (isKillBilling())",
    before: [
      'if (!user) {',
      'if (membership.role !== "admin") {',
      "rateLimitCheck(`stripe-checkout:",
    ],
  },
  {
    file: "src/app/api/stripe/portal/route.ts",
    after: "if (isKillBilling())",
    before: [
      'if (!user) {',
      'if (membership.role !== "admin") {',
      "rateLimitCheck(`stripe-portal:",
    ],
  },
  {
    file: "src/app/api/extract/route.ts",
    after: "if (isKillExtraction())",
    before: ['if (!user) {', "secFetchSiteAllowsSensitiveMutation(request)"],
  },
  {
    file: "src/app/api/tasks/from-email/route.ts",
    after: "if (isKillInboundAutomation())",
    before: ["if (!isAuthorized(request))"],
  },
  {
    file: "src/app/api/tasks/from-slack/route.ts",
    after: "if (isKillInboundAutomation())",
    before: ["if (!isAuthorized(request))"],
  },
  {
    file: "src/actions/settings.ts",
    after: "if (isKillInvites())",
    before: ['if (!user) return { error: "Not authenticated" };', 'if (membership.role !== "admin") {'],
  },
  {
    file: "src/lib/cron/route-runner.ts",
    after: "options.preflight",
    before: ["gateCronRequest(request", "rateLimitCheck(rateLimitKey"],
  },
];

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function walk(root, relDir, out = []) {
  const abs = path.join(root, relDir);
  if (!fs.existsSync(abs)) return out;
  for (const name of fs.readdirSync(abs)) {
    const rel = path.join(relDir, name);
    const full = path.join(root, rel);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(root, rel, out);
    } else if (SOURCE_EXT_RE.test(name)) {
      out.push(rel.split(path.sep).join("/"));
    }
  }
  return out;
}

function addMissingMarkerIssues(issues, root) {
  const featureFlagsPath = "src/lib/feature-flags.ts";
  if (!exists(root, featureFlagsPath)) {
    issues.push({ issue: "missing_feature_flag_module", file: featureFlagsPath });
    return;
  }
  const featureFlags = read(root, featureFlagsPath);
  for (const marker of REQUIRED_FEATURE_FLAG_MARKERS) {
    if (!featureFlags.includes(marker)) {
      issues.push({ issue: "missing_feature_flag_parser_marker", file: featureFlagsPath, marker });
    }
  }
  if (/NEXT_PUBLIC_[A-Z0-9_]*ENABLE_V[356]_/.test(featureFlags)) {
    issues.push({ issue: "feature_flag_exposed_to_client_env", file: featureFlagsPath });
  }

  const featureRegistryPath = "src/lib/product-surface/feature-registry.ts";
  if (!exists(root, featureRegistryPath)) {
    issues.push({ issue: "missing_product_feature_registry", file: featureRegistryPath });
  } else if (!read(root, featureRegistryPath).includes("PRODUCT_FEATURE_REGISTRY")) {
    issues.push({ issue: "missing_product_feature_registry", file: featureRegistryPath });
  }

  const surfaceContextPath = "src/lib/product-surface/context.ts";
  if (!exists(root, surfaceContextPath)) {
    issues.push({ issue: "product_surface_context_missing_feature_flags", file: surfaceContextPath });
  } else if (!read(root, surfaceContextPath).includes("getFeatureFlags(")) {
    issues.push({ issue: "product_surface_context_missing_feature_flags", file: surfaceContextPath });
  }

  const killSwitchPath = "src/lib/security/kill-switches.ts";
  if (!exists(root, killSwitchPath)) {
    issues.push({ issue: "missing_kill_switch_module", file: killSwitchPath });
    return;
  }
  const killSwitches = read(root, killSwitchPath);
  for (const marker of [
    "jsonProblem(503",
    'code: "service_temporarily_unavailable"',
    'diagnostic_id: "kill_switch_active"',
  ]) {
    if (!killSwitches.includes(marker)) {
      issues.push({ issue: "missing_kill_switch_problem_json_marker", file: killSwitchPath, marker });
    }
  }
}

function addKillSwitchOrderIssues(issues, root) {
  for (const contract of KILL_SWITCH_ORDER_CONTRACTS) {
    if (!exists(root, contract.file)) {
      issues.push({ issue: "missing_kill_switch_order_file", file: contract.file });
      continue;
    }
    const source = read(root, contract.file);
    const afterIndex = source.indexOf(contract.after);
    if (afterIndex < 0) {
      issues.push({ issue: "missing_kill_switch_order_marker", file: contract.file, marker: contract.after });
      continue;
    }
    for (const marker of contract.before) {
      const beforeIndex = source.indexOf(marker);
      if (beforeIndex < 0) {
        issues.push({ issue: "missing_kill_switch_auth_marker", file: contract.file, marker });
      } else if (afterIndex < beforeIndex) {
        issues.push({
          issue: "kill_switch_before_required_guard",
          file: contract.file,
          killSwitchMarker: contract.after,
          requiredGuardMarker: marker,
        });
      }
    }
  }
}

function addDangerousEnvIssues(issues, root) {
  const files = [...walk(root, "src"), ...walk(root, "app")];
  for (const file of files) {
    if (TEST_FILE_RE.test(file)) continue;
    const source = read(root, file);
    for (const match of source.matchAll(DANGEROUS_ENV_NAME_RE)) {
      issues.push({ issue: "bypass_shaped_environment_flag", file, env: match[1] });
    }
  }
}

export function analyzeFeatureFlagSecurityBypass(root = DEFAULT_ROOT) {
  const issues = [];

  addMissingMarkerIssues(issues, root);
  addKillSwitchOrderIssues(issues, root);
  addDangerousEnvIssues(issues, root);

  return {
    checkId: "feature-flag-security-bypass",
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeFeatureFlagSecurityBypass();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
