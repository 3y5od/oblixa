import type { WorkspaceProductMode } from "@/lib/product-surface/types";

export type RouteInventoryTier = "core" | "advanced" | "assurance" | "utility" | "edge";

export type RouteInventoryEntry = {
  /** App Router path pattern (no query). */
  pattern: string;
  tier: RouteInventoryTier;
  /** product-surface policy §10 subsection reference. */
  refinementRef: string;
};

/**
 * Authoritative inventory for refinement §10 + plan appendices (edge routes).
 * Used by terminology audit and drift checks; keep aligned with `routes.ts` prefixes.
 */
export const ROUTE_INVENTORY: RouteInventoryEntry[] = [
  // §10.1 Core
  { pattern: "/dashboard", tier: "core", refinementRef: "§10.1" },
  { pattern: "/contracts", tier: "core", refinementRef: "§10.1" },
  { pattern: "/contracts/[id]", tier: "core", refinementRef: "§10.1" },
  { pattern: "/contracts/new", tier: "core", refinementRef: "§10.1" },
  { pattern: "/contracts/bulk", tier: "core", refinementRef: "§10.1" },
  { pattern: "/contracts/review", tier: "core", refinementRef: "§10.1" },
  { pattern: "/work", tier: "core", refinementRef: "§10.1" },
  { pattern: "/contracts/tasks", tier: "core", refinementRef: "§10.1" },
  { pattern: "/contracts/obligations", tier: "core", refinementRef: "§10.1" },
  { pattern: "/contracts/approvals", tier: "core", refinementRef: "§10.1" },
  { pattern: "/contracts/renewals", tier: "core", refinementRef: "§10.1" },
  { pattern: "/contracts/exceptions", tier: "core", refinementRef: "§10.1" },
  { pattern: "/contracts/evidence-studio", tier: "core", refinementRef: "§10.1" },
  { pattern: "/contracts/reports", tier: "core", refinementRef: "§10.1" },
  { pattern: "/reports", tier: "core", refinementRef: "§10.1" },
  { pattern: "/onboarding/calibration", tier: "utility", refinementRef: "appendix" },
  { pattern: "/settings", tier: "core", refinementRef: "§10.1" },
  { pattern: "/settings/security", tier: "core", refinementRef: "§10.1" },
  { pattern: "/settings/billing", tier: "core", refinementRef: "§10.1" },
  { pattern: "/settings/operations", tier: "core", refinementRef: "§10.1" },
  // §10.2 Advanced
  { pattern: "/campaigns", tier: "advanced", refinementRef: "§10.2" },
  { pattern: "/campaigns/[id]", tier: "advanced", refinementRef: "§10.2" },
  { pattern: "/campaigns/compare", tier: "advanced", refinementRef: "§10.2" },
  { pattern: "/decisions", tier: "advanced", refinementRef: "§10.2" },
  { pattern: "/decisions/[id]", tier: "advanced", refinementRef: "§10.2" },
  { pattern: "/decisions/compare", tier: "advanced", refinementRef: "§10.2" },
  { pattern: "/decisions/review", tier: "advanced", refinementRef: "§10.2" },
  { pattern: "/contracts/programs", tier: "advanced", refinementRef: "§10.2" },
  { pattern: "/contracts/analytics", tier: "advanced", refinementRef: "§10.2" },
  { pattern: "/relationship-workspaces", tier: "advanced", refinementRef: "§10.2" },
  { pattern: "/accounts/[key]", tier: "advanced", refinementRef: "§10.2" },
  { pattern: "/counterparties/[key]", tier: "advanced", refinementRef: "§10.2" },
  // §10.3 Assurance
  { pattern: "/assurance", tier: "assurance", refinementRef: "§10.3" },
  { pattern: "/assurance/findings", tier: "assurance", refinementRef: "§10.3" },
  { pattern: "/assurance/findings/[id]", tier: "assurance", refinementRef: "§10.3" },
  { pattern: "/assurance/control-policies", tier: "assurance", refinementRef: "§10.3" },
  { pattern: "/assurance/control-policies/[id]", tier: "assurance", refinementRef: "§10.3" },
  { pattern: "/assurance/scorecards", tier: "assurance", refinementRef: "§10.3" },
  { pattern: "/assurance/playbooks", tier: "assurance", refinementRef: "§10.3" },
  { pattern: "/assurance/review-boards", tier: "assurance", refinementRef: "§10.3" },
  { pattern: "/assurance/autopilot", tier: "assurance", refinementRef: "§10.3" },
  { pattern: "/assurance/segments", tier: "assurance", refinementRef: "§10.3" },
  { pattern: "/assurance/program-evolution", tier: "assurance", refinementRef: "§10.3" },
  { pattern: "/assurance/health-graph", tier: "assurance", refinementRef: "§10.3" },
  // §10.4 Utility
  { pattern: "/contracts/maintenance", tier: "utility", refinementRef: "§10.4" },
  { pattern: "/contracts/intake", tier: "utility", refinementRef: "§10.4" },
  { pattern: "/contracts/data-quality", tier: "utility", refinementRef: "§10.4" },
  { pattern: "/contracts/review-cadence", tier: "utility", refinementRef: "§10.4" },
  { pattern: "/contracts/watchlists", tier: "utility", refinementRef: "§10.4" },
  { pattern: "/contracts/collaboration", tier: "utility", refinementRef: "§10.4" },
  { pattern: "/contracts/execution-graph", tier: "utility", refinementRef: "§10.4" },
  { pattern: "/contracts/approvals/workload", tier: "utility", refinementRef: "§10.4" },
  { pattern: "/contracts/approvals/sla-simulator", tier: "utility", refinementRef: "§10.4" },
  { pattern: "/more", tier: "utility", refinementRef: "§10.4" },
  // Settings extensions (not §10.1 list but product-visible)
  { pattern: "/settings/product", tier: "edge", refinementRef: "appendix" },
  { pattern: "/settings/health", tier: "edge", refinementRef: "appendix" },
  { pattern: "/settings/policy", tier: "edge", refinementRef: "appendix" },
  // Persona (appendix)
  { pattern: "/dashboard/persona", tier: "edge", refinementRef: "appendix" },
];

const CORE_PAGE_FILES = ROUTE_INVENTORY.filter((e) => e.tier === "core").map((e) => {
  const inner = e.pattern.replace(/^\//, "");
  return inner.includes("[") ? null : `${inner}/page.tsx`;
}).filter((v): v is string => v != null);

/** Dynamic Core route used in terminology audit (§10.1). */
const CORE_DYNAMIC_PAGES = ["contracts/[id]/page.tsx"] as const;

/** Relative paths under `src/app/(dashboard)/` for Core terminology audit (§11). */
export function coreDashboardPageRelPaths(): string[] {
  return [...CORE_PAGE_FILES, ...CORE_DYNAMIC_PAGES];
}

export function inventoryTierForPath(pathname: string): RouteInventoryTier | null {
  const p = pathname.split("?")[0] ?? pathname;
  if (!p.startsWith("/")) return null;
  let best: { len: number; tier: RouteInventoryTier } | null = null;
  for (const entry of ROUTE_INVENTORY) {
    const pat = entry.pattern;
    if (pat.includes("[")) continue;
    if (p === pat || p.startsWith(`${pat}/`)) {
      const len = pat.length;
      if (!best || len > best.len) best = { len, tier: entry.tier };
    }
  }
  return best?.tier ?? null;
}

/**
 * Minimum workspace mode implied by **inventory tier** metadata (product-surface policy §10).
 * §10.4 utility routes are **not** Advanced-mode requirements: Core admins may open them; Core
 * non-admins are redirected by `assertCoreUtilitySurfaceOrRedirect` (see `utility-surface.test.ts`).
 */
export function minWorkspaceModeForInventoryPath(pathname: string): WorkspaceProductMode | null {
  const t = inventoryTierForPath(pathname);
  if (t === "assurance") return "assurance";
  if (t === "advanced") return "advanced";
  if (t === "utility") return null;
  if (t === "core" || t === "edge") return null;
  return null;
}
