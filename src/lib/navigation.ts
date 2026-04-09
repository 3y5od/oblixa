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
    description: "Search and manage contract records and ownership.",
    section: "primary",
    icon: "contracts",
  },
  {
    name: "Review",
    href: "/contracts/review",
    description: "Extraction and field validation queue.",
    section: "primary",
    icon: "review",
    badgeKey: "reviewQueue",
  },
  {
    name: "Work",
    href: "/work",
    description: "Unified tasks, blockers, and generated operational actions.",
    section: "primary",
    icon: "tasks",
  },
  {
    name: "Renewals",
    href: "/contracts/renewals",
    description: "Structured renewal workspaces and at-risk signals.",
    section: "primary",
  },
  {
    name: "Approvals",
    href: "/contracts/approvals",
    description: "SLA-governed approvals and escalation bottlenecks.",
    section: "primary",
    badgeKey: "approvals",
  },
  {
    name: "Obligations",
    href: "/contracts/obligations",
    description: "Due obligations, ownership, and evidence status.",
    section: "primary",
    badgeKey: "obligations",
  },
  {
    name: "Exceptions",
    href: "/contracts/exceptions",
    description: "Exception ledger for overdue and policy-risk items.",
    section: "primary",
  },
  {
    name: "Reports",
    href: "/contracts/reports",
    description: "Operational report packs and trend insights.",
    section: "primary",
  },
  {
    name: "More",
    href: "/more",
    description: "Additional tools, maintenance, integrations, and settings.",
    section: "primary",
    icon: "more",
  },
  {
    name: "Intake",
    href: "/contracts/intake",
    description: "Monitor intake queues and throughput.",
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
