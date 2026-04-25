/**
 * Shared visit paths + auth rules for generated loading/error/not-found route states.
 */

export const ROUTE_STATE_DYNAMIC_FIXTURES: Record<string, string> = {
  "/contracts/[id]": "/contracts/00000000-0000-0000-0000-000000000000",
  "/external/[token]": "/external/00000000-0000-0000-0000-000000000000",
};

const AUTH_ROUTE_PREFIXES = [
  "/dashboard",
  "/work",
  "/contracts",
  "/reports",
  "/settings",
  "/onboarding",
  "/assurance",
  "/decisions",
] as const;

export function resolveRouteStateVisitPath(route: string): string {
  return ROUTE_STATE_DYNAMIC_FIXTURES[route] ?? route;
}

export function routeStateNeedsAuth(route: string): boolean {
  return AUTH_ROUTE_PREFIXES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
}
