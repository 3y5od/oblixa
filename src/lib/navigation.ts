import type { FeatureFlagKey } from "@/lib/feature-flags";

export type WorkspaceRole =
  | "admin"
  | "editor"
  | "viewer"
  | "ops_manager"
  | "legal_reviewer"
  | "finance_reviewer"
  | "manager";

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
    | "settings"
    | "billing"
    | "more";
  minRole?: WorkspaceRole;
  badgeKey?: "reviewQueue" | "approvals" | "obligations" | "watchlists";
  /**
   * Primary nav: visible when any listed V5 flag is enabled.
   * Omit for items that are always visible (subject to role).
   */
  v5FlagsAnyOf?: FeatureFlagKey[];
  /** §11 IA: compact sub-links under a primary item (sidebar only). */
  navChildren?: { name: string; href: string; v5FlagsAnyOf?: FeatureFlagKey[] }[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    name: "Home",
    href: "/dashboard",
    description: "Role-aware command center for current execution risk.",
    section: "primary",
    icon: "dashboard",
  },
  {
    name: "Contracts",
    href: "/contracts",
    description: "Portfolio contract records, watchlists, and relationship context.",
    section: "primary",
    icon: "contracts",
    navChildren: [
      { name: "All contracts", href: "/contracts" },
      { name: "Review", href: "/contracts/review" },
      { name: "Intake", href: "/contracts/intake" },
      { name: "Watchlists", href: "/contracts/watchlists" },
      {
        name: "Relationship views",
        href: "/relationship-workspaces",
        v5FlagsAnyOf: ["v5RelationshipLayer"],
      },
    ],
  },
  {
    name: "Work",
    href: "/work",
    description: "Unified tasks, blockers, and generated operational actions.",
    section: "primary",
    icon: "tasks",
    navChildren: [
      { name: "Tasks", href: "/contracts/tasks" },
      { name: "Obligations", href: "/contracts/obligations" },
      { name: "Approvals", href: "/contracts/approvals" },
      { name: "Renewals", href: "/contracts/renewals" },
      { name: "Exceptions", href: "/contracts/exceptions" },
      { name: "Evidence", href: "/contracts/evidence-studio" },
    ],
  },
  {
    name: "Decisions",
    href: "/decisions",
    description: "Structured decision workspaces and decision queue.",
    section: "primary",
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
    description: "Portfolio change campaigns with preview and progress.",
    section: "primary",
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
    name: "Relationships",
    href: "/relationship-workspaces",
    description: "Account and counterparty summaries by stable keys.",
    section: "primary",
    v5FlagsAnyOf: ["v5RelationshipLayer"],
  },
  {
    name: "Reports",
    href: "/reports",
    description: "Portfolio analytics, capacity signals, and trends.",
    section: "primary",
    v5FlagsAnyOf: ["v5ControlRoomUx", "v5SimulationAndIntelligence"],
    navChildren: [
      { name: "Report packs", href: "/contracts/reports" },
      { name: "Signals", href: "/reports#portfolio-signals" },
      { name: "Analytics", href: "/reports#portfolio-analytics" },
      { name: "Trends", href: "/reports#campaign-drift" },
      { name: "Capacity", href: "/reports#capacity-forecasts" },
    ],
  },
  {
    name: "More",
    href: "/more",
    description: "Additional tools, maintenance, integrations, and settings.",
    section: "primary",
    icon: "more",
  },
  {
    name: "Review",
    href: "/contracts/review",
    description: "Extraction and field validation queue.",
    section: "operations",
    icon: "review",
    badgeKey: "reviewQueue",
  },
  {
    name: "Intake",
    href: "/contracts/intake",
    description: "Monitor intake queues and throughput.",
    section: "operations",
  },
  {
    name: "Renewals",
    href: "/contracts/renewals",
    description: "Structured renewal workspaces and at-risk signals.",
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
    name: "Exceptions",
    href: "/contracts/exceptions",
    description: "Exception ledger for overdue and policy-risk items.",
    section: "operations",
  },
  {
    name: "Report packs",
    href: "/contracts/reports",
    description: "Operational report packs and trend insights.",
    section: "operations",
  },
  {
    name: "Programs",
    href: "/contracts/programs",
    description: "Manage contract program catalog and versions.",
    section: "operations",
  },
  {
    name: "Execution graph",
    href: "/contracts/execution-graph",
    description: "Cross-work dependency view and blockers.",
    section: "operations",
  },
  {
    name: "Evidence studio",
    href: "/contracts/evidence-studio",
    description: "Evidence templates and export guidance.",
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
    description: "Portfolio trends and operational KPIs.",
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
    name: "Billing",
    href: "/settings/billing",
    description: "Plan, invoices, and subscription health.",
    section: "workspace",
    icon: "billing",
    minRole: "admin",
  },
  {
    name: "Settings",
    href: "/settings",
    description: "Workflow configuration and org preferences.",
    section: "workspace",
    icon: "settings",
  },
  {
    name: "System health",
    href: "/settings/health",
    description: "Delivery retries, cron posture, and operational health.",
    section: "workspace",
    minRole: "admin",
  },
  {
    name: "Policy registry",
    href: "/settings/policy",
    description: "V4 policy registry JSON and governance notes.",
    section: "workspace",
    minRole: "admin",
  },
];

export const CONTRACTS_SUBROUTES = NAV_ITEMS.filter(
  (item) => item.href.startsWith("/contracts/") && item.href !== "/contracts"
).map((item) => item.href);

export function isContractsRoot(pathname: string): boolean {
  if (!pathname.startsWith("/contracts")) return false;
  if (pathname === "/contracts") return true;
  return !CONTRACTS_SUBROUTES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/contracts") return isContractsRoot(pathname);
  if (href === "/settings") return pathname === "/settings";
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
