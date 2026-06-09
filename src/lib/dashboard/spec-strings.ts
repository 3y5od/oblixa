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
// Release-state §/dashboard mandates "Secondary action: import contracts" — not a
// file-type-specific label. The import destination (/contracts/bulk) is itself
// titled "Import contracts" and accepts CSV trackers *and* signed files, so the
// narrow "Import CSV" entry label understated it. "Import CSV" still lives on the
// bulk form where CSV is the actual format.
export const DASHBOARD_SECONDARY_CTA = "Import contracts";

/** Spec §Dashboard Page > Top cards. Exactly 6 cards in this order. */
export const DASHBOARD_TOP_CARDS = [
  "Contracts needing review",
  "Dates coming up",
  "Tasks awaiting response",
  "Contracts missing an owner",
  "Contract problems",
  "Evidence requests",
] as const;
export type DashboardTopCardLabel = (typeof DASHBOARD_TOP_CARDS)[number];

/** Spec §Dashboard Page > Main sections. Exactly 5 sections with these
 *  exact names + primary action labels. */
export const DASHBOARD_MAIN_SECTIONS = [
  { name: "Details to Confirm", action: "Confirm details" },
  { name: "Dates Coming Up", action: "Create reminder" },
  { name: "Tasks Needing Action", action: "Open tasks" },
  { name: "Missing Details", action: "Fix missing details" },
  { name: "Recent Activity", action: null },
] as const;

/** Spec §In-App Empty States lines 1840–1853. Each section's empty state
 *  maps to a spec-verbatim string. Data Gaps has no spec mandate; the
 *  "all gaps filled" message is informational-only (no CTA). */
export const DASHBOARD_EMPTY_STATES = {
  reviewQueue: "Review suggested contract details before reminders and reports rely on them.",
  upcomingDeadlines: "Add renewal and notice dates to track upcoming decisions.",
  workNeedingAction: "Create tasks from a deadline, requirement, approval, or issue.",
  dataGaps: "All contracts have owners, dates, and counterparties.",
  recentActivity: "Upload your first signed agreement to start tracking dates, owners, and tasks.",
} as const;

/** Spec §In-App Pages > Recommended public Core navigation. Exactly 7
 *  top-level items in this order. */
export const CORE_SIDEBAR_NAV = [
  "Dashboard",
  "Contracts",
  "Tasks",
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
