import Link from "next/link";
import { cookies } from "next/headers";
import {
  TriangleAlert,
} from "lucide-react";
import { getAuthContext, createClient, createAdminClient } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { UiAlert } from "@/components/ui/ui-alert";
import {
  SettingsWorkbench,
  SettingsStateStrip,
  type SettingsStateItem,
} from "@/components/settings/settings-workbench";
import { SecuritySettingsPanel } from "@/components/settings/security-settings-panel";
import { SETTINGS_SECURITY_STRINGS } from "@/lib/settings/spec-strings";
import { readStepUpExpiry } from "@/lib/security/step-up-cookie";
import { listMySessions } from "@/actions/sessions";
import { formatDate } from "@/lib/format/date";
import { hasEmailConfirmationSignal } from "@/lib/auth/email-confirmation";
import { AccountContext, ActivityStrip, LegalNote } from "./security-page-sections";

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
  // Provider-availability signal: when the MFA metadata calls throw, the auth
  // provider can't offer authenticator enrollment, so the panel shows an
  // unavailable state instead of an enroll control it can't fulfil.
  let mfaUnavailable = false;
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
    // MFA metadata calls can fail on transient provider errors; render a
    // degraded panel with an explicit unavailable state.
    mfaUnavailable = true;
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
      ? providers.map(humanizeProvider).join(" - ")
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

  const S = SETTINGS_SECURITY_STRINGS;

  // Header state strip — precise condition phrases, not pills.
  const stepUpStripValue = stepUp.active
    ? stepUp.via === "aal2"
      ? S.stepUpMfaSessionValue
      : S.stepUpActiveValue
    : S.stepUpRequiredValue;

  const stateItems: SettingsStateItem[] = [
    {
      label: S.stateLabels.protection,
      value: factorCount > 0 ? S.protectionEnrolledValue : S.mfaEmptyLabel,
      tone: factorCount > 0 ? "healthy" : "warning",
    },
    ...(orgName
      ? [
          {
            label: S.stateLabels.workspace,
            value: (
              <Link
                href="/settings#workspace-identity"
                className="ui-link block max-w-[12rem] truncate"
                title={orgName}
              >
                {orgName}
              </Link>
            ),
          } satisfies SettingsStateItem,
        ]
      : []),
    {
      label: S.stateLabels.account,
      value: (
        <Link
          href="/settings#profile"
          className="ui-link block max-w-[16rem] truncate font-mono text-[12px]"
          title={accountIdentity}
        >
          {accountIdentity}
        </Link>
      ),
    },
    {
      label: S.stateLabels.stepUp,
      value: stepUpStripValue,
      tone: stepUp.active ? "healthy" : "neutral",
    },
  ];

  return (
    <SettingsWorkbench
      active="security"
      eyebrow={S.eyebrow}
      title={S.title}
      lead={S.lead}
      skipLink={{ href: "#account-protection-card", label: "Skip to security content" }}
      stateStrip={<SettingsStateStrip items={stateItems} />}
    >
      {mfaBanner ? (
        <UiAlert tone={mfaBanner.tone}>{mfaBanner.copy}</UiAlert>
      ) : null}

      {filterParam ? (
        <UiAlert tone="neutral">
          Showing {filterParam}-related audit events.
        </UiAlert>
      ) : null}

      {/* Development marker — a titled inline amber note, not a bare pill. */}
      {showDevBanner ? (
        <div
          role="note"
          className="billing-no-print rounded-lg border px-3.5 py-2.5"
          style={{
            borderColor: "color-mix(in oklab, var(--warning-soft) 55%, var(--border-subtle))",
            background: "color-mix(in oklab, var(--warning-soft) 16%, var(--surface-raised))",
          }}
        >
          <p className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--warning-ink)]">
            <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            {S.devStateTitle}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-secondary)]">
            {S.devModeCopy}
          </p>
        </div>
      ) : null}

      {showAtRiskBanner ? (
        <UiAlert tone="warning">
          Your workspace requires MFA, but this account has no authenticator
          enrolled.{" "}
          <Link href="#account-protection-card" className="ui-link font-medium">
            Enroll an authenticator
          </Link>{" "}
          to keep access.
        </UiAlert>
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
        mfaAvailable={!mfaUnavailable}
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
    </SettingsWorkbench>
  );
}
