import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  BellRing,
  Boxes,
  CalendarClock,
  ChevronRight,
  CreditCard,
  FileCheck2,
  Files,
  Filter,
  Gavel,
  GitBranch,
  Grid2x2,
  HeartPulse,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  ListTodo,
  Megaphone,
  Search,
  SearchCheck,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Stamp,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import {
  NAV_ITEMS,
  WORKFLOW_AREA_LABELS,
  getWorkflowAreaForNavItem,
  type NavItem,
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

const NAV_ICON_BY_KEY: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  review: SearchCheck,
  contracts: Files,
  tasks: ListTodo,
  renewals: CalendarClock,
  exceptions: BellRing,
  evidence: FileCheck2,
  reports: BarChart3,
  decisions: BadgeCheck,
  campaigns: Megaphone,
  assurance: Shield,
  relationships: GitBranch,
  programs: Boxes,
  settings: Settings,
  billing: CreditCard,
  more: Grid2x2,
};

const NAV_ICON_BY_HREF: Record<string, LucideIcon> = {
  "/work": ListTodo,
  "/contracts/approvals": Stamp,
  "/contracts/obligations": ListChecks,
  "/contracts/tasks": ListTodo,
  "/contracts/renewals": CalendarClock,
  "/contracts/exceptions": BellRing,
  "/contracts/evidence-studio": FileCheck2,
  "/settings/health": HeartPulse,
  "/settings/policy": Gavel,
  "/settings/security": ShieldCheck,
};

function iconForNavItem(item: NavItem): LucideIcon {
  const byHref = NAV_ICON_BY_HREF[item.href];
  if (byHref) return byHref;
  if (item.icon && NAV_ICON_BY_KEY[item.icon]) return NAV_ICON_BY_KEY[item.icon];
  return Boxes;
}

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
  const filtersActive = Boolean(query || selectedSection);

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
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-1 items-start gap-3.5">
            <span
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
              aria-hidden
            >
              <LayoutGrid className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />
            </span>
            <div className="min-w-0">
              <p>
                <span className="landing-eyebrow-dot text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                  {pageChrome.eyebrow}
                </span>
              </p>
              <h1
                className="mt-1 text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-[2rem]"
                data-page-heading-contract="Tools index"
              >
                {pageChrome.title}
              </h1>
              <p className="mt-1.5 max-w-2xl text-[14px] leading-snug text-[var(--text-secondary)]">
                {pageChrome.lead}
              </p>
            </div>
          </div>
        </header>

        <form
          action="/more"
          method="get"
          role="search"
          aria-label="Filter tools"
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <span
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]"
              aria-hidden
            >
              <Search className="h-4 w-4" />
            </span>
            <input aria-label="Q" type="search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder={pageChrome.searchPlaceholder}
              className="ui-input pl-10 pr-3 text-[12.5px]"
            />
          </div>
          <div className="relative shrink-0 sm:w-52">
            <span
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]"
              aria-hidden
            >
              <Filter className="h-3.5 w-3.5" />
            </span>
            <select
              name="section"
              defaultValue={selectedSection}
              className="ui-input cursor-pointer appearance-none pl-9 pr-8 text-[12.5px]"
            >
              <option value="">All sections</option>
              <option value="monitor">Monitor</option>
              <option value="workflows">Workflows</option>
              <option value="assurance">Assurance</option>
              <option value="insights">Insights</option>
              <option value="workspace">Workspace</option>
            </select>
            <span
              className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-tertiary)]"
              aria-hidden
            >
              <ChevronRight className="h-3.5 w-3.5 rotate-90" />
            </span>
          </div>
          <button
            type="submit"
            className="ui-btn-secondary inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px]"
          >
            Apply filters
          </button>
          {filtersActive ? (
            <Link
              href="/more"
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_42%,transparent)] hover:text-[var(--accent-strong)]"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      {jumpLinks.length > 0 ? (
        <section data-testid={surfaceTestIds.moreJumpPoints} aria-labelledby="more-shortcuts-heading">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <div>
              <p>
                <span className="landing-eyebrow-dot text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                  Shortcuts
                </span>
              </p>
              <h2
                id="more-shortcuts-heading"
                className="mt-1 text-[1.25rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]"
              >
                {pageChrome.shortcutHeading}
              </h2>
            </div>
            <p className="text-[12.5px] leading-snug text-[var(--text-tertiary)]">
              Contextual shortcuts for your workspace.
            </p>
          </header>
          <div
            className={`grid gap-3 ${
              jumpLinks.length === 1
                ? "grid-cols-1"
                : jumpLinks.length === 2
                  ? "sm:grid-cols-2"
                  : "sm:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {jumpLinks.map((item) => (
              <OperationalSurfaceLinkCard
                key={item.href}
                href={item.href}
                eyebrow="Shortcut"
                title={item.copy.label}
                hint={item.copy.description}
                icon={JUMP_LINK_ICONS[item.key] ?? Settings}
                tone="neutral"
                variant={jumpLinks.length === 1 ? "hero" : "default"}
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
        <section aria-labelledby="more-destinations-heading">
          <header className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <div>
              <p>
                <span className="landing-eyebrow-dot text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                  Index
                </span>
              </p>
              <h2
                id="more-destinations-heading"
                className="mt-1 text-[1.25rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]"
              >
                All destinations
              </h2>
            </div>
            <p className="text-[12.5px] leading-snug text-[var(--text-tertiary)]">
              {groups.reduce((total, group) => total + group.items.length, 0)} surfaces ·{" "}
              {groups.length} {groups.length === 1 ? "category" : "categories"}
            </p>
          </header>
          <div className="grid gap-x-8 gap-y-8 xl:grid-cols-3">
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`more-group-${group.key}`}>
                <header className="mb-2 flex items-baseline gap-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] pb-2.5">
                  <h3
                    id={`more-group-${group.key}`}
                    className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]"
                  >
                    {group.label}
                  </h3>
                  <span className="ml-auto font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
                    {group.items.length}
                  </span>
                </header>
                <ul className="flex flex-col">
                  {group.items.map((item) => {
                    const Icon = iconForNavItem(item);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="group -mx-2 flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,transparent)]"
                        >
                          <span
                            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[color:var(--surface-tint)] text-[var(--text-secondary)] transition-colors group-hover:border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] group-hover:bg-[var(--surface-raised)] group-hover:text-[var(--accent-strong)]"
                            aria-hidden
                          >
                            <Icon className="h-4 w-4" strokeWidth={1.85} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
                              {item.name}
                            </p>
                            <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--text-secondary)]">
                              {item.description}
                            </p>
                          </div>
                          <ArrowUpRight
                            className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--accent-strong)] group-hover:opacity-100"
                            aria-hidden
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
