import Link from "next/link";
import { Scale } from "lucide-react";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { PolicySimulationPanel } from "@/components/v4/policy-simulation-panel";
import { getAuthContext } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface";
import {
  DEFAULT_WORKSPACE_POLICY_REGISTRY,
  getWorkspacePolicyWarnings,
} from "@/lib/workspace-policy-model";
import {
  analyzePolicyRegistry,
  getApprovalSlaFallbackHours,
  validatePolicyRegistry,
} from "@/lib/v4/policy-registry";

export const metadata = { title: "Policy diagnostics" };

export default async function PolicyDiagnosticsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  if (ctx.role !== "admin") {
    return (
      <div className="ui-card p-6">
        <p className="text-sm text-[var(--text-secondary)]">Only workspace admins can inspect policy diagnostics.</p>
        <Link href="/settings/policy" className="ui-link mt-3 inline-block text-sm">
          Back to workflow policies
        </Link>
      </div>
    );
  }

  const [{ data: settings, error }, { data: recentContracts }, productSurface] = await Promise.all([
    ctx.admin
      .from("organization_workflow_settings")
      .select("v4_policy_registry_json")
      .eq("organization_id", ctx.orgId)
      .maybeSingle(),
    ctx.admin
      .from("contracts")
      .select("id, title")
      .eq("organization_id", ctx.orgId)
      .order("updated_at", { ascending: false })
      .limit(40),
    loadProductSurfaceContext(ctx.admin, ctx.orgId, ctx.role as WorkspaceRole),
  ]);

  const registryJson =
    error || !settings?.v4_policy_registry_json
      ? DEFAULT_WORKSPACE_POLICY_REGISTRY
      : settings.v4_policy_registry_json;
  const validation = validatePolicyRegistry(registryJson);
  const rawWarnings = analyzePolicyRegistry(registryJson);
  const userWarnings = getWorkspacePolicyWarnings(registryJson, productSurface.mode, {
    hiddenAssuranceModules: productSurface.assuranceModulesHidden,
  });
  const approvalFallbackHours = getApprovalSlaFallbackHours(registryJson);
  const previewEnabled = productSurface.mode !== "core";

  return (
    <div className="ui-page-stack mx-auto max-w-5xl">
      <DashboardPageHeader
        icon={<Scale className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Governance"
        title="Policy diagnostics"
        lead="Inspect registry validation, SLA fallback behavior, and raw simulation details for support review."
        actions={
          <>
            <Link
              href="/settings/policy"
              className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
            >
              Workflow policies
            </Link>
            <Link
              href="/settings/policy/registry"
              className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
            >
              Advanced policy editor
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
          <p className="ui-eyebrow">Validation</p>
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
            {validation.ok ? "Registry is valid" : "Registry is invalid"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {validation.ok ? "validatePolicyRegistry accepted the saved JSON." : validation.error}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
          <p className="ui-eyebrow">Approval fallback</p>
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
            {approvalFallbackHours ? `${approvalFallbackHours} hours` : "No fallback"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            The approval SLA cron uses the first positive sla_hours entry whose applies_to includes approval when no
            matching approval_slas row exists.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
          <p className="ui-eyebrow">Preview support</p>
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
            {previewEnabled ? "Contract preview enabled" : "Contract preview hidden"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Current workspace mode: {productSurface.mode}. POST /api/policy/simulate performs no database writes.
          </p>
        </div>
      </section>

      <section className="ui-page-shell p-5">
        <p className="ui-eyebrow">Warnings</p>
        <h2 className="ui-section-title mt-1 text-base">Saved registry warnings</h2>
        {rawWarnings.length > 0 || userWarnings.length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">User-facing warnings</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-[var(--text-secondary)]">
                {userWarnings.map((warning, index) => (
                  <li key={`${warning.title}-${index}`}>{warning.title}: {warning.message}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Raw warnings</p>
              {rawWarnings.length > 0 ? (
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-[var(--text-secondary)]">
                  {rawWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-[var(--text-secondary)]">No raw analyzer warnings.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="ui-support-copy mt-2">No warnings for the current saved JSON.</p>
        )}
      </section>

      <PolicySimulationPanel
        contracts={(recentContracts ?? []).map((contract) => ({
          id: contract.id as string,
          title: (contract.title as string) || "Untitled",
        }))}
        mode="diagnostics"
      />
    </div>
  );
}
