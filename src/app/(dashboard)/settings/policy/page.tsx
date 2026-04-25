import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { PolicySimulationPanel } from "@/components/v4/policy-simulation-panel";
import { savePolicyRegistryAction } from "@/actions/v4";
import { analyzePolicyRegistry, validatePolicyRegistry } from "@/lib/v4/policy-registry";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface";

const DEFAULT_REGISTRY = [
  {
    id: "evidence_required_high_value",
    title: "Evidence for high-value renewals",
    applies_to: ["renewal", "obligation"],
    severity: "high",
    notes: "Require manager approval evidence before marking complete.",
  },
  {
    id: "approval_sla_default",
    title: "Default approval SLA",
    applies_to: ["approval"],
    sla_hours: 48,
  },
];

export default async function PolicyRegistryPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  if (ctx.role !== "admin") {
    return (
      <div className="ui-card p-6">
        <p className="text-sm text-[var(--text-secondary)]">Only workspace admins can edit the policy registry.</p>
        <Link href="/settings" className="ui-link mt-3 inline-block text-sm">
          Back to settings
        </Link>
      </div>
    );
  }

  const { data: settings, error } = await ctx.admin
    .from("organization_workflow_settings")
    .select("v4_policy_registry_json")
    .eq("organization_id", ctx.orgId)
    .maybeSingle();

  const registryJson =
    error || !settings?.v4_policy_registry_json
      ? DEFAULT_REGISTRY
      : settings.v4_policy_registry_json;

  const savedWarnings =
    validatePolicyRegistry(registryJson).ok ? analyzePolicyRegistry(registryJson) : [];

  const { data: recentContracts } = await ctx.admin
    .from("contracts")
    .select("id, title")
    .eq("organization_id", ctx.orgId)
    .order("updated_at", { ascending: false })
    .limit(40);

  const productSurface = await loadProductSurfaceContext(
    ctx.admin,
    ctx.orgId,
    ctx.role as WorkspaceRole
  );
  const showPolicySimulation = productSurface.mode !== "core";

  async function saveAction(formData: FormData) {
    "use server";
    await savePolicyRegistryAction(formData);
  }

  return (
    <div className="ui-page-stack mx-auto max-w-3xl">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Governance</p>
          <h1 className="ui-display-title mt-2">Policy registry & simulation</h1>
          <p className="ui-page-lead mt-3">
            Store a structured JSON registry of org policies. Duplicate <code className="text-xs">id</code> values are
            rejected on save. Approval SLA cron uses <code className="text-xs">sla_hours</code> from entries whose{" "}
            <code className="text-xs">applies_to</code> includes <code className="text-xs">approval</code> when no
            matching <code className="text-xs">approval_slas</code> row exists. Use the simulator below to preview
            impact without writes.
          </p>
          <Link href="/settings" className="ui-link mt-3 inline-block text-sm">
            ← Settings
          </Link>
        </div>
      </header>

      <section className="ui-page-shell p-5">
        <p className="ui-eyebrow">Source</p>
        <p className="ui-section-title mt-1 text-base">Registry JSON (array of policies)</p>
        <p className="ui-support-copy mt-1">Edit the registry as the source of truth, then use simulation and warnings below as the diagnostic layer before saving changes.</p>
        <form action={saveAction} className="mt-3 space-y-2">
          <textarea
            name="registryJson"
            required
            rows={18}
            defaultValue={JSON.stringify(registryJson, null, 2)}
            className="ui-input font-mono text-xs"
          />
          <button type="submit" className="ui-btn-primary px-4 py-2 text-sm">
            Save registry
          </button>
        </form>
      </section>

      {showPolicySimulation ? (
        <PolicySimulationPanel
          contracts={(recentContracts ?? []).map((c) => ({
            id: c.id as string,
            title: (c.title as string) || "Untitled",
          }))}
        />
      ) : (
        <section className="ui-page-shell p-5 text-sm text-[var(--text-secondary)]">
          <p className="font-medium text-[var(--text-primary)]">Policy simulation</p>
          <p className="ui-support-copy mt-2 text-[13px]">
            Contract-level simulation is available when the workspace is in Advanced or Assurance mode (Settings →
            Product experience). The registry JSON above still applies to execution and SLAs in Core.
          </p>
        </section>
      )}

      {savedWarnings.length > 0 ? (
        <section className="ui-alert-warning p-4 text-sm">
          <p className="font-semibold">Saved registry warnings</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed">
            {savedWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="ui-soft-details p-4 text-xs text-[var(--text-secondary)]">
          <p className="font-medium text-[var(--text-primary)]">Saved registry</p>
          <p className="mt-1">No automated warnings for the current saved JSON. Run simulation for contract-specific checks.</p>
        </section>
      )}
    </div>
  );
}
