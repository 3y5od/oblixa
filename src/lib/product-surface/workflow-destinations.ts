import type { FeatureFlagKey } from "@/lib/feature-flags";
import type { FeatureFamilyKey } from "@/lib/product-surface/feature-registry";
import type {
  AdvancedNavModuleKey,
  AssuranceNavModuleKey,
  ProductSearchScope,
  UtilityModuleKey,
  WorkspaceProductMode,
} from "@/lib/product-surface/types";

export type WorkflowDestinationPlacement =
  | "primary"
  | "nav_child"
  | "dashboard_card"
  | "hub_card"
  | "more_card"
  | "cmdk"
  | "contextual"
  | "admin_contextual"
  | "tools_only"
  | "deep_link_only"
  | "disabled_hint"
  | "hidden"
  | "suppressed";

export type WorkflowDestinationKey =
  | "home"
  | "contracts"
  | "review"
  | "work"
  | "tasks"
  | "obligations"
  | "approvals"
  | "renewals"
  | "exceptions"
  | "evidence"
  | "reports"
  | "contract_report_packs"
  | "settings"
  | "new_contract"
  | "bulk_import"
  | "calendar_export"
  | "decisions"
  | "campaigns"
  | "programs"
  | "relationships"
  | "advanced_analytics"
  | "maintenance"
  | "collaboration"
  | "compare_views"
  | "review_cadence"
  | "watchlists"
  | "execution_graph"
  | "approval_workload"
  | "approval_sla_simulator"
  | "assurance"
  | "findings"
  | "control_policies"
  | "scorecards"
  | "playbooks"
  | "autopilot"
  | "review_boards"
  | "segments"
  | "program_evolution"
  | "health_graph"
  | "outcome_intelligence"
  | "assurance_analytics"
  | "review_packets"
  | "more_tools"
  | "security_settings"
  | "system_health"
  | "operations_settings"
  | "product_settings"
  | "policy_settings"
  | "billing";

export type WorkflowAreaKey = "monitor" | "workflows" | "assurance" | "insights" | "workspace";

export type WorkflowDestinationCopy = {
  label: string;
  shortLabel?: string;
  description: string;
  headerTitle?: string;
  headerLead?: string;
  emptyTitle?: string;
  emptyCopy?: string;
  ctaLabel?: string;
};

export type WorkflowDestinationDef = {
  key: WorkflowDestinationKey;
  href: string;
  featureFamily: FeatureFamilyKey;
  workflowArea: WorkflowAreaKey;
  minWorkspaceMode: WorkspaceProductMode;
  advancedModuleKey?: AdvancedNavModuleKey;
  assuranceModuleKey?: AssuranceNavModuleKey;
  utilityModuleKey?: UtilityModuleKey;
  featureFlagsAnyOf?: readonly FeatureFlagKey[];
  placementsByMode: Record<WorkspaceProductMode, readonly WorkflowDestinationPlacement[]>;
  copyByMode: Record<WorkspaceProductMode, WorkflowDestinationCopy>;
  aliases?: readonly string[];
};

export type WorkflowDestinationSurface = {
  mode: WorkspaceProductMode;
  role?: string;
  featureFlags?: Partial<Record<FeatureFlagKey, boolean>>;
  advancedModulesHidden?: readonly AdvancedNavModuleKey[] | ReadonlySet<AdvancedNavModuleKey>;
  assuranceModulesHidden?: readonly AssuranceNavModuleKey[] | ReadonlySet<AssuranceNavModuleKey>;
  utilityModulesHidden?: readonly UtilityModuleKey[] | ReadonlySet<UtilityModuleKey>;
  searchScope?: ProductSearchScope;
  seesAdvancedPrimaryNav?: boolean;
  seesAssuranceNav?: boolean;
};

export type WorkflowDestinationSuppressionReason =
  | "mode"
  | "feature_flag"
  | "advanced_module_hidden"
  | "assurance_module_hidden"
  | "utility_module_hidden"
  | "search_scope";

export type ResolvedWorkflowDestination =
  | {
      visible: true;
      key: WorkflowDestinationKey;
      href: string;
      featureFamily: FeatureFamilyKey;
      workflowArea: WorkflowAreaKey;
      placements: readonly WorkflowDestinationPlacement[];
      copy: WorkflowDestinationCopy;
    }
  | {
      visible: false;
      key: WorkflowDestinationKey;
      href: string;
      featureFamily: FeatureFamilyKey;
      reason: WorkflowDestinationSuppressionReason;
    };

export type WorkflowDestinationManifestEntry = {
  key: WorkflowDestinationKey;
  href: string;
  featureFamily: FeatureFamilyKey;
  workflowArea: WorkflowAreaKey;
  label: string;
  description: string;
  placements: readonly WorkflowDestinationPlacement[];
};

const MODE_RANK: Record<WorkspaceProductMode, number> = {
  core: 0,
  advanced: 1,
  assurance: 2,
};

const CORE_COPY = {
  home: ["Dashboard", "What needs attention now.", "Dashboard", "What needs attention now."],
  contracts: ["Contracts", "Find, upload, and manage contracts.", "Contracts", "Find, upload, and manage contracts."],
  review: ["Review", "Review extracted fields before work depends on them.", "Review", "Open review"],
  work: ["Work", "Tasks, approvals, obligations, and blockers assigned to you.", "Work", "Open assigned work."],
  tasks: ["Tasks", "Team follow-up with ownership, urgency, and status.", "Tasks", "Open tasks."],
  obligations: ["Obligations", "Operational commitments, due dates, owners, and evidence status.", "Obligations", "Open obligations."],
  approvals: ["Approvals", "Pending approvals, due dates, and bottlenecks.", "Approvals", "Open approvals."],
  renewals: ["Renewals", "Upcoming renewals and required follow-up.", "Renewals", "Open renewals."],
  exceptions: ["Exceptions", "Open contract issues that need owner action.", "Exceptions", "Open issues."],
  evidence: ["Evidence", "Evidence requests and submitted proof.", "Evidence", "Open evidence."],
  reports: ["Reports", "Standard reports and exports.", "Reports", "Open reports."],
  contract_report_packs: ["Report packs", "Standard contract report packs and export history.", "Report packs", "Open report packs."],
  settings: [
    "Settings",
    "Manage workspace, team, billing, notifications, security, and export settings.",
    "Settings",
    "Open settings.",
  ],
} as const;

function copy(label: string, description: string, ctaLabel?: string): WorkflowDestinationCopy {
  return {
    label,
    shortLabel: label,
    description,
    headerTitle: label,
    headerLead: description,
    emptyTitle: `No ${label.toLowerCase()} yet`,
    emptyCopy: description,
    ctaLabel: ctaLabel ?? `Open ${label.toLowerCase()}`,
  };
}

function coreCopy(key: keyof typeof CORE_COPY): WorkflowDestinationCopy {
  const [label, description, shortLabel, ctaLabel] = CORE_COPY[key];
  return { ...copy(label, description, ctaLabel), shortLabel };
}

function copies(
  core: WorkflowDestinationCopy,
  advanced = core,
  assurance = advanced
): Record<WorkspaceProductMode, WorkflowDestinationCopy> {
  return { core, advanced, assurance };
}

function placements(
  core: readonly WorkflowDestinationPlacement[],
  advanced = core,
  assurance = advanced
): Record<WorkspaceProductMode, readonly WorkflowDestinationPlacement[]> {
  return { core, advanced, assurance };
}

export const WORKFLOW_DESTINATIONS = [
  {
    key: "home",
    href: "/dashboard",
    featureFamily: "contracts",
    workflowArea: "monitor",
    minWorkspaceMode: "core",
    placementsByMode: placements(["primary", "cmdk"]),
    copyByMode: copies(coreCopy("home")),
  },
  {
    key: "contracts",
    href: "/contracts",
    featureFamily: "contracts",
    workflowArea: "workflows",
    minWorkspaceMode: "core",
    placementsByMode: placements(["primary", "cmdk", "dashboard_card"]),
    copyByMode: copies(
      coreCopy("contracts"),
      copy("Contracts", "Manage contracts across programs, decisions, and relationships.", "Open contracts"),
      copy("Contracts", "Use contracts, evidence, and control context together.", "Open contracts")
    ),
  },
  {
    key: "review",
    href: "/contracts/review",
    featureFamily: "review",
    workflowArea: "workflows",
    minWorkspaceMode: "core",
    placementsByMode: placements(["primary", "nav_child", "cmdk", "dashboard_card"]),
    copyByMode: copies(
      coreCopy("review"),
      copy("Review", "Keep extraction review aligned with programs and decisions.", "Open review"),
      copy("Review", "Validate fields that affect evidence, findings, and controls.", "Open review")
    ),
  },
  {
    key: "work",
    href: "/work",
    featureFamily: "work",
    workflowArea: "workflows",
    minWorkspaceMode: "core",
    placementsByMode: placements(["primary", "cmdk", "dashboard_card"]),
    copyByMode: copies(
      coreCopy("work"),
      copy("Work", "Coordinate execution across owners, decisions, and campaigns.", "Open work"),
      copy("Work", "Route execution into findings, controls, and remediation.", "Open work")
    ),
  },
  {
    key: "tasks",
    href: "/contracts/tasks",
    featureFamily: "work",
    workflowArea: "workflows",
    minWorkspaceMode: "core",
    placementsByMode: placements(["nav_child", "cmdk", "contextual"]),
    copyByMode: copies(coreCopy("tasks")),
  },
  {
    key: "obligations",
    href: "/contracts/obligations",
    featureFamily: "work",
    workflowArea: "workflows",
    minWorkspaceMode: "core",
    placementsByMode: placements(["nav_child", "cmdk", "contextual"]),
    copyByMode: copies(
      coreCopy("obligations"),
      copy("Obligations", "Commitments, owners, and evidence status across programs.", "Open obligations"),
      copy("Obligations", "Commitments with evidence coverage, control impact, and findings risk.", "Open obligations")
    ),
  },
  {
    key: "approvals",
    href: "/contracts/approvals",
    featureFamily: "work",
    workflowArea: "workflows",
    minWorkspaceMode: "core",
    placementsByMode: placements(["nav_child", "cmdk", "contextual"]),
    copyByMode: copies(
      coreCopy("approvals"),
      copy("Approvals", "SLA pressure, workload, and decision bottlenecks.", "Open approvals"),
      copy("Approvals", "Approvals for controls, remediation, review boards, and execution gates.", "Open approvals")
    ),
  },
  {
    key: "renewals",
    href: "/contracts/renewals",
    featureFamily: "renewals",
    workflowArea: "workflows",
    minWorkspaceMode: "core",
    placementsByMode: placements(["primary", "nav_child", "cmdk", "dashboard_card"]),
    copyByMode: copies(
      coreCopy("renewals"),
      copy("Renewals", "Coordinate renewal decisions, campaigns, and relationship follow-up.", "Open renewals"),
      copy("Renewals", "Check renewal risk, evidence readiness, and control impact.", "Open renewals")
    ),
  },
  {
    key: "exceptions",
    href: "/contracts/exceptions",
    featureFamily: "exceptions",
    workflowArea: "workflows",
    minWorkspaceMode: "core",
    placementsByMode: placements(["primary", "nav_child", "cmdk", "dashboard_card"]),
    copyByMode: copies(
      coreCopy("exceptions"),
      copy("Exceptions", "Escalate issues into decisions, campaigns, or programs.", "Open exceptions"),
      copy("Exceptions", "Convert material issues into findings or control review.", "Open exceptions")
    ),
  },
  {
    key: "evidence",
    href: "/contracts/evidence-studio",
    featureFamily: "evidence",
    workflowArea: "workflows",
    minWorkspaceMode: "core",
    placementsByMode: placements(["nav_child", "cmdk", "contextual"], ["cmdk", "contextual", "tools_only"]),
    copyByMode: copies(
      coreCopy("evidence"),
      copy("Evidence", "Coordinate evidence across programs and counterparties.", "Open evidence"),
      copy("Evidence", "Tie evidence to controls, findings, attestations, and review packets.", "Open evidence")
    ),
  },
  {
    key: "reports",
    href: "/reports",
    featureFamily: "reports",
    workflowArea: "insights",
    minWorkspaceMode: "core",
    placementsByMode: placements(["primary", "cmdk", "dashboard_card"]),
    copyByMode: copies(
      coreCopy("reports"),
      copy("Reports", "Portfolio analytics, campaign drift, and capacity forecasts.", "Open reports"),
      copy("Reports", "Assurance analytics, outcomes, scorecards, and review packets.", "Open reports")
    ),
  },
  {
    key: "contract_report_packs",
    href: "/contracts/reports",
    featureFamily: "reports",
    workflowArea: "insights",
    minWorkspaceMode: "core",
    placementsByMode: placements(["nav_child", "cmdk", "contextual"]),
    copyByMode: copies(coreCopy("contract_report_packs")),
  },
  {
    key: "settings",
    href: "/settings",
    featureFamily: "settings",
    workflowArea: "workspace",
    minWorkspaceMode: "core",
    placementsByMode: placements(["primary", "cmdk"]),
    copyByMode: copies(
      coreCopy("settings"),
      copy("Settings", "Workspace, team, billing, notifications, security, and export settings.", "Open settings"),
      copy("Settings", "Workspace, team, billing, notifications, security, and export settings.", "Open settings")
    ),
  },
  {
    key: "new_contract",
    href: "/contracts/new",
    featureFamily: "contracts",
    workflowArea: "workflows",
    minWorkspaceMode: "core",
    placementsByMode: placements(["contextual", "cmdk"]),
    copyByMode: copies(copy("Upload contract", "Upload a contract and review extracted fields.", "Upload contract")),
  },
  {
    key: "bulk_import",
    href: "/contracts/bulk",
    featureFamily: "contracts",
    workflowArea: "workflows",
    minWorkspaceMode: "core",
    placementsByMode: placements(["contextual", "cmdk"]),
    copyByMode: copies(copy("Bulk import", "Import multiple contracts and route them to review.", "Bulk import")),
  },
  {
    key: "calendar_export",
    href: "/api/export/calendar/feed",
    featureFamily: "reports",
    workflowArea: "insights",
    minWorkspaceMode: "core",
    placementsByMode: placements(["contextual"]),
    copyByMode: copies(copy("Calendar feed", "Export eligible contract dates to a calendar feed.", "Open calendar feed")),
  },
  {
    key: "decisions",
    href: "/decisions",
    featureFamily: "decisions",
    workflowArea: "workflows",
    minWorkspaceMode: "advanced",
    advancedModuleKey: "decisions",
    featureFlagsAnyOf: ["v5DecisionFoundation"],
    placementsByMode: placements(["hidden"], ["primary", "cmdk", "dashboard_card"], ["primary", "cmdk", "dashboard_card"]),
    copyByMode: copies(
      copy("Decision handoff", "Decision paths are available in Advanced workspaces.", "Open decisions"),
      copy("Decisions", "Coordinate recorded decision paths across renewals, exceptions, and amendments.", "Open decisions"),
      copy("Decisions", "Connect decisions to findings, controls, and review-board follow-through.", "Open decisions")
    ),
  },
  {
    key: "campaigns",
    href: "/campaigns",
    featureFamily: "campaigns",
    workflowArea: "workflows",
    minWorkspaceMode: "advanced",
    advancedModuleKey: "campaigns",
    featureFlagsAnyOf: ["v5PortfolioCampaigns"],
    placementsByMode: placements(["hidden"], ["primary", "cmdk", "dashboard_card"], ["primary", "cmdk", "dashboard_card"]),
    copyByMode: copies(
      copy("Campaign handoff", "Campaigns are available in Advanced workspaces.", "Open campaigns"),
      copy("Campaigns", "Coordinate change campaigns with preview, progress, and history.", "Open campaigns"),
      copy("Campaigns", "Use campaigns as remediation follow-through for eligible assurance work.", "Open campaigns")
    ),
  },
  {
    key: "programs",
    href: "/contracts/programs",
    featureFamily: "programs",
    workflowArea: "workflows",
    minWorkspaceMode: "advanced",
    advancedModuleKey: "programs",
    featureFlagsAnyOf: ["v5PortfolioCampaigns"],
    placementsByMode: placements(["hidden"], ["primary", "more_card", "cmdk"], ["primary", "more_card", "cmdk"]),
    copyByMode: copies(
      copy("Programs", "Programs are available in Advanced workspaces.", "Open programs"),
      copy("Programs", "Manage program catalog, coverage, versions, and operating cadence.", "Open programs"),
      copy("Programs", "Connect program coverage to control impact and program evolution.", "Open programs")
    ),
  },
  {
    key: "relationships",
    href: "/relationship-workspaces",
    featureFamily: "relationship_workspaces",
    workflowArea: "workflows",
    minWorkspaceMode: "advanced",
    advancedModuleKey: "relationships",
    featureFlagsAnyOf: ["v5RelationshipLayer"],
    placementsByMode: placements(["hidden"], ["primary", "more_card", "cmdk"], ["primary", "more_card", "cmdk"]),
    copyByMode: copies(
      copy("Relationships", "Relationships are available in Advanced workspaces.", "Open relationships"),
      copy("Relationships", "Open account and counterparty summaries by stable keys.", "Open relationships"),
      copy("Relationships", "Review account and counterparty concentration with evidence and control context.", "Open relationships")
    ),
  },
  {
    key: "advanced_analytics",
    href: "/contracts/analytics",
    featureFamily: "advanced_analytics",
    workflowArea: "insights",
    minWorkspaceMode: "advanced",
    advancedModuleKey: "analytics",
    featureFlagsAnyOf: ["v5SimulationAndIntelligence"],
    placementsByMode: placements(["hidden"], ["more_card", "cmdk", "hub_card"], ["more_card", "cmdk", "hub_card"]),
    copyByMode: copies(
      copy("Analytics", "Analytics are available in Advanced workspaces.", "Open analytics"),
      copy("Analytics", "Portfolio trends, operating pressure, and capacity signals.", "Open analytics"),
      copy("Analytics", "Risk, evidence, and operational signals for assurance review.", "Open analytics")
    ),
  },
  {
    key: "maintenance",
    href: "/contracts/maintenance",
    featureFamily: "maintenance",
    workflowArea: "workspace",
    minWorkspaceMode: "advanced",
    advancedModuleKey: "maintenance",
    placementsByMode: placements(["tools_only"], ["more_card", "cmdk"], ["more_card", "cmdk"]),
    copyByMode: copies(
      copy("Maintenance", "Data cleanup tools for eligible admins.", "Open maintenance"),
      copy("Maintenance", "Bulk hygiene and correction tools.", "Open maintenance"),
      copy("Maintenance", "Data hygiene that supports evidence and control review.", "Open maintenance")
    ),
  },
  {
    key: "collaboration",
    href: "/contracts/collaboration",
    featureFamily: "collaboration",
    workflowArea: "workflows",
    minWorkspaceMode: "advanced",
    advancedModuleKey: "collaboration",
    featureFlagsAnyOf: ["v5ExternalCollaboration"],
    placementsByMode: placements(["hidden"], ["more_card", "cmdk"], ["more_card", "cmdk"]),
    copyByMode: copies(
      copy("Collaboration", "Collaboration tools are available in Advanced workspaces.", "Open collaboration"),
      copy("Collaboration", "Notes, mentions, and field-level collaboration.", "Open collaboration"),
      copy("Collaboration", "Coordinate remediation and evidence follow-up with collaborators.", "Open collaboration")
    ),
  },
  {
    key: "compare_views",
    href: "/decisions/compare",
    featureFamily: "compare_views",
    workflowArea: "insights",
    minWorkspaceMode: "advanced",
    advancedModuleKey: "compare_views",
    featureFlagsAnyOf: ["v5SimulationAndIntelligence", "v5ControlRoomUx"],
    placementsByMode: placements(["hidden"], ["contextual", "cmdk"], ["contextual", "cmdk"]),
    copyByMode: copies(
      copy("Compare", "Compare views are available in Advanced workspaces.", "Open compare"),
      copy("Compare", "Compare decisions and campaign outputs.", "Open compare"),
      copy("Compare", "Compare decision and remediation outcomes.", "Open compare")
    ),
  },
  {
    key: "review_cadence",
    href: "/contracts/review-cadence",
    featureFamily: "review_cadence",
    workflowArea: "workflows",
    minWorkspaceMode: "core",
    utilityModuleKey: "review_cadence",
    placementsByMode: placements(["tools_only"], ["more_card", "cmdk"], ["more_card", "cmdk"]),
    copyByMode: copies(
      copy("Review cadence", "Weekly and monthly review schedules.", "Open review cadence"),
      copy("Review cadence", "Coordinate recurring review rituals.", "Open review cadence"),
      copy("Review cadence", "Coordinate review rituals for controls, evidence, and outcomes.", "Open review cadence")
    ),
  },
  {
    key: "watchlists",
    href: "/contracts/watchlists",
    featureFamily: "watchlists",
    workflowArea: "workflows",
    minWorkspaceMode: "core",
    utilityModuleKey: "watchlists",
    placementsByMode: placements(["tools_only"], ["more_card", "cmdk"], ["more_card", "cmdk"]),
    copyByMode: copies(copy("Watchlists", "Contracts you explicitly monitor.", "Open watchlists")),
  },
  {
    key: "execution_graph",
    href: "/contracts/execution-graph",
    featureFamily: "execution_graph",
    workflowArea: "workflows",
    minWorkspaceMode: "core",
    utilityModuleKey: "execution_graph",
    placementsByMode: placements(["tools_only"], ["more_card", "cmdk"], ["more_card", "cmdk"]),
    copyByMode: copies(
      copy("Execution graph", "Dependency view for eligible work.", "Open execution graph"),
      copy("Execution graph", "Cross-work dependency view and blockers.", "Open execution graph"),
      copy("Execution graph", "Dependency view across remediation and control follow-through.", "Open execution graph")
    ),
  },
  {
    key: "approval_workload",
    href: "/contracts/approvals/workload",
    featureFamily: "approval_workload",
    workflowArea: "workflows",
    minWorkspaceMode: "core",
    utilityModuleKey: "approval_workload",
    placementsByMode: placements(["tools_only"], ["more_card", "cmdk"], ["more_card", "cmdk"]),
    copyByMode: copies(copy("Approval workload", "Approval workload and bottlenecks.", "Open workload")),
  },
  {
    key: "approval_sla_simulator",
    href: "/contracts/approvals/sla-simulator",
    featureFamily: "approval_sla_simulator",
    workflowArea: "workflows",
    minWorkspaceMode: "core",
    utilityModuleKey: "approval_sla_simulator",
    placementsByMode: placements(["tools_only"], ["more_card", "cmdk"], ["more_card", "cmdk"]),
    copyByMode: copies(copy("Approval SLA simulator", "Model approval deadlines before changing policy.", "Open simulator")),
  },
  {
    key: "assurance",
    href: "/assurance",
    featureFamily: "findings",
    workflowArea: "assurance",
    minWorkspaceMode: "assurance",
    assuranceModuleKey: "findings",
    featureFlagsAnyOf: ["v6AssuranceCore"],
    placementsByMode: placements(["hidden"], ["hidden"], ["primary", "more_card", "cmdk", "dashboard_card"]),
    copyByMode: copies(
      copy("Assurance", "Assurance is available in Assurance workspaces.", "Open assurance"),
      copy("Assurance", "Assurance is available in Assurance workspaces.", "Open assurance"),
      copy("Assurance hub", "Findings, controls, evidence, remediation, and outcomes.", "Open assurance")
    ),
  },
  {
    key: "findings",
    href: "/assurance/findings",
    featureFamily: "findings",
    workflowArea: "assurance",
    minWorkspaceMode: "assurance",
    assuranceModuleKey: "findings",
    featureFlagsAnyOf: ["v6AssuranceCore"],
    placementsByMode: placements(["hidden"], ["hidden"], ["nav_child", "more_card", "cmdk", "dashboard_card"]),
    copyByMode: copies(copy("Findings", "Resolve findings and risk signals.", "Open findings")),
  },
  {
    key: "control_policies",
    href: "/assurance/control-policies",
    featureFamily: "control_policies",
    workflowArea: "assurance",
    minWorkspaceMode: "assurance",
    assuranceModuleKey: "control_policies",
    featureFlagsAnyOf: ["v6ControlPolicies"],
    placementsByMode: placements(["hidden"], ["hidden"], ["nav_child", "more_card", "cmdk", "dashboard_card"]),
    copyByMode: copies(copy("Control policies", "Published controls, evaluations, and coverage.", "Open controls")),
  },
  {
    key: "scorecards",
    href: "/assurance/scorecards",
    featureFamily: "scorecards",
    workflowArea: "assurance",
    minWorkspaceMode: "assurance",
    assuranceModuleKey: "scorecards",
    featureFlagsAnyOf: ["v6AssuranceCore"],
    placementsByMode: placements(["hidden"], ["hidden"], ["nav_child", "more_card", "cmdk", "dashboard_card"]),
    copyByMode: copies(copy("Scorecards", "Score movement and control performance.", "Open scorecards")),
  },
  {
    key: "playbooks",
    href: "/assurance/playbooks",
    featureFamily: "playbooks",
    workflowArea: "assurance",
    minWorkspaceMode: "assurance",
    assuranceModuleKey: "playbooks",
    featureFlagsAnyOf: ["v6AdaptivePlaybooks"],
    placementsByMode: placements(["hidden"], ["hidden"], ["nav_child", "more_card", "cmdk", "dashboard_card"]),
    copyByMode: copies(copy("Playbooks", "Remediation playbooks and approval gates.", "Open playbooks")),
  },
  {
    key: "autopilot",
    href: "/assurance/autopilot",
    featureFamily: "autopilot",
    workflowArea: "assurance",
    minWorkspaceMode: "assurance",
    assuranceModuleKey: "autopilot",
    featureFlagsAnyOf: ["v6Autopilot"],
    placementsByMode: placements(["hidden"], ["hidden"], ["nav_child", "more_card", "cmdk"]),
    copyByMode: copies(copy("Autopilot", "Dry runs, recommendations, and execution boundaries.", "Open autopilot")),
  },
  {
    key: "review_boards",
    href: "/assurance/review-boards",
    featureFamily: "review_boards",
    workflowArea: "assurance",
    minWorkspaceMode: "assurance",
    assuranceModuleKey: "review_boards",
    featureFlagsAnyOf: ["v6ReviewBoards"],
    placementsByMode: placements(["hidden"], ["hidden"], ["nav_child", "more_card", "cmdk", "dashboard_card"]),
    copyByMode: copies(copy("Review boards", "Review packets, approvals, and oversight.", "Open review boards")),
  },
  {
    key: "segments",
    href: "/assurance/segments",
    featureFamily: "segments",
    workflowArea: "assurance",
    minWorkspaceMode: "assurance",
    assuranceModuleKey: "segments",
    featureFlagsAnyOf: ["v6Segments"],
    placementsByMode: placements(["hidden"], ["hidden"], ["nav_child", "more_card", "cmdk"]),
    copyByMode: copies(copy("Segments", "Risk and control segments.", "Open segments")),
  },
  {
    key: "program_evolution",
    href: "/assurance/program-evolution",
    featureFamily: "program_evolution",
    workflowArea: "assurance",
    minWorkspaceMode: "assurance",
    assuranceModuleKey: "program_evolution",
    featureFlagsAnyOf: ["v6AssuranceCore"],
    placementsByMode: placements(["hidden"], ["hidden"], ["nav_child", "more_card", "cmdk"]),
    copyByMode: copies(copy("Program evolution", "Stage program changes with measured impact.", "Open program evolution")),
  },
  {
    key: "health_graph",
    href: "/assurance/health-graph",
    featureFamily: "health_graph",
    workflowArea: "assurance",
    minWorkspaceMode: "assurance",
    assuranceModuleKey: "health_graph",
    featureFlagsAnyOf: ["v6AssuranceCore"],
    placementsByMode: placements(["hidden"], ["hidden"], ["nav_child", "more_card", "cmdk", "dashboard_card"]),
    copyByMode: copies(copy("Health graph", "Risk, control, and evidence relationships.", "Open health graph")),
  },
  {
    key: "outcome_intelligence",
    href: "/reports#outcome-intelligence",
    featureFamily: "outcome_intelligence",
    workflowArea: "assurance",
    minWorkspaceMode: "assurance",
    assuranceModuleKey: "outcome_intelligence",
    featureFlagsAnyOf: ["v6OutcomeIntelligence"],
    placementsByMode: placements(["hidden"], ["hidden"], ["more_card", "cmdk", "dashboard_card"]),
    copyByMode: copies(copy("Outcome intelligence", "Interventions and effectiveness.", "Open outcome intelligence")),
  },
  {
    key: "assurance_analytics",
    href: "/reports#assurance-analytics",
    featureFamily: "findings",
    workflowArea: "assurance",
    minWorkspaceMode: "assurance",
    assuranceModuleKey: "findings",
    featureFlagsAnyOf: ["v6AssuranceCore"],
    placementsByMode: placements(["hidden"], ["hidden"], ["more_card", "cmdk"]),
    copyByMode: copies(copy("Assurance analytics", "Diagnostics and assurance metrics.", "Open assurance analytics")),
  },
  {
    key: "review_packets",
    href: "/api/export/review-packet",
    featureFamily: "reports",
    workflowArea: "assurance",
    minWorkspaceMode: "assurance",
    featureFlagsAnyOf: ["v6AssuranceCore"],
    placementsByMode: placements(["hidden"], ["hidden"], ["contextual"]),
    copyByMode: copies(copy("Review packets", "Generate packets for assurance review.", "Export review packet")),
  },
  {
    key: "more_tools",
    href: "/more",
    featureFamily: "more_tools",
    workflowArea: "workspace",
    minWorkspaceMode: "core",
    utilityModuleKey: "more_tools",
    placementsByMode: placements(["primary", "cmdk"], ["primary", "cmdk"], ["primary", "cmdk"]),
    copyByMode: copies(
      copy("Essential tools", "Secondary entry points for contract execution and workspace basics.", "Open tools"),
      copy("Portfolio tools", "Coordination, analytics, and portfolio operations.", "Open tools"),
      copy("Assurance tools", "Controls, evidence, remediation, and review workflows.", "Open tools")
    ),
  },
  {
    key: "security_settings",
    href: "/settings/security",
    featureFamily: "settings",
    workflowArea: "workspace",
    minWorkspaceMode: "core",
    placementsByMode: placements(["admin_contextual", "cmdk"], ["admin_contextual", "cmdk"], ["admin_contextual", "cmdk"]),
    copyByMode: copies(
      copy("Security", "MFA, sessions, team roles, and security resources.", "Open security"),
      copy("Security", "Authenticator enrollment and session controls.", "Open security"),
      copy("Security", "MFA policy, session hygiene, and DSR export hooks.", "Open security")
    ),
  },
  // Hidden Settings routes remain directly reachable for internal/private
  // compatibility, but public Core navigation, directory, and cmd-K use the
  // release-state Settings destinations instead.
  {
    key: "system_health",
    href: "/settings/health",
    featureFamily: "settings",
    workflowArea: "workspace",
    minWorkspaceMode: "core",
    placementsByMode: placements(["hidden"], ["admin_contextual", "more_card"], ["admin_contextual", "more_card"]),
    copyByMode: copies(
      copy("System health", "Delivery, imports, exports, and extraction reliability.", "Open health"),
      copy("System health", "Workflow reliability, integrations, reports, and portfolio operations.", "Open health"),
      copy("System health", "Workflow reliability, assurance operations, automation, and reporting status.", "Open health")
    ),
  },
  {
    key: "operations_settings",
    href: "/settings/operations",
    featureFamily: "settings",
    workflowArea: "workspace",
    minWorkspaceMode: "core",
    placementsByMode: placements(["admin_contextual", "cmdk"]),
    copyByMode: copies(copy("Notifications", "Reminder defaults for renewal, review, work, evidence, and digest email.", "Edit notifications")),
  },
  {
    key: "product_settings",
    href: "/settings/product",
    featureFamily: "settings",
    workflowArea: "workspace",
    minWorkspaceMode: "core",
    placementsByMode: placements(["hidden"], ["admin_contextual", "cmdk"], ["admin_contextual", "cmdk"]),
    copyByMode: copies(copy("Product experience", "Workspace mode and destination visibility.", "Open product experience")),
  },
  {
    key: "policy_settings",
    href: "/settings/policy",
    featureFamily: "settings",
    workflowArea: "workspace",
    minWorkspaceMode: "core",
    placementsByMode: placements(["hidden"], ["admin_contextual", "cmdk"], ["admin_contextual", "cmdk"]),
    copyByMode: copies(
      copy("Workflow policies", "Rules for approvals, reminders, evidence, and reviews.", "Configure workflow policies"),
      copy("Workflow policies", "Policy controls with contract-level impact preview.", "Configure workflow policies"),
      copy("Workflow policies", "Policy controls for workflow and assurance behavior.", "Configure workflow policies")
    ),
  },
  {
    key: "billing",
    href: "/settings/billing",
    featureFamily: "settings",
    workflowArea: "workspace",
    minWorkspaceMode: "core",
    placementsByMode: placements(["admin_contextual", "cmdk"]),
    copyByMode: copies(copy("Billing", "Plan, invoices, and subscription health.", "Open billing")),
  },
] as const satisfies readonly WorkflowDestinationDef[];

export const WORKFLOW_DESTINATION_KEYS = WORKFLOW_DESTINATIONS.map((d) => d.key);

export const CORE_FORBIDDEN_WORKFLOW_DESTINATION_TERMS = [
  "assurance",
  "autopilot",
  "campaign",
  "capacity forecast",
  "control",
  "control room",
  "finding",
  "health graph",
  "intervention effectiveness",
  "outcome intelligence",
  "playbook",
  "portfolio",
  "program evolution",
  "review board",
  "scorecard",
  "simulation",
] as const;

const DESTINATION_BY_KEY = new Map<WorkflowDestinationKey, WorkflowDestinationDef>(
  WORKFLOW_DESTINATIONS.map((d) => [d.key, d])
);

export function workflowDestinationByKey(
  key: WorkflowDestinationKey
): WorkflowDestinationDef | null {
  return DESTINATION_BY_KEY.get(key) ?? null;
}

function modeAtLeast(mode: WorkspaceProductMode, min: WorkspaceProductMode): boolean {
  return MODE_RANK[mode] >= MODE_RANK[min];
}

function flagsSatisfied(
  surface: WorkflowDestinationSurface,
  def: WorkflowDestinationDef
): boolean {
  if (!def.featureFlagsAnyOf?.length) return true;
  const flags = surface.featureFlags ?? {};
  const known = def.featureFlagsAnyOf.filter((key) => Object.prototype.hasOwnProperty.call(flags, key));
  if (known.length === 0) return true;
  return known.some((key) => flags[key] === true);
}

function hiddenCollectionHas<T extends string>(
  collection: readonly T[] | ReadonlySet<T> | undefined,
  value: T
): boolean {
  if (!collection) return false;
  if (Array.isArray(collection)) return (collection as readonly T[]).includes(value);
  return (collection as ReadonlySet<T>).has(value);
}

function suppressedReason(
  surface: WorkflowDestinationSurface,
  def: WorkflowDestinationDef
): WorkflowDestinationSuppressionReason | null {
  if (!modeAtLeast(surface.mode, def.minWorkspaceMode)) return "mode";
  if (surface.searchScope === "core_only" && def.minWorkspaceMode !== "core") return "search_scope";
  if (!flagsSatisfied(surface, def)) return "feature_flag";
  if (def.advancedModuleKey && hiddenCollectionHas(surface.advancedModulesHidden, def.advancedModuleKey)) {
    return "advanced_module_hidden";
  }
  if (def.assuranceModuleKey && hiddenCollectionHas(surface.assuranceModulesHidden, def.assuranceModuleKey)) {
    return "assurance_module_hidden";
  }
  if (def.utilityModuleKey && hiddenCollectionHas(surface.utilityModulesHidden, def.utilityModuleKey)) {
    return "utility_module_hidden";
  }
  return null;
}

export function resolveWorkflowDestination(
  surface: WorkflowDestinationSurface,
  key: WorkflowDestinationKey
): ResolvedWorkflowDestination | null {
  const def = workflowDestinationByKey(key);
  if (!def) return null;
  const reason = suppressedReason(surface, def);
  if (reason) {
    return {
      visible: false,
      key: def.key,
      href: def.href,
      featureFamily: def.featureFamily,
      reason,
    };
  }
  return {
    visible: true,
    key: def.key,
    href: def.href,
    featureFamily: def.featureFamily,
    workflowArea: def.workflowArea,
    placements: def.placementsByMode[surface.mode],
    copy: def.copyByMode[surface.mode],
  };
}

export function listWorkflowDestinationsForSurface(
  surface: WorkflowDestinationSurface,
  options: {
    placements?: readonly WorkflowDestinationPlacement[];
    keys?: readonly WorkflowDestinationKey[];
  } = {}
): Extract<ResolvedWorkflowDestination, { visible: true }>[] {
  const placementSet = options.placements ? new Set(options.placements) : null;
  const keys = options.keys ?? WORKFLOW_DESTINATION_KEYS;
  return keys
    .map((key) => resolveWorkflowDestination(surface, key))
    .filter((d): d is Extract<ResolvedWorkflowDestination, { visible: true }> => {
      if (!d?.visible) return false;
      if (!placementSet) return !d.placements.includes("hidden") && !d.placements.includes("suppressed");
      return d.placements.some((p) => placementSet.has(p));
    });
}

export function workflowDestinationForHref(href: string): WorkflowDestinationDef | null {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  const normalized = href.startsWith("/reports#") ? href : path;
  const sorted = [...WORKFLOW_DESTINATIONS].sort((a, b) => b.href.length - a.href.length);
  return sorted.find((d) => normalized === d.href || path === d.href || path.startsWith(`${d.href}/`)) ?? null;
}

export function resolveMorePageChrome(surface: WorkflowDestinationSurface): {
  eyebrow: string;
  title: string;
  lead: string;
  searchPlaceholder: string;
  shortcutHeading: string;
} {
  if (surface.mode === "assurance") {
    return {
      eyebrow: "Tools",
      title: "Assurance tools",
      lead: "Controls, evidence, remediation, reporting, and workspace tools for this Assurance workspace.",
      searchPlaceholder: "Search assurance tools, pages, and workflows",
      shortcutHeading: "Assurance jump points",
    };
  }
  if (surface.mode === "advanced") {
    return {
      eyebrow: "Tools",
      title: "Portfolio tools",
      lead: "Coordination, analytics, portfolio operations, and workspace tools for this Advanced workspace.",
      searchPlaceholder: "Search portfolio tools, pages, and workflows",
      shortcutHeading: "Portfolio jump points",
    };
  }
  return {
    eyebrow: "Tools",
    title: "Essential tools",
    lead: "Secondary entry points for contract execution, reports, and workspace basics.",
    searchPlaceholder: "Search essential tools, pages, and workflows",
    shortcutHeading: "Essential jump points",
  };
}

export const MORE_JUMP_DESTINATION_KEYS = [
  "programs",
  "relationships",
  "advanced_analytics",
  "maintenance",
  "system_health",
  "assurance",
  "program_evolution",
  "control_policies",
  "outcome_intelligence",
  "assurance_analytics",
] as const satisfies readonly WorkflowDestinationKey[];

export function listMoreJumpDestinations(
  surface: WorkflowDestinationSurface
): Extract<ResolvedWorkflowDestination, { visible: true }>[] {
  return listWorkflowDestinationsForSurface(surface, {
    keys: MORE_JUMP_DESTINATION_KEYS,
    placements: ["more_card"],
  });
}

export function buildWorkflowDestinationManifest(
  surface: WorkflowDestinationSurface
): WorkflowDestinationManifestEntry[] {
  return listWorkflowDestinationsForSurface(surface)
    .map((destination) => ({
      key: destination.key,
      href: destination.href,
      featureFamily: destination.featureFamily,
      workflowArea: destination.workflowArea,
      label: destination.copy.label,
      description: destination.copy.description,
      placements: destination.placements,
    }))
    .sort((a, b) => {
      const area = a.workflowArea.localeCompare(b.workflowArea);
      if (area !== 0) return area;
      return a.href.localeCompare(b.href);
    });
}

export function assertNoForbiddenCoreWorkflowDestinationTerms(): string[] {
  const failures: string[] = [];
  for (const def of WORKFLOW_DESTINATIONS) {
    if (def.minWorkspaceMode !== "core") continue;
    const strings = Object.values(def.copyByMode.core).filter(
      (v): v is string => typeof v === "string"
    );
    const text = strings.join(" ").toLowerCase();
    for (const term of CORE_FORBIDDEN_WORKFLOW_DESTINATION_TERMS) {
      if (text.includes(term)) failures.push(`${def.key}:${term}`);
    }
  }
  return failures;
}
