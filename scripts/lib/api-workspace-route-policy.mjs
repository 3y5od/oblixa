export const API_WORKSPACE_GUARD_FAMILIES = [
  { prefix: "/api/external-actions/", minMode: "advanced", modeMismatchStatus: 404 },
  { prefix: "/api/decisions/", minMode: "advanced", modeMismatchStatus: 404 },
  { prefix: "/api/campaigns/", minMode: "advanced", modeMismatchStatus: 404 },
  { prefix: "/api/programs/", minMode: "advanced", modeMismatchStatus: 404 },
  { prefix: "/api/simulations/", minMode: "advanced", modeMismatchStatus: 404 },
  { prefix: "/api/intelligence/", minMode: "advanced", modeMismatchStatus: 404 },
  { prefix: "/api/capacity/", minMode: "advanced", modeMismatchStatus: 404 },
  { prefix: "/api/maintenance/", minMode: "advanced", modeMismatchStatus: 404 },
  { prefix: "/api/accounts/", minMode: "advanced", modeMismatchStatus: 404 },
  { prefix: "/api/counterparties/", minMode: "advanced", modeMismatchStatus: 404 },
  { prefix: "/api/assurance/", minMode: "assurance", modeMismatchStatus: 404 },
  { prefix: "/api/autopilot/", minMode: "assurance", modeMismatchStatus: 404 },
  { prefix: "/api/playbooks/", minMode: "assurance", modeMismatchStatus: 404 },
  { prefix: "/api/control-policies/", minMode: "assurance", modeMismatchStatus: 404 },
  { prefix: "/api/review-boards/", minMode: "assurance", modeMismatchStatus: 404 },
  { prefix: "/api/segments/", minMode: "assurance", modeMismatchStatus: 404 },
  { prefix: "/api/program-evolution/", minMode: "assurance", modeMismatchStatus: 404 },
  { prefix: "/api/outcomes/", minMode: "assurance", modeMismatchStatus: 404 },
  { prefix: "/api/policy/", minMode: "core", modeMismatchStatus: 403 },
  { prefix: "/api/events/", minMode: "core", modeMismatchStatus: 403 },
  { prefix: "/api/integrations/", minMode: "core", modeMismatchStatus: 403 },
  { prefix: "/api/attestations/", minMode: "core", modeMismatchStatus: 403 },
  { prefix: "/api/approvals/", minMode: "core", modeMismatchStatus: 403 },
  { prefix: "/api/report-packs/", minMode: "core", modeMismatchStatus: 403 },
  { prefix: "/api/export/contracts", minMode: "core", modeMismatchStatus: 403 },
  { prefix: "/api/command-palette/", minMode: "core", modeMismatchStatus: 403 },
  { prefix: "/api/evidence/", minMode: "core", modeMismatchStatus: 403 },
  { prefix: "/api/exceptions/", minMode: "core", modeMismatchStatus: 403 },
  { prefix: "/api/renewals/", minMode: "core", modeMismatchStatus: 403 },
  { prefix: "/api/import/", minMode: "core", modeMismatchStatus: 403 },
  { prefix: "/api/extract/", minMode: "core", modeMismatchStatus: 403 },
  { prefix: "/api/workspace/", minMode: "core", modeMismatchStatus: 403 },
  { prefix: "/api/templates/", minMode: "core", modeMismatchStatus: 403 },
  { prefix: "/api/command-centers/", minMode: "core", modeMismatchStatus: 403 },
];

export const API_WORKSPACE_EXEMPT_PREFIXES = [
  "/api/cron/",
  "/api/stripe/",
  "/api/export/calendar/feed/",
];

export const API_SESSION_AUTH_MARKERS = [
  "getApiAuthContext",
  "auth.getUser()",
  "requireV6Context",
  "requireV6ReadContext",
];

export function findFamilyPolicy(apiPath) {
  return API_WORKSPACE_GUARD_FAMILIES.find((row) => apiPath.startsWith(row.prefix)) ?? null;
}

export function isExemptByPrefix(apiPath) {
  return API_WORKSPACE_EXEMPT_PREFIXES.some((prefix) => apiPath.startsWith(prefix));
}

export function isSessionAuthenticatedRoute(raw) {
  return API_SESSION_AUTH_MARKERS.some((marker) => raw.includes(marker));
}
