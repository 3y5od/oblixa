import { getAuthContext, createClient } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { SecuritySettingsPanel } from "@/components/settings/security-settings-panel";

export default async function SecuritySettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const sp = (await searchParams) ?? {};
  const mfaBanner =
    typeof sp.mfa === "string" && sp.mfa === "required"
      ? "Your workspace requires multi-factor authentication. Enroll below, then refresh."
      : null;

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

  return (
    <div className="ui-page-stack mx-auto max-w-3xl">
      <header className="ui-page-header">
        <div className="min-w-0">
          <p className="ui-eyebrow">Workspace</p>
          <h1 className="ui-display-title mt-2">Security</h1>
          <p className="ui-page-lead mt-3 max-w-2xl">
            Multi-factor authentication, session hygiene, step-up for sensitive changes, and organization MFA policy.
          </p>
        </div>
      </header>

      {mfaBanner ? (
        <div className="ui-alert-error text-sm" role="status">
          {mfaBanner}
        </div>
      ) : null}

      <SecuritySettingsPanel
        orgId={ctx.orgId}
        role={ctx.role}
        orgMfaRequired={ctx.mfaRequired}
        totpFactors={totpFactors}
        currentAal={currentAal}
        nextAal={nextAal}
      />
    </div>
  );
}
