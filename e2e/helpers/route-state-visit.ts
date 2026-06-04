/**
 * Shared visit paths + auth rules for generated loading/error/not-found route states.
 */

import { uiRouteFixtureManifest } from "@/lib/qa/ui-route-fixtures.source.mjs";

export const ROUTE_STATE_DYNAMIC_FIXTURES: Record<string, string> = Object.fromEntries(
  uiRouteFixtureManifest.map((entry) => [entry.route, entry.visitPath])
);

const AUTH_ROUTE_PREFIXES = [
  "/accounts",
  "/assurance",
  "/campaigns",
  "/counterparties",
  "/dashboard",
  "/decisions",
  "/contracts",
  "/more",
  "/onboarding",
  "/relationship-workspaces",
  "/reports",
  "/search",
  "/settings",
  "/work",
] as const;

export function resolveRouteStateVisitPath(route: string): string {
  return ROUTE_STATE_DYNAMIC_FIXTURES[route] ?? route;
}

export function routeStateNeedsAuth(route: string): boolean {
  return AUTH_ROUTE_PREFIXES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
}
