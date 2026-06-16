import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SETTINGS_SECURITY_STRINGS } from "@/lib/settings/spec-strings";

// Surface pins for the security settings page. These assert against the raw
// source of the page + panel + shared workbench so the design contract
// (structure, copy, primitives, required content) can't drift silently.

const PAGE = join(process.cwd(), "src/app/(dashboard)/settings/security/page.tsx");
const SECTIONS = join(process.cwd(), "src/app/(dashboard)/settings/security/security-page-sections.tsx");
const PANEL_FILES = [
  "src/components/settings/security-settings-panel.tsx",
  "src/components/settings/security-settings-panel-controller.ts",
  "src/components/settings/security-settings-panel-types.ts",
  "src/components/settings/security-settings-panel-constants.ts",
  "src/components/settings/security-settings-account-protection-card.tsx",
  "src/components/settings/security-settings-mfa-column.tsx",
  "src/components/settings/security-settings-step-up-column.tsx",
  "src/components/settings/security-settings-sessions-section.tsx",
  "src/components/settings/security-settings-workspace-mfa-section.tsx",
  "src/components/settings/security-settings-dialogs.tsx",
];
const WORKBENCH = join(process.cwd(), "src/components/settings/settings-workbench.tsx");
const RAIL = join(process.cwd(), "src/components/settings/settings-rail.tsx");
const CARD = join(process.cwd(), "src/components/settings/settings-card.tsx");
const MEDALLION = join(process.cwd(), "src/components/ui/card-medallion.tsx");
const LOADING = join(process.cwd(), "src/app/(dashboard)/settings/security/loading.tsx");
const ERROR_BOUNDARY = join(process.cwd(), "src/app/(dashboard)/settings/security/error.tsx");
const STEP_UP_COOKIE = join(process.cwd(), "src/lib/security/step-up-cookie.ts");
const MFA_ACTIONS = join(process.cwd(), "src/actions/mfa.ts");

const pageSrc = [readFileSync(PAGE, "utf8"), readFileSync(SECTIONS, "utf8")].join("\n");
const panelSrc = PANEL_FILES.map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");
const workbenchSrc = readFileSync(WORKBENCH, "utf8");
const railSrc = readFileSync(RAIL, "utf8");
const cardSrc = readFileSync(CARD, "utf8");
const medallionSrc = readFileSync(MEDALLION, "utf8");
const loadingSrc = readFileSync(LOADING, "utf8");
const errorSrc = readFileSync(ERROR_BOUNDARY, "utf8");
const stepUpSrc = readFileSync(STEP_UP_COOKIE, "utf8");
const mfaActionsSrc = readFileSync(MFA_ACTIONS, "utf8");

describe("Security page — voice + release-state compliance", () => {
  it("legalNote matches release-state §1700-1702 exactly", () => {
    expect(SETTINGS_SECURITY_STRINGS.legalNote).toBe(
      "Oblixa helps organize contract information, but it does not provide legal advice."
    );
    expect(pageSrc).toContain("legalNote");
    // The note is framed as a deliberate boundary statement, not a heading.
    expect(SETTINGS_SECURITY_STRINGS.legalBoundaryLabel).toBe("Legal boundary");
    expect(pageSrc).toContain("legalBoundaryLabel");
  });

  it("no internal 'public Core' tier vocabulary leaks", () => {
    expect(pageSrc).not.toContain("public Core");
    expect(panelSrc).not.toContain("public Core");
  });

  it("no aal1/aal2 developer terms rendered as user copy", () => {
    expect(pageSrc).not.toMatch(/>\s*aal[12]\s*</);
    expect(panelSrc).not.toMatch(/>\s*aal[12]\s*</);
    expect(panelSrc).not.toContain('"aal1"');
  });

  it("voice-rule audit on SETTINGS_SECURITY_STRINGS values", () => {
    const forbidden = ["platform", "transformation", "governance", "autopilot", "intelligence"];
    const stringValues = JSON.stringify(SETTINGS_SECURITY_STRINGS).toLowerCase();
    for (const f of forbidden) expect(stringValues).not.toContain(f);
  });

  it("no V1/V2/V3/V4 or Issue # changelog comments remain in touched files", () => {
    for (const src of [pageSrc, panelSrc, workbenchSrc, railSrc]) {
      expect(src).not.toMatch(/\bV[1-4]\s*§/);
      expect(src).not.toMatch(/Issue #\d/);
    }
  });
});

describe("Security page — shared workbench + rail", () => {
  it("uses the shared SettingsWorkbench frame, not the old centered shell", () => {
    expect(pageSrc).toContain('from "@/components/settings/settings-workbench"');
    expect(pageSrc).toContain("<SettingsWorkbench");
    expect(pageSrc).toContain('active="security"');
    expect(pageSrc).not.toContain("SettingsSubpageShell");
  });

  it("workbench is a wider rail+main field, capped and centered", () => {
    expect(workbenchSrc).toContain("max-w-[1200px]");
    expect(workbenchSrc).toContain("<SettingsRail");
    expect(workbenchSrc).toMatch(/lg:grid-cols-\[/);
    // No floating icon tile beside the page title.
    expect(workbenchSrc).not.toContain("CardMedallion");
    expect(workbenchSrc).not.toContain("DashboardPageHeader");
  });

  it("rail marks the active section with a left rule, not a large card", () => {
    expect(railSrc).toContain("usePathname");
    expect(railSrc).toContain('aria-current');
    expect(railSrc).toContain("border-l-[var(--accent-strong)]");
    expect(railSrc).toContain("billing-no-print");
    // Customer-only destinations; operator surfaces never appear.
    expect(railSrc).toContain('"/settings/security"');
    expect(railSrc).toContain('"/settings/billing"');
    expect(railSrc).toContain("Notifications");
    expect(railSrc).toContain("Imports and exports");
    expect(railSrc).not.toContain("/settings/health");
    expect(railSrc).not.toContain("/settings/policy");
    expect(railSrc).not.toContain("/settings/product");
    // "Settings" overview link is the quiet back affordance.
    expect(railSrc).toContain('href="/settings"');
  });

  it("skip link targets the first focal record", () => {
    expect(pageSrc).toContain('"#account-protection-card"');
    expect(pageSrc).toContain("Skip to security content");
  });

  it("dynamic = force-dynamic + noindex metadata", () => {
    expect(pageSrc).toContain('export const dynamic = "force-dynamic"');
    expect(pageSrc).toMatch(/description:\s*SETTINGS_SECURITY_STRINGS\.lead/);
    expect(pageSrc).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it("fixed page order: panel → context → activity → legal", () => {
    expect(pageSrc).toMatch(
      /<SecuritySettingsPanel[\s\S]{0,3000}<AccountContext[\s\S]{0,2000}<ActivityStrip[\s\S]{0,2000}<LegalNote/
    );
  });

  it("no actions slot passed to the header", () => {
    expect(pageSrc).not.toMatch(/actions=\{/);
  });

  it("lead names the three records", () => {
    expect(SETTINGS_SECURITY_STRINGS.lead).toBe(
      "Manage account protection, active sessions, and security-sensitive workspace actions."
    );
  });
});

describe("Security page — header state strip", () => {
  it("replaces the identity pill row with a ledger-style state strip", () => {
    expect(pageSrc).toContain("<SettingsStateStrip");
    expect(pageSrc).not.toContain("IdentityChip");
    expect(pageSrc).not.toContain("<ChipPair");
    expect(workbenchSrc).toContain("SettingsStateStrip");
  });

  it("strip states protection / workspace / account / step-up with precise values", () => {
    expect(SETTINGS_SECURITY_STRINGS.stateLabels.protection).toBe("Account protection");
    expect(SETTINGS_SECURITY_STRINGS.stateLabels.stepUp).toBe("Step-up");
    expect(SETTINGS_SECURITY_STRINGS.stepUpRequiredValue).toBe(
      "Password required for sensitive actions"
    );
    expect(SETTINGS_SECURITY_STRINGS.protectionEnrolledValue).toBe("Two-factor enabled");
    expect(pageSrc).toContain("stepUpRequiredValue");
    expect(pageSrc).toContain("stateItems");
  });

  it("workspace + account values are real same-page anchors, no masking", () => {
    expect(pageSrc).toContain('href="/settings#workspace-identity"');
    expect(pageSrc).toContain('href="/settings#profile"');
    expect(pageSrc).toMatch(/truncate font-mono/);
    expect(pageSrc).not.toContain("···");
    expect(pageSrc).toContain("accountEmail");
    expect(pageSrc).toContain("ctx.user.email");
  });

  it("ctx.user.id access pattern (not ctx.userId)", () => {
    expect(pageSrc).not.toMatch(/ctx\.userId\b/);
    expect(pageSrc).toMatch(/ctx\.user\.id/);
  });
});

describe("Security page — focal Account protection card", () => {
  it("merges MFA + sensitive actions into one focal card with two columns", () => {
    expect(panelSrc).toContain('id="account-protection-card"');
    expect(panelSrc).toContain("ui-card-raised");
    expect(panelSrc).toContain("<SettingsCardHeader");
    expect(panelSrc).toContain('id="mfa-card"');
    expect(panelSrc).toContain('id="step-up-card"');
    // Exactly one two-column grid (the focal card body).
    expect(panelSrc.match(/lg:grid-cols-2/g)?.length).toBe(1);
  });

  it("column sub-headers are Authenticator + Sensitive actions", () => {
    expect(SETTINGS_SECURITY_STRINGS.sections.mfaColumn).toBe("Authenticator");
    expect(SETTINGS_SECURITY_STRINGS.sections.stepUpColumn).toBe("Sensitive actions");
    expect(SETTINGS_SECURITY_STRINGS.sections.protection).toBe("Account protection");
    expect(panelSrc).toContain("sections.mfaColumn");
    expect(panelSrc).toContain("sections.stepUpColumn");
  });

  it("normalized card header uses 32px medallion + caps eyebrow + 1.05rem title", () => {
    expect(cardSrc).toContain("CardMedallion");
    expect(cardSrc).toContain("ui-caps-2");
    expect(cardSrc).toContain("text-[1.05rem]");
    expect(medallionSrc).toMatch(/h-8 w-8/);
  });

  it("enrolled count surfaces via KeyValueChip when factors > 0", () => {
    expect(panelSrc).toContain("<KeyValueChip");
    expect(panelSrc).toContain('"ENROLLED"');
  });
});

describe("Security page — authenticator enrollment", () => {
  it("empty state is a sentence-case condition (not a caps stamp)", () => {
    expect(SETTINGS_SECURITY_STRINGS.mfaEmptyLabel).toBe("No authenticator enrolled");
    expect(panelSrc).toMatch(/StatusBadge[\s\S]{0,700}mfaEmptyLabel/);
    expect(panelSrc).toContain("showDangerEmptyState");
    expect(SETTINGS_SECURITY_STRINGS.mfaEmptyBodyRequired).toContain("workspace requires MFA");
    expect(panelSrc).toContain("warning-soft");
  });

  it("provider-unavailable state replaces the enroll control", () => {
    expect(SETTINGS_SECURITY_STRINGS.mfaUnavailableLabel).toBe(
      "Authenticator setup unavailable"
    );
    expect(panelSrc).toContain("mfaAvailable");
    expect(panelSrc).toContain("mfaUnavailableLabel");
    expect(panelSrc).toContain("mfaUnavailableBody");
    expect(pageSrc).toContain("mfaUnavailable");
    expect(pageSrc).toMatch(/mfaAvailable=\{!mfaUnavailable\}/);
  });

  it("Enroll authenticator is primary when empty", () => {
    expect(panelSrc).toMatch(/factorsEmpty\s*\?\s*"ui-btn-primary"/);
  });

  it("TOTP enrollment: QR alt + 6-digit input + noscript + idempotency", () => {
    expect(SETTINGS_SECURITY_STRINGS.qrAlt).toContain("Scan");
    expect(panelSrc).toContain("maxLength={6}");
    expect(panelSrc).toContain('pattern="\\d{6}"');
    expect(panelSrc).toContain("<noscript>");
    expect(panelSrc).toContain('action="/api/settings/step-up"');
    expect(panelSrc).toContain('method="POST"');
    expect(panelSrc).toMatch(/name="idempotency_key"/);
  });

  it("max-factors recovery hint + cancel-enrollment focus restoration", () => {
    expect(SETTINGS_SECURITY_STRINGS.enrollMaxFactorsHint).toContain("Remove an existing");
    expect(panelSrc).toMatch(/max\.\*factor/);
    expect(panelSrc).toContain("ADD_AUTH_BTN_ID");
    expect(panelSrc).toMatch(/getElementById\(\s*ADD_AUTH_BTN_ID/);
  });

  it("authenticator explainer disclosure beneath the empty state", () => {
    expect(SETTINGS_SECURITY_STRINGS.mfaExplainerSummary).toBe(
      "How authenticator sign-in protects this account"
    );
    expect(panelSrc).toContain("mfaExplainerSummary");
    expect(panelSrc).toContain("mfaExplainerBody");
  });

  it("?mfa=enrolled redirect after verify", () => {
    expect(panelSrc).toContain('"/settings/security?mfa=enrolled"');
  });
});

describe("Security page — sensitive actions column", () => {
  it("step-up CTA names the object ('Confirm account password')", () => {
    expect(SETTINGS_SECURITY_STRINGS.stepUpFormCta).toBe("Confirm account password");
    expect(panelSrc).not.toContain("Confirm step-up");
  });

  it("a visible 'why' line states which actions password confirmation guards", () => {
    expect(SETTINGS_SECURITY_STRINGS.sensitiveActionsWhy).toBe(
      "Confirm your password before changing security settings, billing settings, or workspace access."
    );
    expect(panelSrc).toContain("sensitiveActionsWhy");
  });

  it("step-up state reads server-side via readStepUpExpiry", () => {
    expect(pageSrc).toContain("readStepUpExpiry");
    expect(pageSrc).toMatch(/stepUp[:\s]/);
  });

  it("password field: empty placeholder + aria-describedby help", () => {
    expect(SETTINGS_SECURITY_STRINGS.passwordPlaceholder).toBe("");
    expect(panelSrc).toMatch(/aria-describedby=\{stepUpHelpId\}/);
    expect(SETTINGS_SECURITY_STRINGS.stepUpFormHelp.length).toBeLessThanOrEqual(80);
  });

  it("Change password + Forgot password live in this column under an account-recovery label", () => {
    expect(panelSrc).toContain("/settings/account?action=change-password");
    expect(panelSrc).toContain("forgotPasswordCta");
    expect(panelSrc).toContain('href="/auth/forgot-password"');
    expect(panelSrc).toContain("Account recovery");
    expect(SETTINGS_SECURITY_STRINGS.forgotPasswordCta).toBe("Forgot password?");
  });

  it("step-up badge labels + optimistic state", () => {
    expect(SETTINGS_SECURITY_STRINGS.stepUpEmptyLabel).toBe("REQUIRES PASSWORD");
    expect(SETTINGS_SECURITY_STRINGS.stepUpMfaSessionLabel).toBe("MFA SESSION");
    expect(panelSrc).toContain("optimisticStepUpActive");
  });
});

describe("Security page — sessions and devices", () => {
  it("sessions render as a flat row group titled 'Sessions and devices'", () => {
    expect(panelSrc).toContain('aria-labelledby="sessions-title"');
    expect(SETTINGS_SECURITY_STRINGS.sections.sessions).toBe("Sessions and devices");
  });

  it("a consequence line precedes the destructive sign-out controls", () => {
    // States the exact scope (no vague "selected sessions"); the destructive
    // control + this line only render when other sessions exist.
    expect(SETTINGS_SECURITY_STRINGS.sessionsConsequence).toMatch(/every other signed-in session/i);
    expect(SETTINGS_SECURITY_STRINGS.sessionsConsequence).not.toContain("selected sessions");
    expect(panelSrc).toContain("sessionsConsequence");
    expect(panelSrc).toContain("sessionsOnlyCurrentNote");
  });

  it("THIS DEVICE StatusBadge + sentence-case Expires (no pipe)", () => {
    expect(panelSrc).toMatch(/sessionsCurrentLabel[\s\S]{0,400}Expires \{fmtRelative/);
    expect(panelSrc).toContain("fmtRelative");
    expect(panelSrc).toMatch(/<time[\s\S]{0,300}timeAttrs/);
  });

  it("sign-out actions name their exact scope", () => {
    expect(SETTINGS_SECURITY_STRINGS.signOutOthersCta).toBe("Sign out all other devices");
    expect(SETTINGS_SECURITY_STRINGS.signOutSelfCta).toBe("Sign out of this device");
    expect(panelSrc).toMatch(/ui-btn-secondary[\s\S]{0,160}danger-ink/);
    expect(panelSrc).toContain("signOutOthersCta");
  });

  it("device count names its object type for multi-device states", () => {
    expect(panelSrc).toMatch(/sessions\.length > 1/);
    expect(panelSrc).toMatch(/\{sessions\.length\}\s*signed-in devices/);
    expect(panelSrc).not.toMatch(/\{sessions\.length\}\s*ACTIVE/);
  });
});

describe("Security page — workspace MFA enforcement", () => {
  it("policy is a secondary card with a state-specific badge", () => {
    expect(panelSrc).toContain('id="org-mfa-card"');
    expect(panelSrc).toContain("REQUIRED");
    expect(panelSrc).toContain("NOT ENABLED");
    expect(panelSrc).toContain("OPTIONAL");
    expect(panelSrc).not.toContain("SETUP REQUIRED");
    expect(panelSrc).not.toContain("AT RISK");
    expect(SETTINGS_SECURITY_STRINGS.sections.workspaceMfa).toBe("MFA enforcement");
  });

  it("UiToggle drives enforcement + self-lockout guard with a full reason", () => {
    expect(panelSrc).toContain('from "@/components/ui/ui-toggle"');
    expect(panelSrc).toContain("<UiToggle");
    expect(panelSrc).toContain("cannotEnableOrgMfa");
    expect(SETTINGS_SECURITY_STRINGS.orgMfaSelfLockoutHint).toContain("Enroll your own");
  });

  it("members-impact disclosure beneath the toggle", () => {
    expect(panelSrc).toContain("policyExplainerSummary");
    expect(panelSrc).toContain("policyExplainerBody");
    expect(SETTINGS_SECURITY_STRINGS.policyExplainerSummary).toBe(
      "How MFA enforcement affects workspace members"
    );
    expect(SETTINGS_SECURITY_STRINGS.orgMfaConsequence.length).toBeLessThanOrEqual(80);
  });
});

describe("Security page — workspace security context ledger", () => {
  it("renders a grouped divide-y ledger with ui-caps-3 labels", () => {
    expect(SETTINGS_SECURITY_STRINGS.sections.resources).toBe("Workspace security context");
    expect(pageSrc).toMatch(/divide-y divide-\[/);
    expect(pageSrc).toContain("ui-caps-3");
  });

  it("Team roles shows the role, a visibility note, and an explicit action", () => {
    expect(SETTINGS_SECURITY_STRINGS.sections.teamRoles).toBe("Team roles");
    expect(SETTINGS_SECURITY_STRINGS.manageTeamRolesCta).toBe("Manage team roles");
    expect(SETTINGS_SECURITY_STRINGS.teamRolesVisibilityNote).toBe(
      "Team roles are visible to admins."
    );
    expect(pageSrc).toContain("manageTeamRolesCta");
    expect(pageSrc).toContain("teamRolesVisibilityNote");
    expect(pageSrc).toContain("roleLabel");
    expect(pageSrc).not.toContain("VIEW ONLY");
  });

  it("email status, member since, last sign-in use tabular time", () => {
    expect(SETTINGS_SECURITY_STRINGS.emailVerifiedLabel).toBe("VERIFIED");
    expect(SETTINGS_SECURITY_STRINGS.resources.memberSince).toBe("Member since");
    expect(pageSrc).toContain("lastSignInLabel");
    expect(pageSrc).toContain("timeAttrs");
    expect(pageSrc).toContain("formatDate");
  });

  it("audit history + data-handling contact rows use explicit action labels", () => {
    expect(SETTINGS_SECURITY_STRINGS.auditHistoryCta).toBe("View security audit history");
    expect(SETTINGS_SECURITY_STRINGS.contactCta).toBe("Contact security support");
    expect(pageSrc).toContain("auditHistoryCta");
    expect(pageSrc).toContain('"/settings/security?filter=billing"');
    expect(pageSrc).toContain("contactCta");
    expect(pageSrc).toMatch(/mailto:\$\{[^}]*contactEmail\}/);
    expect(SETTINGS_SECURITY_STRINGS.contactEmail).toBe("security@oblixa.com");
  });

  it("sign-in method row drops when provider is only email", () => {
    expect(pageSrc).toContain("onlyEmailProvider");
    expect(pageSrc).toContain("humanizeProvider");
  });
});

describe("Security page — activity + legal", () => {
  it("activity is an empty record that explains absence and what appears", () => {
    expect(SETTINGS_SECURITY_STRINGS.activityEmptyLabel).toBe(
      "0 security events in the last 90 days"
    );
    expect(SETTINGS_SECURITY_STRINGS.activityEmptyBody).toBe(
      "Security-sensitive account and workspace changes will appear here."
    );
    expect(pageSrc).toContain("activityEmptyLabel");
    expect(pageSrc).toContain("activityEmptyBody");
    expect(pageSrc).toMatch(/title="Events retained for 90 days"/);
  });

  it("legal note renders as a final boundary row with the pinned text", () => {
    expect(pageSrc).toContain("legalBoundaryLabel");
    expect(pageSrc).toContain("legalNote");
  });
});

describe("Security page — primitives + accessibility", () => {
  it("StatusBadge primitive used (not inline ui-status-badge spans)", () => {
    expect(panelSrc).toContain('from "@/components/ui/status-badge"');
    expect(panelSrc).toContain("<StatusBadge");
  });

  it("UiConfirmDialog replaces window.confirm/ConfirmActionButton", () => {
    expect(panelSrc).toContain('from "@/components/ui/ui-confirm-dialog"');
    expect(panelSrc).toContain("<UiConfirmDialog");
    expect(panelSrc).not.toContain("<ConfirmActionButton");
  });

  it("caps-tier utility classes used, no landing eyebrow decoration", () => {
    expect(panelSrc).toMatch(/ui-caps-[123]/);
    expect(pageSrc).toMatch(/ui-caps-[123]/);
    expect(panelSrc).not.toContain("landing-eyebrow-dot");
    expect(pageSrc).not.toContain("landing-eyebrow-dot");
  });

  it("a11y: aria-live region, per-row aria-busy, noValidate forms, clipboard fallback", () => {
    expect(panelSrc).toMatch(/aria-live="polite"/);
    expect(panelSrc).toMatch(/aria-busy=\{pendingFactorId === f\.id\}/);
    expect(panelSrc).toMatch(/<form[\s\S]{0,200}noValidate/);
    expect(panelSrc).toContain("navigator.clipboard");
    expect(panelSrc).toContain("setCopyFallback");
  });

  it("offline UiAlert renders when !isOnline", () => {
    expect(panelSrc).toContain("isOnline");
    expect(panelSrc).toMatch(/!isOnline/);
    expect(SETTINGS_SECURITY_STRINGS.offlineCopy).toContain("offline");
  });

  it("dev environment marker is a titled inline note", () => {
    expect(pageSrc).toContain("showDevBanner");
    expect(SETTINGS_SECURITY_STRINGS.devStateTitle).toBe("Development security state");
    expect(pageSrc).toContain("devStateTitle");
    expect(SETTINGS_SECURITY_STRINGS.devModeCopy).toBe(
      "Development environment — step-up cookie validation is mocked."
    );
  });

  it("ephemeral controls carry billing-no-print", () => {
    expect(panelSrc).toContain("billing-no-print");
    expect(railSrc).toContain("billing-no-print");
  });
});

describe("Security page — boundary files + helpers", () => {
  it("loading.tsx uses skeleton/loading-panel + aria-busy", () => {
    expect(loadingSrc).toContain("ui-skeleton");
    expect(loadingSrc).toContain("ui-loading-panel");
    expect(loadingSrc).toContain('aria-busy="true"');
  });

  it("error.tsx is a recoverable client boundary classifying provider errors", () => {
    expect(errorSrc).toContain('"use client"');
    expect(errorSrc).toContain("reset()");
    expect(errorSrc).toContain("Try again");
    expect(errorSrc).toContain("supabase");
    expect(errorSrc).toContain("network");
  });

  it("step-up cookie helper shape", () => {
    expect(stepUpSrc).toContain("export function readStepUpExpiry");
    expect(stepUpSrc).toContain("expiresAt");
    expect(stepUpSrc).toContain("active");
  });

  it("MFA actions audit + discriminated union", () => {
    expect(mfaActionsSrc).toMatch(/startTotpEnrollment[\s\S]*?recordSecurityAuditEvent/);
    expect(mfaActionsSrc).toContain("security.mfa_totp_enrollment_started");
    expect(mfaActionsSrc).toContain("export type MfaActionResult");
    expect(mfaActionsSrc).toContain("export type MfaActionError");
  });

  it("date helper module exists with the formatters the page uses", () => {
    const fmtSrc = readFileSync(join(process.cwd(), "src/lib/format/date.ts"), "utf8");
    expect(fmtSrc).toContain("export function formatDate");
    expect(fmtSrc).toContain("export function timeAttrs");
    expect(fmtSrc).toContain("export function fmtRelative");
  });

  it("listMySessions wired to page + SessionRow exposes expiresAt", () => {
    expect(pageSrc).toContain("listMySessions");
    expect(panelSrc).toContain("expiresAt: string | null");
  });
});
