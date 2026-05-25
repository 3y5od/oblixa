/**
 * Traceability for product-surface policy — maps major spec sections to implementation anchors.
 * Keep in sync when moving product-surface entry points; E2E header in e2e/authenticated.spec.ts mirrors §22.
 */

/**
 * product-surface policy §4.2 — every mechanism is implemented somewhere in the tree below.
 * - Nav/cmd-K: `nav-visibility.ts`, `resolver.ts`, sidebar, command palette
 * - Advanced mode: `routes.ts`, segment `layout.tsx` + `assertWorkspaceModeAtLeast`
 * - Role: `navigation.ts` `canAccessItem`, `advanced_nav_roles`, optional `assurance_nav_roles` in org JSON
 * - Contextual entry: §14 CTAs (`contract-continuity-links`, renewal/exception/bulk pages)
 */
export const REFINEMENT_CONTAINMENT_MECHANISMS = [
  "nav_cmdk",
  "workspace_mode_layout_guards",
  "role_and_org_json_roles",
  "contextual_entry_ctas",
] as const;

/** product-surface policy §3 — release PR checklist when touching dashboard or nav. */
export const REFINEMENT_OBJECTIVES = [
  "Clearer primary surface",
  "Progressive disclosure",
  "Stronger information hierarchy",
  "Fewer top-level concepts",
  "More consistent naming",
  "Better defaults",
  "Stronger quality/polish on visible surfaces",
] as const;

/** v7 spec §23–§25 — acceptance trace points for product-surface control. */
export const REFINEMENT_V7_TRACE_STRINGS = [
  "Registry-first feature ownership",
  "Eligibility-driven discoverability",
  "Core-first nav and command palette leakage prevention",
  "Mode-aware dashboard, reports, and notification payloads",
  "Route/API/server-action guards with mismatch policy",
  "Transition-side suppression without destructive deletes",
  "Audit + diagnostics coverage for product-surface changes",
] as const;

/** product-surface policy §5 Layer 2 — Advanced operations (mode + flags + optional module hides). */
export const REFINEMENT_LAYER2_ANCHORS = [
  "src/lib/navigation.ts (Decisions, Campaigns, Programs, Relationship Workspaces)",
  "src/app/(dashboard)/decisions/",
  "src/app/(dashboard)/campaigns/",
  "src/app/(dashboard)/contracts/programs/",
  "src/app/(dashboard)/relationship-workspaces/",
  "src/app/(dashboard)/contracts/analytics/page.tsx",
  "src/app/(dashboard)/contracts/maintenance/page.tsx",
  "src/app/(dashboard)/contracts/collaboration/page.tsx",
  "src/app/(dashboard)/settings/operations/page.tsx (integrations)",
  "src/app/api/export/ (calendar, review-packet, etc.)",
  "src/app/api/integrations/oauth/start/route.ts (OAuth entry)",
  "src/app/(dashboard)/settings/policy/page.tsx + src/app/api/policy/simulate/route.ts (simulation)",
  "src/app/(dashboard)/decisions/compare/page.tsx",
  "src/app/(dashboard)/campaigns/compare/page.tsx",
] as const;

/** product-surface policy §5 Layer 3 — Assurance (Assurance mode + flags) + outcome intelligence. */
export const REFINEMENT_LAYER3_ANCHORS = [
  "src/app/(dashboard)/assurance/",
  "src/components/dashboard/dashboard-operational-blocks.tsx",
  "src/lib/assurance/assurance-analytics.ts",
  "src/lib/assurance/outcomes.ts (outcome intelligence)",
  "src/app/(dashboard)/reports/page.tsx (#outcome-intelligence, #assurance-analytics)",
] as const;

/**
 * product-surface policy §14 — contextual entry (advanced flows reachable from Core objects).
 * Each line: example → primary implementation file(s).
 */
export const REFINEMENT_CONTEXTUAL_ENTRY_ANCHORS = [
  "Decision from renewal or exception → src/app/(dashboard)/contracts/renewals/page.tsx, contracts/exceptions/page.tsx, work/page.tsx",
  "Campaign from bulk remediation → src/app/(dashboard)/contracts/bulk/page.tsx",
  "Relationship workspace from contract → src/app/(dashboard)/contracts/[id]/page.tsx (account/counterparty keys)",
  "Finding from control policy / alerts → src/app/(dashboard)/assurance/findings/, assurance/control-policies/",
  "Program evolution from programs → src/app/(dashboard)/contracts/programs/page.tsx",
  "Playbook from finding or campaign → src/app/(dashboard)/assurance/playbooks/, campaigns/[id]/page.tsx",
] as const;

export const REFINEMENT_TRACE = {
  "§1": ["src/lib/product-surface/refinement-trace.ts"],
  "§2": [
    "src/components/landing/",
    "src/app/(dashboard)/dashboard/page.tsx",
    "scripts/audit-marketing-identity.mjs",
  ],
  "§3": ["src/lib/navigation.ts"],
  "§4-6": ["src/lib/product-surface/context.ts", "src/lib/product-surface/routes.ts"],
  "§7-9": ["src/lib/navigation.ts", "src/components/layout/sidebar.tsx"],
  "§8": [
    "src/app/(dashboard)/dashboard/page.tsx",
    "src/components/dashboard/dashboard-upper.tsx",
    "src/components/dashboard/dashboard-lower.tsx",
  ],
  "§10": ["src/lib/product-surface/routes.ts", "src/lib/product-surface/route-inventory.ts"],
  "§12-13": ["src/lib/product-surface/nav-visibility.ts", "src/lib/product-surface/resolver.ts"],
  "§14": [...REFINEMENT_CONTEXTUAL_ENTRY_ANCHORS],
  "§16.3": ["src/components/ui/contract-continuity-links.tsx"],
  "§17.2": [
    "src/lib/assurance/org-settings.ts",
    "src/app/(dashboard)/assurance/autopilot/",
    "src/app/api/autopilot/",
  ],
  "§18": [
    "src/lib/notification-product-tier.ts",
    "src/lib/notification-policy.ts",
    "src/lib/integrations/events.ts (enqueueOutboundEvent — workspace tier + suppression; see scripts/check-outbound-events-context.mjs)",
    "src/app/(dashboard)/settings/product/page.tsx",
    "src/lib/email-workspace-degrade.ts",
    "scripts/check-outbound-events-context.mjs",
    "scripts/audit-core-email-copy.mjs",
    "src/app/api/reports/send-summaries/route.ts",
    "src/app/api/cron/v4/report-packs-generate/route.ts",
    "src/app/api/integrations/slack/ (Slack outbound)",
  ],
  "§19": ["src/proxy.ts", "src/app/api/**/route.ts"],
  "§20": [
    "src/components/layout/command-palette.tsx",
    "src/components/layout/header.tsx",
    "src/lib/product-surface/resolver.ts",
    "src/app/(dashboard)/contracts/page.tsx",
    "e2e/authenticated.spec.ts",
    "e2e/compatibility-core-smoke.spec.ts",
    "scripts/audit-nav-primary-vs-metadata.mjs (nav label vs page title heuristic)",
    "Global / header search dispatches into the command palette bridge with mode-gated results",
  ],
  "§21": [
    "src/app/(dashboard)/settings/product/page.tsx",
    "src/app/(dashboard)/settings/product/settings-product-calibration-summary.tsx",
    "src/lib/onboarding/calibration-map.ts",
    "src/lib/onboarding/calibration-copy.ts",
    "src/lib/onboarding/calibration-gate.ts",
    "src/actions/onboarding-calibration.ts",
    "src/app/(dashboard)/onboarding/calibration/",
    "src/lib/product-surface/workspace-transition.ts",
  ],
  "§22": [
    "e2e/authenticated.spec.ts",
    "e2e/authenticated-a11y-paths.ts",
    "e2e/onboarding-calibration.spec.ts",
  ],
  "§23-24": [
    "AGENTS.md",
    ".github/pull_request_template.md (REFINEMENT_OBJECTIVES when changing onboarding / nav-adjacent surfaces)",
    "src/lib/product-surface/refinement-contract.test.ts",
  ],
} as const;

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { REFINEMENT_V7_TRACE_STRINGS as REFINEMENT_TRACE_STRINGS };
// End version-name compatibility aliases.
