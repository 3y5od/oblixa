const ROOT_STATE_SOURCE_PATHS = new Set(["src/app/error.tsx", "src/app/not-found.tsx"]);
export const APP_ROUTER_STATE_KINDS = new Set(["loading", "error", "not_found"]);

export function sourcePathForShellRoot(kind, shellFamily) {
  const basename = kind === "not_found" ? "not-found.tsx" : `${kind}.tsx`;
  return `src/app/(${shellFamily})/${basename}`;
}

export function isGlobalRootEntry(entry) {
  return ROOT_STATE_SOURCE_PATHS.has(entry.sourcePath);
}

export function stateEntryAppliesToRoute(entry, route, shellFamily, includeGlobalRoot = true) {
  if (entry.route === route) return true;
  if (includeGlobalRoot && isGlobalRootEntry(entry)) return true;
  if (entry.shellFamily !== shellFamily) return false;
  if (entry.sourcePath === sourcePathForShellRoot(entry.kind, shellFamily)) return true;
  return entry.route !== "/" && route.startsWith(`${entry.route}/`);
}

export function collectEffectiveRouteStateRows(route, shellFamily, manifest, includeGlobalRoot = true) {
  return manifest.filter((entry) => stateEntryAppliesToRoute(entry, route, shellFamily, includeGlobalRoot));
}

export function collectEffectiveRouteStateKinds(route, shellFamily, manifest, includeGlobalRoot = true) {
  return new Set(collectEffectiveRouteStateRows(route, shellFamily, manifest, includeGlobalRoot).map((entry) => entry.kind));
}