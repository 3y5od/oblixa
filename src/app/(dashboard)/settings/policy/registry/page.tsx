import Link from "next/link";
import { FileCode } from "lucide-react";
import { savePolicyRegistryAction } from "@/actions/policy-operations";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { getAuthContext } from "@/lib/supabase/server";
import {
  DEFAULT_WORKSPACE_POLICY_REGISTRY,
  getWorkspacePolicyWarnings,
} from "@/lib/workspace-policy-model";
import { validatePolicyRegistry } from "@/lib/contract-operations/policy-registry";
import { PolicyRegistryEditorForm } from "./policy-registry-editor-form";

export const metadata = { title: "Advanced policy editor" };

export default async function PolicyRegistryEditorPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  if (ctx.role !== "admin") {
    return (
      <div className="ui-card p-6">
        <p className="text-sm text-[var(--text-secondary)]">Only workspace admins can edit workflow policies.</p>
        <Link href="/settings/policy" className="ui-link mt-3 inline-block text-sm">
          Back to workflow policies
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
      ? DEFAULT_WORKSPACE_POLICY_REGISTRY
      : settings.v4_policy_registry_json;
  const validation = validatePolicyRegistry(registryJson);
  const warnings = getWorkspacePolicyWarnings(registryJson, "advanced");

  async function saveAction(_state: { error?: string; success?: boolean }, formData: FormData) {
    "use server";
    return savePolicyRegistryAction(formData);
  }

  return (
    <div className="ui-page-stack mx-auto max-w-4xl">
      <DashboardPageHeader
        icon={<FileCode className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Governance"
        title="Advanced policy editor"
        lead="Edit the underlying JSON registry used by workflow policies, validation, and preview tools."
        actions={
          <Link
            href="/settings/policy"
            className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
          >
            Workflow policies
          </Link>
        }
      />

      <section className="ui-page-shell p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="ui-eyebrow">Source</p>
            <h2 className="ui-section-title mt-1 text-base">Registry JSON</h2>
            <p className="ui-support-copy mt-1">
              This array of policies is the source of truth. Duplicate id values are rejected on save.
            </p>
          </div>
          <Link href="/settings/policy/diagnostics" className="ui-link text-sm">
            View diagnostics
          </Link>
        </div>

        <div className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-sm">
          <p className="font-semibold text-[var(--text-primary)]">
            {validation.ok ? "Current registry is valid" : "Current registry needs attention"}
          </p>
          <p className="mt-1 text-[var(--text-secondary)]">
            {validation.ok
              ? `${Array.isArray(registryJson) ? registryJson.length : 0} policies are available for editing.`
              : validation.error}
          </p>
        </div>

        {warnings.length > 0 ? (
          <div className="ui-alert-warning mt-4 p-3 text-sm">
            <p className="font-semibold">Validation summary</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed">
              {warnings.map((warning, index) => (
                <li key={`${warning.title}-${warning.policyId ?? index}`}>{warning.title}: {warning.message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <PolicyRegistryEditorForm initialJson={JSON.stringify(registryJson, null, 2)} saveAction={saveAction} />
      </section>
    </div>
  );
}
