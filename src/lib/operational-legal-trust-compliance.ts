import { createHash } from "node:crypto";
import config from "../../config/operational-legal-trust-compliance.json";

export type LegalTrustComplianceConfig = typeof config;
export type TrustSurface = LegalTrustComplianceConfig["trustSurfaces"][number];
export type PublicClaim = LegalTrustComplianceConfig["publicClaims"][number];
export type CapabilityEvidence = LegalTrustComplianceConfig["capabilityEvidence"][number];
export type ConsentInventoryEntry = LegalTrustComplianceConfig["consentAndStorage"]["inventory"][number];
export type ComplianceFrameworkMapping = LegalTrustComplianceConfig["complianceTraceability"]["mappings"][number];

export type SubprocessorEntry = {
  id: string;
  name: string;
  purpose: string;
  dataClasses: readonly string[];
  region: string;
  owner: string;
  changeDate: string;
  notificationSlaDays: number;
  lastNotifiedAt?: string;
  nextReviewDue?: string;
  noticeLeadTimeDays?: number;
  privacyInventoryRefs?: readonly string[];
  validationCommand?: string;
  checksum: string;
};

export type LegalTrustIssue = {
  issue: string;
  target: string;
  detail?: string;
};

export const OPERATIONAL_LEGAL_TRUST_COMPLIANCE_CONFIG = config;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/u;
const CHECKSUM_PREFIX = "sha256-";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJson(entryValue)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseIsoDate(value: string): number {
  if (!ISO_DATE_RE.test(value)) return Number.NaN;
  return Date.parse(`${value}T00:00:00.000Z`);
}

function daysBetween(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.POSITIVE_INFINITY;
  return Math.floor((end - start) / 86_400_000);
}

function beforeMatchWindow(text: string, matchIndex: number, windowChars: number): string {
  return text.slice(Math.max(0, matchIndex - windowChars), matchIndex).toLowerCase();
}

export function evaluateTrustSurfaceFreshness(
  surfaces: readonly TrustSurface[],
  options: { asOfDate: string },
): { ok: boolean; issues: LegalTrustIssue[] } {
  const issues: LegalTrustIssue[] = [];
  for (const surface of surfaces) {
    if (!surface.ownerArea.trim()) issues.push({ issue: "trust_surface_missing_owner", target: surface.id });
    if (!surface.path.trim()) issues.push({ issue: "trust_surface_missing_path", target: surface.id });
    if (!ISO_DATE_RE.test(surface.lastReviewed)) {
      issues.push({ issue: "trust_surface_invalid_last_reviewed", target: surface.id });
      continue;
    }
    if (daysBetween(surface.lastReviewed, options.asOfDate) > surface.freshnessWindowDays) {
      issues.push({
        issue: "trust_surface_review_stale",
        target: surface.id,
        detail: `${surface.lastReviewed}+${surface.freshnessWindowDays}d`,
      });
    }
    if (!surface.contactPath.trim()) issues.push({ issue: "trust_surface_missing_contact_path", target: surface.id });
    if (surface.requiredMarkers.length === 0) {
      issues.push({ issue: "trust_surface_missing_required_markers", target: surface.id });
    }
  }
  return { ok: issues.length === 0, issues };
}

export function evaluatePublicClaims(
  claims: readonly PublicClaim[],
  capabilities: readonly CapabilityEvidence[],
): { ok: boolean; issues: LegalTrustIssue[] } {
  const issues: LegalTrustIssue[] = [];
  const capabilityIds = new Set(capabilities.map((row) => row.id));

  for (const claim of claims) {
    if (!claim.claim.trim()) issues.push({ issue: "public_claim_missing_text", target: claim.id });
    if (!claim.sourcePath.trim()) issues.push({ issue: "public_claim_missing_source", target: claim.id });
    if (!claim.allowedScope.trim()) issues.push({ issue: "public_claim_missing_allowed_scope", target: claim.id });
    if (claim.capabilityRefs.length === 0 && !("manualBoundary" in claim && claim.manualBoundary)) {
      issues.push({ issue: "public_claim_missing_capability_or_boundary", target: claim.id });
    }
    for (const ref of claim.capabilityRefs) {
      if (!capabilityIds.has(ref)) issues.push({ issue: "public_claim_unknown_capability_ref", target: claim.id, detail: ref });
    }
    if (/\b(?:certified|certification|compliant|guarantee)\b/iu.test(claim.claim)) {
      issues.push({ issue: "public_claim_contains_certification_language", target: claim.id });
    }
  }

  return { ok: issues.length === 0, issues };
}

export function evaluatePublicClaimText(
  text: string,
  rules: LegalTrustComplianceConfig["publicClaimRules"],
): { ok: boolean; findings: LegalTrustIssue[] } {
  const findings: LegalTrustIssue[] = [];
  const normalizedText = text.replace(/\s+/gu, " ");
  for (const rule of rules.forbiddenPatterns) {
    const pattern = new RegExp(rule.pattern, "giu");
    for (const match of normalizedText.matchAll(pattern)) {
      const index = match.index ?? 0;
      const windowText = beforeMatchWindow(normalizedText, index, rules.negationWindowChars);
      const negated = rule.allowedNegations.some((needle) => windowText.includes(needle.toLowerCase()));
      if (!negated) {
        findings.push({
          issue: "forbidden_public_claim",
          target: rule.id,
          detail: match[0].slice(0, 120),
        });
      }
    }
  }
  return { ok: findings.length === 0, findings };
}

export function canonicalSubprocessorPayload(entry: Omit<SubprocessorEntry, "checksum">): string {
  return stableJson({
    changeDate: entry.changeDate,
    dataClasses: [...entry.dataClasses].sort((a, b) => a.localeCompare(b)),
    id: entry.id,
    lastNotifiedAt: entry.lastNotifiedAt ?? null,
    name: entry.name,
    nextReviewDue: entry.nextReviewDue ?? null,
    noticeLeadTimeDays: entry.noticeLeadTimeDays ?? null,
    notificationSlaDays: entry.notificationSlaDays,
    owner: entry.owner,
    privacyInventoryRefs: [...(entry.privacyInventoryRefs ?? [])].sort((a, b) => a.localeCompare(b)),
    purpose: entry.purpose,
    region: entry.region,
    validationCommand: entry.validationCommand ?? null,
  });
}

export function checksumSubprocessorEntry(entry: Omit<SubprocessorEntry, "checksum">): string {
  return `${CHECKSUM_PREFIX}${sha256(canonicalSubprocessorPayload(entry))}`;
}

export function evaluateSubprocessorIntegrity(
  entries: readonly SubprocessorEntry[],
  options: { requiredDataClasses: readonly string[]; minimumNoticeLeadTimeDays: number },
): { ok: boolean; issues: LegalTrustIssue[] } {
  const issues: LegalTrustIssue[] = [];
  const coveredDataClasses = new Set<string>();
  const ids = new Set<string>();

  for (const entry of entries) {
    if (ids.has(entry.id)) issues.push({ issue: "subprocessor_duplicate_id", target: entry.id });
    ids.add(entry.id);
    for (const field of ["id", "name", "purpose", "region", "owner", "changeDate", "checksum"] as const) {
      if (!String(entry[field] ?? "").trim()) {
        issues.push({ issue: "subprocessor_required_field_missing", target: entry.id || "(missing)", detail: field });
      }
    }
    if (!ISO_DATE_RE.test(entry.changeDate)) {
      issues.push({ issue: "subprocessor_change_date_invalid", target: entry.id });
    }
    if (entry.notificationSlaDays < options.minimumNoticeLeadTimeDays) {
      issues.push({ issue: "subprocessor_notification_sla_too_short", target: entry.id });
    }
    if (entry.noticeLeadTimeDays !== undefined && entry.noticeLeadTimeDays < options.minimumNoticeLeadTimeDays) {
      issues.push({ issue: "subprocessor_notice_lead_time_too_short", target: entry.id });
    }
    if (entry.dataClasses.length === 0) {
      issues.push({ issue: "subprocessor_data_classes_missing", target: entry.id });
    }
    for (const dataClass of entry.dataClasses) coveredDataClasses.add(dataClass);
    const expected = checksumSubprocessorEntry(entry);
    if (entry.checksum !== expected) {
      issues.push({ issue: "subprocessor_checksum_mismatch", target: entry.id, detail: expected });
    }
  }

  for (const dataClass of options.requiredDataClasses) {
    if (!coveredDataClasses.has(dataClass)) {
      issues.push({ issue: "subprocessor_required_data_class_uncovered", target: dataClass });
    }
  }

  return { ok: issues.length === 0, issues };
}

export function evaluateConsentInventory(
  inventory: readonly ConsentInventoryEntry[],
): { ok: boolean; issues: LegalTrustIssue[] } {
  const issues: LegalTrustIssue[] = [];
  const ids = new Set<string>();

  for (const entry of inventory) {
    if (ids.has(entry.id)) issues.push({ issue: "consent_inventory_duplicate_id", target: entry.id });
    ids.add(entry.id);
    for (const field of ["sourcePath", "marker", "storageType", "consentCategory", "provider", "dataClass", "expiry", "optOutBehavior"] as const) {
      if (!String(entry[field] ?? "").trim()) {
        issues.push({ issue: "consent_inventory_required_field_missing", target: entry.id, detail: field });
      }
    }
    if (entry.trackingLike && entry.consentCategory === "essential") {
      issues.push({ issue: "tracking_like_entry_cannot_be_essential_only", target: entry.id });
    }
    if (entry.trackingLike && !/revocation|opt|unsubscribe|preference/iu.test(entry.optOutBehavior)) {
      issues.push({ issue: "tracking_like_entry_missing_opt_out", target: entry.id });
    }
  }

  return { ok: issues.length === 0, issues };
}

export function evaluateComplianceFrameworkMappings(
  mappings: readonly ComplianceFrameworkMapping[],
  requiredFrameworks: readonly string[],
): { ok: boolean; issues: LegalTrustIssue[] } {
  const issues: LegalTrustIssue[] = [];
  const frameworks = new Set(mappings.map((row) => row.framework));

  for (const framework of requiredFrameworks) {
    if (!frameworks.has(framework)) {
      issues.push({ issue: "compliance_framework_missing", target: framework });
    }
  }
  for (const mapping of mappings) {
    if (!mapping.controlId.trim()) issues.push({ issue: "compliance_mapping_missing_control_id", target: mapping.id });
    if (mapping.evidenceRefs.length === 0) issues.push({ issue: "compliance_mapping_missing_evidence", target: mapping.id });
    if (mapping.certificationClaim) {
      issues.push({ issue: "compliance_mapping_claims_certification", target: mapping.id });
    }
    if (!mapping.manualBoundary.trim()) {
      issues.push({ issue: "compliance_mapping_missing_manual_boundary", target: mapping.id });
    }
  }

  return { ok: issues.length === 0, issues };
}

export function buildLegalTrustComplianceFixtureReport(input: {
  asOfDate: string;
  subprocessorEntries: readonly SubprocessorEntry[];
  claimText: string;
}) {
  const trust = evaluateTrustSurfaceFreshness(config.trustSurfaces, { asOfDate: input.asOfDate });
  const claims = evaluatePublicClaims(config.publicClaims, config.capabilityEvidence);
  const claimText = evaluatePublicClaimText(input.claimText, config.publicClaimRules);
  const subprocessors = evaluateSubprocessorIntegrity(input.subprocessorEntries, {
    minimumNoticeLeadTimeDays: config.subprocessorIntegrity.minimumNoticeLeadTimeDays,
    requiredDataClasses: config.subprocessorIntegrity.requiredDataClasses,
  });
  const consent = evaluateConsentInventory(config.consentAndStorage.inventory);
  const compliance = evaluateComplianceFrameworkMappings(
    config.complianceTraceability.mappings,
    config.complianceTraceability.frameworks,
  );

  return {
    ok: trust.ok && claims.ok && claimText.ok && subprocessors.ok && consent.ok && compliance.ok,
    trust,
    claims,
    claimText,
    subprocessors,
    consent,
    compliance,
  };
}
