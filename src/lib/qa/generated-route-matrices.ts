import { GENERATED_AUTHENTICATED_ROUTES } from "../../../e2e/generated/authenticated-routes";
import { GENERATED_PUBLIC_ROUTES } from "../../../e2e/generated/public-routes";
import { GENERATED_VISUAL_ROUTES } from "../../../e2e/generated/visual-routes";
import { GENERATED_ROUTE_STATES } from "../../../e2e/generated/route-states";
import type { UiCoverageLevel } from "@/lib/qa/ui-surface-manifest";

function hasCoverage(entry: { coverage: readonly string[] }, coverage: UiCoverageLevel): boolean {
  return entry.coverage.includes(coverage);
}

export { hasCoverage };

export const GENERATED_AUTHENTICATED_CORE_A11Y_PATHS = GENERATED_AUTHENTICATED_ROUTES.filter(
  (entry) =>
    hasCoverage(entry, "a11y") &&
    entry.workspaceModeTier !== "utility" &&
    entry.workspaceModeTier !== "advanced" &&
    entry.workspaceModeTier !== "assurance"
).map((entry) => entry.visitPath);

export const GENERATED_AUTHENTICATED_UTILITY_A11Y_PATHS = GENERATED_AUTHENTICATED_ROUTES.filter(
  (entry) => hasCoverage(entry, "a11y") && entry.workspaceModeTier === "utility"
).map((entry) => entry.visitPath);

export const GENERATED_AUTHENTICATED_MULTI_BROWSER_PATHS = GENERATED_AUTHENTICATED_ROUTES.filter(
  (entry) => hasCoverage(entry, "multi_browser")
).map((entry) => entry.visitPath);

export const GENERATED_PUBLIC_A11Y_PATHS = GENERATED_PUBLIC_ROUTES.filter((entry) =>
  hasCoverage(entry, "a11y")
).map((entry) => entry.visitPath);

export const GENERATED_PUBLIC_MULTI_BROWSER_PATHS = GENERATED_PUBLIC_ROUTES.filter((entry) =>
  hasCoverage(entry, "multi_browser")
).map((entry) => entry.visitPath);

export const GENERATED_VISUAL_PATHS = GENERATED_VISUAL_ROUTES.map((entry) => entry.visitPath);

export const GENERATED_LOADING_ROUTE_PATHS = [
  ...new Set(
    GENERATED_ROUTE_STATES.filter((entry) => entry.kind === "loading").map((entry) => entry.route)
  ),
];

export const GENERATED_LOADING_SOURCE_PATHS = GENERATED_ROUTE_STATES.filter(
  (entry) => entry.kind === "loading"
).map((entry) => entry.sourcePath);

