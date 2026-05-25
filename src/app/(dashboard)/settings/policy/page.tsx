import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  FileCode2,
  Gavel,
  Layers,
  Sparkles,
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
  type WorkspacePolicy,
  type WorkspacePolicyGroup,
  type WorkspacePolicySummary,
  type WorkspacePolicyWarning,
} from "@/lib/workspace-policy-model";

export const metadata = { title: "Workflow policies" };

function policyStatusClass(policy: WorkspacePolicy): string {
  if (policy.status === "warning") {
    return "border-[color:color-mix(in_oklab,var(--warning)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_30%,var(--surface-raised))] text-[var(--warning-ink)]";
  }
  if (policy.status === "unavailable") {
    return "border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,var(--surface-raised))] text-[var(--text-tertiary)]";
  }
  return "border-[color:color-mix(in_oklab,var(--success)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_28%,var(--surface-raised))] text-[var(--success-ink)]";
}

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

function PolicyGroupSection({ group }: { group: WorkspacePolicyGroup }) {
  return (
    <section className="ui-card overflow-hidden p-0">
      <header className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
        <h3 className="text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">
          {group.title}
        </h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          {group.description}
        </p>
      </header>
      <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
        {group.policies.map((policy) => (
          <li
            key={policy.id}
            className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                  {policy.title}
                </h4>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${policyStatusClass(policy)}`}
                >
                  {policy.status === "active"
                    ? "Active"
                    : policy.status === "warning"
                      ? "Warning"
                      : "Unavailable"}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{policy.affectsLabel}</p>
              <p className="mt-0.5 font-mono text-[11px] text-[var(--text-tertiary)]">{policy.detail}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link href="/settings/policy/registry" className="ui-btn-secondary px-3 py-1.5 text-xs">
                Edit advanced settings
              </Link>
              <Link
                href="/settings/policy/diagnostics"
                className="ui-btn-ghost px-3 py-1.5 text-xs"
              >
                View diagnostics
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PolicyGroups({ groups }: { groups: WorkspacePolicyGroup[] }) {
  if (groups.length === 0) {
    return (
      <section className="ui-card-raised relative overflow-hidden rounded-2xl border p-6 sm:p-8">
        <div
          aria-hidden
          className="landing-corner-ring"
          style={{ top: "-2.25rem", right: "-2.25rem", width: "7rem", height: "7rem" }}
        />
        <div className="flex items-start gap-4">
          <span
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_38%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
            aria-hidden
          >
            <Layers className="h-5 w-5" strokeWidth={1.65} />
          </span>
          <div className="min-w-0 flex-1">
            <p>
              <span className="landing-eyebrow-dot text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                No policies yet
              </span>
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]">
              Start with the structured policy registry
            </h2>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--text-secondary)]">
              Policies control approval timing, reminder cadence, evidence requirements, and review checkpoints.
              Configure them in the advanced editor when this workspace is ready for structured rules.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-1 gap-y-2">
              <Link
                href="/settings/policy/registry"
                className="ui-btn-primary min-h-10 px-4 py-2.5 text-[12.5px]"
              >
                Open advanced editor
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/settings/policy/diagnostics"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_42%,transparent)] hover:text-[var(--accent-strong)]"
              >
                Inspect diagnostics
                <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <PolicyGroupSection key={group.key} group={group} />
      ))}
    </div>
  );
}

function AdvancedTools() {
  const tools = [
    {
      href: "/settings/policy/registry",
      title: "Advanced policy editor",
      description: "Edit the underlying policy list and save registry changes.",
      icon: FileCode2,
    },
    {
      href: "/settings/policy/diagnostics",
      title: "Policy diagnostics",
      description: "Inspect validation details, fallback behavior, and preview support.",
      icon: Activity,
    },
  ] as const;
  return (
    <section aria-labelledby="policy-administration">
      <header className="mb-3 flex items-center gap-2.5">
        <Sparkles className="h-3 w-3 text-[var(--text-tertiary)]" aria-hidden />
        <h2
          id="policy-administration"
          className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]"
        >
          Policy administration
        </h2>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        {tools.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group ui-card relative overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-2)]"
          >
            <div className="flex items-start gap-3.5">
              <span
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_24%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
                aria-hidden
              >
                <Icon className="h-4 w-4" strokeWidth={1.85} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                  {title}
                  <ArrowUpRight
                    className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--accent-strong)]"
                    aria-hidden
                  />
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                  {description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
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
