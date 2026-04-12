/**
 * docs/refinement.md §21.2 — org default landing must match workspace mode and not be a §10.4 utility on Core.
 */
import { isRefinementCoreUtilityPath } from "@/lib/product-surface/core-utility-paths";
import { isPathAllowedForWorkspaceMode } from "@/lib/product-surface/routes";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";

/** Strip query/hash for path policy checks. */
export function normalizeLandingPath(path: string): string {
  const s = path.trim();
  const noQuery = s.split("?")[0] ?? s;
  return (noQuery.split("#")[0] ?? noQuery).trim();
}

/**
 * Whether `path` is acceptable as `organizations.v6_org_settings_json.default_landing_path`
 * for the given workspace mode.
 */
export function isValidDefaultLandingPath(path: string, mode: WorkspaceProductMode): boolean {
  const p = normalizeLandingPath(path);
  if (!p.startsWith("/")) return false;
  if (p === "/more") return false;
  if (!isPathAllowedForWorkspaceMode(p, mode)) return false;
  if (mode === "core" && isRefinementCoreUtilityPath(p)) return false;
  return true;
}

/** Resolves org landing for a mode; invalid or missing values fall back to `/dashboard`. */
export function resolveEffectiveLandingPath(
  rawPath: string | null | undefined,
  mode: WorkspaceProductMode
): string {
  if (typeof rawPath !== "string") return "/dashboard";
  const p = normalizeLandingPath(rawPath);
  return isValidDefaultLandingPath(p, mode) ? p : "/dashboard";
}
