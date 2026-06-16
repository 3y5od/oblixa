import Link from "next/link";
import { ArrowLeft, HeartPulse } from "lucide-react";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { hasRoleCapability } from "@/lib/access-control";
import { getOrgSettingsJson } from "@/lib/assurance/org-settings";
import { getOrgMemberRole } from "@/lib/permissions";
import { getAuthContext } from "@/lib/supabase/server";
import { SettingsHealthHealthyChecks } from "./settings-health-healthy-checks";
import { SettingsHealthHero } from "./settings-health-hero";
import { loadSettingsHealthPageModel } from "./settings-health-page-model";
import { SettingsHealthRecoveryActions } from "./settings-health-recovery-actions";
import { SettingsHealthRestrictedState } from "./settings-health-restricted-state";
import { SettingsHealthSupportDisclosure } from "./settings-health-support-disclosure";
import { SettingsHealthWorkflowIssues } from "./settings-health-workflow-issues";

export const metadata = { title: "System health" };

export default async function SettingsHealthPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const { admin, orgId, user } = ctx;

  const [role, workflowSettingsRes, orgSettings] = await Promise.all([
    getOrgMemberRole(admin, user.id, orgId),
    admin
      .from("organization_workflow_settings")
      .select("role_policy_json")
      .eq("organization_id", orgId)
      .maybeSingle(),
    getOrgSettingsJson(admin, orgId),
  ]);
  const canOpenHealth = hasRoleCapability({
    role,
    capability: "settings_manage",
    rolePolicyJson: (workflowSettingsRes.data?.role_policy_json as Record<string, unknown> | null) ?? null,
  });
  if (!canOpenHealth) return <SettingsHealthRestrictedState />;

  const model = await loadSettingsHealthPageModel({ admin, orgId, orgSettings });

  return (
    <div className="ui-page-stack-dense mx-auto max-w-6xl">
      <Link
        href="/settings"
        className="ui-btn-ghost inline-flex max-w-max items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
        Back to settings
      </Link>

      <DashboardPageHeader
        icon={<HeartPulse className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Internal settings"
        title="System health"
        lead="Workflow reliability, delivery status, and configuration issues for this workspace."
        actions={
          <dl className="flex shrink-0 items-baseline gap-1.5 pt-1 text-[11px]">
            <dt className="font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Checked</dt>
            <dd className="font-mono text-[var(--text-secondary)]">{model.lastCheckedLabel}</dd>
          </dl>
        }
      />

      <SettingsHealthHero
        overallStatus={model.overallStatus}
        affectedCount={model.affectedCount}
        healthyCount={model.healthyItems.length}
        primaryAction={model.primaryAction}
        primaryAffectedItem={model.primaryAffectedItem}
        heroCtaLabel={model.heroCtaLabel}
        allClearSentence={model.allClearSentence}
      />
      <SettingsHealthRecoveryActions
        retryableImportJobId={model.retryableImportJobId}
        latestFailedReportId={model.latestFailedReportId}
      />
      <SettingsHealthWorkflowIssues items={model.secondaryAffectedItems} primaryAction={model.primaryAction} />
      <SettingsHealthHealthyChecks items={model.healthyItems} />
      <SettingsHealthSupportDisclosure
        reportMetadataLabel={model.reportMetadataLabel}
        deliveryMetadataLabel={model.deliveryMetadataLabel}
        diagnostics={model.diagnosticsProps}
      />
    </div>
  );
}
