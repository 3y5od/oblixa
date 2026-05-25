#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:xss-client-exposure"];
const REQUIRED_CI_COMMANDS = [
  "npm run check:xss-client-exposure",
  "npm run check:dangerously-set-inner-html",
  "npm run check:postmessage-origins",
  "npm run check:client-storage-sensitivity",
  "npm run check:next-public-surface",
];
const REQUIRED_SECURITY_PIPELINE_STEPS = [
  '"check:xss-client-exposure"',
  '"check:dangerously-set-inner-html"',
  '"check:postmessage-origins"',
  '"check:client-storage-sensitivity"',
  '"check:outbound-message-safety"',
];
const REQUIRED_FILE_MARKERS = {
  "src/lib/security/json-ld-inline-script.ts": [
    "export function serializeJsonLdForInlineScript(value: unknown): string {",
    '.replace(/</g, "\\\\u003c")',
  ],
  "src/lib/security/json-ld-inline-script.test.ts": [
    'it("does not emit raw </script> inside string values"',
    'it("escapes user-controlled names and titles with script tags"',
  ],
  "src/components/landing/landing-json-ld.tsx": [
    "serializeJsonLdForInlineScript(payload)",
    'type="application/ld+json"',
  ],
  "src/components/landing/legal-page-json-ld.tsx": [
    "serializeJsonLdForInlineScript([webPage, breadcrumbs])",
    'type="application/ld+json"',
  ],
  "src/lib/security/safe-external-href.ts": [
    "export function sanitizeExternalHref(",
    "DANGEROUS_SCHEME",
    "replace(/[\\u0000-\\u001f]+/g, \"\")",
    't.includes("\\u007f")',
    'lower.startsWith("//")',
  ],
  "src/lib/security/safe-external-href.test.ts": [
    'expect(sanitizeExternalHref(" javaScript :alert(1)")).toBeNull();',
    'expect(sanitizeExternalHref("java\\nscript:alert(1)")).toBeNull();',
    'expect(sanitizeExternalHref("//evil.example/path")).toBeNull();',
  ],
  "src/components/ui/external-link.tsx": [
    'target="_blank"',
    'const parts = new Set(["noreferrer", "noopener"]);',
    "const safeHref = sanitizeExternalHref(href);",
    "if (!safeHref)",
    "rel={mergeRel(rel)}",
  ],
  "src/lib/messaging/chat-snippet-sanitize.ts": [
    '.replace(/javascript:/gi, "javascript\\u200b:")',
    '.replace(/vbscript:/gi, "vbscript\\u200b:")',
    '.replace(/data:text\\/html/gi, "data\\u200b:text/html")',
    '.replace(/<\\/?script/gi, "<scr\\u200bipt")',
  ],
  "src/lib/messaging/chat-snippet-sanitize.test.ts": [
    'it("breaks script tags and HTML data URLs"',
    'it("defangs Slack-style auto-link openers"',
  ],
  "src/lib/messaging/adaptive-card-snippet-sanitize.ts": [
    '.replace(/javascript:/gi, "javascript\\u200b:")',
    '.replace(/vbscript:/gi, "vbscript\\u200b:")',
    '.replace(/data:text\\/html/gi, "data\\u200b:text/html")',
    '.replace(/<\\/?script/gi, "<scr\\u200bipt")',
  ],
  "src/lib/messaging/adaptive-card-snippet-sanitize.test.ts": [
    'it("breaks script tags and HTML data URLs"',
  ],
  "src/lib/messaging/discord-embed-snippet-sanitize.ts": [
    '.replace(/javascript:/gi, "javascript\\u200b:")',
    '.replace(/vbscript:/gi, "vbscript\\u200b:")',
    '.replace(/data:text\\/html/gi, "data\\u200b:text/html")',
    '.replace(/<\\/?script/gi, "<scr\\u200bipt")',
  ],
  "src/lib/messaging/discord-embed-snippet-sanitize.test.ts": [
    'it("breaks active content URL and script tokens"',
  ],
  "src/lib/dashboard-no-dangerous-html.test.ts": [
    "Core dashboard tree avoids dangerouslySetInnerHTML",
    "expect(hits, hits.join(\"\\n\")).toEqual([]);",
  ],
  "scripts/check-dangerously-set-inner-html.mjs": ["dangerouslySetInnerHTML"],
  "scripts/check-next-public-surface.mjs": ["NEXT_PUBLIC_"],
  "scripts/check-client-storage-sensitivity.mjs": [
    "analyzeClientStorageSensitivity",
    "direct_client_storage_access",
    "sensitive_storage_key",
    "unapproved_storage_key",
  ],
  "src/lib/security/client-storage.ts": [
    "CLIENT_STORAGE_JSON_MAX_LENGTH",
    "hasUnsafeJsonKey(parsed)",
    "isJsonShapeWithinLimits(parsed",
    "export function readCommandPaletteRecentCommands()",
    "export function readUploadMetadataDraft(",
    "export function writeContractTableSelection(",
  ],
  "scripts/check-client-bundle-secret-leakage.mjs": [
    "analyzeClientBundleSecretLeakage",
    "server_env_in_client_bundle",
    "supabase_server_import_in_client_bundle",
  ],
};
const ALLOWED_PUBLIC_ENV = new Set([
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_RELEASE",
  "NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE",
  "NEXT_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE",
  "NEXT_PUBLIC_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE",
  "NEXT_PUBLIC_INLINE_QUEUE_ACTIONS",
  "NEXT_PUBLIC_V9_INLINE_QUEUE_ACTIONS",
  "NEXT_PUBLIC_OBLIXA_CLIENT_SWEEP_BREADCRUMB",
  "NEXT_PUBLIC_SUPPORT_DIAGNOSTICS",
  "NEXT_PUBLIC_V10_SUPPORT_DIAGNOSTICS",
]);
const FORBIDDEN_PUBLIC_ENV_TOKENS = /SECRET|SERVICE_ROLE|PRIVATE|TOKEN|KEY/i;
const STORAGE_SENSITIVE_TOKENS = /token|signed_url|signedUrl|raw_document|rawDocument|provider_payload|providerPayload|service_role|secret/i;

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function walk(root, rel, out = []) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return out;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(ent.name)) continue;
    const childRel = path.join(rel, ent.name).replace(/\\/g, "/");
    if (ent.isDirectory()) walk(root, childRel, out);
    else if (/\.(ts|tsx)$/.test(ent.name)) out.push(childRel);
  }
  return out;
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

function collectDangerousHtmlHits(root) {
  const hits = [];
  for (const rel of walk(root, "src")) {
    if (/\.(test|spec|ui\.test)\.(ts|tsx)$/.test(rel)) continue;
    const content = read(root, rel);
    if (!content.includes("dangerouslySetInnerHTML")) continue;
    if (
      [
        "src/components/landing/landing-json-ld.tsx",
        "src/components/landing/legal-page-json-ld.tsx",
      ].includes(rel) &&
      content.includes("serializeJsonLdForInlineScript") &&
      content.includes('type="application/ld+json"')
    ) {
      continue;
    }
    hits.push(rel);
  }
  return hits;
}

function collectPublicEnvIssues(root) {
  const issues = [];
  const re = /(?:process\.env|import\.meta\.env)\.(NEXT_PUBLIC_[A-Z0-9_]+)/g;
  for (const rel of walk(root, "src")) {
    if (/\.(test|spec|ui\.test)\.(ts|tsx)$/.test(rel)) continue;
    const content = read(root, rel);
    for (const match of content.matchAll(re)) {
      const key = match[1];
      if (!ALLOWED_PUBLIC_ENV.has(key) && FORBIDDEN_PUBLIC_ENV_TOKENS.test(key.replace(/^NEXT_PUBLIC_/, ""))) {
        issues.push({ rel, key });
      }
    }
  }
  return issues;
}

function collectSensitiveStorageIssues(root) {
  const issues = [];
  const re = /(?:localStorage|sessionStorage)\.(?:setItem|getItem|removeItem)\(([^\n;]+)/g;
  for (const rel of walk(root, "src")) {
    if (/\.(test|spec|ui\.test)\.(ts|tsx)$/.test(rel)) continue;
    const content = read(root, rel);
    for (const match of content.matchAll(re)) {
      const arg = match[1];
      if (STORAGE_SENSITIVE_TOKENS.test(arg)) issues.push({ rel, expression: arg.slice(0, 120) });
    }
  }
  return issues;
}

function collectPostMessageIssues(root) {
  const issues = [];
  for (const rel of walk(root, "src")) {
    if (/\.(test|spec|ui\.test)\.(ts|tsx)$/.test(rel)) continue;
    const content = read(root, rel);
    if (/\bpostMessage\s*\(/.test(content) || /\.postMessage\s*\(/.test(content)) {
      issues.push({ rel });
    }
  }
  return issues;
}

function collectTargetBlankIssues(root) {
  const issues = [];
  for (const rel of walk(root, "src")) {
    if (/\.(test|spec|ui\.test)\.(ts|tsx)$/.test(rel)) continue;
    const content = read(root, rel);
    if (!/target\s*=\s*["']_blank["']/.test(content)) continue;
    const safeRel =
      /rel\s*=\s*["'][^"']*\bnoopener\b[^"']*\bnoreferrer\b[^"']*["']/.test(content) ||
      /rel\s*=\s*["'][^"']*\bnoreferrer\b[^"']*\bnoopener\b[^"']*["']/.test(content) ||
      content.includes("externalLinkRelAndReferrer") ||
      content.includes("rel={mergeRel(rel)}");
    if (!safeRel) issues.push({ rel });
  }
  return issues;
}

function collectClientServerImportIssues(root) {
  const issues = [];
  const serverOnlyImport = /from\s+["']@\/lib\/supabase\/server["']|from\s+["']server-only["']|import\s+["']server-only["']|\bcreateAdminClient\b|\bgetAuthContext\b|\bprocess\.env\.(?!(?:NEXT_PUBLIC_|NODE_ENV\b))[A-Z0-9_]+/;
  for (const rel of walk(root, "src")) {
    if (/\.(test|spec|ui\.test)\.(ts|tsx)$/.test(rel)) continue;
    const content = read(root, rel);
    if (!/^\s*["']use client["']\s*;?/m.test(content)) continue;
    if (serverOnlyImport.test(content)) issues.push({ rel });
  }
  return issues;
}

function collectErrorBoundaryExposureIssues(root) {
  const issues = [];
  for (const rel of walk(root, "src/app")) {
    if (!/(^|\/)(global-error|error)\.tsx$/.test(rel)) continue;
    const content = read(root, rel);
    if (!content.includes("captureClientException(error")) {
      issues.push({ issue: "frontend_error_boundary_missing_capture", rel });
    }
    if (/[{=]\s*error\.(?:message|stack|cause|name)\b/.test(content)) {
      issues.push({ issue: "frontend_error_boundary_raw_error", rel });
    }
  }
  return issues;
}

export function analyzeXssClientExposure(root = ROOT) {
  const issues = [];
  for (const rel of Object.keys(REQUIRED_FILE_MARKERS)) {
    if (!exists(root, rel)) issues.push({ issue: "missing_required_file", rel });
  }
  const pkg = JSON.parse(read(root, "package.json"));
  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push({ issue: "missing_package_script", script });
  }
  const ci = read(root, ".github/workflows/ci.yml");
  for (const cmd of REQUIRED_CI_COMMANDS) {
    if (!ci.includes(cmd)) issues.push({ issue: "missing_ci_reference", cmd });
  }
  const securityPipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  for (const step of REQUIRED_SECURITY_PIPELINE_STEPS) {
    if (!securityPipeline.includes(step)) issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
  }
  for (const [rel, markers] of Object.entries(REQUIRED_FILE_MARKERS)) {
    if (!exists(root, rel)) continue;
    const content = read(root, rel);
    for (const marker of collectMissingMarkers(content, markers)) {
      issues.push({ issue: "missing_marker", rel, marker });
    }
  }
  for (const rel of collectDangerousHtmlHits(root)) {
    issues.push({ issue: "unapproved_dangerously_set_inner_html", rel });
  }
  for (const hit of collectPublicEnvIssues(root)) {
    issues.push({ issue: "unsafe_next_public_env", ...hit });
  }
  for (const hit of collectSensitiveStorageIssues(root)) {
    issues.push({ issue: "sensitive_client_storage", ...hit });
  }
  for (const hit of collectPostMessageIssues(root)) {
    issues.push({ issue: "unapproved_postmessage", ...hit });
  }
  for (const hit of collectTargetBlankIssues(root)) {
    issues.push({ issue: "unsafe_target_blank", ...hit });
  }
  for (const hit of collectClientServerImportIssues(root)) {
    issues.push({ issue: "client_server_only_import", ...hit });
  }
  for (const hit of collectErrorBoundaryExposureIssues(root)) {
    issues.push(hit);
  }
  return { checkId: "xss-client-exposure", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeXssClientExposure();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
