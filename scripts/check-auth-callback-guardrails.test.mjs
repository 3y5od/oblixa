import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeAuthCallbackGuardrails } from "./check-auth-callback-guardrails.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeFixture(root, callbackOverride) {
  write(root, "package.json", JSON.stringify({ scripts: { "check:auth-callback-guardrails": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:auth-callback-guardrails\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:auth-callback-guardrails"\n');
  write(
    root,
    "src/app/auth/callback/route.ts",
    callbackOverride ??
      `
      const next = getSafeRedirectPath(searchParams.get("next"));
      const origin = getTrustedPublicOriginFromRequest(request);
      await supabase.auth.exchangeCodeForSession(code);
      const admin = await createAdminClient();
      admin.from("organization_invites").select("id, organization_id, email, role, expires_at, consumed_at, revoked_at");
      if (inv.consumed_at || inv.revoked_at || new Date(inv.expires_at).getTime() < Date.now()) {}
      if (emailLower !== inv.email.toLowerCase()) {}
      await admin.from("organization_members").upsert({});
      await admin.from("organization_invites").update({ consumed_at: new Date().toISOString() });
      await ensureUserOrg(user.id, resolveDefaultOrganizationNameForUser(user));
      await getUserPrimaryOrganizationId(admin, user.id);
      await resolvePostAuthRedirectPath(admin, orgIdForLanding, next);
      await resolveBlockingCalibrationPathForAdminOrg({
      });
      resolveDestinationWithBlockingCalibration(destination, calibrationPath);
      NextResponse.redirect(\`\${origin}\${finalDestination}\`);
      NextResponse.redirect(\`\${origin}/login?error=auth_callback_error\`);
      `
  );
  write(
    root,
    "src/lib/auth/post-auth-redirect.ts",
    `
    getSafeRedirectPath;
    resolveEffectiveLandingPath;
    const homePaths = new Set(["/dashboard", getSafeRedirectPath(null)]);
    if (!homePaths.has(requestedPath)) return requestedPath;
    return getSafeRedirectPath(resolved);
    `
  );
  write(
    root,
    "src/app/auth/refinement-auth-callback.test.ts",
    `
    provisions an org for non-invite callbacks and redirects to the resolved destination;
    rejects invite callbacks when the signed-in email does not match the invite target;
    rejects invite callbacks when the invite is expired;
    uses the trusted canonical origin when the callback request host is untrusted in production;
    expect(ensureUserOrg).not.toHaveBeenCalled();
    `
  );
}

test("analyzeAuthCallbackGuardrails accepts callback session, invite, and redirect protections", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-auth-callback-"));
  writeFixture(root);

  const report = analyzeAuthCallbackGuardrails(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzeAuthCallbackGuardrails rejects admin use before session exchange", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-auth-callback-"));
  writeFixture(
    root,
    `
    const admin = await createAdminClient();
    await supabase.auth.exchangeCodeForSession(code);
    const next = searchParams.get("next");
    `
  );

  const report = analyzeAuthCallbackGuardrails(root);
  assert.equal(report.ok, false);
  assert.equal(
    report.issues.some((issue) => issue.issue === "admin_client_must_be_created_after_session_exchange"),
    true
  );
  assert.equal(report.issues.some((issue) => issue.issue === "callback_redirect_param_not_sanitized"), true);
});
