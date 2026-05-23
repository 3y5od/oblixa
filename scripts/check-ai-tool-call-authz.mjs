#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:ai-tool-call-authz"];
const REQUIRED_CI_COMMANDS = ["npm run check:ai-tool-call-authz"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:ai-tool-call-authz"'];
const REQUIRED_MARKERS = {
  "src/lib/security/ai-tool-call-authz.ts": [
    "verifyAiToolMutationRequest",
    "authorizeAiToolMutation",
    "recordAiToolAuditEvent",
    "ai_tool_auth_required",
    "ai_tool_arguments_invalid",
    "ai_tool_cross_org_arguments",
    "ai_tool_role_required",
    "ai_tool_capability_required",
    "ai_tool_target_forbidden",
    "requiredRole",
    "requiredCapability",
    "authorizeTarget",
    "redactSensitiveLogString",
    '.from("audit_events").insert',
  ],
  "src/lib/security/ai-tool-call-authz.test.ts": [
    "rejects AI tool calls without authenticated org context",
    "validates AI tool arguments with the direct user input parser",
    "rejects cross-org AI tool arguments",
    "records an audit event for authorized AI-assisted actions",
    "requires role, capability, and target scope before authorizing AI tools",
  ],
  "scripts/check-ai-tool-call-authz.test.mjs": [
    "rejects OpenAI tool surfaces that do not use the authz helper",
    "accepts OpenAI tool surfaces routed through AI tool authz",
    "ai_tool_call_surface_missing_role_gate",
    "ai_tool_call_surface_missing_capability_gate",
    "ai_tool_call_surface_missing_target_scope_authorization",
  ],
};

const OPENAI_PROVIDER_RE =
  /from\s+["']openai["']|import\(["']openai["']\)|\bOpenAI\b|chat\.completions\.create|responses\.create/i;
const OPENAI_TOOL_SURFACE_RE =
  /\btools\s*:|\btool_choice\s*:|function_call|function_calling|tool_calls|responses\.create/i;
const AUTH_CONTEXT_RE = /AiToolMutationAuthContext|ctx:\s*AiToolMutationAuthContext|ctx\.orgId|organizationId:\s*result\.ctx\.orgId/;
const ARGUMENT_VALIDATION_RE = /parseArguments|safeParse|validate[A-Za-z0-9_]*Payload|readJsonBody/;
const AUDIT_RE = /recordAiToolAuditEvent|ai\.tool_call\.(authorized|executed|denied)|\.from\("audit_events"\)\.insert/;
const AUTHZ_HELPER_RE = /authorizeAiToolMutation|verifyAiToolMutationRequest/;
const ROLE_GATE_RE = /requiredRole|ctx\.role|role:\s*["'][A-Za-z0-9_-]+["']/;
const CAPABILITY_GATE_RE = /requiredCapability|ctx\.capabilities|capabilities:\s*\[/;
const TARGET_SCOPE_RE = /authorizeTarget|targetType|targetId/;

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
    if (["node_modules", ".next", ".git", "coverage", "dist"].includes(ent.name)) continue;
    const childRel = path.join(rel, ent.name).replace(/\\/g, "/");
    if (ent.isDirectory()) walk(root, childRel, out);
    else if (/\.(ts|tsx)$/.test(ent.name) && !/\.(test|spec|v9\.test|v10\.test)\.(ts|tsx)$/.test(ent.name)) {
      out.push(childRel);
    }
  }
  return out;
}

function hasOpenAiToolSurface(source) {
  return OPENAI_PROVIDER_RE.test(source) && OPENAI_TOOL_SURFACE_RE.test(source);
}

function collectToolSurfaceIssues(root) {
  const issues = [];
  for (const rel of walk(root, "src")) {
    const source = read(root, rel);
    if (!hasOpenAiToolSurface(source)) continue;

    if (!AUTHZ_HELPER_RE.test(source)) {
      issues.push({
        rel,
        issue: "ai_tool_call_surface_present_requires_explicit_authorization_design",
      });
    }
    if (!AUTH_CONTEXT_RE.test(source)) {
      issues.push({ rel, issue: "ai_tool_call_surface_missing_authenticated_org_context" });
    }
    if (!ARGUMENT_VALIDATION_RE.test(source)) {
      issues.push({ rel, issue: "ai_tool_call_surface_missing_argument_validation" });
    }
    if (!AUDIT_RE.test(source)) {
      issues.push({ rel, issue: "ai_tool_call_surface_missing_audit_event" });
    }
    if (!ROLE_GATE_RE.test(source)) {
      issues.push({ rel, issue: "ai_tool_call_surface_missing_role_gate" });
    }
    if (!CAPABILITY_GATE_RE.test(source)) {
      issues.push({ rel, issue: "ai_tool_call_surface_missing_capability_gate" });
    }
    if (!TARGET_SCOPE_RE.test(source)) {
      issues.push({ rel, issue: "ai_tool_call_surface_missing_target_scope_authorization" });
    }
  }
  return issues;
}

export function analyzeAiToolCallAuthz(root = ROOT) {
  const issues = [];

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
    if (!securityPipeline.includes(step)) {
      issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
    }
  }

  for (const [rel, markers] of Object.entries(REQUIRED_MARKERS)) {
    if (!exists(root, rel)) {
      issues.push({ issue: "missing_required_file", rel });
      continue;
    }
    const source = read(root, rel);
    for (const marker of markers) {
      if (!source.includes(marker)) issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  issues.push(...collectToolSurfaceIssues(root));
  return { checkId: "ai-tool-call-authz", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeAiToolCallAuthz();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
