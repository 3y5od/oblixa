import Link from "next/link";
import type { LucideIcon } from "lucide-react";
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
  getWorkflowAreaForNavItem,
  type WorkflowArea,
  type WorkspaceRole,
} from "@/lib/navigation";
import { MORE_PAGE_JUMP_LINKS, MORE_TOOLS_GROUP_ORDER } from "@/lib/navigation/more-tools-model";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { OperationalSurfaceLinkCard } from "@/components/ui/operational-summary-card";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import { isHrefEligibleForProductSurface } from "@/lib/product-surface/href-eligibility";
import {
  isNavItemVisibleForSurface,
  toNavSurfaceInput,
} from "@/lib/product-surface/nav-visibility";
import { isPathAllowedForWorkspaceMode, minWorkspaceModeForPath } from "@/lib/product-surface/routes";
import { isCmdkHrefAllowed } from "@/lib/product-surface/resolver";

const JUMP_LINK_ICONS: Record<(typeof MORE_PAGE_JUMP_LINKS)[number]["href"], LucideIcon> = {
  "/contracts/programs": LayoutGrid,
  "/relationship-workspaces": GitBranch,
  "/contracts/maintenance": Wrench,
  "/settings": Settings,
  "/settings/health": HeartPulse,
  "/assurance": Shield,
  "/assurance/program-evolution": Sparkles,
  "/assurance/control-policies": ShieldCheck,
  "/reports#outcome-intelligence": TrendingUp,
  "/reports#assurance-analytics": BarChart3,
};

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
  const productSurface = await loadProductSurfaceContext(ctx.admin, ctx.orgId, role);
  const navInput = toNavSurfaceInput(productSurface);
  const params = await props.searchParams;
  const query = String(params.q ?? "").trim().toLowerCase();
  const selectedSection = (params.section ?? "").trim() as WorkflowArea | "";

  const jumpLinks = MORE_PAGE_JUMP_LINKS.filter((link) =>
    isPathAllowedForWorkspaceMode(link.href.split("#")[0] ?? link.href, productSurface.mode)
  )
    .filter((link) => {
      const path = link.href.split("#")[0] ?? link.href;
      if (navInput.searchScope !== "core_only") return true;
      return minWorkspaceModeForPath(path) === "core";
    })
    .filter((link) => isHrefEligibleForProductSurface(productSurface, link.href));

  const groups = MORE_TOOLS_GROUP_ORDER.map((group) => {
    const items = NAV_ITEMS.filter(
      (item) =>
        getWorkflowAreaForNavItem(item) === group &&
        isNavItemVisibleForSurface(item, navInput) &&
        isCmdkHrefAllowed(item.href, navInput)
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
        <p className="ui-eyebrow">Utilities</p>
        <h1 className="ui-display-title mt-2">Tools index</h1>
        <p className="mt-3 max-w-2xl text-[15px] text-zinc-500">
          Secondary destinations and workspace tools. Primary work lives under Home, Contracts,
          Review, Work, and Reports.
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

      {v6Any && jumpLinks.length > 0 ? (
        <section className="ui-card p-5">
          <p className="ui-eyebrow">Shortcuts</p>
          <h2 className="ui-section-title mt-1 text-base">Jump points</h2>
          <p className="ui-muted-tight mt-1 max-w-3xl text-[13px]">
            Contextual shortcuts for your workspace mode.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jumpLinks.map((item) => (
              <OperationalSurfaceLinkCard
                key={item.href}
                href={item.href}
                eyebrow="Shortcut"
                title={item.title}
                hint={item.hint}
                actionLabel={item.actionLabel}
                icon={JUMP_LINK_ICONS[item.href]}
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
              <div className="border-b border-[var(--border-subtle)] bg-zinc-50/60 px-5 py-4">
                <h2 className="ui-section-title">{group.label}</h2>
              </div>
              <ul className="divide-y divide-[var(--border-subtle)]">
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
