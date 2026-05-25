import Link from "next/link";
import { Stethoscope } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { getOrgMemberRole } from "@/lib/permissions";
import { hasRoleCapability } from "@/lib/access-control";
import { V10_OPS_RELEASE_READINESS_CONTRACTS } from "@/lib/operational-contracts";

export const metadata = { title: "Internal health diagnostics" };

export default async function SettingsHealthInternalDiagnosticsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const [role, workflowSettingsRes] = await Promise.all([
    getOrgMemberRole(ctx.admin, ctx.user.id, ctx.orgId),
    ctx.admin
      .from("organization_workflow_settings")
      .select("role_policy_json")
      .eq("organization_id", ctx.orgId)
      .maybeSingle(),
  ]);
  const canOpenHealth = hasRoleCapability({
    role,
    capability: "settings_manage",
    rolePolicyJson: (workflowSettingsRes.data?.role_policy_json as Record<string, unknown> | null) ?? null,
  });

  if (!canOpenHealth) {
    return (
      <div className="ui-card px-6 py-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">Workspace</p>
        <h1 className="mt-2 text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-[2rem]">Internal health diagnostics</h1>
        <p className="mt-3 max-w-xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          You do not have permission to view internal operational diagnostics for this workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="ui-page-stack">
      <DashboardPageHeader
        icon={<Stethoscope className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Internal diagnostics"
        title="System health diagnostics"
        lead="Internal route, release, recovery, and implementation diagnostics live here so the default health page stays focused on workspace-admin workflow reliability."
        actions={
          <Link
            href="/settings/health"
            className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
          >
            Back to workspace health
          </Link>
        }
      />

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Route and recovery hooks</p>
          <h2 className="ui-page-title mt-2 text-[1.8rem]">Internal product path diagnostics</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
            These are implementation checks for support and engineering. They are intentionally excluded from the
            default workspace-admin health page.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <InternalDiagnosticCard title="/api/health" detail="Deployment and smoke-test health probe." href="/api/health" />
          <InternalDiagnosticCard
            title="/api/notifications/retry-deliveries"
            detail="Notification retry recovery route and worker hook."
            href="/settings/operations"
          />
          <InternalDiagnosticCard
            title="/api/contracts/recompute-signals"
            detail="Workspace signal recomputation route for recovery checks."
            href="/api/contracts/recompute-signals"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Release readiness</p>
          <h2 className="ui-page-title mt-2 text-[1.8rem]">Runbooks, providers, canary, and rollback</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
            These rows mirror internal release-readiness contracts. Keep them out of the user-facing health summary.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {V10_OPS_RELEASE_READINESS_CONTRACTS.map((contract) => (
            <InternalDiagnosticCard
              key={contract.key}
              title={String(contract.key).replace(/_/g, " ")}
              detail={`${contract.diagnosticPrefix} · ${contract.providerBlockers.length} provider blocker${contract.providerBlockers.length === 1 ? "" : "s"} · rollback: ${contract.rollbackCommand}`}
              href={contract.recoveryDestination}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function InternalDiagnosticCard(props: { title: string; detail: string; href: string }) {
  return (
    <Link
      href={props.href}
      className="ui-operational-focusable ui-operational-card-compact flex h-full flex-col px-3.5 py-3"
    >
      <p className="ui-kicker">Internal</p>
      <p className="mt-1.5 font-semibold tracking-tight text-[14px] text-[var(--text-primary)]">{props.title}</p>
      <p className="ui-support-copy mt-1.5">{props.detail}</p>
      <span className="ui-operational-action mt-3.5 shrink-0 text-[11px]">
        Inspect diagnostic
        <span aria-hidden>→</span>
      </span>
    </Link>
  );
}
