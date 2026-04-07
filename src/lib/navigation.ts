export type WorkspaceRole = "admin" | "editor" | "viewer";

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
    name: "Dashboard",
    href: "/dashboard",
    description: "Portfolio snapshot and personal work.",
    section: "primary",
    icon: "dashboard",
  },
  {
    name: "Review queue",
    href: "/contracts/review",
    description: "Contracts waiting for extraction or field review.",
    section: "primary",
    icon: "review",
    badgeKey: "reviewQueue",
  },
  {
    name: "Contracts",
    href: "/contracts",
    description: "Search and manage the full contract list.",
    section: "primary",
    icon: "contracts",
  },
  {
    name: "Tasks",
    href: "/contracts/tasks",
    description: "Open and triage operational tasks.",
    section: "primary",
    icon: "tasks",
  },
  {
    name: "More tools",
    href: "/more",
    description: "All workflows, reporting, and operational tools.",
    section: "primary",
    icon: "more",
  },
  {
    name: "Renewals",
    href: "/contracts/renewals",
    description: "Track upcoming renewals and notice windows.",
    section: "operations",
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
    description: "Resolve pending approval decisions.",
    section: "operations",
    badgeKey: "approvals",
  },
  {
    name: "Obligations",
    href: "/contracts/obligations",
    description: "Manage open and overdue obligations.",
    section: "operations",
    badgeKey: "obligations",
  },
  {
    name: "Collaboration",
    href: "/contracts/collaboration",
    description: "Notes, mentions, and field-level collaboration.",
    section: "operations",
  },
  {
    name: "Exceptions",
    href: "/contracts/exceptions",
    description: "Investigate stale records and workflow exceptions.",
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
  if (item.minRole === "editor") return role === "admin" || role === "editor";
  return true;
}
