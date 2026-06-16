import Link from "next/link";
import { notFound } from "next/navigation";
import { createHash } from "node:crypto";
import { SlidersHorizontal } from "lucide-react";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { RecoverableState } from "@/components/ui/recoverable-state";
import { getAuthContext } from "@/lib/supabase/server";
import { getOrgSettingsJson } from "@/lib/assurance/org-settings";
import { getFeatureFlags } from "@/lib/feature-flags";
import { parseOnboardingCalibration } from "@/lib/onboarding/calibration-types";
import { arePrivateProductControlsEnabled } from "@/lib/release-state-private-controls";
import { SettingsProductDraftPreview } from "@/app/(dashboard)/settings/product/settings-product-draft-preview";
import { SettingsProductEmailSection } from "@/app/(dashboard)/settings/product/settings-product-email-section";
import {
  ProductCalibrationSection,
  ProductModeExplanation,
} from "@/app/(dashboard)/settings/product/settings-product-page-sections";
import { ProductSurfaceSettingsForm } from "@/app/(dashboard)/settings/product/settings-product-surface-form";

export const metadata = { title: "Product experience" };

export default async function WorkspaceProductSettingsPage() {
  if (!arePrivateProductControlsEnabled()) notFound();
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  if (ctx.role !== "admin") {
    return (
      <div className="ui-page-stack mx-auto max-w-2xl">
        <RecoverableState
          state="forbidden"
          title="Only workspace admins can change product mode"
          reason="Your current role can view settings but cannot change workspace mode, module visibility, or notification category controls."
          accessibleName="Product experience settings forbidden state"
          surface="settings_product"
          section="authorization"
          sourceObject="setting"
          nextActionLabel="Back to settings"
          nextAction={
            <Link href="/settings" className="ui-link inline-block text-sm">
              Back to settings
            </Link>
          }
        />
      </div>
    );
  }

  const v6 = await getOrgSettingsJson(ctx.admin, ctx.orgId);
  const onboardingCal = parseOnboardingCalibration(v6.onboarding_calibration);
  const hidden = new Set(v6.advanced_modules_hidden ?? []);
  const assuranceHidden = new Set(v6.assurance_modules_hidden ?? []);
  const utilityHidden = new Set(v6.utility_modules_hidden ?? []);
  const homeHidden = new Set(v6.home_hidden_sections ?? []);
  const mode = v6.workspace_mode ?? "core";
  const advancedNavCustom = Array.isArray(v6.advanced_nav_roles);
  const advancedNavSet = new Set(v6.advanced_nav_roles ?? []);
  const assuranceNavCustom = Array.isArray(v6.assurance_nav_roles);
  const assuranceNavSet = new Set(v6.assurance_nav_roles ?? []);

  const { data: workflowRow } = await ctx.admin
    .from("organization_workflow_settings")
    .select("notification_policy_json")
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  const emailPolicy = (
    (workflowRow?.notification_policy_json as Record<string, unknown> | null)?.email ?? {}
  ) as Record<string, unknown>;
  const emailBlocked = new Set(
    Array.isArray(emailPolicy.blocked_types)
      ? (emailPolicy.blocked_types as unknown[]).map((v) => String(v))
      : []
  );
  const featureFlags = getFeatureFlags();
  const orgFingerprint = createHash("sha256").update(ctx.orgId).digest("hex").slice(0, 8);

  return (
    <div className="ui-page-stack mx-auto max-w-2xl">
      <DashboardPageHeader
        icon={<SlidersHorizontal className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Internal settings"
        title="Product experience"
        lead="Private workspace controls for product-mode and module visibility compatibility."
      />
      <ProductModeExplanation />
      <ProductCalibrationSection onboardingCal={onboardingCal} orgFingerprint={orgFingerprint} />
      <ProductSurfaceSettingsForm
        mode={mode}
        hidden={hidden}
        assuranceHidden={assuranceHidden}
        utilityHidden={utilityHidden}
        homeHidden={homeHidden}
        advancedNavCustom={advancedNavCustom}
        advancedNavSet={advancedNavSet}
        assuranceNavCustom={assuranceNavCustom}
        assuranceNavSet={assuranceNavSet}
        searchScope={v6.search_scope}
        defaultLandingPath={v6.default_landing_path}
        assuranceNavAdminTesting={v6.assurance_nav_admin_testing}
        autopilotAllowExecution={v6.autopilot_allow_execution}
      />
      <SettingsProductDraftPreview
        formId="workspace-product-settings-form"
        orgId={ctx.orgId}
        featureFlags={featureFlags}
        initialBlockedTypes={[...emailBlocked]}
        initialMode={mode}
      />
      <SettingsProductEmailSection blockedTypes={[...emailBlocked]} />
    </div>
  );
}
