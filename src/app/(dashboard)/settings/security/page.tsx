import Link from "next/link";
import { cookies } from "next/headers";
import {
  Check,
  Inbox,
  Mail,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { getAuthContext, createClient, createAdminClient } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state";
import { UiAlert } from "@/components/ui/ui-alert";
import { StatusBadge } from "@/components/ui/status-badge";
import { ChipCapsule } from "@/components/ui/chip-capsule";
import { ChipPair } from "@/components/ui/chip-pair";
import { ActionChip } from "@/components/ui/action-chip";
import {
  SettingsSubpageShell,
  IdentityChip,
} from "@/components/settings/settings-subpage-shell";
import { SecuritySettingsPanel } from "@/components/settings/security-settings-panel";
import { SETTINGS_SECURITY_STRINGS } from "@/lib/settings/spec-strings";
import { readStepUpExpiry } from "@/lib/security/step-up-cookie";
import { listMySessions } from "@/actions/sessions";
import { formatDate, timeAttrs } from "@/lib/format/date";
import { hasEmailConfirmationSignal } from "@/lib/auth/email-confirmation";

// Security data must never be cached — fresh server render on every request.
export const dynamic = "force-dynamic";

export const metadata = {
  title: SETTINGS_SECURITY_STRINGS.title,
  description: SETTINGS_SECURITY_STRINGS.lead,
  robots: { index: false, follow: false },
};

/** Humanize sign-in provider names (`google` → `Google`). */
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
  const filterParam = typeof sp.filter === "string" ? sp.filter : null;

  // Banner state machine — required / enrolled / expired.
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
    // MFA metadata calls can fail on transient provider errors; render a degraded panel.
  }

  const jar = await cookies();
  const stepUpFromCookie = readStepUpExpiry(jar, ctx.user.id);
  const stepUp: { active: boolean; via: "password" | "aal2" | null; expiresAt: number | null } =
    stepUpFromCookie.active
      ? { active: true, via: "password", expiresAt: stepUpFromCookie.expiresAt }
      : currentAal === "aal2"
        ? { active: true, via: "aal2", expiresAt: null }
        : { active: false, via: null, expiresAt: null };

  let sessions: Awaited<ReturnType<typeof listMySessions>> = { sessions: [] };
  try {
    sessions = await listMySessions();
  } catch {
    sessions = { sessions: [] };
  }
  const sessionRows = "sessions" in sessions ? sessions.sessions : [];

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

  const emailConfirmedAt = ((ctx.user.email_confirmed_at ?? ctx.user.confirmed_at) ?? null) as string | null;
  const emailVerified = hasEmailConfirmationSignal(ctx.user);

  const userCreatedAt = (ctx.user.created_at ?? null) as string | null;
  const memberSince = userCreatedAt ? formatDate(userCreatedAt, "date") : null;

  const lastSignInIso = (ctx.user.last_sign_in_at ?? null) as string | null;

  const isAdmin = ctx.role === "admin";
  const factorCount = totpFactors.length;
  const accountEmail = ctx.user.email ?? "";
  // Show the full email (truncated via CSS with a hover/focus title) so the
  // exact account stays verifiable; fall back to the first provider.
  const accountIdentity = accountEmail
    ? accountEmail
    : providers[0]
      ? humanizeProvider(providers[0]).toUpperCase()
      : "—";

  const showAtRiskBanner =
    isAdmin && factorCount === 0 && ctx.mfaRequired === true;

  // Gated to local development only so the "step-up cookie validation is
  // mocked" notice can never surface in preview, test, or staging.
  const isDevEnv = process.env.NODE_ENV === "development";
  const showDevBanner = isDevEnv && !process.env.OBLIXA_STEP_UP_SECRET;

  return (
    <SettingsSubpageShell
      icon={<ShieldCheck className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
      eyebrow={SETTINGS_SECURITY_STRINGS.eyebrow}
      title={SETTINGS_SECURITY_STRINGS.title}
      lead={SETTINGS_SECURITY_STRINGS.lead}
      skipLink={{ href: "#mfa-card", label: "Skip to security content" }}
      identityLabel="Identity"
      identity={
        <>
          <IdentityChip label="MFA">
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
          </IdentityChip>
          {orgName ? (
            <IdentityChip label={SETTINGS_SECURITY_STRINGS.workspaceLabelChip}>
              <Link
                href="/settings/workspace"
                className="ui-link block max-w-[12rem] truncate text-[13px] font-medium"
                title={orgName}
                aria-label={orgName}
              >
                {orgName}
              </Link>
            </IdentityChip>
          ) : null}
          <IdentityChip label={SETTINGS_SECURITY_STRINGS.accountLabel}>
            <Link
              href="/settings/account"
              className="ui-link block max-w-[16rem] truncate font-mono text-[12.5px]"
              title={accountIdentity}
            >
              {accountIdentity}
            </Link>
          </IdentityChip>
        </>
      }
    >
      {mfaBanner ? (
        <UiAlert tone={mfaBanner.tone}>{mfaBanner.copy}</UiAlert>
      ) : null}

      {filterParam ? (
        <UiAlert tone="neutral">
          Showing {filterParam}-related audit events.
        </UiAlert>
      ) : null}

      {/* Local-dev marker reads as a compact pill, not a full-width alert. */}
      {showDevBanner ? (
        <span
          className="billing-no-print inline-flex max-w-max items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] leading-none"
          style={{
            borderColor: "color-mix(in oklab, var(--warning-soft) 55%, var(--border-subtle))",
            background: "color-mix(in oklab, var(--warning-soft) 18%, var(--surface-raised))",
            color: "var(--warning-ink)",
          }}
        >
          <TriangleAlert className="h-3 w-3" strokeWidth={2} aria-hidden />
          {SETTINGS_SECURITY_STRINGS.devModeCopy}
        </span>
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
    </SettingsSubpageShell>
  );
}

// Account & workspace context — a flat grouped-list directory so it reads as
// supporting context, not a second focal surface.
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
  // When the only provider is "email", the EMAIL STATUS row already conveys
  // sign-in, so the SIGN-IN METHOD row is dropped.
  const onlyEmailProvider = providerLabel.trim().toLowerCase() === "email";
  const rowClass =
    "flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5";
  const labelClass = "ui-caps-3 text-[var(--text-tertiary)]";
  return (
    <section aria-labelledby="security-context-title">
      <p className="ui-caps-2 text-[var(--accent-strong)]">
        {SETTINGS_SECURITY_STRINGS.eyebrows.resources}
      </p>
      <h2
        id="security-context-title"
        className="mt-0.5 text-[15px] font-semibold tracking-tight text-[var(--text-primary)]"
      >
        {SETTINGS_SECURITY_STRINGS.sections.resources}
      </h2>
      <dl className="mt-3 divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
        <div className={rowClass}>
          <dt className={labelClass}>
            {SETTINGS_SECURITY_STRINGS.sections.teamRoles}
          </dt>
          <dd className="inline-flex flex-wrap items-center justify-end gap-2 text-[13px]">
            <ChipPair primary={ctxRole.toUpperCase()} secondary="VIEW ONLY" />
            <ActionChip verb="Manage" href="/settings#team-access" />
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

        <div className={rowClass}>
          <dt className={labelClass}>
            {SETTINGS_SECURITY_STRINGS.resources.auditHistory}
          </dt>
          <dd className="inline-flex justify-end text-[13px]">
            <ActionChip verb="View audit history" href="/settings/security?filter=billing" />
          </dd>
        </div>

        <div className={rowClass}>
          <dt className={labelClass}>
            {SETTINGS_SECURITY_STRINGS.resources.dpaContact}
          </dt>
          <dd className="inline-flex justify-end text-[13px]">
            <ActionChip
              verb={SETTINGS_SECURITY_STRINGS.contactCta}
              href={`mailto:${SETTINGS_SECURITY_STRINGS.contactEmail}`}
              icon={Mail}
            />
          </dd>
        </div>
      </dl>
    </section>
  );
}

// Recent security activity — a compact empty state in a reserved-height area.
function ActivityStrip() {
  return (
    <section aria-labelledby="security-activity-title">
      <h2
        id="security-activity-title"
        title="Events retained for 90 days"
        className="ui-caps-2 text-[var(--accent-strong)]"
      >
        {SETTINGS_SECURITY_STRINGS.activityEyebrow}
      </h2>
      <div className="mt-3 flex min-h-[4rem] items-center">
        <DashboardEmptyState
          icon={Inbox}
          label={SETTINGS_SECURITY_STRINGS.activityEmptyLabel}
          compact
        />
      </div>
    </section>
  );
}

// Required legal disclaimer — a quiet footer row on a hairline, not a focal heading.
function LegalNote() {
  return (
    <section
      aria-label="Legal"
      className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3"
    >
      <p className="ui-caps-3 text-[var(--text-tertiary)]">
        {SETTINGS_SECURITY_STRINGS.eyebrows.legal}
      </p>
      <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
        {SETTINGS_SECURITY_STRINGS.legalNote}
      </p>
    </section>
  );
}
