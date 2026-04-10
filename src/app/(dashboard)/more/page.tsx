import Link from "next/link";
import {
  BarChart3,
  GitBranch,
  HeartPulse,
  LayoutGrid,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import {
  NAV_ITEMS,
  WORKFLOW_AREA_LABELS,
  canAccessItem,
  getWorkflowAreaForNavItem,
  isV5NavItemVisible,
  type WorkflowArea,
  type WorkspaceRole,
} from "@/lib/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { OperationalSurfaceLinkCard } from "@/components/ui/operational-summary-card";
import { getFeatureFlags, isFeatureEnabled } from "@/lib/feature-flags";

const ASSURANCE_JUMP_LINKS = [
  {
    href: "/contracts/programs",
    title: "Programs",
    hint: "Portfolio programs and operating coverage.",
    actionLabel: "View programs",
    icon: LayoutGrid,
  },
  {
    href: "/relationship-workspaces",
    title: "Relationships",
    hint: "Account and counterparty jump points.",
    actionLabel: "Open relationships",
    icon: GitBranch,
  },
  {
    href: "/contracts/maintenance",
    title: "Maintenance",
    hint: "Bulk hygiene and correction tools.",
    actionLabel: "Open maintenance",
    icon: Wrench,
  },
  {
    href: "/settings",
    title: "Settings",
    hint: "Workspace profile, members, and policy.",
    actionLabel: "Open settings",
    icon: Settings,
  },
  {
    href: "/settings/health",
    title: "System health",
    hint: "Delivery, webhooks, and worker transparency.",
    actionLabel: "View health",
    icon: HeartPulse,
  },
  {
    href: "/assurance",
    title: "Assurance hub",
    hint: "Findings, policies, and automation entry.",
    actionLabel: "Open assurance",
    icon: Shield,
  },
  {
    href: "/assurance/program-evolution",
    title: "Program evolution",
    hint: "Stage changes with measured impact.",
    actionLabel: "View evolution",
    icon: Sparkles,
  },
  {
    href: "/assurance/control-policies",
    title: "Control policies",
    hint: "Published controls and evaluations.",
    actionLabel: "View policies",
    icon: ShieldCheck,
  },
  {
    href: "/reports#outcome-intelligence",
    title: "Outcome intelligence",
    hint: "Interventions and effectiveness (reports).",
    actionLabel: "Open reports section",
    icon: TrendingUp,
  },
  {
    href: "/reports#assurance-analytics",
    title: "Assurance analytics",
    hint: "Diagnostics and advanced assurance metrics.",
    actionLabel: "Open reports section",
    icon: BarChart3,
  },
] as const;

const GROUP_ORDER: WorkflowArea[] = [
  "monitor",
  "workflows",
  "assurance",
  "insights",
  "workspace",
];

export default async function MoreToolsPage(props: {
  searchParams: Promise<{ q?: string; section?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const v6Any =
    isFeatureEnabled("v6AssuranceCore") ||
    isFeatureEnabled("v6ControlPolicies") ||
    isFeatureEnabled("v6AdaptivePlaybooks") ||
    isFeatureEnabled("v6ReviewBoards") ||
    isFeatureEnabled("v6Autopilot") ||
    isFeatureEnabled("v6Segments");
  const role = (ctx.role as WorkspaceRole | undefined) ?? "viewer";
  const v5Flags = getFeatureFlags();
  const params = await props.searchParams;
  const query = String(params.q ?? "").trim().toLowerCase();
  const selectedSection = (params.section ?? "").trim() as WorkflowArea | "";

  const groups = GROUP_ORDER.map((group) => {
    const items = NAV_ITEMS.filter(
      (item) =>
        getWorkflowAreaForNavItem(item) === group &&
        canAccessItem(item, role) &&
        isV5NavItemVisible(item, v5Flags)
    ).filter((item) => {
      if (selectedSection && group !== selectedSection) return false;
      if (!query) return true;
      const haystack = `${item.name} ${item.description} ${item.href}`.toLowerCase();
      return haystack.includes(query);
    });
    return {
      key: group,
      label: `${WORKFLOW_AREA_LABELS[group]} destinations`,
      items,
    };
  }).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-8">
      <header className="border-b border-zinc-200/60 pb-8">
        <p className="ui-eyebrow">Navigation hub</p>
        <h1 className="ui-display-title mt-2">Workflow index</h1>
        <p className="mt-3 max-w-2xl text-[15px] text-zinc-500">
          Browse destinations by area: Monitor, Workflows, Assurance, Insights, and Workspace.
        </p>
        <form action="/more" method="get" className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search tools, pages, and workflows"
            className="ui-input-compact w-full sm:max-w-xl"
          />
          <select name="section" defaultValue={selectedSection} className="ui-input-compact sm:w-52">
            <option value="">All sections</option>
            <option value="monitor">Monitor</option>
            <option value="workflows">Workflows</option>
            <option value="assurance">Assurance</option>
            <option value="insights">Insights</option>
            <option value="workspace">Workspace</option>
          </select>
          <button type="submit" className="ui-btn-secondary px-4 py-2 text-[13px]">
            Apply
          </button>
          {(query || selectedSection) && (
            <Link href="/more" className="ui-btn-ghost px-3 py-2 text-[12px]">
              Clear
            </Link>
          )}
        </form>
      </header>

      {v6Any ? (
        <section className="ui-card p-5">
          <p className="ui-eyebrow">Assurance</p>
          <h2 className="ui-section-title mt-1 text-base">Adjacent jump points</h2>
          <p className="ui-muted-tight mt-1 max-w-3xl text-[13px]">
            Direct paths for ownership, maintenance, and reporting next to assurance work.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ASSURANCE_JUMP_LINKS.map((item) => (
              <OperationalSurfaceLinkCard
                key={item.href}
                href={item.href}
                eyebrow="Shortcut"
                title={item.title}
                hint={item.hint}
                actionLabel={item.actionLabel}
                icon={item.icon}
                tone="neutral"
              />
            ))}
          </div>
        </section>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          title="No tools match your filters"
          copy="Try a broader search term or clear section filtering."
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          {groups.map((group) => (
            <section key={group.key} className="ui-card overflow-hidden">
              <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-4">
                <h2 className="ui-section-title">{group.label}</h2>
              </div>
              <ul className="divide-y divide-zinc-100">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block px-5 py-4 transition-colors hover:bg-zinc-50/70"
                    >
                      <p className="text-sm font-semibold text-zinc-900">{item.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">{item.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
