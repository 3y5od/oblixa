export type ExemptSurfaceClass =
  | "auth_entry"
  | "legal_marketing"
  | "static_information"
  | "webhook"
  | "cron"
  | "tracking"
  | "tokenized_capability"
  | "health_instrumentation"
  | "infra_utility";

/** @deprecated Use ExemptSurfaceClass. */
export type V8ExemptSurfaceClass = ExemptSurfaceClass;

export type ExemptSurfaceRule = {
  class: ExemptSurfaceClass;
  pathPrefix: string;
  reason: string;
};

/** @deprecated Use ExemptSurfaceRule. */
export type V8ExemptSurfaceRule = ExemptSurfaceRule;

const PAGE_EXEMPT_RULES: ExemptSurfaceRule[] = [
  { class: "legal_marketing", pathPrefix: "/", reason: "Public marketing/info page" },
  { class: "auth_entry", pathPrefix: "/login", reason: "Authentication entry" },
  { class: "auth_entry", pathPrefix: "/signup", reason: "Authentication entry" },
  { class: "auth_entry", pathPrefix: "/forgot-password", reason: "Authentication entry" },
  { class: "auth_entry", pathPrefix: "/reset-password", reason: "Authentication entry" },
  { class: "legal_marketing", pathPrefix: "/privacy", reason: "Public legal page" },
  { class: "legal_marketing", pathPrefix: "/terms", reason: "Public legal page" },
  { class: "legal_marketing", pathPrefix: "/cookies", reason: "Public legal page" },
  { class: "legal_marketing", pathPrefix: "/about", reason: "Public marketing/info page" },
  { class: "legal_marketing", pathPrefix: "/contact", reason: "Public marketing/info page" },
  { class: "static_information", pathPrefix: "/accessibility", reason: "Public static information page" },
  { class: "static_information", pathPrefix: "/security", reason: "Public static information page" },
  { class: "infra_utility", pathPrefix: "/_not-found", reason: "Framework utility route" },
  {
    class: "infra_utility",
    pathPrefix: "/search",
    reason: "Meta-navigation surface — searches the nav inventory; no feature family",
  },
];

const API_EXEMPT_RULES: ExemptSurfaceRule[] = [
  { class: "cron", pathPrefix: "/api/cron/", reason: "Cron endpoint family" },
  { class: "webhook", pathPrefix: "/api/stripe/", reason: "Stripe webhook endpoint family" },
  {
    class: "tokenized_capability",
    pathPrefix: "/api/export/calendar/feed/",
    reason: "Tokenized calendar feed",
  },
  { class: "tracking", pathPrefix: "/api/tracking/", reason: "Tracking endpoint family" },
  { class: "health_instrumentation", pathPrefix: "/api/health", reason: "Health endpoint" },
  {
    class: "infra_utility",
    pathPrefix: "/api/assurance/checks/",
    reason: "Assurance orchestration utility endpoints",
  },
  {
    class: "infra_utility",
    pathPrefix: "/api/assurance/check-runs",
    reason: "Assurance orchestration utility endpoints",
  },
  {
    class: "infra_utility",
    pathPrefix: "/api/assurance/workflows/",
    reason: "Assurance orchestration utility endpoints",
  },
  {
    class: "infra_utility",
    pathPrefix: "/api/assurance/analytics/",
    reason: "Assurance orchestration utility endpoints",
  },
  {
    class: "infra_utility",
    pathPrefix: "/api/assurance/external-links/",
    reason: "Assurance orchestration utility endpoints",
  },
];

const ACTION_EXEMPT_RULES: Array<{ class: ExemptSurfaceClass; filePrefix: string; reason: string }> = [
  { class: "auth_entry", filePrefix: "auth", reason: "Authentication/account actions" },
  { class: "infra_utility", filePrefix: "demo", reason: "Demo/test utility action module" },
  {
    class: "health_instrumentation",
    filePrefix: "product-telemetry",
    reason: "Allowlisted product telemetry (audit_events only)",
  },
];

function normalize(pathname: string): string {
  const pathOnly = pathname.split("?")[0] ?? pathname;
  return pathOnly.split("#")[0] ?? pathOnly;
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(prefix);
}

export function resolvePageExemptSurface(pathname: string): ExemptSurfaceRule | null {
  const normalized = normalize(pathname);
  return PAGE_EXEMPT_RULES.find((rule) => matchesPrefix(normalized, rule.pathPrefix)) ?? null;
}

export function resolveApiExemptSurface(pathname: string): ExemptSurfaceRule | null {
  const normalized = normalize(pathname);
  return API_EXEMPT_RULES.find((rule) => matchesPrefix(normalized, rule.pathPrefix)) ?? null;
}

export function resolveActionExemptSurface(actionFileBaseName: string): {
  class: ExemptSurfaceClass;
  reason: string;
} | null {
  const normalized = actionFileBaseName.trim().toLowerCase();
  return (
    ACTION_EXEMPT_RULES.find((rule) => normalized === rule.filePrefix || normalized.startsWith(`${rule.filePrefix}-`)) ??
    null
  );
}

export function allExemptSurfaceRules(): {
  page: ExemptSurfaceRule[];
  api: ExemptSurfaceRule[];
  action: Array<{ class: ExemptSurfaceClass; filePrefix: string; reason: string }>;
} {
  return {
    page: [...PAGE_EXEMPT_RULES],
    api: [...API_EXEMPT_RULES],
    action: [...ACTION_EXEMPT_RULES],
  };
}

/** @deprecated Use allExemptSurfaceRules. */
export const allV8ExemptSurfaceRules = allExemptSurfaceRules;
