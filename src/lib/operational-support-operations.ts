import config from "../../config/operational-support-operations.json";

export type OperationalSupportOperationsConfig = typeof config;
export type SupportRole = "authenticated" | "admin" | "server-only";
export type SupportReadWriteClass =
  | "credential-verification"
  | "security-mutation"
  | "secret-bearing-mutation"
  | "destructive-mutation"
  | "customer-impacting-mutation"
  | "read-only-diagnostic"
  | "fixture-mutation";

export type SupportCapability = {
  id: string;
  capabilityName: string;
  routeOrAction: string;
  requiredRole: SupportRole | string;
  stepUpRequirement: string;
  auditEvent: string;
  tenantBoundary: string;
  readWriteClass: SupportReadWriteClass | string;
  supportSafeAlternative: string;
  validationCommand: string;
  evidenceRefs: readonly string[];
};

export type SupportAccessContext = {
  role: SupportRole | "editor" | "viewer" | "ops_manager" | "legal_reviewer" | "finance_reviewer" | "manager";
  hasStepUp: boolean;
  sameTenant: boolean;
  auditEventRecorded: boolean;
};

export type SupportAccessDecision = {
  allowed: boolean;
  reasons: string[];
  supportSafeAlternative: string;
};

export type SupportRedactionFinding = {
  path: string;
  reason: string;
};

export type SupportRedactionResult<T> = {
  redacted: T;
  findings: SupportRedactionFinding[];
};

export type BreakGlassRequest = {
  enabled: boolean;
  actorRole: string;
  reason: string | null;
  expiresAt: string | null;
  now: string;
  hasStepUp: boolean;
  auditEventRecorded: boolean;
  customerImpactAcknowledged: boolean;
};

export type DemoSeedRequest = {
  enabled: boolean;
  role: string;
  nodeEnv: string | null;
  vercelEnv: string | null;
  orgId: string | null;
  fixtureOnly: boolean;
  auditEventRecorded: boolean;
};

export const OPERATIONAL_SUPPORT_OPERATIONS_CONFIG = config as OperationalSupportOperationsConfig;
export const OPERATIONAL_SUPPORT_CAPABILITIES = OPERATIONAL_SUPPORT_OPERATIONS_CONFIG.supportCapabilities as readonly SupportCapability[];
export const OPERATIONAL_SUPPORT_REDACTION_FIELDS = OPERATIONAL_SUPPORT_OPERATIONS_CONFIG.redactionFields;

const ROLE_RANK: Record<string, number> = {
  authenticated: 0,
  viewer: 1,
  editor: 2,
  legal_reviewer: 2,
  finance_reviewer: 2,
  manager: 3,
  ops_manager: 3,
  admin: 4,
  "server-only": 5,
};

const TOKEN_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/giu,
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{12,}\b/gu,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/gu,
  /\bwhsec_[A-Za-z0-9]{12,}\b/gu,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu,
];

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu;
const BILLING_ID_RE = /\b(?:cus|sub|price|prod|pi|cs)_[A-Za-z0-9]{8,}\b/gu;
const PROVIDER_ID_RE = /\b(?:acct|org|evt|job|run)_[A-Za-z0-9]{8,}\b/gu;
const FILE_NAME_RE = /\b[^/\s]+\.(?:pdf|docx?|xlsx?|csv|png|jpe?g|heic|zip)\b/giu;

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function keySuggestsContractText(key: string): boolean {
  return /(?:contract|document|source|clause|extracted|raw).*text|sourceSnippet|source_snippet|fullText|search_document/iu.test(key);
}

function keySuggestsFileName(key: string): boolean {
  return /(?:file|upload|document).*name|filename|file_name|path/iu.test(key);
}

export function redactSupportString(value: string, key = ""): { value: string; reasons: string[] } {
  const reasons: string[] = [];
  if (keySuggestsContractText(key) && value.length > 20) {
    return { value: `[redacted-contract-text:${value.length}]`, reasons: ["contract-text"] };
  }

  let next = value;
  for (const pattern of TOKEN_PATTERNS) {
    next = next.replace(pattern, (match) => {
      reasons.push("token");
      return `[redacted-token:${stableHash(match)}]`;
    });
  }
  next = next.replace(EMAIL_RE, (match) => {
    reasons.push("email-address");
    return `[redacted-email:${stableHash(match.toLowerCase())}]`;
  });
  next = next.replace(BILLING_ID_RE, (match) => {
    reasons.push("billing-id");
    return `[redacted-billing-id:${stableHash(match)}]`;
  });
  next = next.replace(PROVIDER_ID_RE, (match) => {
    reasons.push("provider-id");
    return `[redacted-provider-id:${stableHash(match)}]`;
  });
  next = next.replace(UUID_RE, (match) => {
    reasons.push(/org/i.test(key) ? "org-id" : /user/i.test(key) ? "user-id" : "opaque-id");
    return `[redacted-id:${stableHash(match)}]`;
  });
  if (keySuggestsFileName(key)) {
    next = next.replace(FILE_NAME_RE, (match) => {
      reasons.push("uploaded-file-name");
      return `[redacted-file-name:${stableHash(match)}]`;
    });
  }
  if (/authorization|cookie/i.test(key) && next.trim()) {
    reasons.push(/cookie/i.test(key) ? "cookie" : "authorization-header");
    next = `[redacted-${/cookie/i.test(key) ? "cookie" : "authorization-header"}:${stableHash(next)}]`;
  }

  return { value: next, reasons: [...new Set(reasons)].sort() };
}

export function redactSupportBundle<T>(input: T): SupportRedactionResult<T> {
  const findings: SupportRedactionFinding[] = [];

  function redact(value: unknown, path: string, key: string): unknown {
    if (typeof value === "string") {
      const redacted = redactSupportString(value, key);
      for (const reason of redacted.reasons) findings.push({ path, reason });
      return redacted.value;
    }
    if (Array.isArray(value)) return value.map((item, index) => redact(item, `${path}[${index}]`, key));
    if (isObject(value)) {
      const output: Record<string, unknown> = {};
      for (const [childKey, childValue] of Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) {
        output[childKey] = redact(childValue, path ? `${path}.${childKey}` : childKey, childKey);
      }
      return output;
    }
    return value;
  }

  return { redacted: redact(input, "", "") as T, findings };
}

export function evaluateSupportCapabilityAccess(
  capability: SupportCapability,
  context: SupportAccessContext,
): SupportAccessDecision {
  const reasons: string[] = [];
  const requiredRank = ROLE_RANK[capability.requiredRole] ?? Number.POSITIVE_INFINITY;
  const actualRank = ROLE_RANK[context.role] ?? -1;
  const writeClass = !capability.readWriteClass.includes("read-only");

  if (actualRank < requiredRank) reasons.push("required_role_not_met");
  if (!context.sameTenant) reasons.push("tenant_boundary_not_met");
  if (writeClass && capability.stepUpRequirement !== "not-required-read-only" && !context.hasStepUp) {
    reasons.push("step_up_required");
  }
  if (writeClass && !context.auditEventRecorded) reasons.push("audit_event_required");

  return {
    allowed: reasons.length === 0,
    reasons,
    supportSafeAlternative: capability.supportSafeAlternative,
  };
}

function isFutureWithinHours(expiresAt: string | null, now: string, maxHours: number): boolean {
  if (!expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  const current = Date.parse(now);
  if (!Number.isFinite(expiry) || !Number.isFinite(current)) return false;
  return expiry > current && expiry - current <= maxHours * 60 * 60 * 1000;
}

export function evaluateBreakGlassRequest(input: BreakGlassRequest): SupportAccessDecision {
  const reasons: string[] = [];
  if (!input.enabled) reasons.push("disabled_by_default");
  if (input.actorRole !== "admin") reasons.push("admin_role_required");
  if (!input.reason || input.reason.trim().length < 12) reasons.push("reason_capture_required");
  if (!isFutureWithinHours(input.expiresAt, input.now, 4)) reasons.push("short_expiry_required");
  if (!input.hasStepUp) reasons.push("step_up_required");
  if (!input.auditEventRecorded) reasons.push("audit_event_required");
  if (!input.customerImpactAcknowledged) reasons.push("customer_impact_warning_required");
  return {
    allowed: reasons.length === 0,
    reasons,
    supportSafeAlternative: "Use redacted diagnostics and customer-approved workflow actions instead of break-glass access.",
  };
}

export function isProductionLikeEnvironment(input: Pick<DemoSeedRequest, "nodeEnv" | "vercelEnv">): boolean {
  return input.nodeEnv === "production" || input.vercelEnv === "production";
}

export function evaluateDemoSeedRequest(input: DemoSeedRequest): SupportAccessDecision {
  const reasons: string[] = [];
  if (!input.enabled) reasons.push("env_flag_required");
  if (input.role !== "admin") reasons.push("admin_role_required");
  if (!input.orgId) reasons.push("organization_scope_required");
  if (isProductionLikeEnvironment(input)) reasons.push("production_refusal");
  if (!input.fixtureOnly) reasons.push("fixture_data_only_required");
  if (!input.auditEventRecorded) reasons.push("audit_event_required");
  return {
    allowed: reasons.length === 0,
    reasons,
    supportSafeAlternative: "Use static demo fixtures or a local-only fixture workspace instead of seeding production-like data.",
  };
}

export function buildSupportBundleReport(input: {
  bundle: Record<string, unknown>;
  capabilityIds: readonly string[];
}) {
  const redaction = redactSupportBundle(input.bundle);
  const capabilityIds = new Set(OPERATIONAL_SUPPORT_CAPABILITIES.map((capability) => capability.id));
  const missingCapabilityIds = input.capabilityIds.filter((id) => !capabilityIds.has(id)).sort();
  return {
    ok: redaction.findings.length > 0 && missingCapabilityIds.length === 0,
    redactionFindingCount: redaction.findings.length,
    redactionFindings: redaction.findings,
    missingCapabilityIds,
    redacted: redaction.redacted,
  };
}
