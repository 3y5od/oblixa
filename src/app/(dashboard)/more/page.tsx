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
import { MORE_TOOLS_GROUP_ORDER } from "@/lib/navigation/more-tools-model";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { OperationalSurfaceLinkCard } from "@/components/ui/operational-summary-card";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import { isHrefEligibleForProductSurface } from "@/lib/product-surface/href-eligibility";
import {
  isNavItemVisibleForSurface,
  toNavSurfaceInput,
} from "@/lib/product-surface/nav-visibility";
import { isPathAllowedForWorkspaceMode, minWorkspaceModeForPath } from "@/lib/product-surface/routes";
import { isCmdkHrefAllowed } from "@/lib/product-surface/resolver";
import {
  listMoreJumpDestinations,
  resolveMorePageChrome,
  resolveWorkflowDestination,
  workflowDestinationForHref,
  type WorkflowDestinationKey,
} from "@/lib/product-surface/workflow-destinations";
import { surfaceTestIds } from "@/lib/qa/test-ids";

const JUMP_LINK_ICONS: Partial<Record<WorkflowDestinationKey, LucideIcon>> = {
  programs: LayoutGrid,
  relationships: GitBranch,
  advanced_analytics: BarChart3,
  maintenance: Wrench,
  system_health: HeartPulse,
  assurance: Shield,
  program_evolution: Sparkles,
  control_policies: ShieldCheck,
  outcome_intelligence: TrendingUp,
  assurance_analytics: BarChart3,
};

export default async function MoreToolsPage(props: {
  searchParams: Promise<{ q?: string; section?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const role = (ctx.role as WorkspaceRole | undefined) ?? "viewer";
  const productSurface = await loadProductSurfaceContext(ctx.admin, ctx.orgId, role);
  const navInput = toNavSurfaceInput(productSurface);
  const pageChrome = resolveMorePageChrome(productSurface);
  const params = await props.searchParams;
  const query = String(params.q ?? "").trim().toLowerCase();
  const selectedSection = (params.section ?? "").trim() as WorkflowArea | "";

  const jumpLinks = listMoreJumpDestinations(productSurface)
    .filter((link) => {
      const path = link.href.split("#")[0] ?? link.href;
      return isPathAllowedForWorkspaceMode(path, productSurface.mode);
    })
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
        item.href !== "/more" &&
        isNavItemVisibleForSurface(item, navInput) &&
        isCmdkHrefAllowed(item.href, navInput)
    ).filter((item) => {
      if (selectedSection && group !== selectedSection) return false;
      if (!query) return true;
      const haystack = `${item.name} ${item.description} ${item.href}`.toLowerCase();
      return haystack.includes(query);
    }).map((item) => {
      const def = workflowDestinationForHref(item.href);
      const destination = def ? resolveWorkflowDestination(productSurface, def.key) : null;
      if (!destination?.visible) return item;
      return {
        ...item,
        name: destination.copy.label,
        description: destination.copy.description,
      };
    });
    return {
      key: group,
      label: `${WORKFLOW_AREA_LABELS[group]} destinations`,
      items,
    };
  }).filter((group) => group.items.length > 0);

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header">
        <div className="min-w-0 flex-1">
          <p className="ui-eyebrow">{pageChrome.eyebrow}</p>
          <h1 className="ui-display-title mt-2">{pageChrome.title}</h1>
          <p className="ui-page-lead mt-3 max-w-2xl">
            {pageChrome.lead}
          </p>
        </div>
        <form
          action="/more"
          method="get"
          className="ui-page-actions flex w-full flex-col gap-3 sm:max-w-xl sm:flex-row sm:flex-wrap sm:items-center"
        >
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={pageChrome.searchPlaceholder}
            className="ui-input-compact w-full sm:min-w-[16rem] sm:flex-1"
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
            Apply filters
          </button>
          {(query || selectedSection) && (
            <Link href="/more" className="ui-btn-ghost px-3 py-2 text-[12px]">
              Clear filters
            </Link>
          )}
        </form>
      </header>

      {jumpLinks.length > 0 ? (
        <section data-testid={surfaceTestIds.moreJumpPoints} className="ui-page-shell">
          <p className="ui-eyebrow">Shortcuts</p>
          <h2 className="ui-page-title mt-1 text-[1.8rem]">{pageChrome.shortcutHeading}</h2>
          <p className="ui-section-lead mt-2 max-w-3xl">
            Contextual shortcuts for your workspace mode.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jumpLinks.map((item) => (
              <OperationalSurfaceLinkCard
                key={item.href}
                href={item.href}
                eyebrow="Shortcut"
                title={item.copy.label}
                hint={item.copy.description}
                icon={JUMP_LINK_ICONS[item.key] ?? Settings}
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
            <section key={group.key} className="ui-page-shell overflow-hidden">
              <div className="ui-surface-tint px-5 py-4">
                <h2 className="ui-section-title">{group.label}</h2>
              </div>
              <ul className="divide-y divide-[var(--border-subtle)]">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block px-5 py-4 transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_72%,transparent)]"
                    >
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{item.name}</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.description}</p>
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
