import type { WorkflowArea } from "@/lib/navigation";

/** Same section buckets as the `/more` tools index (product-surface policy Appendix B). */
export const MORE_TOOLS_GROUP_ORDER: WorkflowArea[] = [
  "monitor",
  "workflows",
  "assurance",
  "insights",
  "workspace",
];

/** Jump cards on `/more` when any v6 assurance flag is on (icons stay in the page). */
export const MORE_PAGE_JUMP_LINKS = [
  {
    href: "/contracts/programs",
    title: "Programs",
    hint: "Portfolio programs and operating coverage.",
  },
  {
    href: "/relationship-workspaces",
    title: "Relationships",
    hint: "Account and counterparty jump points.",
  },
  {
    href: "/contracts/maintenance",
    title: "Maintenance",
    hint: "Bulk hygiene and correction tools.",
  },
  {
    href: "/settings",
    title: "Settings",
    hint: "Workspace architecture, members, and policy controls.",
  },
  {
    href: "/settings/health",
    title: "System health",
    hint: "Delivery, webhooks, and worker transparency.",
  },
  {
    href: "/assurance",
    title: "Assurance hub",
    hint: "Findings, policies, and automation control room.",
  },
  {
    href: "/assurance/program-evolution",
    title: "Program evolution",
    hint: "Stage changes with measured impact.",
  },
  {
    href: "/assurance/control-policies",
    title: "Control policies",
    hint: "Published controls and evaluations.",
  },
  {
    href: "/reports#outcome-intelligence",
    title: "Outcome intelligence",
    hint: "Interventions and effectiveness (reports).",
  },
  {
    href: "/reports#assurance-analytics",
    title: "Assurance analytics",
    hint: "Diagnostics and advanced assurance metrics.",
  },
] as const;
