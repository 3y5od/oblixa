import type { WorkflowArea } from "@/lib/navigation";

/** Same section buckets as the `/more` tools index (docs/refinement.md Appendix B). */
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
    actionLabel: "View programs",
  },
  {
    href: "/relationship-workspaces",
    title: "Relationships",
    hint: "Account and counterparty jump points.",
    actionLabel: "Open relationships",
  },
  {
    href: "/contracts/maintenance",
    title: "Maintenance",
    hint: "Bulk hygiene and correction tools.",
    actionLabel: "Open maintenance",
  },
  {
    href: "/settings",
    title: "Settings",
    hint: "Workspace profile, members, and policy.",
    actionLabel: "Open settings",
  },
  {
    href: "/settings/health",
    title: "System health",
    hint: "Delivery, webhooks, and worker transparency.",
    actionLabel: "View health",
  },
  {
    href: "/assurance",
    title: "Assurance hub",
    hint: "Findings, policies, and automation entry.",
    actionLabel: "Open assurance",
  },
  {
    href: "/assurance/program-evolution",
    title: "Program evolution",
    hint: "Stage changes with measured impact.",
    actionLabel: "View evolution",
  },
  {
    href: "/assurance/control-policies",
    title: "Control policies",
    hint: "Published controls and evaluations.",
    actionLabel: "View policies",
  },
  {
    href: "/reports#outcome-intelligence",
    title: "Outcome intelligence",
    hint: "Interventions and effectiveness (reports).",
    actionLabel: "Open reports section",
  },
  {
    href: "/reports#assurance-analytics",
    title: "Assurance analytics",
    hint: "Diagnostics and advanced assurance metrics.",
    actionLabel: "Open reports section",
  },
] as const;
