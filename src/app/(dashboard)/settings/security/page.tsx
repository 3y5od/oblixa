import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Inbox,
  Mail,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { getAuthContext, createClient, createAdminClient } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state";
import { UiAlert } from "@/components/ui/ui-alert";
import { StatusBadge } from "@/components/ui/status-badge";
import { ChipCapsule } from "@/components/ui/chip-capsule";
import { ChipPair } from "@/components/ui/chip-pair";
import { SecuritySettingsPanel } from "@/components/settings/security-settings-panel";
import { SETTINGS_SECURITY_STRINGS } from "@/lib/settings/spec-strings";
import { readStepUpExpiry } from "@/lib/security/step-up-cookie";
import { listMySessions } from "@/actions/sessions";
import { formatDate, timeAttrs } from "@/lib/format/date";

// SPEC: docs/security-page-v2-pass.md — v2 pass implementation on top
// of the maximal-pass scaffold. `reactCache` wraps `getAuthContext`
// so we can call it + read step-up + list sessions + fetch org meta
// independently without N+1 cost.

// SPEC: V2 §1.41 — security data must never be cached. force-dynamic
// guarantees a fresh server render on every request.
export const dynamic = "force-dynamic";

// SPEC: V2 §1.39 + §1.40 — explicit metadata for SR + crawlers.
export const metadata = {
  title: SETTINGS_SECURITY_STRINGS.title,
  description: SETTINGS_SECURITY_STRINGS.lead,
  robots: { index: false, follow: false },
};

/**
 * Humanize sign-in provider names. Supabase returns
 * `email`, `google`, `github`, etc. We render Title Case.
 */
function humanizeProvider(p: string): string {
  if (p === "email") return "Email";
  if (p === "google") return "Google";
  if (p === "github") return "GitHub";
  if (p === "apple") return "Apple";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export default async function SecuritySettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const sp = (await searchParams) ?? {};
  const mfaParam = typeof sp.mfa === "string" ? sp.mfa : null;
  // V2 §1.15 — surface filter acknowledgment when present.
  const filterParam = typeof sp.filter === "string" ? sp.filter : null;

  // SPEC: §1.39 banner state machine — required / enrolled / expired.
  let mfaBanner: { tone: "warning" | "success"; copy: string } | null = null;
  if (mfaParam === "required") {
    mfaBanner = {
      tone: "warning",
      copy: SETTINGS_SECURITY_STRINGS.mfaBannerRequired,
    };
  } else if (mfaParam === "enrolled") {
    mfaBanner = {
      tone: "success",
      copy: SETTINGS_SECURITY_STRINGS.mfaBannerEnrolled,
    };
  } else if (mfaParam === "expired") {
    mfaBanner = {
      tone: "warning",
      copy: SETTINGS_SECURITY_STRINGS.mfaBannerExpired,
    };
  }

  const supabase = await createClient();

  let totpFactors: Array<{ id: string; status: string; friendly_name: string | null }> = [];
  let currentAal: string | null = null;
  let nextAal: string | null = null;
  try {
    const [{ data: factorsData }, { data: aalData }] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    totpFactors =
      factorsData?.totp?.map((f) => ({
        id: f.id,
        status: f.status,
        friendly_name: f.friendly_name ?? null,
      })) ?? [];
    currentAal = aalData?.currentLevel ?? null;
    nextAal = aalData?.nextLevel ?? null;
  } catch {
    // MFA metadata calls can fail when the auth provider returns transient errors; render a degraded panel.
  }

  // V2 §1.12 + §1.37 step-up state. hasSensitiveActionProof's AAL2
  // path is captured via the currentAal check below.
  const jar = await cookies();
  const stepUpFromCookie = readStepUpExpiry(jar, ctx.user.id);
  const stepUp: { active: boolean; via: "password" | "aal2" | null; expiresAt: number | null } =
    stepUpFromCookie.active
      ? { active: true, via: "password", expiresAt: stepUpFromCookie.expiresAt }
      : currentAal === "aal2"
        ? { active: true, via: "aal2", expiresAt: null }
        : { active: false, via: null, expiresAt: null };

  // V2 §1.35 listMySessions metadata.
  let sessions: Awaited<ReturnType<typeof listMySessions>> = { sessions: [] };
  try {
    sessions = await listMySessions();
  } catch {
    sessions = { sessions: [] };
  }
  const sessionRows = "sessions" in sessions ? sessions.sessions : [];

  // V2 §1.22 fetch workspace name. The admin client is required because
  // ctx.admin doesn't necessarily expose the same query surface here.
  let orgName: string | null = null;
  try {
    const admin = await createAdminClient();
    const { data: orgRow } = await admin
      .from("organizations")
      .select("name")
      .eq("id", ctx.orgId)
      .maybeSingle();
    orgName = (orgRow as { name?: string } | null)?.name ?? null;
  } catch {
    orgName = null;
  }

  // V2 §1.37 — sign-in providers from user.identities.
  const userIdentities = (ctx.user.identities ?? []) as Array<{ provider?: string | null }>;
  const providers = Array.from(
    new Set(
      userIdentities
        .map((i) => (typeof i?.provider === "string" ? i.provider : null))
        .filter((p): p is string => Boolean(p))
    )
  );
  const signInMethodLabel =
    providers.length > 0
      ? providers.map(humanizeProvider).join(" · ")
      : "Email";

  // V2 §1.36 — email verification status.
  const emailConfirmedAt = (ctx.user.email_confirmed_at ?? null) as string | null;
  const emailVerified = !!emailConfirmedAt;

  // V2 §1.48 / V3 §1.1 — account creation date via canonical helper.
  const userCreatedAt = (ctx.user.created_at ?? null) as string | null;
  const memberSince = userCreatedAt ? formatDate(userCreatedAt, "date") : null;

  // V4 §1.1 — last sign-in timestamp from Supabase.
  const lastSignInIso = (ctx.user.last_sign_in_at ?? null) as string | null;

  const isAdmin = ctx.role === "admin";
  const factorCount = totpFactors.length;
  const accountEmail = ctx.user.email ?? "";
  // Show the full email so the user can verify the exact account; the
  // identity strip truncates with a title tooltip rather than masking,
  // which made long addresses ("alt…@gmail.com") impossible to confirm.
  // Falls back to the first sign-in provider when no email is present.
  const accountIdentity = accountEmail
    ? accountEmail
    : providers[0]
      ? humanizeProvider(providers[0]).toUpperCase()
      : "—";

  // V2 §12.2 at-risk banner.
  const showAtRiskBanner =
    isAdmin && factorCount === 0 && ctx.mfaRequired === true;

  // V2 §1.54 dev environment marker.
  const isProdLike = process.env.NODE_ENV === "production";
  const showDevBanner =
    !isProdLike && !process.env.OBLIXA_STEP_UP_SECRET;

  return (
    <div className="ui-page-stack mx-auto max-w-4xl gap-5">
      {/* The panel (mfa-card) is always the first interactive surface,
          so the skip link targets it directly. */}
      <Link
        href="#mfa-card"
        className="ui-skip-link sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-[var(--surface-raised)] focus:px-3 focus:py-2 focus:text-[var(--text-primary)]"
      >
        Skip to security content
      </Link>

      <Link
        href="/settings"
        className="ui-btn-ghost inline-flex max-w-max items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] billing-no-print"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        {SETTINGS_SECURITY_STRINGS.backLabel}
      </Link>

      <div className="flex flex-col gap-4">
        <DashboardPageHeader
          icon={
            <ShieldCheck
              className="h-[1.125rem] w-[1.125rem]"
              strokeWidth={1.85}
            />
          }
          eyebrow={SETTINGS_SECURITY_STRINGS.eyebrow}
          title={SETTINGS_SECURITY_STRINGS.title}
          lead={SETTINGS_SECURITY_STRINGS.lead}
          // Identity-only header — no actions slot. Account context
          // (MFA, role, workspace, email) renders in the flat identity
          // strip below rather than being crammed into the header.
        />

        {/* Issue #2 — identity strip flattened from a boxed panel to an
            inline dl on a hairline so it reads as page metadata (§5.1),
            not a second card competing with the panel below. items-center
            keeps the MFA StatusBadge aligned with the text values without
            grid baseline gymnastics. */}
        <dl
          aria-label="Identity"
          className="billing-no-print flex flex-wrap items-center gap-x-6 gap-y-2.5 border-t border-[var(--border-subtle)] pt-3.5"
        >
          {/* Issue #3 — MFA posture carries a StatusBadge + glyph so the
              state is legible without relying on color alone (§7.7). */}
          <div className="inline-flex items-center gap-2">
            <dt className="ui-caps-3 text-[var(--text-tertiary)]">MFA</dt>
            <dd>
              {factorCount > 0 ? (
                <StatusBadge status="healthy" className="gap-1">
                  <ShieldCheck className="h-3 w-3" strokeWidth={2} aria-hidden />
                  {SETTINGS_SECURITY_STRINGS.mfaTwoFactorLabel}
                </StatusBadge>
              ) : (
                <StatusBadge status="warning" className="gap-1">
                  <TriangleAlert className="h-3 w-3" strokeWidth={2} aria-hidden />
                  {SETTINGS_SECURITY_STRINGS.mfaSingleLabel}
                </StatusBadge>
              )}
            </dd>
          </div>
          <div className="inline-flex items-center gap-2">
            <dt className="ui-caps-3 text-[var(--text-tertiary)]">Role</dt>
            <dd className="text-[13px] font-medium text-[var(--text-primary)]">
              {ctx.role.charAt(0).toUpperCase() + ctx.role.slice(1)}
            </dd>
          </div>
          {orgName ? (
            <div className="inline-flex min-w-0 items-center gap-2">
              <dt className="ui-caps-3 text-[var(--text-tertiary)]">
                {SETTINGS_SECURITY_STRINGS.workspaceLabelChip}
              </dt>
              <dd className="min-w-0">
                <Link
                  href="/settings/workspace"
                  className="ui-link block max-w-[12rem] truncate text-[13px] font-medium"
                  title={orgName}
                  aria-label={orgName}
                >
                  {orgName}
                </Link>
              </dd>
            </div>
          ) : null}
          {/* Issue #4 — full email (mono) with truncate + title so long
              addresses stay verifiable on hover/focus instead of being
              masked into ambiguity. The visible email text supplies the
              link's accessible name, so no separate aria-label. */}
          <div className="inline-flex min-w-0 items-center gap-2">
            <dt className="ui-caps-3 text-[var(--text-tertiary)]">
              {SETTINGS_SECURITY_STRINGS.accountLabel}
            </dt>
            <dd className="min-w-0">
              <Link
                href="/settings/account"
                className="ui-link block max-w-[16rem] truncate font-mono text-[12.5px]"
                title={accountIdentity}
              >
                {accountIdentity}
              </Link>
            </dd>
          </div>
        </dl>

        {mfaBanner ? (
          <UiAlert tone={mfaBanner.tone}>{mfaBanner.copy}</UiAlert>
        ) : null}

        {/* V2 §1.15 — acknowledge ?filter param when present. */}
        {filterParam ? (
          <UiAlert tone="neutral">
            Showing {filterParam}-related audit events.
          </UiAlert>
        ) : null}

        {/* Issue #5 — the dev banner flags that step-up cookie
            validation is mocked, which is security-relevant. Warning
            tone (amber + TriangleAlert) makes it visibly distinct from
            neutral informational notices rather than blending in. */}
        {showDevBanner ? (
          <UiAlert tone="warning">
            {SETTINGS_SECURITY_STRINGS.devModeCopy}
          </UiAlert>
        ) : null}

        {showAtRiskBanner ? (
          <div>
            <ChipCapsule
              leftValue="POLICY"
              leftLabel="UNCOVERED"
              rightVerb="ENABLE POLICY"
              href="#org-mfa-card"
              tone="warning"
            />
          </div>
        ) : null}
      </div>

      {/* Issue #25 — fixed order for consistent rhythm: the interactive
          security panel always leads (the primary task surface), then the
          read-only account context, then activity, then the legal note.
          The previous factorsEmpty reorder produced two different layouts
          depending on state, which read as uneven hierarchy. */}
      <SecuritySettingsPanel
        orgId={ctx.orgId}
        role={ctx.role}
        orgMfaRequired={ctx.mfaRequired}
        totpFactors={totpFactors}
        currentAal={currentAal}
        nextAal={nextAal}
        stepUp={stepUp}
        sessions={sessionRows}
      />

      <AccountContext
        ctxRole={ctx.role}
        providerLabel={signInMethodLabel}
        emailVerified={emailVerified}
        emailConfirmedAt={emailConfirmedAt}
        memberSince={memberSince}
        memberSinceIso={userCreatedAt}
        lastSignInIso={lastSignInIso}
      />

      <ActivityStrip />

      <LegalNote />
    </div>
  );
}

// Account & workspace context. Issue #6/#17/#18 — flattened from a
// ui-card-raised panel with a decorative corner ring into a plain
// grouped list so it stops competing with the interactive panel above.
function AccountContext({
  ctxRole,
  providerLabel,
  emailVerified,
  emailConfirmedAt,
  memberSince,
  memberSinceIso,
  lastSignInIso,
}: {
  ctxRole: string;
  providerLabel: string;
  emailVerified: boolean;
  emailConfirmedAt: string | null;
  memberSince: string | null;
  memberSinceIso: string | null;
  lastSignInIso: string | null;
}) {
  const verifiedLabel = emailConfirmedAt ? formatDate(emailConfirmedAt, "date") : null;
  // When the only provider is "email", the EMAIL STATUS row already
  // conveys sign-in, so the SIGN-IN METHOD row is dropped (§10.4).
  const onlyEmailProvider = providerLabel.trim().toLowerCase() === "email";
  // Issue #19 — labels sit at ui-caps-3 (not the oversized ui-caps-2)
  // so they no longer overpower the values; rows are justify-between
  // grouped-list lines instead of a 2-col grid with heavy labels.
  const rowClass =
    "flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5";
  const labelClass = "ui-caps-3 text-[var(--text-tertiary)]";
  return (
    <section aria-labelledby="security-context-title">
      <p className="ui-caps-2 text-[var(--accent-strong)]">
        {SETTINGS_SECURITY_STRINGS.eyebrows.resources}
      </p>
      {/* Issue #18 — heading shrunk from the 1.4rem card title to a
          15px label so the section reads as supporting context, not a
          focal surface. */}
      <h2
        id="security-context-title"
        className="mt-0.5 text-[15px] font-semibold tracking-tight text-[var(--text-primary)]"
      >
        {SETTINGS_SECURITY_STRINGS.sections.resources}
      </h2>
      <dl className="mt-3 divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
        {/* Team roles (release-state §1685-1702 required content). */}
        <div className={rowClass}>
          <dt className={labelClass}>
            {SETTINGS_SECURITY_STRINGS.sections.teamRoles}
          </dt>
          <dd className="inline-flex items-center gap-1.5 text-[13px]">
            <ChipPair primary={ctxRole.toUpperCase()} secondary="VIEW ONLY" />
          </dd>
        </div>

        {!onlyEmailProvider ? (
          <div className={rowClass}>
            <dt className={labelClass}>
              {SETTINGS_SECURITY_STRINGS.resources.signInMethod}
            </dt>
            <dd className="inline-flex flex-wrap items-center justify-end gap-1.5 text-[13px]">
              {providerLabel.split(" · ").map((p) => (
                <span
                  key={p}
                  className="ui-caps-3 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-0.5 text-[var(--text-secondary)]"
                >
                  {p.toUpperCase()}
                </span>
              ))}
            </dd>
          </div>
        ) : null}

        {/* Issue #21 — email status keeps the StatusBadge but adds a
            glyph (Check / TriangleAlert) so it isn't a color-only chip. */}
        <div className={rowClass}>
          <dt className={labelClass}>
            {SETTINGS_SECURITY_STRINGS.resources.emailStatus}
          </dt>
          <dd className="inline-flex flex-wrap items-center justify-end gap-2 text-[13px]">
            {emailVerified ? (
              <StatusBadge status="healthy" className="gap-1">
                <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                {SETTINGS_SECURITY_STRINGS.emailVerifiedLabel}
              </StatusBadge>
            ) : (
              <StatusBadge status="warning" className="gap-1">
                <TriangleAlert className="h-3 w-3" strokeWidth={2} aria-hidden />
                {SETTINGS_SECURITY_STRINGS.emailUnverifiedLabel}
              </StatusBadge>
            )}
            {verifiedLabel ? (
              <time
                className="tabular-nums text-[12px] text-[var(--text-tertiary)]"
                {...timeAttrs(emailConfirmedAt)}
              >
                {verifiedLabel}
              </time>
            ) : null}
            {!emailVerified ? (
              <Link
                href="/auth/resend-verification"
                className="ui-link text-[12.5px]"
              >
                {SETTINGS_SECURITY_STRINGS.resendVerificationCta}
              </Link>
            ) : null}
          </dd>
        </div>

        {/* Issue #20 — dates use tabular-nums for aligned, scannable
            figures instead of plain proportional text. */}
        {memberSince ? (
          <div className={rowClass}>
            <dt className={labelClass}>
              {SETTINGS_SECURITY_STRINGS.resources.memberSince}
            </dt>
            <dd className="text-[13px] text-[var(--text-primary)]">
              <time className="tabular-nums" {...timeAttrs(memberSinceIso)}>
                {memberSince}
              </time>
            </dd>
          </div>
        ) : null}

        {lastSignInIso ? (
          <div className={rowClass}>
            <dt className={labelClass}>
              {SETTINGS_SECURITY_STRINGS.lastSignInLabel}
            </dt>
            <dd className="text-[13px] text-[var(--text-primary)]">
              <time className="tabular-nums" {...timeAttrs(lastSignInIso)}>
                {formatDate(lastSignInIso, "dateTime")}
              </time>
            </dd>
          </div>
        ) : null}

        {/* Audit history link (release-state §1685-1702 required). */}
        <div className={rowClass}>
          <dt className={labelClass}>
            {SETTINGS_SECURITY_STRINGS.resources.auditHistory}
          </dt>
          <dd className="text-[13px]">
            <Link
              href="/settings/security?filter=billing"
              className="ui-link inline-flex items-center gap-1"
            >
              View audit history
              <ChevronRight className="h-3 w-3" strokeWidth={2} aria-hidden />
            </Link>
          </dd>
        </div>

        {/* Legal/security contact (release-state §1685-1702 required). */}
        <div className={rowClass}>
          <dt className={labelClass}>
            {SETTINGS_SECURITY_STRINGS.resources.dpaContact}
          </dt>
          <dd className="text-[13px]">
            <Link
              href={`mailto:${SETTINGS_SECURITY_STRINGS.contactEmail}`}
              className="ui-link inline-flex items-center gap-1.5"
            >
              <Mail className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              {SETTINGS_SECURITY_STRINGS.contactCta}
              <ChevronRight className="h-3 w-3" strokeWidth={2} aria-hidden />
            </Link>
          </dd>
        </div>
      </dl>
    </section>
  );
}

// Issue #23/#24 — the activity section was a single plain line behind a
// raw pipe ("ACTIVITY | 0 events..."). It now renders as a heading plus a
// compact DashboardEmptyState (icon + caps label), and the pipe is gone.
function ActivityStrip() {
  return (
    <section aria-labelledby="security-activity-title">
      {/* Retention copy lives in the title attribute (hover-reveal) so it
          doesn't add a second visible line to the empty state. */}
      <h2
        id="security-activity-title"
        title="Events retained for 90 days"
        className="ui-caps-2 text-[var(--accent-strong)]"
      >
        {SETTINGS_SECURITY_STRINGS.activityEyebrow}
      </h2>
      <div className="mt-3">
        <DashboardEmptyState
          icon={Inbox}
          label={SETTINGS_SECURITY_STRINGS.activityEmptyLabel}
          compact
        />
      </div>
    </section>
  );
}

// Issue #22 — the legal note was buried as a footer inside the resources
// card, reading like an afterthought. It now stands as its own flat
// section on a hairline so the required disclaimer is unmistakably present.
function LegalNote() {
  return (
    <section
      aria-label="Legal"
      className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3"
    >
      <p className="ui-caps-3 text-[var(--accent-strong)]">
        {SETTINGS_SECURITY_STRINGS.eyebrows.legal}
      </p>
      <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
        {SETTINGS_SECURITY_STRINGS.legalNote}
      </p>
    </section>
  );
}
