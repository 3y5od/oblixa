#!/usr/bin/env node
/**
 * Governs the public Next.js env and client diagnostic surface.
 *
 * This check intentionally treats every NEXT_PUBLIC_* key as a product/security
 * decision: keys must be allowlisted, present in .env.example, and diagnostic
 * toggles must stay dev-only or scrubbed before they can enter the browser.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { issueReport, isSourceFileName, isTestLikeFile, readText, toPosix, walkFiles } from "./lib/static-check-utils.mjs";

const ROOT = process.cwd();
const ENV_EXAMPLE_REL = ".env.example";
const PUBLIC_ENV_ALLOWLIST = new Set([
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_OBLIXA_CLIENT_SWEEP_BREADCRUMB",
  "NEXT_PUBLIC_PRODUCT_SURFACE_DIAGNOSTICS",
  "NEXT_PUBLIC_PRODUCT_SURFACE_SENTRY_DIAGNOSTICS",
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_RELEASE",
  "NEXT_PUBLIC_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE",
  "NEXT_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE",
  "NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS",
  "NEXT_PUBLIC_V10_SUPPORT_DIAGNOSTICS",
]);
const PUBLIC_DIAGNOSTIC_KEYS = new Set([
  "NEXT_PUBLIC_OBLIXA_CLIENT_SWEEP_BREADCRUMB",
  "NEXT_PUBLIC_PRODUCT_SURFACE_DIAGNOSTICS",
  "NEXT_PUBLIC_PRODUCT_SURFACE_SENTRY_DIAGNOSTICS",
  "NEXT_PUBLIC_V10_SUPPORT_DIAGNOSTICS",
]);
const PUBLIC_DIAGNOSTIC_ALLOWED_FILES = new Map([
  ["NEXT_PUBLIC_OBLIXA_CLIENT_SWEEP_BREADCRUMB", new Set(["src/lib/debugging-sweep/client-sweep-bridge.tsx"])],
  ["NEXT_PUBLIC_PRODUCT_SURFACE_DIAGNOSTICS", new Set(["src/lib/product-surface/dev-diagnostics.ts"])],
  ["NEXT_PUBLIC_PRODUCT_SURFACE_SENTRY_DIAGNOSTICS", new Set(["src/lib/observability/sentry-client.ts"])],
  ["NEXT_PUBLIC_V10_SUPPORT_DIAGNOSTICS", new Set(["src/components/ui/v10-recoverable-state.tsx"])],
]);
const FORBIDDEN_PUBLIC_ENV_TOKENS =
  /(?:SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|WEBHOOK|CRON|PEPPER|ENCRYPTION|INTERNAL|BEARER|ACCESS_TOKEN|REFRESH_TOKEN|API_KEY)/i;
const CLIENT_INTERNAL_DIAGNOSTIC_PATTERNS = [
  { issue: "client_public_surface_references_internal_api", re: /["'`]\/api\/internal(?:\/|["'`?])/ },
  { issue: "client_public_surface_references_debug_endpoint", re: /["'`][^"'`]*(?:debugging-sweep|internal-debugging-sweep)[^"'`]*/i },
  { issue: "client_public_surface_references_internal_diag_secret", re: /\bOBLIXA_INTERNAL_DIAG_[A-Z0-9_]*\b/ },
];
const TOP_LEVEL_SOURCE_FILES = ["next.config.ts"];

function lineForIndex(source, index) {
  return source.slice(0, index).split("\n").length;
}

function maskCommentsForScanning(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (match) => match.replace(/[^\n]/g, " "));
}

function readIfExists(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
}

function collectEnvExampleKeys(root) {
  const source = readIfExists(root, ENV_EXAMPLE_REL);
  const keys = new Map();
  if (source === null) return { source: "", keys, missing: true };
  source.split("\n").forEach((line, index) => {
    const match = /^\s*#?\s*(NEXT_PUBLIC_[A-Z0-9_]+)\s*=/.exec(line);
    if (match && !keys.has(match[1])) {
      keys.set(match[1], index + 1);
    }
  });
  return { source, keys, missing: false };
}

function collectSourceFiles(root) {
  const sourceFiles = walkFiles(root, ["src"], {
    include: (rel, name) => isSourceFileName(name) && !isTestLikeFile(rel) && !rel.endsWith(".d.ts"),
  });
  for (const rel of TOP_LEVEL_SOURCE_FILES) {
    if (fs.existsSync(path.join(root, rel))) sourceFiles.push(rel);
  }
  return [...new Set(sourceFiles)].sort();
}

function collectNextPublicReferences(root) {
  const refs = [];
  const files = collectSourceFiles(root);
  for (const rel of files) {
    const source = readText(root, rel);
    const maskedSource = maskCommentsForScanning(source);
    for (const match of maskedSource.matchAll(/\bNEXT_PUBLIC_[A-Z0-9]+(?:_[A-Z0-9]+)*\b/g)) {
      refs.push({ key: match[0], rel, line: lineForIndex(source, match.index ?? 0) });
    }
  }
  return refs;
}

function hasDevOnlyFlagGuard(source, key) {
  const env = "process\\.env";
  const dev = `${env}\\.NODE_ENV\\s*!==\\s*["']production["']`;
  const flag = `${env}\\.${key}\\s*={2,3}\\s*["']1["']`;
  return (
    new RegExp(`${dev}[\\s\\S]{0,140}&&[\\s\\S]{0,140}${flag}`).test(source) ||
    new RegExp(`${flag}[\\s\\S]{0,140}&&[\\s\\S]{0,140}${dev}`).test(source)
  );
}

function collectDiagnosticKeyIssues(root, refs) {
  const issues = [];
  const refsByKey = new Map();
  for (const ref of refs) {
    if (!PUBLIC_DIAGNOSTIC_KEYS.has(ref.key)) continue;
    if (!refsByKey.has(ref.key)) refsByKey.set(ref.key, []);
    refsByKey.get(ref.key).push(ref);
  }

  for (const [key, keyRefs] of refsByKey.entries()) {
    const allowedFiles = PUBLIC_DIAGNOSTIC_ALLOWED_FILES.get(key) ?? new Set();
    for (const ref of keyRefs) {
      if (!allowedFiles.has(ref.rel)) {
        issues.push({ issue: "public_diagnostic_env_used_outside_allowed_file", key, file: ref.rel, line: ref.line });
      }
    }
  }

  const v10Rel = "src/components/ui/v10-recoverable-state.tsx";
  const v10Source = readIfExists(root, v10Rel) ?? "";
  if (!hasDevOnlyFlagGuard(v10Source, "NEXT_PUBLIC_V10_SUPPORT_DIAGNOSTICS")) {
    issues.push({ issue: "v10_support_diagnostics_not_dev_only", key: "NEXT_PUBLIC_V10_SUPPORT_DIAGNOSTICS", file: v10Rel });
  }

  const productRel = "src/lib/product-surface/dev-diagnostics.ts";
  const productSource = readIfExists(root, productRel) ?? "";
  if (!hasDevOnlyFlagGuard(productSource, "NEXT_PUBLIC_PRODUCT_SURFACE_DIAGNOSTICS")) {
    issues.push({ issue: "product_surface_diagnostics_not_dev_only", key: "NEXT_PUBLIC_PRODUCT_SURFACE_DIAGNOSTICS", file: productRel });
  }

  const sentryRel = "src/lib/observability/sentry-client.ts";
  const sentrySource = readIfExists(root, sentryRel) ?? "";
  if (sentrySource.includes("NEXT_PUBLIC_PRODUCT_SURFACE_SENTRY_DIAGNOSTICS")) {
    for (const marker of ["Sentry.addBreadcrumb", "family", "reason", "discoverability"]) {
      if (!sentrySource.includes(marker)) {
        issues.push({ issue: "product_surface_sentry_diagnostics_missing_scrub_marker", key: "NEXT_PUBLIC_PRODUCT_SURFACE_SENTRY_DIAGNOSTICS", file: sentryRel, marker });
      }
    }
    if (/\bdata\s*:\s*details\b|\.\.\.\s*details\b/.test(sentrySource)) {
      issues.push({ issue: "product_surface_sentry_diagnostics_forwards_raw_details", key: "NEXT_PUBLIC_PRODUCT_SURFACE_SENTRY_DIAGNOSTICS", file: sentryRel });
    }
  } else {
    issues.push({ issue: "missing_product_surface_sentry_diagnostics_guard", key: "NEXT_PUBLIC_PRODUCT_SURFACE_SENTRY_DIAGNOSTICS", file: sentryRel });
  }

  const sweepRel = "src/lib/debugging-sweep/client-sweep-bridge.tsx";
  const sweepSource = readIfExists(root, sweepRel) ?? "";
  if (sweepSource.includes("NEXT_PUBLIC_OBLIXA_CLIENT_SWEEP_BREADCRUMB")) {
    for (const marker of ["Sentry.addBreadcrumb", "sweep_client", "client-bridge-mounted"]) {
      if (!sweepSource.includes(marker)) {
        issues.push({ issue: "debugging_sweep_breadcrumb_missing_safe_marker", key: "NEXT_PUBLIC_OBLIXA_CLIENT_SWEEP_BREADCRUMB", file: sweepRel, marker });
      }
    }
    if (/\bfetch\s*\(|["'`]\/api\//.test(sweepSource)) {
      issues.push({ issue: "debugging_sweep_breadcrumb_must_not_call_api", key: "NEXT_PUBLIC_OBLIXA_CLIENT_SWEEP_BREADCRUMB", file: sweepRel });
    }
  } else {
    issues.push({ issue: "missing_debugging_sweep_breadcrumb_guard", key: "NEXT_PUBLIC_OBLIXA_CLIENT_SWEEP_BREADCRUMB", file: sweepRel });
  }

  return issues;
}

function collectClientInternalDiagnosticIssues(root) {
  const issues = [];
  for (const rel of collectSourceFiles(root)) {
    if (rel === "src/lib/debugging-sweep/client-sweep-bridge.tsx") continue;
    const source = readText(root, rel);
    if (!/^\s*["']use client["']/m.test(source)) continue;
    for (const pattern of CLIENT_INTERNAL_DIAGNOSTIC_PATTERNS) {
      const match = pattern.re.exec(source);
      if (match) {
        issues.push({ issue: pattern.issue, file: rel, line: lineForIndex(source, match.index), evidence: match[0] });
      }
    }
  }
  return issues;
}

export function analyzeNextPublicSurface(root = ROOT) {
  const issues = [];
  const envExample = collectEnvExampleKeys(root);
  const refs = collectNextPublicReferences(root);
  const referencedKeys = new Set(refs.map((ref) => ref.key));

  if (envExample.missing) {
    issues.push({ issue: "missing_env_example", file: ENV_EXAMPLE_REL });
  }

  for (const [key, line] of envExample.keys.entries()) {
    if (!PUBLIC_ENV_ALLOWLIST.has(key)) {
      issues.push({ issue: "unknown_next_public_env_key_in_env_example", key, file: ENV_EXAMPLE_REL, line });
    }
    if (FORBIDDEN_PUBLIC_ENV_TOKENS.test(key.replace(/^NEXT_PUBLIC_/, "")) && !PUBLIC_ENV_ALLOWLIST.has(key)) {
      issues.push({ issue: "sensitive_next_public_env_key_in_env_example", key, file: ENV_EXAMPLE_REL, line });
    }
  }

  for (const ref of refs) {
    if (!PUBLIC_ENV_ALLOWLIST.has(ref.key)) {
      issues.push({ issue: "unknown_next_public_env_key_in_source", key: ref.key, file: ref.rel, line: ref.line });
    }
    if (FORBIDDEN_PUBLIC_ENV_TOKENS.test(ref.key.replace(/^NEXT_PUBLIC_/, "")) && !PUBLIC_ENV_ALLOWLIST.has(ref.key)) {
      issues.push({ issue: "sensitive_next_public_env_key_in_source", key: ref.key, file: ref.rel, line: ref.line });
    }
  }

  for (const key of referencedKeys) {
    if (!envExample.keys.has(key)) {
      const first = refs.find((ref) => ref.key === key);
      issues.push({ issue: "source_next_public_env_missing_from_env_example", key, file: first?.rel, line: first?.line });
    }
  }

  issues.push(...collectDiagnosticKeyIssues(root, refs));
  issues.push(...collectClientInternalDiagnosticIssues(root));

  return issueReport("next-public-surface", issues, {
    envExampleKeyCount: envExample.keys.size,
    sourceReferenceCount: refs.length,
    sourceKeyCount: referencedKeys.size,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeNextPublicSurface();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
