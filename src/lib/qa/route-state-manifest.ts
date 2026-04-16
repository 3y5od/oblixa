export type RouteStateKind = "loading" | "error" | "not_found";

export type RouteStateEntry = {
  route: string;
  kind: RouteStateKind;
  sourcePath: string;
  shellFamily: "dashboard" | "auth" | "marketing" | "external" | "root";
};

import { routeStateManifest } from "@/lib/qa/route-state-manifest.source.mjs";

export const ROUTE_STATE_MANIFEST = routeStateManifest as readonly RouteStateEntry[];

export function getRouteStatesForRoute(route: string): RouteStateEntry[] {
  return ROUTE_STATE_MANIFEST.filter((entry) => entry.route === route);
}

