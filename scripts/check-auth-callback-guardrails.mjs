#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REQUIRED_PACKAGE_SCRIPTS = ["check:auth-callback-guardrails"];
const REQUIRED_CI_COMMANDS = ["npm run check:auth-callback-guardrails"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:auth-callback-guardrails"'];

const REQUIRED_FILE_MARKERS = {
  "src/app/auth/callback/route.ts": [
    "exchangeCodeForSession(code)",
    "getSafeRedirectPath(searchParams.get(\"next\"))",
    "getTrustedPublicOriginFromRequest(request)",
    "createAdminClient()",
    '.select("id, organization_id, email, role, expires_at, consumed_at, revoked_at")',
    "inv.consumed_at",
    "inv.revoked_at",
    "new Date(inv.expires_at).getTime() < Date.now()",
    "emailLower !== inv.email.toLowerCase()",
    ".upsert(",
    ".update({ consumed_at: new Date().toISOString() })",
    "ensureUserOrg(user.id, resolveDefaultOrganizationNameForUser(user))",
    "getUserPrimaryOrganizationId(admin, user.id)",
    "resolvePostAuthRedirectPath(admin, orgIdForLanding, next)",
    "resolveBlockingCalibrationPathForAdminOrg({",
    "resolveDestinationWithBlockingCalibration(destination, calibrationPath)",
    "NextResponse.redirect(`${origin}${finalDestination}`)",
    "NextResponse.redirect(`${origin}/login?error=auth_callback_error`)",
  ],
  "src/lib/auth/post-auth-redirect.ts": [
    "getSafeRedirectPath",
    "resolveEffectiveLandingPath",
    'const homePaths = new Set(["/dashboard", getSafeRedirectPath(null)])',
    "if (!homePaths.has(requestedPath)) return requestedPath",
    "return getSafeRedirectPath(resolved)",
  ],
  "src/app/auth/refinement-auth-callback.test.ts": [
    "provisions an org for non-invite callbacks and redirects to the resolved destination",
    "rejects invite callbacks when the signed-in email does not match the invite target",
    "rejects invite callbacks when the invite is expired",
    "uses the trusted canonical origin when the callback request host is untrusted in production",
    "expect(ensureUserOrg).not.toHaveBeenCalled()",
  ],
};

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

export function analyzeAuthCallbackGuardrails(root = ROOT) {
  const issues = [];
  for (const rel of Object.keys(REQUIRED_FILE_MARKERS)) {
    if (!fs.existsSync(path.join(root, rel))) issues.push({ issue: "missing_required_file", rel });
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
    if (!securityPipeline.includes(step)) {
      issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
    }
  }

  for (const [rel, markers] of Object.entries(REQUIRED_FILE_MARKERS)) {
    const content = read(root, rel);
    for (const marker of collectMissingMarkers(content, markers)) {
      issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  const callback = read(root, "src/app/auth/callback/route.ts");
  const exchangeIndex = callback.indexOf("exchangeCodeForSession(code)");
  const adminIndex = callback.indexOf("createAdminClient()");
  if (exchangeIndex === -1 || adminIndex === -1 || adminIndex < exchangeIndex) {
    issues.push({
      issue: "admin_client_must_be_created_after_session_exchange",
      rel: "src/app/auth/callback/route.ts",
    });
  }

  if (/searchParams\.get\(["'](?:next|redirect|returnTo)["']\)/.test(callback) && !callback.includes("getSafeRedirectPath(searchParams.get(\"next\"))")) {
    issues.push({ issue: "callback_redirect_param_not_sanitized", rel: "src/app/auth/callback/route.ts" });
  }

  return { checkId: "auth-callback-guardrails", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeAuthCallbackGuardrails();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
