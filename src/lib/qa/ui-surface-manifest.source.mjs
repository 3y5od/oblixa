import { getUiRouteFixture, resolveUiRouteVisitPath } from "./ui-route-fixtures.source.mjs";

const coreRoutes = [
  ["/dashboard", "dashboard", "Dashboard", ["smoke", "a11y", "visual", "multi_browser"]],
  ["/dashboard/persona", "dashboard", "Persona dashboard", ["smoke", "a11y", "visual"]],
  ["/contracts", "contracts", "Contracts", ["smoke", "a11y", "visual", "multi_browser"]],
  ["/contracts/[id]", "contracts", null, ["smoke"]],
  ["/contracts/new", "contracts", "Upload contract", ["smoke", "a11y", "visual"]],
  ["/contracts/bulk", "contracts", "Bulk import", ["smoke", "a11y"]],
  ["/contracts/review", "contracts", "Review", ["smoke", "a11y"]],
  ["/work", "work", "Work Queue", ["smoke", "a11y", "visual", "multi_browser"]],
  ["/contracts/tasks", "contracts", "Tasks", ["smoke", "a11y"]],
  ["/contracts/obligations", "contracts", "Obligations", ["smoke", "a11y"]],
  ["/contracts/approvals", "contracts", "Approvals", ["smoke", "a11y"]],
  ["/contracts/renewals", "contracts", "Renewals", ["smoke", "a11y"]],
  ["/contracts/exceptions", "contracts", "Exceptions", ["smoke", "a11y"]],
  ["/contracts/evidence-studio", "contracts", "Evidence", ["smoke", "a11y"]],
  ["/contracts/reports", "reports", "Contract report packs", ["smoke", "a11y"]],
  ["/reports", "reports", "Reports", ["smoke", "a11y", "visual", "multi_browser"]],
  ["/search", "utilities", "Search", ["smoke", "a11y"]],
  ["/settings", "settings", "Settings", ["smoke", "a11y", "visual", "multi_browser"]],
  ["/settings/security", "settings", "Security", ["smoke", "a11y"]],
  ["/settings/billing", "settings", "Billing", ["smoke", "a11y"]],
  ["/settings/operations", "settings", "Notifications", ["smoke", "a11y"]],
  ["/settings/health", "settings", "System health", ["smoke", "a11y"]],
  ["/settings/health/diagnostics", "settings", "System health diagnostics", ["smoke", "a11y"]],
  ["/settings/policy", "settings", "Workflow policies", ["smoke", "a11y"]],
  ["/settings/policy/diagnostics", "settings", "Policy diagnostics", ["smoke", "a11y"]],
  ["/settings/policy/registry", "settings", "Advanced policy editor", ["smoke", "a11y"]],
  ["/settings/product", "settings", "Product settings", ["smoke", "a11y"]],
  ["/more", "utilities", "Tools index", ["smoke", "a11y", "visual", "multi_browser"]],
  ["/onboarding/calibration", "dashboard", "Workspace calibration", ["smoke", "a11y"]],
];

const advancedRoutes = [
  ["/campaigns", "advanced", "Campaign Queue", ["smoke", "a11y", "visual"]],
  ["/campaigns/[id]", "advanced", null, ["smoke"]],
  ["/campaigns/compare", "advanced", "Campaign and simulation compare", ["smoke"]],
  ["/decisions", "advanced", "Decision Queue", ["smoke", "a11y", "visual"]],
  ["/decisions/[id]", "advanced", null, ["smoke"]],
  ["/decisions/compare", "advanced", "Decision compare", ["smoke"]],
  ["/decisions/review", "advanced", "Decision review queue", ["smoke"]],
  ["/contracts/programs", "advanced", "Contract Programs", ["smoke", "a11y"]],
  ["/relationship-workspaces", "advanced", "Relationship workspaces", ["smoke", "a11y"]],
  ["/accounts/[key]", "advanced", null, ["smoke"]],
  ["/counterparties/[key]", "advanced", null, ["smoke"]],
];

const assuranceRoutes = [
  ["/assurance", "assurance", "Continuous assurance", ["smoke", "a11y", "visual"]],
  ["/assurance/findings", "assurance", "Findings queue", ["smoke", "a11y"]],
  ["/assurance/findings/[id]", "assurance", null, ["smoke"]],
  ["/assurance/control-policies", "assurance", "Control policies", ["smoke", "a11y"]],
  ["/assurance/control-policies/[id]", "assurance", null, ["smoke"]],
  ["/assurance/scorecards", "assurance", null, ["smoke", "a11y"]],
  ["/assurance/playbooks", "assurance", "Adaptive playbooks", ["smoke", "a11y"]],
  ["/assurance/review-boards", "assurance", null, ["smoke", "a11y"]],
  ["/assurance/autopilot", "assurance", "Safe autopilot", ["smoke", "a11y"]],
  ["/assurance/segments", "assurance", null, ["smoke", "a11y"]],
  ["/assurance/program-evolution", "assurance", "Program evolution studio", ["smoke", "a11y"]],
  ["/assurance/health-graph", "assurance", "Portfolio health graph", ["smoke", "a11y"]],
];

const utilityRoutes = [
  ["/contracts/analytics", "utilities", null, ["smoke", "a11y"]],
  ["/contracts/maintenance", "utilities", "Maintenance workspace", ["smoke", "a11y"]],
  ["/contracts/intake", "utilities", null, ["smoke", "a11y"]],
  ["/contracts/data-quality", "utilities", "Data quality", ["smoke", "a11y"]],
  ["/contracts/review-cadence", "utilities", null, ["smoke", "a11y"]],
  ["/contracts/watchlists", "utilities", null, ["smoke", "a11y"]],
  ["/contracts/collaboration", "utilities", null, ["smoke", "a11y"]],
  ["/contracts/execution-graph", "utilities", null, ["smoke", "a11y"]],
  ["/contracts/approvals/workload", "utilities", null, ["smoke", "a11y"]],
  ["/contracts/approvals/sla-simulator", "utilities", null, ["smoke", "a11y"]],
];

function ownerForRouteFamily(routeFamily, route) {
  if (routeFamily === "marketing") return "growth";
  if (routeFamily === "auth" || routeFamily === "external") return "security";
  if (routeFamily === "settings" || route.startsWith("/settings/")) return "security";
  if (routeFamily === "assurance") return "assurance";
  if (routeFamily === "reports") return "release";
  return "engineering";
}

function escalationForOwner(owner) {
  if (owner === "security") return "security-oncall";
  if (owner === "assurance") return "assurance-oncall";
  if (owner === "release") return "release-oncall";
  if (owner === "growth") return "growth-oncall";
  return "engineering-oncall";
}

function smokeTierForCoverage(coverage) {
  if (coverage.includes("multi_browser") || coverage.includes("visual")) return "core";
  if (coverage.includes("smoke")) return "standard";
  return "not_applicable";
}

function a11yTierForCoverage(coverage) {
  return coverage.includes("a11y") ? "required" : "not_applicable";
}

function visualTierForCoverage(coverage) {
  return coverage.includes("visual") ? "baseline" : "not_applicable";
}

function withManifestMetadata(entry) {
  const owner = ownerForRouteFamily(entry.routeFamily, entry.route);
  const fixture = getUiRouteFixture(entry.route);
  return {
    ...entry,
    visitPath: entry.visitPath ?? resolveUiRouteVisitPath(entry.route),
    fixtureId: fixture?.fixtureId ?? null,
    smokeTier: smokeTierForCoverage(entry.coverage),
    a11yTier: a11yTierForCoverage(entry.coverage),
    visualTier: visualTierForCoverage(entry.coverage),
    owner,
    ownerExpiry: null,
    ownerEscalation: escalationForOwner(owner),
  };
}

function workspaceModeTierForRoute(routeFamily, route) {
  if (route === "/onboarding/calibration") return "utility";
  if (route === "/contracts/analytics") return "advanced";
  if (route === "/search") return "core";

  if (routeFamily === "advanced") return "advanced";
  if (routeFamily === "assurance") return "assurance";
  if (routeFamily === "utilities") return "utility";
  return "core";
}

function toAuthenticatedEntry([route, routeFamily, expectedHeading, coverage]) {
  return withManifestMetadata({
    route,
    routeFamily,
    mode: "authenticated",
    workspaceModeTier: workspaceModeTierForRoute(routeFamily, route),
    shellFamily: "dashboard",
    expectedHeading,
    visitPath: resolveUiRouteVisitPath(route),
    coverage,
  });
}

const publicRoutes = [
  withManifestMetadata({
    route: "/product",
    routeFamily: "marketing",
    mode: "public",
    workspaceModeTier: "public",
    shellFamily: "marketing",
    expectedHeading: "Product",
    visitPath: "/product",
    coverage: ["smoke", "a11y", "visual"],
  }),
  withManifestMetadata({
    route: "/pricing",
    routeFamily: "marketing",
    mode: "public",
    workspaceModeTier: "public",
    shellFamily: "marketing",
    expectedHeading: "Pricing",
    visitPath: "/pricing",
    coverage: ["smoke", "a11y", "visual"],
  }),
  withManifestMetadata({
    route: "/contact",
    routeFamily: "marketing",
    mode: "public",
    workspaceModeTier: "public",
    shellFamily: "marketing",
    expectedHeading: "Contact",
    visitPath: "/contact",
    coverage: ["smoke", "a11y", "visual"],
  }),
  withManifestMetadata({
    route: "/",
    routeFamily: "marketing",
    mode: "public",
    workspaceModeTier: "public",
    shellFamily: "marketing",
    expectedHeading: "Run renewals, approvals, and obligations from one trusted system",
    visitPath: "/",
    coverage: ["smoke", "a11y", "visual", "multi_browser"],
  }),
  withManifestMetadata({
    route: "/login",
    routeFamily: "auth",
    mode: "public",
    workspaceModeTier: "public",
    shellFamily: "auth",
    expectedHeading: "Sign in to your account",
    visitPath: "/login",
    coverage: ["smoke", "a11y", "visual", "multi_browser"],
  }),
  withManifestMetadata({
    route: "/signup",
    routeFamily: "auth",
    mode: "public",
    workspaceModeTier: "public",
    shellFamily: "auth",
    expectedHeading: "Create your account",
    visitPath: "/signup",
    coverage: ["smoke", "a11y", "visual"],
  }),
  withManifestMetadata({
    route: "/forgot-password",
    routeFamily: "auth",
    mode: "public",
    workspaceModeTier: "public",
    shellFamily: "auth",
    expectedHeading: "Reset your password",
    visitPath: "/forgot-password",
    coverage: ["smoke", "a11y", "visual"],
  }),
  withManifestMetadata({
    route: "/reset-password",
    routeFamily: "auth",
    mode: "public",
    workspaceModeTier: "public",
    shellFamily: "auth",
    expectedHeading: "Set a new password",
    visitPath: "/reset-password",
    coverage: ["smoke", "a11y", "visual"],
  }),
  withManifestMetadata({
    route: "/privacy",
    routeFamily: "marketing",
    mode: "public",
    workspaceModeTier: "public",
    shellFamily: "marketing",
    expectedHeading: "Privacy",
    visitPath: "/privacy",
    coverage: ["smoke", "a11y", "visual"],
  }),
  withManifestMetadata({
    route: "/terms",
    routeFamily: "marketing",
    mode: "public",
    workspaceModeTier: "public",
    shellFamily: "marketing",
    expectedHeading: "Terms of use",
    visitPath: "/terms",
    coverage: ["smoke", "a11y", "visual"],
  }),
  withManifestMetadata({
    route: "/acceptable-use",
    routeFamily: "marketing",
    mode: "public",
    workspaceModeTier: "public",
    shellFamily: "marketing",
    expectedHeading: "Acceptable use",
    visitPath: "/acceptable-use",
    coverage: ["smoke", "a11y", "visual"],
  }),
  withManifestMetadata({
    route: "/security",
    routeFamily: "marketing",
    mode: "public",
    workspaceModeTier: "public",
    shellFamily: "marketing",
    expectedHeading: "Security",
    visitPath: "/security",
    coverage: ["smoke", "a11y", "visual"],
  }),
  withManifestMetadata({
    route: "/accessibility",
    routeFamily: "marketing",
    mode: "public",
    workspaceModeTier: "public",
    shellFamily: "marketing",
    expectedHeading: "Accessibility",
    visitPath: "/accessibility",
    coverage: ["smoke", "a11y", "visual"],
  }),
  withManifestMetadata({
    route: "/cookies",
    routeFamily: "marketing",
    mode: "public",
    workspaceModeTier: "public",
    shellFamily: "marketing",
    expectedHeading: "Cookies",
    visitPath: "/cookies",
    coverage: ["smoke", "a11y", "visual"],
  }),
];

const externalRoutes = [
  withManifestMetadata({
    route: "/external/[token]",
    routeFamily: "external",
    mode: "external",
    workspaceModeTier: "external",
    shellFamily: "external",
    expectedHeading: null,
    visitPath: resolveUiRouteVisitPath("/external/[token]"),
    coverage: ["smoke", "a11y", "visual", "multi_browser"],
  }),
];

export const uiSurfaceManifest = [
  ...coreRoutes.map(toAuthenticatedEntry),
  ...advancedRoutes.map(toAuthenticatedEntry),
  ...assuranceRoutes.map(toAuthenticatedEntry),
  ...utilityRoutes.map(toAuthenticatedEntry),
  ...publicRoutes,
  ...externalRoutes,
];
