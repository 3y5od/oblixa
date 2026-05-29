import {
  PUBLIC_INFORMATION_PATHS,
  SITEMAP_PATHS,
} from "@/lib/marketing/public-paths";

export const OPERATIONAL_PUBLIC_LAUNCH_BOUNDARY_IDS = [
  "core-contract-tracking",
  "signed-agreements-only",
  "not-full-clm",
  "no-legal-advice",
  "no-grc-positioning",
  "no-autonomous-agent",
  "no-enterprise-assurance",
  "human-reviewed-ai",
  "early-access-assurance-workflows",
  "exportable-data",
] as const;

export const OPERATIONAL_PRIVATE_SURFACE_IDS = [
  "advanced-decisions",
  "advanced-campaigns",
  "assurance-hub",
  "assurance-findings",
  "assurance-control-policies",
  "assurance-scorecards",
  "assurance-playbooks",
  "relationship-workspaces",
  "accounts",
  "counterparties",
  "command-palette-private-results",
] as const;

export const OPERATIONAL_CONVERSION_FLOW_IDS = [
  "contact-form",
  "contact-api",
  "pricing-page",
  "signup-form",
  "password-recovery",
  "billing-checkout-handoff",
  "billing-portal-handoff",
  "dpa-security-contact",
] as const;

export const OPERATIONAL_MARKETING_ASSET_METADATA_IDS = [
  "canonical-url",
  "sitemap",
  "robots-private-disallow",
  "json-ld-safe-serialization",
  "opengraph-image",
  "twitter-image",
  "app-icon",
  "apple-icon",
  "public-logo",
  "metadata-route-inventory",
  "broken-link-smoke",
  "private-anchor-ban",
] as const;

export type OperationalPublicLaunchBoundaryId =
  (typeof OPERATIONAL_PUBLIC_LAUNCH_BOUNDARY_IDS)[number];
export type OperationalPrivateSurfaceId =
  (typeof OPERATIONAL_PRIVATE_SURFACE_IDS)[number];
export type OperationalConversionFlowId =
  (typeof OPERATIONAL_CONVERSION_FLOW_IDS)[number];
export type OperationalMarketingAssetMetadataId =
  (typeof OPERATIONAL_MARKETING_ASSET_METADATA_IDS)[number];

export type PublicLaunchClaimRule = {
  id: string;
  pattern: string;
  allowedNegations: readonly string[];
};

export type PublicLaunchIssue = {
  issue: string;
  target: string;
  detail?: string;
};

export const OPERATIONAL_PRIVATE_LAUNCH_ROUTE_PREFIXES = [
  "/dashboard",
  "/work",
  "/contracts",
  "/settings",
  "/onboarding",
  "/reports",
  "/search",
  "/assurance",
  "/campaigns",
  "/decisions",
  "/relationship-workspaces",
  "/accounts",
  "/counterparties",
  "/more",
] as const;

export const OPERATIONAL_PUBLIC_LAUNCH_REQUIRED_PUBLIC_ROUTES = [
  "/",
  "/product",
  "/pricing",
  "/contact",
  "/signup",
  "/login",
  "/forgot-password",
  "/reset-password",
] as const;

export const OPERATIONAL_PUBLIC_LAUNCH_CLAIM_RULES = [
  {
    id: "full-clm",
    pattern:
      "\\b(?:oblixa\\s+)?(?:is|provides|offers|delivers|replaces|becomes|acts\\s+as)\\b.{0,48}\\b(?:full|complete|end-to-end)\\s+CLM\\b",
    allowedNegations: ["not", "no", "is not", "does not", "doesn't", "does not replace"],
  },
  {
    id: "legal-advice",
    pattern:
      "\\b(?:oblixa\\s+)?(?:provides|offers|delivers|gives|renders)\\b.{0,48}\\blegal\\s+advice\\b",
    allowedNegations: ["not", "no", "does not", "doesn't", "without"],
  },
  {
    id: "grc",
    pattern:
      "\\b(?:GRC|governance,\\s*risk,\\s*and\\s*compliance)\\s+(?:platform|system|suite|tool)\\b",
    allowedNegations: ["not", "no", "without"],
  },
  {
    id: "autonomous-agent",
    pattern:
      "\\b(?:autonomous|self-driving)\\s+(?:agent|agents|legal\\s+agent|contract\\s+agent|workflow\\s+agent)\\b|\\b(?:acts\\s+as|is|becomes)\\s+(?:an?\\s+)?(?:autonomous|self-driving)\\s+(?:agent|legal\\s+agent|contract\\s+agent|workflow\\s+agent)\\b",
    allowedNegations: ["not", "no", "without"],
  },
  {
    id: "enterprise-assurance",
    pattern: "\\benterprise\\s+assurance\\s+(?:platform|suite|system|program)\\b",
    allowedNegations: ["not", "no", "without"],
  },
  {
    id: "certification",
    pattern:
      "\\b(?:SOC\\s*2|ISO\\s*27001)\\s+(?:certified|certification|compliant|compliance)\\b",
    allowedNegations: ["not", "no", "without"],
  },
] as const satisfies readonly PublicLaunchClaimRule[];

export const OPERATIONAL_PUBLIC_LAUNCH_BOUNDARIES = [
  {
    id: "core-contract-tracking",
    allowedPublicPositioning: "Contract tracking workspace for signed agreements.",
    requiredEvidence: ["PUBLIC_INFORMATION_PATHS", "audit:marketing-identity:strict"],
  },
  {
    id: "signed-agreements-only",
    allowedPublicPositioning: "Post-signature tracking, not drafting or negotiation.",
    requiredEvidence: ["antiGoalSummary", "landing-json-ld"],
  },
  {
    id: "not-full-clm",
    allowedPublicPositioning: "Explicitly says Oblixa is not a full CLM.",
    requiredEvidence: ["antiGoalSummary", "forbidden_public_launch_claim"],
  },
  {
    id: "no-legal-advice",
    allowedPublicPositioning: "Explicit legal-advice disclaimer on public surfaces.",
    requiredEvidence: ["does not provide legal advice", "MarketingSiteFooter"],
  },
  {
    id: "no-grc-positioning",
    allowedPublicPositioning: "No public GRC platform positioning.",
    requiredEvidence: ["evaluatePublicLaunchCopy"],
  },
  {
    id: "no-autonomous-agent",
    allowedPublicPositioning: "No public autonomous-agent positioning.",
    requiredEvidence: ["antiGoalSummary", "evaluatePublicLaunchCopy"],
  },
  {
    id: "no-enterprise-assurance",
    allowedPublicPositioning: "No public enterprise-assurance launch.",
    requiredEvidence: ["audit:marketing-identity:strict"],
  },
  {
    id: "human-reviewed-ai",
    allowedPublicPositioning: "AI extraction is source-backed and human reviewed.",
    requiredEvidence: ["your team reviews and approves", "source snippet"],
  },
  {
    id: "early-access-assurance-workflows",
    allowedPublicPositioning: "Assurance workflows may be routed through contact only.",
    requiredEvidence: ["assurance_workflows", "/api/contact"],
  },
  {
    id: "exportable-data",
    allowedPublicPositioning: "CSV export and data portability are public claims.",
    requiredEvidence: ["CSV export", "export your data"],
  },
] as const;

export function isOperationalPrivateLaunchPath(pathname: string): boolean {
  return OPERATIONAL_PRIVATE_LAUNCH_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function hasNegationWindow(
  normalizedText: string,
  matchIndex: number,
  allowedNegations: readonly string[],
  windowChars: number,
): boolean {
  const windowText = normalizedText
    .slice(Math.max(0, matchIndex - windowChars), matchIndex)
    .toLowerCase();
  return containsNegation(windowText, allowedNegations);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function containsNegation(text: string, allowedNegations: readonly string[]): boolean {
  return allowedNegations.some((needle) =>
    new RegExp(`(?:^|\\W)${escapeRegExp(needle.toLowerCase())}(?:$|\\W)`, "u").test(text)
  );
}

export function evaluatePublicLaunchCopy(
  text: string,
  options: {
    rules?: readonly PublicLaunchClaimRule[];
    negationWindowChars?: number;
  } = {},
): { ok: boolean; issues: PublicLaunchIssue[] } {
  const rules = options.rules ?? OPERATIONAL_PUBLIC_LAUNCH_CLAIM_RULES;
  const negationWindowChars = options.negationWindowChars ?? 72;
  const normalizedText = text.replace(/\s+/gu, " ");
  const issues: PublicLaunchIssue[] = [];

  for (const rule of rules) {
    const pattern = new RegExp(rule.pattern, "giu");
    for (const match of normalizedText.matchAll(pattern)) {
      const index = match.index ?? 0;
      const matchText = match[0].toLowerCase();
      const negatedInMatch = containsNegation(matchText, rule.allowedNegations);
      if (
        negatedInMatch ||
        hasNegationWindow(normalizedText, index, rule.allowedNegations, negationWindowChars)
      ) {
        continue;
      }
      issues.push({
        issue: "forbidden_public_launch_claim",
        target: rule.id,
        detail: match[0].slice(0, 120),
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

export function validatePublicLaunchInventory(paths: readonly string[]): {
  ok: boolean;
  issues: PublicLaunchIssue[];
} {
  const issues: PublicLaunchIssue[] = [];
  for (const route of paths) {
    if (isOperationalPrivateLaunchPath(route)) {
      issues.push({ issue: "private_launch_path_in_public_inventory", target: route });
    }
  }
  for (const requiredRoute of OPERATIONAL_PUBLIC_LAUNCH_REQUIRED_PUBLIC_ROUTES) {
    if (!paths.includes(requiredRoute)) {
      issues.push({ issue: "required_public_launch_route_missing", target: requiredRoute });
    }
  }
  return { ok: issues.length === 0, issues };
}

export function validateOperationalPublicLaunchRegistry(): {
  ok: boolean;
  issues: PublicLaunchIssue[];
} {
  const issues: PublicLaunchIssue[] = [];
  const boundaryIds = new Set(OPERATIONAL_PUBLIC_LAUNCH_BOUNDARY_IDS);
  for (const boundary of OPERATIONAL_PUBLIC_LAUNCH_BOUNDARIES) {
    if (!boundaryIds.has(boundary.id)) {
      issues.push({ issue: "unknown_public_launch_boundary", target: boundary.id });
    }
    const requiredEvidenceCount: number = boundary.requiredEvidence.length;
    if (requiredEvidenceCount === 0) {
      issues.push({ issue: "public_launch_boundary_missing_evidence", target: boundary.id });
    }
  }

  const publicInventory = validatePublicLaunchInventory([
    ...SITEMAP_PATHS,
    ...PUBLIC_INFORMATION_PATHS,
  ]);
  issues.push(...publicInventory.issues);

  return { ok: issues.length === 0, issues };
}
