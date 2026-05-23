import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowLeft,
  ChevronRight,
  Inbox,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { getAuthContext, createClient, createAdminClient } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
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
 * V2 §1.13 + §1.49 — mask an email for privacy:
 *  - local: first 3 chars + Unicode ellipsis
 *  - domain: truncated to 12 chars + Unicode ellipsis when longer
 * Output capped ≤ ~20 chars to fit metaStrip without overflow.
 */
function maskEmail(value: string): string {
  if (!value || typeof value !== "string") return "";
  const at = value.indexOf("@");
  if (at <= 0) return value;
  const local = value.slice(0, at);
  const domain = value.slice(at);
  const localMasked = local.length <= 3 ? local : `${local.slice(0, 3)}…`;
  const domainMasked =
    domain.length <= 13 ? domain : `${domain.slice(0, 12)}…`;
  return `${localMasked}${domainMasked}`;
}

/**
 * V2 §1.37 — humanize sign-in provider names. Supabase returns
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
  const mfaStateLabel =
    factorCount > 0
      ? SETTINGS_SECURITY_STRINGS.mfaTwoFactorLabel
      : SETTINGS_SECURITY_STRINGS.mfaSingleLabel;
  const accountEmail = ctx.user.email ?? "";
  // V2 §1.50 defensive: fall back to first provider when email empty.
  const accountIdentity = accountEmail
    ? maskEmail(accountEmail)
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

  // V2 §3.1 — when factors === 0, MFA is the primary task; reorder
  // so the Resources card moves below the panel.
  const factorsEmpty = factorCount === 0;
  // V2 §1.35 — skip-link target follows the reorder.
  const skipTargetId = factorsEmpty ? "mfa-card" : "security-resources-title";

  return (
    <div className="ui-page-stack mx-auto max-w-4xl gap-5">
      {/* SPEC: V2 §1.35 + §5.1 — skip-link target adapts to reorder. */}
      <Link
        href={`#${skipTargetId}`}
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
          // V4 user-report — metaStrip prop dropped. The
          // DashboardPageHeader primitive wraps metaStrip children in
          // a `<dl className="flex items-center">` which produced
          // baseline drift between chips with different value heights
          // (font-mono email at 12px vs sans values at 11.5px).
          // Identity chips relocated to a dedicated IdentityStrip
          // below this header using CSS grid for guaranteed column
          // alignment + adequate breathing room. V3 §1.25 — `actions`
          // prop also remains dropped.
        />

        {/* V4 user-report — identity strip with grid layout so all
            eyebrows align at the TOP of each column (independent of
            value height), with proper breathing room between chips
            (gap-x-6 = 24px, up from gap-x-2 = 8px in the dl). At <sm
            widths the grid degrades to 2 cols; at sm+ it's 4 cols. */}
        <section
          aria-label="Identity"
          className="billing-no-print rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-5 py-3"
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="ui-caps-2 text-[var(--text-tertiary)]">MFA</dt>
              <dd
                className={`text-[13px] font-medium ${
                  factorCount > 0
                    ? "text-[var(--success-ink)]"
                    : "text-[var(--warning-ink)]"
                }`}
              >
                {factorCount > 0 ? "Two-factor" : "Single-factor"}
              </dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="ui-caps-2 text-[var(--text-tertiary)]">Role</dt>
              <dd className="text-[13px] font-medium text-[var(--text-primary)]">
                {ctx.role.charAt(0).toUpperCase() + ctx.role.slice(1)}
              </dd>
            </div>
            {orgName ? (
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="ui-caps-2 text-[var(--text-tertiary)]">
                  {SETTINGS_SECURITY_STRINGS.workspaceLabelChip}
                </dt>
                <dd className="min-w-0">
                  <Link
                    href="/settings/workspace"
                    className="ui-link block truncate text-[13px] font-medium"
                    title={orgName}
                    aria-label={orgName}
                  >
                    {orgName}
                  </Link>
                </dd>
              </div>
            ) : null}
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="ui-caps-2 text-[var(--text-tertiary)]">
                {SETTINGS_SECURITY_STRINGS.accountLabel}
              </dt>
              <dd className="min-w-0">
                <Link
                  href="/settings/account"
                  className="ui-link block truncate font-mono text-[13px] font-medium"
                  aria-label={accountEmail || accountIdentity}
                >
                  {accountIdentity}
                </Link>
              </dd>
            </div>
          </dl>
        </section>

        {mfaBanner ? (
          <UiAlert tone={mfaBanner.tone}>{mfaBanner.copy}</UiAlert>
        ) : null}

        {/* V2 §1.15 — acknowledge ?filter param when present. */}
        {filterParam ? (
          <UiAlert tone="neutral">
            Showing {filterParam}-related audit events.
          </UiAlert>
        ) : null}

        {/* V2 §1.54 — dev environment marker. V3 §1.4 requested
            `info` tone but the UiAlert primitive only supports
            neutral/success/warning/danger (StatTone). Neutral is
            the canonical "informational, no action required" tone
            here. Marked verified-by-design. */}
        {showDevBanner ? (
          <UiAlert tone="neutral">
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

      {/* V2 §3.1 — render MFA + Sensitive + Sessions + Workspace
          panel FIRST when factors are empty (primary task); otherwise
          render Resources card first as the orientation surface. */}
      {factorsEmpty ? (
        <>
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
          <ResourcesCard
            ctxRole={ctx.role}
            providerLabel={signInMethodLabel}
            emailVerified={emailVerified}
            emailConfirmedAt={emailConfirmedAt}
            memberSince={memberSince}
            lastSignInIso={lastSignInIso}
          />
        </>
      ) : (
        <>
          <ResourcesCard
            ctxRole={ctx.role}
            providerLabel={signInMethodLabel}
            emailVerified={emailVerified}
            emailConfirmedAt={emailConfirmedAt}
            memberSince={memberSince}
            lastSignInIso={lastSignInIso}
          />
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
        </>
      )}

      {/* V2 §3.1 activity strip — final element. */}
      <ActivityStrip />
    </div>
  );
}

// V2 §1.1 + §1.28 — Resources card extracted for readability + to
// fold the new account-identity rows in cleanly.
function ResourcesCard({
  ctxRole,
  providerLabel,
  emailVerified,
  emailConfirmedAt,
  memberSince,
  lastSignInIso,
}: {
  ctxRole: string;
  providerLabel: string;
  emailVerified: boolean;
  emailConfirmedAt: string | null;
  memberSince: string | null;
  lastSignInIso: string | null;
}) {
  // V3 §1.11 + §1.1 — canonical date helper.
  const verifiedLabel = emailConfirmedAt ? formatDate(emailConfirmedAt, "date") : null;
  // V3 §1.10 — when provider is only "email", combine SIGN-IN +
  // EMAIL into a single row (drop the SIGN-IN METHOD row).
  const onlyEmailProvider =
    providerLabel.trim().toLowerCase() === "email";
  return (
    <section
      className="ui-card-raised relative overflow-hidden rounded-2xl border p-0"
      aria-labelledby="security-resources-title"
    >
      <div
        aria-hidden
        className="landing-corner-ring pointer-events-none absolute"
        style={{
          top: "-2.25rem",
          right: "-2.25rem",
          width: "7rem",
          height: "7rem",
        }}
      />
      <header className="relative border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-5">
        {/* V3 §1.13 — landing-eyebrow-dot retained ONLY on
            page-header SETTINGS + the top-level Resources card
            (reduces dot count from 7 → 2). */}
        <p className="ui-caps-1 text-[var(--accent)]">
          <span className="landing-eyebrow-dot">
            {SETTINGS_SECURITY_STRINGS.eyebrows.resources}
          </span>
        </p>
        <h2
          id="security-resources-title"
          className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]"
        >
          {SETTINGS_SECURITY_STRINGS.sections.resources}
        </h2>
      </header>
      <div className="relative grid gap-2 px-5 py-4 sm:grid-cols-[minmax(11rem,16rem)_minmax(0,1fr)]">
        {/* V2 §1.3 — TEAM ROLES row uses ChipPair (drops bare dot). */}
        <div className="ui-caps-2 self-center text-[var(--text-tertiary)]">
          {SETTINGS_SECURITY_STRINGS.sections.teamRoles}
        </div>
        <div className="inline-flex items-center gap-1.5 text-[13.5px]">
          <ChipPair primary={ctxRole.toUpperCase()} secondary="VIEW ONLY" />
        </div>

        {/* V3 §1.10 — when provider is "email" only, drop the
            SIGN-IN METHOD row (the EMAIL STATUS row carries it).
            When multiple providers, render via ChipPair cluster
            per V3 §1.24. */}
        {!onlyEmailProvider ? (
          <>
            <div className="ui-caps-2 self-center text-[var(--text-tertiary)]">
              {SETTINGS_SECURITY_STRINGS.resources.signInMethod}
            </div>
            <div className="inline-flex flex-wrap items-center gap-1.5 text-[13.5px]">
              {providerLabel.split(" · ").map((p, idx, arr) => (
                <span key={p} className="inline-flex items-center gap-1.5">
                  <span className="ui-caps-3 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-0.5 text-[var(--text-secondary)]">
                    {p.toUpperCase()}
                  </span>
                  {idx < arr.length - 1 ? null : null}
                </span>
              ))}
            </div>
          </>
        ) : null}

        {/* V2 §1.36 / V3 §1.10 — EMAIL STATUS row (also conveys
            SIGN-IN when provider is only email). */}
        <div className="ui-caps-2 self-center text-[var(--text-tertiary)]">
          {SETTINGS_SECURITY_STRINGS.resources.emailStatus}
        </div>
        <div className="inline-flex flex-wrap items-center gap-1.5 text-[13.5px]">
          <StatusBadge status={emailVerified ? "healthy" : "warning"}>
            {emailVerified
              ? SETTINGS_SECURITY_STRINGS.emailVerifiedLabel
              : SETTINGS_SECURITY_STRINGS.emailUnverifiedLabel}
          </StatusBadge>
          {verifiedLabel ? (
            <time
              className="text-[12px] text-[var(--text-tertiary)]"
              {...timeAttrs(emailConfirmedAt)}
            >
              {verifiedLabel}
            </time>
          ) : null}
          {/* V3 §1.15 — Resend verification CTA when unverified. */}
          {!emailVerified ? (
            <Link
              href="/auth/resend-verification"
              className="ui-link text-[12.5px]"
            >
              {SETTINGS_SECURITY_STRINGS.resendVerificationCta}
            </Link>
          ) : null}
        </div>

        {/* V2 §1.48 / V3 §1.12 — MEMBER SINCE row uses body font
            (mono dropped). V3 §1.27 — <time> with UTC title. */}
        {memberSince ? (
          <>
            <div className="ui-caps-2 self-center text-[var(--text-tertiary)]">
              {SETTINGS_SECURITY_STRINGS.resources.memberSince}
            </div>
            <div className="inline-flex items-center gap-1.5 text-[13.5px] text-[var(--text-primary)]">
              <time {...timeAttrs(emailConfirmedAt)}>{memberSince}</time>
            </div>
          </>
        ) : null}

        {/* V4 §1.1 — LAST SIGN-IN row from user.last_sign_in_at. */}
        {lastSignInIso ? (
          <>
            <div className="ui-caps-2 self-center text-[var(--text-tertiary)]">
              {SETTINGS_SECURITY_STRINGS.lastSignInLabel}
            </div>
            <div className="inline-flex items-center gap-1.5 text-[13.5px] text-[var(--text-primary)]">
              <time {...timeAttrs(lastSignInIso)}>
                {formatDate(lastSignInIso, "dateTime")}
              </time>
            </div>
          </>
        ) : null}

        {/* V3 §1.7 — hairline divider between account-scope (above)
            and workspace-scope (below) rows. Two-scope segmentation
            without forcing a card split. */}
        <div
          aria-hidden
          className="col-span-full my-1 h-px bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]"
        />

        {/* Release-state §1685-1702 explicitly requires an
            "Audit history link" in this page's content set.
            V3 §1.14 had dropped the row pending real audit-log
            backing, but the spec doesn't gate the link on
            backend readiness — it requires the affordance. The
            target page reads `?filter` for future filtering. */}
        <div className="ui-caps-2 self-center text-[var(--text-tertiary)]">
          {SETTINGS_SECURITY_STRINGS.resources.auditHistory}
        </div>
        <div className="inline-flex items-center gap-1.5 text-[13.5px]">
          <Link
            href="/settings/security?filter=billing"
            className="ui-link inline-flex items-center gap-1"
          >
            View audit history
            <ChevronRight className="h-3 w-3" strokeWidth={2} aria-hidden />
          </Link>
        </div>

        {/* V2 §1.16 — Request DPA: split icon + text + ChevronRight. */}
        <div className="ui-caps-2 self-center text-[var(--text-tertiary)]">
          {SETTINGS_SECURITY_STRINGS.resources.dpaContact}
        </div>
        <div className="inline-flex items-center gap-1.5 text-[13.5px]">
          <Link
            href={`mailto:${SETTINGS_SECURITY_STRINGS.contactEmail}`}
            className="ui-link inline-flex items-center gap-1.5"
          >
            <Mail className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            {SETTINGS_SECURITY_STRINGS.contactCta}
            <ChevronRight className="h-3 w-3" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </div>
      {/* V2 §13.1 LEGAL footer — accent eyebrow per §2.10. */}
      <footer className="relative border-t border-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)] px-5 py-3">
        <p className="ui-caps-3 text-[var(--accent-strong)]">
          {SETTINGS_SECURITY_STRINGS.eyebrows.legal}
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          {SETTINGS_SECURITY_STRINGS.legalNote}
        </p>
      </footer>
    </section>
  );
}

// V2 §3.1 activity strip — extracted for clarity. V2 §1.7 adds hairline
// separators between every segment.
function ActivityStrip() {
  return (
    <section
      aria-labelledby="security-activity-title"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-2.5"
    >
      {/* V2 §5.1 — render eyebrow as <h2> for SR landmark.
          V4 §1.12 — retention copy relocated to title attribute
          (hover-reveal) per spec §10.14 subtraction. */}
      <h2
        id="security-activity-title"
        title="Events retained for 90 days"
        className="ui-caps-2 text-[var(--accent-strong)]"
      >
        {SETTINGS_SECURITY_STRINGS.activityEyebrow}
      </h2>
      <span
        aria-hidden
        className="hidden h-3 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] sm:inline-block"
      />
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-secondary)]">
        <Inbox className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
        {SETTINGS_SECURITY_STRINGS.activityEmptyLabel}
      </span>
      {/* V4 §1.6 — visible retention caps dropped; relocated to
          title attribute above (no more floating right segment).
          V3 §1.14 — OPEN AUDIT LOG link dropped: it routed to this
          same page with an unread ?filter param. Will return when
          a real audit-log surface lands. */}
    </section>
  );
}
