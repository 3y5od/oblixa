import type { FeatureFlagKey } from "@/lib/feature-flags";

/** Core-first navigation registry; release-state public Core exposes seven primary app surfaces. */

export type WorkspaceRole =
  | "admin"
  | "editor"
  | "viewer"
  | "ops_manager"
  | "legal_reviewer"
  | "finance_reviewer"
  | "manager";

/** Public taxonomy buckets surfaced in the search UI (overlay + /search page).
 *  Matches the placeholder copy "Search pages, queues, reports, tools" so the
 *  user-visible language stays aligned with the input prompt. */
export type SearchGroup = "pages" | "queues" | "reports" | "tools";

export const SEARCH_GROUP_LABELS: Record<SearchGroup, string> = {
  pages: "Pages",
  queues: "Queues",
  reports: "Reports",
  tools: "Tools",
};

/** Render order for search groups. Page-level destinations first, then work
 *  queues, then reporting, then settings/admin tools. */
export const SEARCH_GROUP_ORDER: SearchGroup[] = ["pages", "queues", "reports", "tools"];

export type NavItem = {
  name: string;
  href: string;
  description: string;
  section: "primary" | "operations" | "personal" | "workspace";
  icon?:
    | "dashboard"
    | "review"
    | "contracts"
    | "tasks"
    | "renewals"
    | "exceptions"
    | "evidence"
    | "reports"
    | "decisions"
    | "campaigns"
    | "assurance"
    | "relationships"
    | "programs"
    | "settings"
    | "billing"
    | "more"
    // Per-destination icons for cmd-K extras + finer settings differentiation.
    // Mapped in `src/components/search/nav-icon.tsx`.
    | "profile"
    | "workspace-identity"
    | "team"
    | "imports"
    | "security-account"
    | "notifications"
    | "export"
    | "review-fields";
  minRole?: WorkspaceRole;
  badgeKey?: "reviewQueue" | "approvals" | "obligations" | "watchlists";
  /**
   * Primary nav: visible when any listed V5 flag is enabled.
   * Omit for items that are always visible (subject to role).
   */
  v5FlagsAnyOf?: FeatureFlagKey[];
  /** Information architecture: compact sub-links under a primary item (sidebar only). */
  navChildren?: {
    name: string;
    href: string;
    /** Per-child description shown in search results. Must NOT be inherited
     *  from the parent — search results would otherwise show identical copy
     *  on parent + child rows. */
    description?: string;
    v5FlagsAnyOf?: FeatureFlagKey[];
    badgeKey?: "reviewQueue" | "approvals" | "obligations" | "watchlists";
    /** Synonyms used by the search matcher in addition to name/description. */
    searchSynonyms?: readonly string[];
    /** Search group override for the child (otherwise inherits parent). */
    searchGroup?: SearchGroup;
    /** Per-child icon override. Without this, navChildren would inherit the
     *  parent's icon (e.g., "Review fields" would show the Contracts icon),
     *  which collapses visual distinction in search results. */
    icon?: NonNullable<NavItem["icon"]>;
  }[];
  /** Public-taxonomy search bucket. Defaults derived in
   *  `resolveSearchGroupForNavItem()` so every NavItem maps to exactly one. */
  searchGroup?: SearchGroup;
  /** Optional sub-bucket inside the search group (e.g. Tools → account /
   *  workspace / operations). Renders as a hairline-divided subgroup
   *  within a single group card. V2 search pass T1.2. */
  searchSubgroup?: "account" | "workspace" | "operations";
  /** Synonyms used by the search matcher in addition to name + description.
   *  Lower-case, no punctuation; matched as substring tokens. */
  searchSynonyms?: readonly string[];
};

export type WorkflowArea =
  | "monitor"
  | "workflows"
  | "assurance"
  | "insights"
  | "workspace";

export const WORKFLOW_AREA_LABELS: Record<WorkflowArea, string> = {
  monitor: "Monitor",
  workflows: "Workflows",
  assurance: "Assurance",
  insights: "Insights",
  workspace: "Workspace",
};

export const PRIMARY_NAV_GROUPS: ReadonlyArray<{
  label: string;
  hrefs: readonly string[];
}> = [
  {
    label: "Workspace",
    hrefs: [
      "/dashboard",
      "/contracts",
      "/work",
      "/contracts/renewals",
      "/contracts/evidence-studio",
      "/reports",
      "/settings",
    ],
  },
  { label: "Advanced", hrefs: ["/decisions", "/campaigns", "/contracts/programs", "/relationship-workspaces"] },
  { label: "Assurance", hrefs: ["/assurance"] },
  { label: "Tools", hrefs: ["/more"] },
];

export const NAV_ITEMS: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    description: "What needs action, what is due, and what you own.",
    section: "primary",
    icon: "dashboard",
    searchGroup: "pages",
    searchSynonyms: ["home", "overview"],
  },
  {
    name: "Contracts",
    href: "/contracts",
    description: "Every contract you've added, with renewal and notice dates.",
    section: "primary",
    icon: "contracts",
    searchGroup: "pages",
    searchSynonyms: ["contract", "agreement", "agreements", "inventory"],
    navChildren: [
      {
        name: "All contracts",
        href: "/contracts",
        description: "Every contract in the workspace with filters and search.",
      },
      {
        name: "Review fields",
        href: "/contracts/review",
        description: "Pending field approvals on extracted contract data.",
        badgeKey: "reviewQueue",
        searchGroup: "queues",
        searchSynonyms: ["review", "approve", "approval", "fields", "extraction"],
        icon: "review-fields",
      },
    ],
  },
  /**
   * Release-state Work is one top-level surface. Its tabs live inside /work,
   * not as public Core sidebar lanes.
   */
  {
    name: "Work",
    href: "/work",
    description: "Tasks, approvals, obligations, and exceptions.",
    section: "primary",
    icon: "tasks",
    searchGroup: "queues",
    searchSynonyms: ["tasks", "approvals", "obligations", "queue"],
    navChildren: [],
  },
  {
    name: "Renewals",
    href: "/contracts/renewals",
    description: "Upcoming renewal and notice dates.",
    section: "primary",
    icon: "renewals",
    searchGroup: "pages",
    searchSynonyms: ["renew", "renewal", "rollover", "notice", "deadline"],
  },
  {
    name: "Evidence",
    href: "/contracts/evidence-studio",
    description: "Evidence requests, collection, and audit trail.",
    section: "primary",
    icon: "evidence",
    searchGroup: "queues",
    searchSynonyms: ["evidence", "proof", "audit", "documents"],
  },
  {
    name: "Decisions",
    href: "/decisions",
    description: "Decision workspaces and queue.",
    section: "primary",
    icon: "decisions",
    v5FlagsAnyOf: ["v5DecisionFoundation"],
    navChildren: [
      { name: "Decision queue", href: "/decisions?queue=active" },
      {
        name: "Manager review",
        href: "/decisions/review",
        v5FlagsAnyOf: ["v5ControlRoomUx"],
      },
      {
        name: "Compare",
        href: "/decisions/compare",
        v5FlagsAnyOf: ["v5ControlRoomUx"],
      },
      { name: "Renewals", href: "/decisions?type=renewal" },
      { name: "Amendments", href: "/decisions?type=amendment_request" },
      { name: "Waivers", href: "/decisions?type=waiver_exception" },
      { name: "Policy", href: "/decisions?type=policy_exception" },
    ],
  },
  {
    name: "Campaigns",
    href: "/campaigns",
    description: "Change campaigns with preview and progress.",
    section: "primary",
    icon: "campaigns",
    v5FlagsAnyOf: ["v5PortfolioCampaigns"],
    navChildren: [
      { name: "Active", href: "/campaigns?status=active" },
      { name: "History", href: "/campaigns?status=closed" },
      { name: "Remediation", href: "/campaigns?type=remediation_push" },
      { name: "Compare", href: "/campaigns/compare" },
      { name: "Simulations", href: "/campaigns#simulations" },
    ],
  },
  {
    name: "Assurance",
    href: "/assurance",
    description: "Findings, controls, scorecards, and playbooks.",
    section: "primary",
    icon: "assurance",
    v5FlagsAnyOf: [
      "v6AssuranceCore",
      "v6ControlPolicies",
      "v6AdaptivePlaybooks",
      "v6ReviewBoards",
      "v6Autopilot",
      "v6Segments",
    ],
    /** Order follows product-surface policy §7.3 */
    navChildren: [
      { name: "Findings", href: "/assurance/findings", v5FlagsAnyOf: ["v6AssuranceCore"] },
      { name: "Control policies", href: "/assurance/control-policies", v5FlagsAnyOf: ["v6ControlPolicies"] },
      { name: "Scorecards", href: "/assurance/scorecards", v5FlagsAnyOf: ["v6AssuranceCore"] },
      { name: "Playbooks", href: "/assurance/playbooks", v5FlagsAnyOf: ["v6AdaptivePlaybooks"] },
      { name: "Review boards", href: "/assurance/review-boards", v5FlagsAnyOf: ["v6ReviewBoards"] },
      { name: "Autopilot", href: "/assurance/autopilot", v5FlagsAnyOf: ["v6Autopilot"] },
      { name: "Segments", href: "/assurance/segments", v5FlagsAnyOf: ["v6Segments"] },
      {
        name: "Program evolution",
        href: "/assurance/program-evolution",
        v5FlagsAnyOf: ["v6AssuranceCore"],
      },
      { name: "Health graph", href: "/assurance/health-graph", v5FlagsAnyOf: ["v6AssuranceCore"] },
    ],
  },
  {
    name: "Relationships",
    href: "/relationship-workspaces",
    description: "Account and counterparty summaries by stable keys.",
    section: "primary",
    icon: "relationships",
    v5FlagsAnyOf: ["v5RelationshipLayer"],
  },
  {
    name: "Reports",
    href: "/reports",
    description: "Operational reports and exports.",
    section: "primary",
    icon: "reports",
    searchGroup: "reports",
    searchSynonyms: ["report", "export", "csv", "inventory"],
  },
  {
    name: "Tools",
    href: "/more",
    description: "Secondary tools, maintenance, and admin-only destinations.",
    section: "primary",
    icon: "more",
    searchGroup: "tools",
    searchSynonyms: ["more", "admin", "utility", "utilities"],
  },
  {
    name: "Intake",
    href: "/contracts/intake",
    description: "Monitor intake queues and throughput.",
    section: "operations",
  },
  {
    name: "Approvals",
    href: "/contracts/approvals",
    description: "SLA-governed approvals and escalation bottlenecks.",
    section: "operations",
    badgeKey: "approvals",
  },
  {
    name: "Obligations",
    href: "/contracts/obligations",
    description: "Due obligations, ownership, and evidence status.",
    section: "operations",
    badgeKey: "obligations",
  },
  {
    name: "Programs",
    href: "/contracts/programs",
    description: "Manage contract program catalog and versions.",
    section: "primary",
    icon: "programs",
  },
  {
    name: "Execution graph",
    href: "/contracts/execution-graph",
    description: "Cross-work dependency view and blockers.",
    section: "operations",
  },
  {
    name: "Collaboration",
    href: "/contracts/collaboration",
    description: "Notes, mentions, and field-level collaboration.",
    section: "operations",
  },
  {
    name: "Review cadence",
    href: "/contracts/review-cadence",
    description: "Weekly and monthly review ritual workspace.",
    section: "operations",
  },
  {
    name: "Analytics",
    href: "/contracts/analytics",
    description: "Contract trends and operational KPIs.",
    section: "operations",
  },
  {
    name: "Data quality",
    href: "/contracts/data-quality",
    description: "Completeness, lineage confidence, and remediation targets.",
    section: "operations",
  },
  {
    name: "Maintenance",
    href: "/contracts/maintenance",
    description: "Data hygiene and cleanup operations.",
    section: "operations",
  },
  {
    name: "Watchlists",
    href: "/contracts/watchlists",
    description: "Contracts you explicitly monitor.",
    section: "personal",
    badgeKey: "watchlists",
  },
  {
    name: "Persona dashboard",
    href: "/dashboard/persona",
    description: "Role-specific dashboard views.",
    section: "personal",
  },
  {
    name: "Settings",
    href: "/settings",
    description: "Profile, workspace, team, billing, notifications, security, and export settings.",
    section: "primary",
    icon: "settings",
    searchGroup: "tools",
    searchSynonyms: ["settings", "preferences", "config", "configuration"],
  },
];

/** Resolve the search bucket for a NavItem. Explicit `searchGroup` wins;
 *  otherwise fall back to a workflow-area-based default mapping. */
export function resolveSearchGroupForNavItem(item: { searchGroup?: SearchGroup; href: string; section?: NavItem["section"] }): SearchGroup {
  if (item.searchGroup) return item.searchGroup;
  const path = item.href.split("?")[0]?.split("#")[0] ?? item.href;
  if (path === "/reports" || path.startsWith("/reports/") || path.startsWith("/contracts/reports")) return "reports";
  if (
    path === "/work" ||
    path.startsWith("/work/") ||
    path === "/contracts/review" ||
    path === "/contracts/approvals" ||
    path === "/contracts/obligations" ||
    path === "/contracts/exceptions" ||
    path === "/contracts/tasks" ||
    path === "/contracts/evidence-studio"
  ) {
    return "queues";
  }
  if (path === "/more" || path.startsWith("/settings") || path === "/contracts/bulk") return "tools";
  return "pages";
}

// Routes that remain live but are not surfaced as public Core sidebar lanes.
// Keep them in the subroutes set so isContractsRoot() still distinguishes
// them from the contracts inventory root.
const ADDITIONAL_CONTRACTS_SUBROUTES = [
  "/contracts/bulk",
  "/contracts/reports",
  "/contracts/tasks",
  "/contracts/exceptions",
];

export const CONTRACTS_SUBROUTES = Array.from(
  new Set([
    ...NAV_ITEMS.flatMap((item) => [
      item.href,
      ...(item.navChildren ?? []).map((child) => child.href),
    ])
      .map((href) => href.split("?")[0] ?? href)
      .filter((href) => href.startsWith("/contracts/") && href !== "/contracts"),
    ...ADDITIONAL_CONTRACTS_SUBROUTES,
  ])
);

export function isContractsRoot(pathname: string): boolean {
  if (!pathname.startsWith("/contracts")) return false;
  if (pathname === "/contracts") return true;
  return !CONTRACTS_SUBROUTES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/contracts") return isContractsRoot(pathname);
  if (href === "/settings") return pathname === "/settings" || pathname.startsWith("/settings/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function canAccessItem(item: NavItem, role: WorkspaceRole): boolean {
  if (!item.minRole) return true;
  if (item.minRole === "admin") return role === "admin";
  if (item.minRole === "editor") {
    return (
      role === "admin" ||
      role === "editor" ||
      role === "ops_manager" ||
      role === "manager"
    );
  }
  return true;
}

export function isV5NavItemVisible(
  item: NavItem,
  v5Flags: Record<FeatureFlagKey, boolean>
): boolean {
  if (!item.v5FlagsAnyOf?.length) return true;
  return item.v5FlagsAnyOf.some((k) => v5Flags[k]);
}

export function isV5NavChildVisible(
  child: { v5FlagsAnyOf?: FeatureFlagKey[] },
  v5Flags: Record<FeatureFlagKey, boolean>
): boolean {
  if (!child.v5FlagsAnyOf?.length) return true;
  return child.v5FlagsAnyOf.some((k) => v5Flags[k]);
}

export function getWorkflowAreaForNavItem(item: NavItem): WorkflowArea {
  if (
    item.href === "/dashboard" ||
    item.href === "/dashboard/persona"
  ) {
    return "monitor";
  }
  if (
    item.href.startsWith("/assurance") ||
    item.href.startsWith("/api/assurance")
  ) {
    return "assurance";
  }
  if (
    item.href === "/reports" ||
    item.href === "/contracts/reports" ||
    item.href.startsWith("/reports#")
  ) {
    return "insights";
  }
  if (
    item.href.startsWith("/settings") ||
    item.section === "workspace" ||
    item.href === "/more"
  ) {
    return "workspace";
  }
  return "workflows";
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { isV5NavChildVisible as isNavChildVisible };
export { isV5NavItemVisible as isNavItemVisible };
// End version-name compatibility aliases.
