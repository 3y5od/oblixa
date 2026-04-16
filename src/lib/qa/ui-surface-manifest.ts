import type { RouteInventoryTier } from "@/lib/product-surface/route-inventory";
import { uiSurfaceManifest } from "@/lib/qa/ui-surface-manifest.source.mjs";

export type UiShellFamily =
  | "dashboard"
  | "auth"
  | "marketing"
  | "external"
  | "global_error"
  | "not_found";

export type UiCoverageLevel = "smoke" | "a11y" | "visual" | "route_state" | "multi_browser";

export type UiSurfaceFamily =
  | "dashboard"
  | "contracts"
  | "work"
  | "settings"
  | "reports"
  | "utilities"
  | "advanced"
  | "assurance"
  | "auth"
  | "marketing"
  | "external";

export type UiSurfaceEntry = {
  route: string;
  routeFamily: UiSurfaceFamily;
  mode: "authenticated" | "public" | "external";
  workspaceModeTier: RouteInventoryTier | "public" | "external";
  shellFamily: UiShellFamily;
  expectedHeading: string | null;
  visitPath: string | null;
  coverage: readonly UiCoverageLevel[];
};

export const UI_SURFACE_MANIFEST = uiSurfaceManifest as readonly UiSurfaceEntry[];

export function getUiSurfaceByRoute(route: string): UiSurfaceEntry | undefined {
  return UI_SURFACE_MANIFEST.find((entry) => entry.route === route);
}

export function getUiSurfacesByCoverage(level: UiCoverageLevel): UiSurfaceEntry[] {
  return UI_SURFACE_MANIFEST.filter((entry) => entry.coverage.includes(level));
}

