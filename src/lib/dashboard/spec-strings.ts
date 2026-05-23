/**
 * Dashboard spec-strings — single source of truth for every spec-verbatim
 * string the dashboard renders, per docs/oblixa-release-state.md §Dashboard
 * Page and §In-App Pages. See docs/dashboard-spec-compliance.md for the
 * full compliance checklist.
 *
 * Test pins (src/lib/dashboard/dashboard-spec-compliance.test.ts) import
 * from this module so spec drift is caught at CI time.
 */

export const DASHBOARD_TITLE = "Contract tracking";

export const DASHBOARD_PRIMARY_CTA = "Upload contract";
export const DASHBOARD_SECONDARY_CTA = "Import CSV";

/** Spec §Dashboard Page > Top cards. Exactly 6 cards in this order. */
export const DASHBOARD_TOP_CARDS = [
  "Needs review",
  "Upcoming deadlines",
  "Blocked work",
  "Missing owners",
  "Open exceptions",
  "Evidence requested",
] as const;
export type DashboardTopCardLabel = (typeof DASHBOARD_TOP_CARDS)[number];

/** Spec §Dashboard Page > Main sections. Exactly 5 sections with these
 *  exact names + primary action labels. */
export const DASHBOARD_MAIN_SECTIONS = [
  { name: "Review Queue", action: "Review fields" },
  { name: "Upcoming Deadlines", action: "Create reminder" },
  { name: "Work Needing Action", action: "Open work" },
  { name: "Data Gaps", action: "Fix missing data" },
  { name: "Recent Activity", action: null },
] as const;

/** Spec §In-App Empty States lines 1840–1853. Each section's empty state
 *  maps to a spec-verbatim string. Data Gaps has no spec mandate; the
 *  "all gaps filled" message is informational-only (no CTA). */
export const DASHBOARD_EMPTY_STATES = {
  reviewQueue: "Review extracted fields to make contract data trustworthy.",
  upcomingDeadlines: "Add renewal and notice dates to track upcoming decisions.",
  workNeedingAction: "Create work from a deadline, obligation, approval, or exception.",
  dataGaps: "All contracts have owners, dates, and counterparties.",
  recentActivity: "Upload your first signed agreement to start tracking dates, owners, and work.",
} as const;

/** Spec §In-App Pages > Recommended public Core navigation. Exactly 7
 *  top-level items in this order. */
export const CORE_SIDEBAR_NAV = [
  "Dashboard",
  "Contracts",
  "Work",
  "Renewals",
  "Evidence",
  "Reports",
  "Settings",
] as const;

/** Vocabulary banned from public Core surfaces per MEMORY.md voice rules.
 *  The dashboard counts as a Core surface; none of these strings should
 *  appear in dashboard component sources. */
export const DASHBOARD_BANNED_VOCABULARY = [
  "Portfolio",
  "Pulse",
  "Execution workspace",
  "Health graph",
  "Autopilot",
  "Assurance workflows",
  "Platform",
  "Transformation",
  "Programs",
  "Intelligence",
] as const;

/** Spec §Plan Limits. Core plan caps. */
export const CORE_PLAN_LIMITS = {
  activeContracts: 500,
  teamMembers: 10,
} as const;
