import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Gavel,
  TriangleAlert,
} from "lucide-react";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { PolicySimulationPanel } from "@/components/policy-simulation-panel";
import { getAuthContext } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface";
import {
  DEFAULT_WORKSPACE_POLICY_REGISTRY,
  buildWorkspacePolicyView,
  type WorkspacePolicySummary,
  type WorkspacePolicyWarning,
} from "@/lib/workspace-policy-model";
import { AdvancedTools, PolicyGroups } from "./policy-page-sections";

export const metadata = { title: "Workflow policies" };

type SummaryTone = "neutral" | "success" | "warning";

function SummaryCellTone({ count, kind }: { count: number; kind: "active" | "warning" | "groups" }): SummaryTone {
  if (kind === "warning") return count > 0 ? "warning" : "success";
  if (kind === "active") return count > 0 ? "success" : "neutral";
  return "neutral";
}

function toneDot(tone: SummaryTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  return "color-mix(in oklab, var(--border-strong) 70%, var(--text-tertiary))";
}

function toneHalo(tone: SummaryTone): string {
  if (tone === "success") return "var(--success-soft)";
  if (tone === "warning") return "var(--warning-soft)";
  return "var(--surface-contrast)";
}

function toneNumber(tone: SummaryTone, value: number): string {
  if (value === 0) return "var(--text-tertiary)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "success") return "var(--success-ink)";
  return "var(--text-primary)";
}

function SummaryStrip({ summary }: { summary: WorkspacePolicySummary }) {
  const cells: Array<{
    label: string;
    value: number;
    tone: SummaryTone;
  }> = [
    {
      label: "Active policies",
      value: summary.activePolicyCount,
      tone: SummaryCellTone({ count: summary.activePolicyCount, kind: "active" }),
    },
    {
      label: "Needs attention",
      value: summary.warningCount,
      tone: SummaryCellTone({ count: summary.warningCount, kind: "warning" }),
    },
    {
      label: "Workflow groups",
      value: summary.affectedGroupCount,
      tone: SummaryCellTone({ count: summary.affectedGroupCount, kind: "groups" }),
    },
  ];
  return (
    <section
      aria-label="Policy summary"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_92%,transparent)] bg-[color:var(--surface-tint)] px-4 py-3.5 shadow-[var(--shadow-1)]"
        >
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            <span
              aria-hidden
              className="inline-flex h-2 w-2 rounded-full"
              style={{
                background: toneDot(cell.tone),
                boxShadow: `0 0 0 3px color-mix(in oklab, ${toneHalo(cell.tone)} 42%, transparent)`,
              }}
            />
            {cell.label}
          </p>
          <p
            className="mt-2 text-[1.75rem] font-semibold leading-none tabular-nums tracking-[-0.02em]"
            style={{ color: toneNumber(cell.tone, cell.value) }}
          >
            {cell.value}
          </p>
        </div>
      ))}
    </section>
  );
}

function NeedsAttention({ warnings }: { warnings: WorkspacePolicyWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <section
      aria-labelledby="policy-needs-attention"
      className="relative overflow-hidden rounded-2xl border border-[color:color-mix(in_oklab,var(--warning)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_22%,var(--surface-raised))] p-5 shadow-[var(--shadow-1)]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--warning-ink) 80%, transparent) 0%, color-mix(in oklab, var(--warning-ink) 20%, transparent) 100%)",
        }}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--warning)_28%,var(--border-subtle))] bg-[var(--surface-raised)] text-[var(--warning-ink)] shadow-[var(--shadow-1)]"
            aria-hidden
          >
            <TriangleAlert className="h-4 w-4" strokeWidth={1.85} />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--warning-ink)]">
              Needs attention
            </p>
            <h2
              id="policy-needs-attention"
              className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]"
            >
              Policy issues to review
            </h2>
          </div>
        </div>
        <Link
          href="/settings/policy/diagnostics"
          className="ui-link inline-flex items-center gap-1 text-sm"
        >
          View diagnostics
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <ul className="mt-4 divide-y divide-[color:color-mix(in_oklab,var(--warning)_22%,transparent)]">
        {warnings.map((warning, index) => (
          <li key={`${warning.title}-${warning.policyId ?? index}`} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{warning.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {warning.message}
                </p>
              </div>
              <Link
                href={warning.actionHref}
                className="ui-link inline-flex shrink-0 items-center gap-1 text-sm"
              >
                {warning.actionLabel}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function PolicyRegistryPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  if (ctx.role !== "admin") {
    return (
      <div className="ui-page-stack mx-auto max-w-3xl">
        <Link
          href="/settings"
          className="ui-btn-ghost inline-flex max-w-max items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
          Back to settings
        </Link>
        <div className="ui-card-raised relative overflow-hidden rounded-2xl border p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--warning)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_36%,var(--surface-raised))] text-[var(--warning-ink)] shadow-[var(--shadow-1)]"
              aria-hidden
            >
              <AlertTriangle className="h-5 w-5" strokeWidth={1.65} />
            </span>
            <div className="min-w-0">
              <p>
                <span className="landing-eyebrow-dot text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--warning-ink)]">
                  Admins only
                </span>
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]">
                Workflow policies
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                Only workspace admins can manage workflow policies. Ask your administrator for access.
              </p>
            </div>
          </div>
        </div>
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
  const policyView = buildWorkspacePolicyView(registryJson, productSurface.mode, {
    hiddenAssuranceModules: productSurface.assuranceModulesHidden,
  });
  const showImpactPreview = productSurface.mode !== "core";
  const hasAnyPolicyState =
    policyView.summary.activePolicyCount > 0 ||
    policyView.summary.warningCount > 0 ||
    policyView.summary.affectedGroupCount > 0;

  return (
    <div className="ui-page-stack mx-auto max-w-5xl">
      <Link
        href="/settings"
        className="ui-btn-ghost inline-flex max-w-max items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
        Back to settings
      </Link>

      <DashboardPageHeader
        icon={<Gavel className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Internal settings"
        title="Workflow policies"
        lead="Private policy controls for approvals, reminders, evidence, and review workflow compatibility."
      />

      {hasAnyPolicyState ? <SummaryStrip summary={policyView.summary} /> : null}
      <NeedsAttention warnings={policyView.warnings} />
      <PolicyGroups groups={policyView.groups} />

      {showImpactPreview ? (
        <PolicySimulationPanel
          contracts={(recentContracts ?? []).map((contract) => ({
            id: contract.id as string,
            title: (contract.title as string) || "Untitled",
          }))}
          mode="preview"
        />
      ) : null}

      <AdvancedTools />
    </div>
  );
}
