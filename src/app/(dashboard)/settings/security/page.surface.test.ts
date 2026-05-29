import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SETTINGS_SECURITY_STRINGS } from "@/lib/settings/spec-strings";

// SPEC: docs/security-page-maximal-pass.md §14.x — surface pins for
// the maximal-pass implementation. Substring-level assertions in
// the canonical pattern from settings-page-refinement,
// v9-route-metadata, and billing/page.surface.test.

const PAGE = join(
  process.cwd(),
  "src/app/(dashboard)/settings/security/page.tsx"
);
const PANEL = join(
  process.cwd(),
  "src/components/settings/security-settings-panel.tsx"
);
const LOADING = join(
  process.cwd(),
  "src/app/(dashboard)/settings/security/loading.tsx"
);
const ERROR_BOUNDARY = join(
  process.cwd(),
  "src/app/(dashboard)/settings/security/error.tsx"
);
const STEP_UP_COOKIE = join(
  process.cwd(),
  "src/lib/security/step-up-cookie.ts"
);
const MFA_ACTIONS = join(process.cwd(), "src/actions/mfa.ts");

const pageSrc = readFileSync(PAGE, "utf8");
const panelSrc = readFileSync(PANEL, "utf8");
const loadingSrc = readFileSync(LOADING, "utf8");
const errorSrc = readFileSync(ERROR_BOUNDARY, "utf8");
const stepUpSrc = readFileSync(STEP_UP_COOKIE, "utf8");
const mfaActionsSrc = readFileSync(MFA_ACTIONS, "utf8");

describe("Security page — voice + release-state compliance (§4)", () => {
  it("§4.3 legalNote matches release-state §1700-1702 exactly", () => {
    expect(SETTINGS_SECURITY_STRINGS.legalNote).toBe(
      "Oblixa helps organize contract information, but it does not provide legal advice."
    );
  });

  it("§4.1 no 'public Core' tier vocabulary leaks", () => {
    expect(pageSrc).not.toContain("public Core");
    expect(panelSrc).not.toContain("public Core");
  });

  it("§14.4 no aal1/aal2 developer-internal terms rendered as user copy", () => {
    // aal1/aal2 may appear in code logic (currentAal === "aal2") but
    // must NOT appear in rendered text. The hidden SR-only span uses
    // currentAal — that's an interpolation, not a literal.
    expect(pageSrc).not.toMatch(/>\s*aal[12]\s*</);
    expect(panelSrc).not.toMatch(/>\s*aal[12]\s*</);
  });

  it("§14.8 voice-rule audit on SETTINGS_SECURITY_STRINGS values", () => {
    const forbidden = [
      "platform",
      "transformation",
      "governance",
      "autopilot",
      "intelligence",
    ];
    const stringValues = JSON.stringify(SETTINGS_SECURITY_STRINGS);
    for (const f of forbidden) {
      expect(stringValues.toLowerCase()).not.toContain(f);
    }
  });
});

describe("Security page — page structure + primitives (§1, §2)", () => {
  it("§5.1 skip-to-content link targets the first interactive surface", () => {
    // The panel (mfa-card) always leads, so the skip link points at it
    // directly — no state-dependent target.
    expect(pageSrc).toContain('href="#mfa-card"');
    expect(pageSrc).toContain("Skip to security content");
  });

  it("§5.2 page-header + alerts grouped in flex-col wrapper", () => {
    expect(pageSrc).toContain('<div className="flex flex-col gap-4">');
  });

  it("§2.1 StatusBadge primitive used (not inline ui-status-badge spans)", () => {
    expect(panelSrc).toContain('from "@/components/ui/status-badge"');
    expect(panelSrc).toContain("<StatusBadge");
  });

  it("§2.4 / V3 §1.13 public settings avoids landing eyebrow decoration", () => {
    expect(panelSrc).not.toContain("landing-eyebrow-dot");
    expect(pageSrc).not.toContain("landing-eyebrow-dot");
  });

  it("§2.5 medallion icons render on sub-section headers", () => {
    // V2 §1.26 — sub-card medallions sized h-8 w-8 (32px), down from 40px.
    // V2 §1.17 — MFA empty-state uses Smartphone, not ShieldCheck.
    expect(panelSrc).toContain("KeyRound");
    expect(panelSrc).toContain("Smartphone");
    expect(panelSrc).toContain("Building2");
    expect(panelSrc).toMatch(/h-8 w-8/);
  });

  it("§2.6 identity strip surfaces MFA + Role + Account on a hairline dl", () => {
    // Issue #2 — chips live in a flat <dl aria-label="Identity"> rather
    // than the page-header metaStrip slot.
    expect(pageSrc).toContain('aria-label="Identity"');
    // ACCOUNT label comes from spec-strings.accountLabel.
    expect(pageSrc).toContain("SETTINGS_SECURITY_STRINGS.accountLabel");
    expect(pageSrc).toMatch(/dt[^>]*>MFA/);
  });

  it("§2.7 / Issue #17 account context drops landing-grade corner ring", () => {
    // Flattened to a grouped list — no decorative absolute-positioned
    // ring borders left behind.
    expect(pageSrc).not.toContain("landing-corner-ring");
    expect(pageSrc).not.toMatch(/pointer-events-none absolute rounded-full border/);
  });

  it("§2.9 UiToggle primitive replaces raw checkbox", () => {
    expect(panelSrc).toContain('from "@/components/ui/ui-toggle"');
    expect(panelSrc).toContain("<UiToggle");
  });

  it("§2.10 UiConfirmDialog replaces window.confirm via ConfirmActionButton", () => {
    expect(panelSrc).toContain('from "@/components/ui/ui-confirm-dialog"');
    expect(panelSrc).toContain("<UiConfirmDialog");
    expect(panelSrc).not.toContain("<ConfirmActionButton");
  });

  it("§3.3 DPA contact rendered as mailto link", () => {
    // mailto: is constructed via template literal `mailto:${...contactEmail}`.
    expect(pageSrc).toMatch(/mailto:\$\{[^}]*contactEmail\}/);
    expect(SETTINGS_SECURITY_STRINGS.contactEmail).toBe("security@oblixa.com");
  });

  it("§3.4 password change link present in panel", () => {
    expect(panelSrc).toContain("/settings/account?action=change-password");
  });
});

describe("Security page — defects (§1.x)", () => {
  it("§1.5 raw aal1/aal2 strings absent from rendered JSX", () => {
    expect(panelSrc).not.toContain('"aal1"');
    expect(panelSrc).not.toContain("aal1 →");
  });

  it("§1.10 caps-tier utility classes used (not inline tracking-[Xem])", () => {
    expect(panelSrc).not.toMatch(/tracking-\[0\.\d+em\][^"]*uppercase/);
    expect(panelSrc).toMatch(/ui-caps-[123]/);
    expect(pageSrc).toMatch(/ui-caps-[123]/);
  });

  it("§1.11 step-up CTA renamed from 'Confirm step-up' to 'Confirm password'", () => {
    expect(SETTINGS_SECURITY_STRINGS.stepUpFormCta).toBe("Confirm password");
    expect(panelSrc).not.toContain("Confirm step-up");
  });

  it("§1.12 step-up status reads server-side via readStepUpExpiry", () => {
    expect(pageSrc).toContain("readStepUpExpiry");
    expect(pageSrc).toMatch(/stepUp[:\s]/);
  });

  it("§1.13 + V2 §4.6 sessions body uses positive-action phrasing", () => {
    // V2 §4.6 — shortened (h2 provides scope).
    expect(SETTINGS_SECURITY_STRINGS.sessionsBody).toBe(
      "Sign out other devices."
    );
  });

  it("§1.18 QR alt text describes the action", () => {
    expect(SETTINGS_SECURITY_STRINGS.qrAlt).toContain("Scan");
    expect(SETTINGS_SECURITY_STRINGS.qrAlt).toContain("authenticator app");
  });

  it("§1.19 TOTP code input has maxLength 6 + pattern \\d{6}", () => {
    expect(panelSrc).toContain("maxLength={6}");
    expect(panelSrc).toContain('pattern="\\d{6}"');
  });

  it("§1.25 noscript form-action POST fallback for step-up", () => {
    expect(panelSrc).toContain("<noscript>");
    expect(panelSrc).toContain('action="/api/settings/step-up"');
    expect(panelSrc).toContain('method="POST"');
  });

  it("§1.27 aria-busy on cards during transitions", () => {
    expect(panelSrc).toMatch(/aria-busy=\{/);
  });

  it("§1.33 needStepUp flag triggers scrollIntoView + focus", () => {
    expect(panelSrc).toContain("needStepUp");
    expect(panelSrc).toContain("scrollIntoView");
  });

  it("§1.34 startTotpEnrollment emits audit event", () => {
    expect(mfaActionsSrc).toContain("security.mfa_totp_enrollment_started");
  });

  it("§1.35 listMySessions wired to page.tsx", () => {
    expect(pageSrc).toContain("listMySessions");
    expect(pageSrc).toContain("sessions:");
  });

  it("§1.37 ctx.user.id access pattern (not ctx.userId)", () => {
    expect(pageSrc).not.toMatch(/ctx\.userId\b/);
    expect(pageSrc).toMatch(/ctx\.user\.id/);
  });

  it("§1.40 MfaActionResult discriminated union exported", () => {
    expect(mfaActionsSrc).toContain("export type MfaActionResult");
    expect(mfaActionsSrc).toContain("export type MfaActionError");
  });

  it("§1.44 / Issue #4 ctx.user.email surfaced in full (no masking)", () => {
    // Long addresses ("alt…@gmail.com") were impossible to verify when
    // masked; the strip now shows the full email and truncates via CSS.
    expect(pageSrc).toContain("accountEmail");
    expect(pageSrc).toContain("ctx.user.email");
  });

  it("§1.46 audit-write fire-and-forget pattern verified", () => {
    // recordSecurityAuditEvent wrapped in try/catch for best-effort
    expect(mfaActionsSrc).toMatch(/try\s*\{[\s\S]*recordSecurityAuditEvent/);
  });
});

describe("Security page — content + layout (§3, §7, §8)", () => {
  it("§3.1 + V4 §1.12 activity-feed empty label (retention via title attr)", () => {
    expect(pageSrc).toContain("activityEmptyLabel");
    // V2 §4.5 — reframed as count + period.
    expect(SETTINGS_SECURITY_STRINGS.activityEmptyLabel).toBe(
      "0 events in the last 90 days"
    );
    // V4 §1.6 + §1.12 — retention copy relocated to title attribute
    // on the eyebrow; no longer a visible chip in the strip.
    expect(pageSrc).toMatch(/title="Events retained for 90 days"/);
  });

  it("§7.1 MFA + Step-up paired in 2-col grid at lg+", () => {
    expect(panelSrc).toContain("lg:grid-cols-2");
  });

  it("§8.13 reserved tone-dot slot on factor rows", () => {
    expect(panelSrc).toMatch(/h-2 w-2[^<]*rounded-full/);
  });

  it("§8.16 print-stylesheet class applied to interactive controls", () => {
    expect(panelSrc).toContain("billing-no-print");
    expect(pageSrc).toContain("billing-no-print");
  });
});

describe("Security page — accessibility (§9)", () => {
  it("§9.4 step-up password aria-describedby links to help paragraph", () => {
    expect(panelSrc).toMatch(/aria-describedby=\{stepUpHelpId\}/);
  });

  it("§9.15 per-row aria-busy with pendingFactorId tracking", () => {
    expect(panelSrc).toContain("pendingFactorId");
    expect(panelSrc).toMatch(/aria-busy=\{pendingFactorId === f\.id\}/);
  });

  it("§9.16 forms use noValidate (server-validation owns error surface)", () => {
    // At least one <form> with noValidate
    expect(panelSrc).toMatch(/<form[\s\S]{0,200}noValidate/);
  });

  it("§9.17 aria-live='polite' on dynamic enrollment region", () => {
    expect(panelSrc).toMatch(/aria-live="polite"/);
  });

  it("§9.19 clipboard feature-detection fallback", () => {
    expect(panelSrc).toContain("navigator.clipboard");
    expect(panelSrc).toContain("setCopyFallback");
  });
});

describe("Security page — boundary files (§5.4, §5.5)", () => {
  it("§5.4 loading.tsx uses .ui-skeleton + .ui-loading-panel", () => {
    expect(loadingSrc).toContain("ui-skeleton");
    expect(loadingSrc).toContain("ui-loading-panel");
  });

  it("§5.4 loading.tsx has aria-busy on root", () => {
    expect(loadingSrc).toContain('aria-busy="true"');
  });

  it("§5.5 error.tsx is 'use client' recoverable boundary with reset()", () => {
    expect(errorSrc).toContain('"use client"');
    expect(errorSrc).toContain("reset()");
    expect(errorSrc).toContain("Try again");
  });

  it("§5.5 error.tsx classifies supabase + network errors", () => {
    expect(errorSrc).toContain("supabase");
    expect(errorSrc).toContain("network");
  });
});

describe("Step-up cookie helper (§16.1)", () => {
  it("§16.1 readStepUpExpiry returns active + expiresAt shape", () => {
    expect(stepUpSrc).toContain("export function readStepUpExpiry");
    expect(stepUpSrc).toContain("expiresAt");
    expect(stepUpSrc).toContain("active");
  });
});

describe("MFA actions (§1.34, §1.40, §16.2)", () => {
  it("§1.34 startTotpEnrollment audits via recordSecurityAuditEvent", () => {
    expect(mfaActionsSrc).toMatch(
      /startTotpEnrollment[\s\S]*?recordSecurityAuditEvent/
    );
  });

  it("§16.2 audit action enum includes mfa_totp_enrollment_started", () => {
    const auditActionsSrc = readFileSync(
      join(process.cwd(), "src/lib/security/audit-actions.ts"),
      "utf8"
    );
    expect(auditActionsSrc).toContain('"security.mfa_totp_enrollment_started"');
  });
});

describe("Security page — banner state machine (§1.39)", () => {
  it("§1.39 mfaBanner branches on ?mfa=required|enrolled|expired", () => {
    expect(pageSrc).toContain('mfaParam === "required"');
    expect(pageSrc).toContain('mfaParam === "enrolled"');
    expect(pageSrc).toContain('mfaParam === "expired"');
  });
});

// ---------------------------------------------------------------------
// V2 pass surface pins
// ---------------------------------------------------------------------

describe("Security page — V2 pass surface pins", () => {
  it("V2 §1.1 Resources h2 renamed (not literal 'Resources')", () => {
    expect(SETTINGS_SECURITY_STRINGS.sections.resources).toBe(
      "Account & workspace context"
    );
  });

  it("V2 §1.2 + §1.20 MFA card uses count-chip, no duplicate badge", () => {
    // Card-level SINGLE-FACTOR/TWO-FACTOR badge dropped; the identity
    // strip carries MFA posture. KeyValueChip ENROLLED count surfaces
    // in-card when factors > 0.
    expect(panelSrc).toContain('<KeyValueChip');
    expect(panelSrc).toContain('"ENROLLED"');
  });

  it("V2 §1.3 ChipPair used in TEAM ROLES row", () => {
    expect(pageSrc).toContain("<ChipPair");
    expect(pageSrc).toContain("VIEW ONLY");
  });

  it("V2 §1.4 stepUpFormHelp is sentence-case (≤80 chars)", () => {
    expect(SETTINGS_SECURITY_STRINGS.stepUpFormHelp).toBe(
      "Confirm your password to unlock sensitive changes."
    );
    expect(SETTINGS_SECURITY_STRINGS.stepUpFormHelp.length).toBeLessThanOrEqual(80);
  });

  it("V2 §1.5 + §1.21 lead is ≤80 chars + scope-marking dropped", () => {
    expect(SETTINGS_SECURITY_STRINGS.lead.length).toBeLessThanOrEqual(80);
    expect(SETTINGS_SECURITY_STRINGS.lead).not.toContain("your account and workspace");
  });

  it("V2 §1.6 + V3 §1.1 session timestamp uses canonical date helper", () => {
    // V3 §1.1 — local format helper replaced with formatDate from
    // src/lib/format/date.ts. Panel imports it; the helper handles
    // "MMM d · h:mm a" format internally.
    expect(panelSrc).toContain("formatDate");
    expect(panelSrc).toContain('from "@/lib/format/date"');
    expect(panelSrc).not.toMatch(/toLocaleString\(\)/);
  });

  it("V2 §1.7 / Issue #24 activity strip drops raw pipe separators", () => {
    // The strip is no longer a single line stitched with hairline pipes;
    // it renders a heading + compact DashboardEmptyState (Issue #23).
    expect(pageSrc).not.toMatch(/h-3 w-px[^>]*sm:inline-block/);
    expect(pageSrc).toMatch(/<DashboardEmptyState[\s\S]{0,200}activityEmptyLabel/);
  });

  it("V2 §1.11 WORKSPACE divider hr dropped from panel", () => {
    expect(panelSrc).not.toMatch(/<hr[^>]*w-32/);
  });

  it("V2 §1.13 / Issue #4 email shown in full — no mask ellipsis or middots", () => {
    expect(pageSrc).not.toContain("···");
    expect(pageSrc).not.toContain("maskEmail");
  });

  it("V2 §1.17 MFA empty-state uses different icon than header (Smartphone vs KeyRound)", () => {
    // Header uses KeyRound, empty state uses Smartphone.
    expect(panelSrc).toMatch(/KeyRound[\s\S]{0,2000}Smartphone/);
  });

  it("V2 §1.18 'Activity rows retained for compliance review.' prose dropped", () => {
    expect(pageSrc).not.toContain("Activity rows retained for compliance review");
  });

  it("V2 §1.19 MFA empty-state branches on orgMfaRequired", () => {
    expect(panelSrc).toContain("showDangerEmptyState");
    expect(SETTINGS_SECURITY_STRINGS.mfaEmptyBodyRequired).toContain("workspace requires MFA");
  });

  it("V2 §1.22 WORKSPACE chip in identity strip from org.name", () => {
    expect(pageSrc).toContain("workspaceLabelChip");
    expect(pageSrc).toMatch(/orgName/);
  });

  it("V2 §1.24 in-card 'Enroll authenticator' becomes primary when empty", () => {
    expect(panelSrc).toMatch(/factorsEmpty\s*\?\s*"ui-btn-primary"/);
  });

  it("V2 §1.26 sub-card medallions are 32px (h-8 w-8)", () => {
    expect(panelSrc).toMatch(/CardMedallion[\s\S]{0,500}h-8 w-8/);
  });

  it("V2 §1.27 + V3 §1.3 password input placeholder empty (drops ambiguous dots)", () => {
    expect(panelSrc).toContain("passwordPlaceholder");
    // V3 §1.3 — empty placeholder; "••••••••" was indistinguishable
    // from typed password content.
    expect(SETTINGS_SECURITY_STRINGS.passwordPlaceholder).toBe("");
  });

  it("V2 §1.34 + §2.6 / Issue #9 stepUpEmptyLabel is LOCKED (consistent with the unlock form)", () => {
    // "LOCKED + enabled Confirm-password form" reads as a call to act;
    // the old "INACTIVE" badge over active controls looked contradictory.
    expect(SETTINGS_SECURITY_STRINGS.stepUpEmptyLabel).toBe("LOCKED");
  });

  it("V2 §1.34 stepUpMfaSessionLabel exists for AAL2 path", () => {
    expect(SETTINGS_SECURITY_STRINGS.stepUpMfaSessionLabel).toBe("MFA SESSION");
  });

  it("V2 §1.36 email-verification status surfaced in Resources card", () => {
    expect(pageSrc).toContain("emailConfirmedAt");
    expect(SETTINGS_SECURITY_STRINGS.emailVerifiedLabel).toBe("VERIFIED");
    expect(SETTINGS_SECURITY_STRINGS.emailUnverifiedLabel).toBe("UNVERIFIED");
  });

  it("V2 §1.37 SIGN-IN METHOD row uses user.identities providers", () => {
    expect(pageSrc).toContain("user.identities");
    expect(pageSrc).toContain("humanizeProvider");
  });

  it("V2 §1.39 + §1.40 metadata.description + robots set", () => {
    expect(pageSrc).toMatch(/description:\s*SETTINGS_SECURITY_STRINGS\.lead/);
    expect(pageSrc).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it("V2 §1.41 dynamic = 'force-dynamic' for no-store behavior", () => {
    expect(pageSrc).toContain('export const dynamic = "force-dynamic"');
  });

  it("V2 §1.46 leftover <ShieldAlert> hidden span removed", () => {
    expect(pageSrc).not.toContain("ShieldAlert");
  });

  it("V2 §1.47 / Issue #14 Sign out this device renders as a ghost pill (no arrow)", () => {
    // The pill shape carries the affordance, so the trailing arrow glyph
    // is dropped — all three Devices actions share one pill vocabulary.
    expect(panelSrc).toContain("signOutSelfCta");
    expect(SETTINGS_SECURITY_STRINGS.signOutSelfCta).toBe("Sign out this device");
  });

  it("V2 §1.48 MEMBER SINCE row with user.created_at", () => {
    expect(pageSrc).toContain("memberSince");
    expect(SETTINGS_SECURITY_STRINGS.resources.memberSince).toBe("Member since");
  });

  it("V2 §1.49 / Issue #4 account email truncates via CSS, not masking", () => {
    expect(pageSrc).toMatch(/truncate font-mono/);
  });

  it("V2 §1.50 defensive accountIdentity falls back when email empty", () => {
    expect(pageSrc).toContain("accountIdentity");
  });

  it("V2 §1.51 max-factors recovery hint", () => {
    expect(SETTINGS_SECURITY_STRINGS.enrollMaxFactorsHint).toContain("Remove an existing");
    expect(panelSrc).toMatch(/max\.\*factor/);
  });

  it("V2 §1.52 cancel-enrollment focus restoration via id lookup", () => {
    expect(panelSrc).toContain("ADD_AUTH_BTN_ID");
    expect(panelSrc).toMatch(/getElementById\(\s*ADD_AUTH_BTN_ID/);
  });

  it("V2 §1.54 dev environment marker conditional banner", () => {
    expect(pageSrc).toContain("showDevBanner");
    expect(SETTINGS_SECURITY_STRINGS.devModeCopy).toContain("Development environment");
  });

  it("V2 §1.55 noscript form has hidden idempotency_key input", () => {
    expect(panelSrc).toMatch(/name="idempotency_key"/);
  });

  it("V2 §3.1 / Issue #25 fixed page order: panel → context → activity → legal", () => {
    // The factorsEmpty reorder produced two different layouts depending
    // on state, which read as uneven hierarchy. Order is now fixed.
    expect(pageSrc).toMatch(
      /<SecuritySettingsPanel[\s\S]{0,3000}<AccountContext[\s\S]{0,2000}<ActivityStrip[\s\S]{0,2000}<LegalNote/
    );
  });

  it("V2 §3.4 Sessions + Workspace MFA in 2-col grid at lg+", () => {
    // Two `lg:grid-cols-2` occurrences (one for MFA+Sensitive, one for Sessions+Workspace).
    const matches = panelSrc.match(/lg:grid-cols-2/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("V2 §3.9 offline UiAlert renders when !isOnline", () => {
    expect(panelSrc).toContain("isOnline");
    expect(panelSrc).toMatch(/!isOnline/);
    expect(SETTINGS_SECURITY_STRINGS.offlineCopy).toContain("offline");
  });

  it("V2 §4.5 activity empty label is count + period", () => {
    expect(SETTINGS_SECURITY_STRINGS.activityEmptyLabel).toBe(
      "0 events in the last 90 days"
    );
  });

  it("V2 §4.8 SENSITIVE eyebrow renamed to STEP-UP", () => {
    expect(SETTINGS_SECURITY_STRINGS.eyebrows.stepUp).toBe("STEP-UP");
  });

  it("V2 §4.10 activityViewAllCta renamed to OPEN AUDIT LOG", () => {
    expect(SETTINGS_SECURITY_STRINGS.activityViewAllCta).toBe("OPEN AUDIT LOG");
  });

  it("V2 §5.1 activity strip eyebrow renders as <h2>", () => {
    expect(pageSrc).toMatch(/<h2[^>]*id="security-activity-title"/);
  });

  it("V2 §5.10 aria-current on current session row", () => {
    expect(panelSrc).toMatch(/aria-current=\{s\.current/);
  });

  it("V2 §6.1 ?mfa=enrolled redirect after verify", () => {
    expect(panelSrc).toContain('"/settings/security?mfa=enrolled"');
  });

  it("V2 §6.2 optimistic step-up state", () => {
    expect(panelSrc).toContain("optimisticStepUpActive");
    expect(panelSrc).toContain("setOptimisticStepUpActive");
  });
});

// ---------------------------------------------------------------------
// V3 pass surface pins
// ---------------------------------------------------------------------

describe("Security page — V3 pass surface pins", () => {
  it("V3 §1.1 date helper module exists", () => {
    const fmtSrc = readFileSync(
      join(process.cwd(), "src/lib/format/date.ts"),
      "utf8"
    );
    expect(fmtSrc).toContain("export function formatDate");
    expect(fmtSrc).toContain("export function timeAttrs");
    expect(fmtSrc).toContain("export function formatDateUTC");
  });

  it("V3 §1.8 lead verb is Manage (not Confirm)", () => {
    expect(SETTINGS_SECURITY_STRINGS.lead).toBe(
      "Manage authenticators, devices, and access policy."
    );
    expect(SETTINGS_SECURITY_STRINGS.lead.length).toBeLessThanOrEqual(80);
  });

  it("V3 §4.6 POLICY description shortened to one sentence", () => {
    expect(SETTINGS_SECURITY_STRINGS.orgMfaConsequence).toBe(
      "Members must enroll an authenticator at next sign-in."
    );
    expect(
      SETTINGS_SECURITY_STRINGS.orgMfaConsequence.length
    ).toBeLessThanOrEqual(80);
  });

  it("V3 §1.13 landing-eyebrow-dot count reduced to 1 in panel", () => {
    // Panel sub-cards (MFA, STEP-UP, SESSIONS, POLICY) no longer
    // carry the dot. Only page-level Resources card keeps it.
    expect(panelSrc).not.toContain("landing-eyebrow-dot");
  });

  it("V3 §1.21 + §1.12 dates use canonical helper, no font-mono on dates", () => {
    expect(pageSrc).toContain("formatDate");
    expect(panelSrc).toContain("formatDate");
    // Drop the explicit `font-mono` on the session timestamp.
    expect(panelSrc).not.toMatch(/font-mono[^"]*text-\[11\.5px\][\s\S]{0,400}fmtSession/);
  });

  it("V3 §1.22 Forgot password link present in STEP-UP", () => {
    expect(panelSrc).toContain("forgotPasswordCta");
    expect(panelSrc).toContain('href="/auth/forgot-password"');
    expect(SETTINGS_SECURITY_STRINGS.forgotPasswordCta).toBe("Forgot password?");
  });

  it("V3 §1.27 <time> wrapper with UTC title attribute", () => {
    expect(panelSrc).toContain("timeAttrs");
    expect(pageSrc).toContain("timeAttrs");
    // The Sessions row uses <time> element.
    expect(panelSrc).toMatch(/<time[\s\S]{0,300}timeAttrs/);
  });

  it("V3 §3.1 lg:items-start (not lg:items-stretch)", () => {
    expect(panelSrc).toContain("lg:items-start");
    expect(panelSrc).not.toContain("lg:items-stretch");
  });

  it("V3 §1.7 / Issue #6 account context uses a grouped divide-y list", () => {
    // Flattened from a 2-col grid with col-span hairlines into a single
    // grouped list whose rows are separated by divide-y (§7.5).
    expect(pageSrc).toMatch(/divide-y divide-\[/);
  });

  it("V3 §1.10 SIGN-IN row dropped when provider is only email", () => {
    expect(pageSrc).toContain("onlyEmailProvider");
  });

  it("V3 §1.14 OPEN AUDIT LOG link dropped from activity strip", () => {
    // The activity strip no longer renders an OPEN AUDIT LOG link.
    expect(pageSrc).not.toMatch(/href="\/settings\/security\?filter=billing"[\s\S]{0,500}activityViewAllCta/);
  });

  it("V3 §1.14 / compliance audit: View audit history row restored per release-state §1685-1702", () => {
    // Release-state §1685-1702 explicitly requires an "Audit history
    // link" — V3 §1.14 had dropped it pending real backing data, but
    // the spec doesn't gate the affordance on backend readiness.
    // Compliance pass restored the row in Resources card.
    expect(pageSrc).toContain("View audit history");
    expect(pageSrc).toContain('"/settings/security?filter=billing"');
  });

  it("V3 §1.15 Resend verification CTA renders when unverified", () => {
    expect(pageSrc).toContain("resendVerificationCta");
    expect(SETTINGS_SECURITY_STRINGS.resendVerificationCta).toContain("Resend");
  });

  it("V3 §1.19 Workspace chip has title + aria-label for truncation", () => {
    expect(pageSrc).toMatch(/title=\{orgName\}/);
    expect(pageSrc).toMatch(/aria-label=\{orgName\}/);
  });

  it("V3 §1.25 page-header receives no actions slot", () => {
    // Identity-only header — account context renders in the flat strip
    // below, so no actions prop is passed to DashboardPageHeader.
    expect(pageSrc).not.toMatch(/actions=\{/);
  });
});

// ---------------------------------------------------------------------
// V4 pass surface pins
// ---------------------------------------------------------------------

describe("Security page — V4 pass surface pins", () => {
  it("V4 §1.1 LAST SIGN-IN row rendered from user.last_sign_in_at", () => {
    expect(pageSrc).toContain("lastSignInIso");
    expect(pageSrc).toContain("last_sign_in_at");
    expect(pageSrc).toContain("lastSignInLabel");
  });

  it("V4 §1.2 SessionRow + SessionSummary expose expiresAt", () => {
    const sessionsSrc = readFileSync(
      join(process.cwd(), "src/actions/sessions.ts"),
      "utf8"
    );
    expect(sessionsSrc).toContain("expiresAt: string | null");
    expect(panelSrc).toContain("expiresAt: string | null");
    // Issue #12/#13 — sentence-case "Expires {relative}" replaced the
    // oversized "EXPIRES" caps + bare pipe in the session row.
    expect(panelSrc).toContain("Expires");
    expect(panelSrc).toContain("fmtRelative");
  });

  it("V4 §1.6 + §1.12 activity strip drops retention chip; uses title attr", () => {
    // Visible retention caps span removed; title attribute on h2.
    expect(pageSrc).toMatch(/title="Events retained for 90 days"/);
  });

  it("V4 §1.5 / Issue #14 Sign out this device precedes Change password in the pill cluster", () => {
    // signOutSelfCta comes BEFORE passwordChangeCta (sign-out actions
    // grouped first). All three share one ghost-pill vocabulary — no
    // pipe separator between them.
    expect(panelSrc).toMatch(
      /signOutSelfCta[\s\S]{0,500}passwordChangeCta/
    );
  });

  it("V4 §1.7 MFA card carries conditional warning border", () => {
    expect(panelSrc).toMatch(/factorsEmpty[^?]*\?[\s\S]{0,200}warning-soft/);
  });

  it("V4 §1.8 / user-report §5 POLICY badge escalates to AT RISK when exposed", () => {
    // V4 user-report §5 — shortened from "WORKSPACE EXPOSED" (17
    // chars, forced h2 wrap) to "AT RISK" (7 chars, matches the
    // width-class of REQUIRED / OPTIONAL). Workspace context is
    // implicit from the card identity.
    // Issue #16 — each policy badge now carries a leading glyph
    // (ShieldCheck / TriangleAlert) for non-color reinforcement (§7.7),
    // so the orgMfa ternary → factorsEmpty branch spans more markup;
    // distance relaxed accordingly.
    expect(panelSrc).toContain("AT RISK");
    expect(panelSrc).not.toContain("WORKSPACE EXPOSED");
    expect(panelSrc).toMatch(/orgMfa\s*\?[\s\S]{0,400}factorsEmpty/);
  });

  it("V4 §1.9 medallion variety: ShieldCheck on MFA, KeyRound on STEP-UP", () => {
    // Both icons imported.
    expect(panelSrc).toMatch(/ShieldCheck,/);
    expect(panelSrc).toMatch(/KeyRound,/);
    // MFA card header uses ShieldCheck (relaxed distance — code
    // comments + structure between id and medallion can be long).
    expect(panelSrc).toMatch(
      /id="mfa-card"[\s\S]{0,1500}<ShieldCheck/
    );
    // STEP-UP card retains KeyRound.
    expect(panelSrc).toMatch(
      /id="step-up-card"[\s\S]{0,800}<KeyRound/
    );
  });

  it("V4 §2.1 dev banner copy uses 'is mocked'", () => {
    expect(SETTINGS_SECURITY_STRINGS.devModeCopy).toBe(
      "Development environment — step-up cookie validation is mocked."
    );
  });

  it("V4 user-report §2: count chip dropped when sessions.length === 1", () => {
    // V4 user-report §2 — a single digit in a rounded-full border
    // reads as a notification badge. The THIS DEVICE row already
    // conveys the count when only 1 session exists. Count chip
    // now only renders for multi-device states (length > 1) as
    // "N DEVICES" caps (no doubled "ACTIVE" per §11.8).
    expect(panelSrc).not.toMatch(/\{sessions\.length\}\s*ACTIVE/);
    expect(panelSrc).toMatch(/sessions\.length > 1/);
    expect(panelSrc).toMatch(/\{sessions\.length\}\s*DEVICES/);
    expect(panelSrc).toMatch(/tabular-nums/);
  });

  it("V4 §2.3 / Issue #12+#13 THIS DEVICE row: StatusBadge + sentence-case Expires, no pipe", () => {
    // Issue #12 — bare tone-dot + oversized caps replaced by a
    // StatusBadge. Issue #13 — the raw pipe separator is gone; expiry
    // is a compact sentence-case tabular <time> ("Expires {relative}").
    expect(panelSrc).toMatch(
      /sessionsCurrentLabel[\s\S]{0,800}Expires \{fmtRelative/
    );
    expect(panelSrc).not.toMatch(/sessionsCurrentLabel[\s\S]{0,500}h-3 w-px/);
  });

  it("V4 §6.1 / Issue #8 'What is two-factor sign-in?' disclosure beneath MFA empty state", () => {
    // Issue #8 — sentence-case accent link (not an oversized caps
    // heading) so it reads as a secondary "learn more" affordance.
    expect(SETTINGS_SECURITY_STRINGS.mfaExplainerSummary).toContain("two-factor");
    expect(panelSrc).toContain("mfaExplainerSummary");
    expect(panelSrc).toContain("mfaExplainerBody");
  });

  it("V4 §6.2 'What changes for members?' disclosure beneath POLICY toggle", () => {
    expect(SETTINGS_SECURITY_STRINGS.policyExplainerSummary).toContain("members");
    expect(panelSrc).toContain("policyExplainerSummary");
    expect(panelSrc).toContain("policyExplainerBody");
  });

  it("V4 §6.3 WORKSPACE chip is a Link to /settings/workspace", () => {
    expect(pageSrc).toMatch(/href="\/settings\/workspace"[\s\S]{0,200}\{orgName\}/);
  });

  it("V4 §6.4 ACCOUNT chip is a Link to /settings/account", () => {
    expect(pageSrc).toMatch(/href="\/settings\/account"[\s\S]{0,200}\{accountIdentity\}/);
  });

  it("V4 §5.2 resendEmailVerification server action exists", () => {
    const emailVerificationSrc = readFileSync(
      join(process.cwd(), "src/actions/email-verification.ts"),
      "utf8"
    );
    expect(emailVerificationSrc).toContain("export async function resendEmailVerification");
    expect(emailVerificationSrc).toContain('"signup"');
  });

  it("V4 §5.2 email_verification_resent audit action enum entry", () => {
    const auditActionsSrc = readFileSync(
      join(process.cwd(), "src/lib/security/audit-actions.ts"),
      "utf8"
    );
    expect(auditActionsSrc).toContain('"security.email_verification_resent"');
  });

  it("V4 §1.2 fmtRelative helper exists in lib/format/date.ts", () => {
    const fmtSrc = readFileSync(
      join(process.cwd(), "src/lib/format/date.ts"),
      "utf8"
    );
    expect(fmtSrc).toContain("export function fmtRelative");
  });

  it("Issue #3 MFA posture uses a StatusBadge + glyph, not color-only text", () => {
    // The flat items-center strip aligns a StatusBadge with the text
    // values cleanly, so the MFA `dd` reinforces state with a badge +
    // icon (ShieldCheck / TriangleAlert) rather than amber/green text
    // alone (§7.7 — never a bare colored signal).
    expect(pageSrc).toMatch(/factorCount > 0[\s\S]{0,400}StatusBadge status="healthy"/);
    expect(pageSrc).toContain("mfaTwoFactorLabel");
    expect(pageSrc).toContain("mfaSingleLabel");
    expect(pageSrc).toMatch(/<TriangleAlert/);
  });

  it("Issue #2 identity is a flat hairline dl, not a boxed grid panel", () => {
    // Issue #2 — the boxed identity grid competed with the panel below.
    // It is now a flat <dl aria-label="Identity"> on a top hairline, so
    // it reads as page metadata (§5.1) rather than a second card.
    expect(pageSrc).toContain('aria-label="Identity"');
    // DashboardPageHeader no longer receives a metaStrip prop here.
    expect(pageSrc).not.toMatch(/metaStrip=\{/);
    expect(pageSrc).toMatch(/aria-label="Identity"[\s\S]{0,160}border-t/);
  });

  it("Issue #2 identity strip aligns chips with items-center", () => {
    // The flat strip uses items-center so a 22px StatusBadge lines up
    // with 13px text values without grid baseline gymnastics.
    expect(pageSrc).toMatch(/aria-label="Identity"[\s\S]{0,160}items-center/);
  });

  it("V4 user-report-3 (Sessions): body prose dropped; h2 + row + actions self-describe", () => {
    // V4 user-report §1.B — `Sign out other devices.` body text
    // duplicated the button label; dropped per §10.4.
    // The sessionsBody spec-string remains for other consumers but
    // the panel no longer renders it.
    expect(panelSrc).not.toMatch(/sessionsBody/);
  });

  it("V4 user-report-3 / Issue #14 (Sessions): destructive + sign-out + change-password share one pill cluster", () => {
    // Issue #14 — all three actions render as pills in a single
    // flex-wrap cluster (danger-tinted secondary + two ghost pills),
    // no mixed link/button weights and no pipe separator (§10.4).
    expect(panelSrc).toMatch(
      /Sign out other devices[\s\S]{0,800}signOutSelfCta[\s\S]{0,500}passwordChangeCta/
    );
  });

  it("V4 user-report §3: SESSIONS + POLICY h2s no longer doubled with their eyebrows", () => {
    // V4 user-report §3 / spec §11.8 word-doubling fixes:
    //   SESSIONS eyebrow + Active sessions h2 → SESSIONS + Devices
    //   POLICY   eyebrow + MFA policy h2     → POLICY   + MFA enforcement
    expect(SETTINGS_SECURITY_STRINGS.sections.sessions).toBe("Devices");
    expect(SETTINGS_SECURITY_STRINGS.sections.workspaceMfa).toBe(
      "MFA enforcement"
    );
    // Eyebrows unchanged.
    expect(SETTINGS_SECURITY_STRINGS.eyebrows.sessions).toBe("SESSIONS");
    expect(SETTINGS_SECURITY_STRINGS.eyebrows.policy).toBe("POLICY");
  });

  it("release-state §1685-1702 compliance: all 7 required-content items present", () => {
    // 1. MFA status — identity strip eyebrow "MFA" + MFA card empty state.
    expect(pageSrc).toMatch(/<dt[^>]*>MFA<\/dt>/);
    expect(panelSrc).toContain("mfaEmptyLabel");
    // 2. Team roles — TEAM ROLES row in Resources card.
    expect(SETTINGS_SECURITY_STRINGS.sections.teamRoles).toBe("Team roles");
    expect(pageSrc).toContain("sections.teamRoles");
    // 3. Active sessions — SESSIONS card.
    expect(panelSrc).toContain("sessionsCurrentLabel");
    // 4. Recent security activity — Activity strip.
    expect(pageSrc).toContain("activityEmptyLabel");
    // 5. Audit history link — Resources card row (restored per compliance audit).
    expect(pageSrc).toContain("View audit history");
    // 6. DPA/security contact link — LEGAL CONTACT row.
    expect(pageSrc).toContain("contactCta");
    expect(pageSrc).toMatch(/mailto:\$\{[^}]*contactEmail\}/);
    // 7. Required note — LEGAL footer, exact phrasing per §1700-1702.
    expect(SETTINGS_SECURITY_STRINGS.legalNote).toBe(
      "Oblixa helps organize contract information, but it does not provide legal advice."
    );
    expect(pageSrc).toContain("legalNote");
  });

  it("V4 user-report-3 (date helper): fmtRelative emits unambiguous units (min/hr/d)", () => {
    const fmtSrc = readFileSync(
      join(process.cwd(), "src/lib/format/date.ts"),
      "utf8"
    );
    // Old: "/\\s*minutes?\\b/, 'm'" → caps "39M" was ambiguous.
    // New: " min" so caps renders "39 MIN" — readable.
    expect(fmtSrc).toContain('" min"');
    expect(fmtSrc).toContain('" hr"');
    expect(fmtSrc).toContain('" d"');
  });
});
