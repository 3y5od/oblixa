#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { analyzePrivacyInventory } from "./check-privacy-inventory.mjs";
import { analyzePublicSeoSurface } from "./check-public-seo-surface.mjs";
import { analyzeSubprocessorChangeSla } from "./check-subprocessor-change-sla.mjs";
import { analyzeSubprocessorsDrift } from "./check-subprocessors-drift.mjs";
import { analyzeSubprocessorsPrivacyAlignment } from "./check-subprocessors-privacy-alignment.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-legal-trust-compliance.json";
const ARTIFACT_REL = "artifacts/operational-legal-trust-compliance.json";
const WRITE = process.argv.includes("--write");
const AS_OF_DATE = "2026-05-28";

const REQUIRED_TRUST_SURFACES = [
  "terms",
  "privacy",
  "security",
  "cookies",
  "acceptable-use",
  "accessibility",
  "contact",
  "security-txt",
  "subprocessors",
  "dpa-request",
];
const REQUIRED_FRAMEWORKS = ["SOC 2", "ISO 27001", "OWASP ASVS", "privacy", "internal"];
const REQUIRED_SUBPROCESSOR_DATA_CLASSES = [
  "account_data",
  "workspace_content",
  "contract_content",
  "billing_data",
  "email_delivery",
  "error_telemetry",
  "ai_extraction",
  "rate_limit_metadata",
];

const SCRIPT_MARKERS = {
  "scripts/check-subprocessors-drift.mjs": [
    "analyzeSubprocessorsDrift",
    "subprocessor_required_field_missing",
    "subprocessor_checksum_mismatch",
    "artifacts/subprocessors-diff.json",
  ],
  "scripts/check-subprocessor-change-sla.mjs": [
    "analyzeSubprocessorChangeSla",
    "noticeLeadTimeDays",
    "notificationSlaDays",
    "insufficient_notice_lead_before_review_window",
  ],
  "scripts/check-subprocessors-privacy-alignment.mjs": [
    "analyzeSubprocessorsPrivacyAlignment",
    "privacyInventoryRefs",
    "subprocessor_privacy_inventory_ref_missing",
  ],
  "src/lib/operational-legal-trust-compliance.ts": [
    "evaluatePublicClaimText",
    "evaluateSubprocessorIntegrity",
    "evaluateConsentInventory",
    "evaluateComplianceFrameworkMappings",
    "certificationClaim",
  ],
  "src/lib/operational-legal-trust-compliance.test.ts": [
    "allows negated prohibited claims",
    "validates subprocessor checksums",
    "requires tracking-like storage",
    "does not allow compliance mappings to claim certification",
  ],
};

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readText(rel) {
  const abs = path.join(ROOT, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(rel, fallback = null) {
  const text = readText(rel);
  return text ? JSON.parse(text) : fallback;
}

function writeJson(rel, value) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function packageScripts() {
  return readJson("package.json", { scripts: {} })?.scripts ?? {};
}

function isPackageScriptRef(value, scripts) {
  return Boolean(scripts[value] || value.startsWith("check:") || value.startsWith("audit:") || value.startsWith("test:"));
}

function requirePackageScript(scripts, command, issues, fields = {}) {
  if (!scripts[command]) issues.push(issue("operational_legal_trust_missing_package_script", { ...fields, command }));
}

function daysBetween(startIso, endIso) {
  const start = Date.parse(`${startIso}T00:00:00.000Z`);
  const end = Date.parse(`${endIso}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.POSITIVE_INFINITY;
  return Math.floor((end - start) / 86_400_000);
}

function collectMarkerRows(markerMap, issues) {
  const rows = [];
  for (const [rel, markers] of Object.entries(markerMap)) {
    const source = readText(rel);
    const missing = [];
    if (!source) {
      missing.push(...markers);
      issues.push(issue("operational_legal_trust_marker_file_missing", { path: rel }));
    } else {
      for (const marker of markers) {
        if (!source.includes(marker)) {
          missing.push(marker);
          issues.push(issue("operational_legal_trust_marker_missing", { path: rel, marker }));
        }
      }
    }
    rows.push({ path: rel, markerCount: markers.length, missingCount: missing.length, ok: missing.length === 0 });
  }
  return rows;
}

function beforeMatchWindow(text, matchIndex, windowChars) {
  return text.slice(Math.max(0, matchIndex - windowChars), matchIndex).toLowerCase();
}

function scanPublicClaimText(config, issues) {
  const findings = [];
  for (const rel of config.publicClaimFiles ?? []) {
    const source = readText(rel);
    if (!source) {
      issues.push(issue("operational_legal_trust_public_claim_file_missing", { path: rel }));
      continue;
    }
    const text = source.replace(/\s+/gu, " ");
    for (const rule of config.publicClaimRules?.forbiddenPatterns ?? []) {
      const pattern = new RegExp(rule.pattern, "giu");
      for (const match of text.matchAll(pattern)) {
        const windowText = beforeMatchWindow(text, match.index ?? 0, config.publicClaimRules.negationWindowChars);
        const negated = (rule.allowedNegations ?? []).some((needle) => windowText.includes(String(needle).toLowerCase()));
        if (!negated) {
          const finding = {
            issue: "operational_legal_trust_forbidden_public_claim",
            path: rel,
            rule: rule.id,
            excerpt: match[0].slice(0, 120),
          };
          findings.push(finding);
          issues.push(finding);
        }
      }
    }
  }

  for (const row of config.publicClaimRules?.requiredDisclaimers ?? []) {
    const source = readText(row.path);
    if (!source.includes(row.marker)) {
      issues.push(issue("operational_legal_trust_required_disclaimer_missing", { id: row.id, path: row.path, marker: row.marker }));
    }
  }
  return findings;
}

function walkFiles(rel, out = []) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const childRel = path.join(rel, entry.name).replace(/\\/gu, "/");
    if (entry.isDirectory()) walkFiles(childRel, out);
    else if (entry.isFile()) out.push(childRel);
  }
  return out;
}

function isExcluded(rel, excludedFragments) {
  return excludedFragments.some((fragment) => rel.includes(fragment));
}

function scanConsentSignals(config, issues) {
  const consent = config.consentAndStorage ?? {};
  const inventory = consent.inventory ?? [];
  const inventoryByPath = new Map();
  for (const row of inventory) {
    if (!inventoryByPath.has(row.sourcePath)) inventoryByPath.set(row.sourcePath, []);
    inventoryByPath.get(row.sourcePath).push(row);
  }

  const observations = [];
  const patterns = (consent.signalPatterns ?? []).map((pattern) => new RegExp(pattern, "u"));
  for (const root of consent.scanRoots ?? []) {
    for (const rel of walkFiles(root)) {
      if (!/\.(?:ts|tsx|js|jsx|mjs)$/u.test(rel)) continue;
      if (isExcluded(rel, consent.excludedPathFragments ?? [])) continue;
      const source = readText(rel);
      for (const pattern of patterns) {
        if (!pattern.test(source)) continue;
        const rows = inventoryByPath.get(rel) ?? [];
        const covered = rows.some((row) => source.includes(row.marker));
        const observation = { path: rel, pattern: String(pattern), covered };
        observations.push(observation);
        if (!covered) {
          issues.push(issue("operational_legal_trust_consent_signal_unclassified", { path: rel, pattern: String(pattern) }));
        }
      }
    }
  }

  for (const row of inventory) {
    const source = readText(row.sourcePath);
    if (!source) issues.push(issue("operational_legal_trust_consent_inventory_source_missing", { id: row.id, path: row.sourcePath }));
    else if (!source.includes(row.marker)) {
      issues.push(issue("operational_legal_trust_consent_inventory_marker_missing", { id: row.id, path: row.sourcePath, marker: row.marker }));
    }
    for (const field of ["storageType", "consentCategory", "provider", "dataClass", "expiry", "optOutBehavior"]) {
      if (!String(row[field] ?? "").trim()) {
        issues.push(issue("operational_legal_trust_consent_inventory_field_missing", { id: row.id, field }));
      }
    }
    if (row.trackingLike && row.consentCategory === "essential") {
      issues.push(issue("operational_legal_trust_tracking_like_marked_essential", { id: row.id }));
    }
    if (row.trackingLike && !/revocation|opt|unsubscribe|preference/iu.test(row.optOutBehavior ?? "")) {
      issues.push(issue("operational_legal_trust_tracking_like_missing_opt_out", { id: row.id }));
    }
  }

  return observations;
}

function validateTrustSurfaces(config, issues) {
  const ids = new Set((config.trustSurfaces ?? []).map((row) => row.id));
  for (const id of REQUIRED_TRUST_SURFACES) {
    if (!ids.has(id)) issues.push(issue("operational_legal_trust_surface_missing", { id }));
  }
  for (const surface of config.trustSurfaces ?? []) {
    if (!surface.ownerArea) issues.push(issue("operational_legal_trust_surface_owner_missing", { id: surface.id }));
    if (!surface.path || !fileExists(surface.path)) {
      issues.push(issue("operational_legal_trust_surface_path_missing", { id: surface.id, path: surface.path ?? null }));
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(surface.lastReviewed ?? "")) {
      issues.push(issue("operational_legal_trust_surface_last_reviewed_invalid", { id: surface.id }));
    } else if (daysBetween(surface.lastReviewed, AS_OF_DATE) > Number(surface.freshnessWindowDays ?? 0)) {
      issues.push(issue("operational_legal_trust_surface_stale", { id: surface.id, lastReviewed: surface.lastReviewed }));
    }
    const source = readText(surface.path);
    for (const marker of surface.requiredMarkers ?? []) {
      if (!source.includes(marker)) {
        issues.push(issue("operational_legal_trust_surface_marker_missing", { id: surface.id, path: surface.path, marker }));
      }
    }
    if (/new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/u.test(source)) {
      issues.push(issue("operational_legal_trust_surface_uses_runtime_review_date", { id: surface.id, path: surface.path }));
    }
  }
}

function validateClaims(config, scripts, issues) {
  const capabilityIds = new Set((config.capabilityEvidence ?? []).map((row) => row.id));
  for (const row of config.capabilityEvidence ?? []) {
    for (const ref of row.evidenceRefs ?? []) {
      if (!fileExists(ref) && !isPackageScriptRef(ref, scripts)) {
        issues.push(issue("operational_legal_trust_capability_evidence_missing", { id: row.id, ref }));
      }
    }
    for (const command of row.validationCommands ?? []) requirePackageScript(scripts, command, issues, { capability: row.id });
  }
  for (const claim of config.publicClaims ?? []) {
    if (!fileExists(claim.sourcePath)) {
      issues.push(issue("operational_legal_trust_public_claim_source_missing", { id: claim.id, sourcePath: claim.sourcePath }));
    }
    if (!claim.allowedScope) issues.push(issue("operational_legal_trust_public_claim_scope_missing", { id: claim.id }));
    if ((claim.capabilityRefs ?? []).length === 0 && !claim.manualBoundary) {
      issues.push(issue("operational_legal_trust_public_claim_unmapped", { id: claim.id }));
    }
    for (const ref of claim.capabilityRefs ?? []) {
      if (!capabilityIds.has(ref)) {
        issues.push(issue("operational_legal_trust_public_claim_capability_unknown", { id: claim.id, ref }));
      }
    }
    requirePackageScript(scripts, claim.validationCommand, issues, { claim: claim.id });
  }
  return scanPublicClaimText(config, issues);
}

function validateSubprocessors(config, issues, driftReport) {
  const data = readJson(config.subprocessorIntegrity.artifact, {});
  const rows = data.subprocessors ?? [];
  const coveredDataClasses = new Set(rows.flatMap((row) => row.dataClasses ?? []));
  for (const dataClass of REQUIRED_SUBPROCESSOR_DATA_CLASSES) {
    if (!coveredDataClasses.has(dataClass)) {
      issues.push(issue("operational_legal_trust_subprocessor_data_class_missing", { dataClass }));
    }
  }
  if (config.subprocessorIntegrity.diffArtifact !== "artifacts/subprocessors-diff.json") {
    issues.push(issue("operational_legal_trust_subprocessor_diff_artifact_unexpected"));
  }
  for (const requiredField of config.subprocessorIntegrity.requiredFields ?? []) {
    for (const row of rows) {
      const value = row[requiredField];
      if (Array.isArray(value) ? value.length === 0 : value == null || value === "") {
        issues.push(issue("operational_legal_trust_subprocessor_required_field_missing", { id: row.id ?? "(missing)", requiredField }));
      }
    }
  }
  if (!driftReport.ok) {
    issues.push(issue("operational_legal_trust_subprocessor_drift_failed", { issueCount: driftReport.issueCount }));
  }
}

function validateCompliance(config, scripts, issues) {
  const mappings = config.complianceTraceability?.mappings ?? [];
  const frameworks = new Set(mappings.map((row) => row.framework));
  for (const framework of REQUIRED_FRAMEWORKS) {
    if (!frameworks.has(framework)) issues.push(issue("operational_legal_trust_framework_missing", { framework }));
  }
  for (const row of mappings) {
    if (row.certificationClaim) issues.push(issue("operational_legal_trust_certification_claimed", { id: row.id }));
    if (!row.manualBoundary) issues.push(issue("operational_legal_trust_compliance_manual_boundary_missing", { id: row.id }));
    for (const ref of row.evidenceRefs ?? []) {
      if (!fileExists(ref) && !isPackageScriptRef(ref, scripts)) {
        issues.push(issue("operational_legal_trust_compliance_evidence_missing", { id: row.id, ref }));
      }
    }
  }
}

function summarize(checkId, report) {
  return {
    checkId,
    ok: Boolean(report.ok),
    issueCount: Number(report.issueCount ?? report.violationCount ?? report.issues?.length ?? report.violations?.length ?? 0),
  };
}

function generatedTrustSurface(surface) {
  if (!surface || typeof surface !== "object") return surface;
  const contactPath = String(surface.contactPath ?? "");
  return {
    ...surface,
    contactPath: contactPath.startsWith("mailto:") ? "mailto:[redacted]" : surface.contactPath,
  };
}

export function buildOperationalLegalTrustComplianceReport() {
  const config = readJson(CONFIG_REL, {});
  const scripts = packageScripts();
  const ci = readText(".github/workflows/ci.yml");
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-legal-trust-compliance") {
    issues.push(issue("operational_legal_trust_invalid_config_metadata"));
  }
  if (config.generatedArtifact !== ARTIFACT_REL) {
    issues.push(issue("operational_legal_trust_unexpected_generated_artifact", { generatedArtifact: config.generatedArtifact ?? null }));
  }
  for (const rel of config.sourceFiles ?? []) {
    if (!fileExists(rel)) issues.push(issue("operational_legal_trust_source_file_missing", { path: rel }));
  }
  for (const command of config.requiredValidationCommands ?? []) {
    requirePackageScript(scripts, command, issues, { source: "requiredValidationCommands" });
  }
  requirePackageScript(scripts, "check:operational-legal-trust-compliance", issues);
  if (!ci.includes("npm run check:operational-legal-trust-compliance")) {
    issues.push(issue("operational_legal_trust_missing_ci_command", { command: "npm run check:operational-legal-trust-compliance" }));
  }

  validateTrustSurfaces(config, issues);
  const claimFindings = validateClaims(config, scripts, issues);
  const consentObservations = scanConsentSignals(config, issues);
  const driftReport = analyzeSubprocessorsDrift(ROOT, { strict: true });
  validateSubprocessors(config, issues, driftReport);
  validateCompliance(config, scripts, issues);
  const markerRows = collectMarkerRows(SCRIPT_MARKERS, issues);

  const delegatedChecks = [
    summarize("privacy-inventory", analyzePrivacyInventory(ROOT)),
    summarize("public-seo-surface", analyzePublicSeoSurface(ROOT)),
    summarize("subprocessors-drift", driftReport),
    summarize("subprocessor-change-sla", analyzeSubprocessorChangeSla(ROOT, { strict: true, asOfDate: AS_OF_DATE })),
    summarize("subprocessors-privacy-alignment", analyzeSubprocessorsPrivacyAlignment(ROOT)),
  ];
  for (const report of delegatedChecks) {
    if (!report.ok) issues.push(issue("operational_legal_trust_delegated_check_failed", { checkId: report.checkId, issueCount: report.issueCount }));
  }

  return {
    schemaVersion: 1,
    source: "code-owned-operational-legal-trust-compliance",
    generatedArtifact: ARTIFACT_REL,
    ok: issues.length === 0,
    summary: {
      trustSurfaceCount: config.trustSurfaces?.length ?? 0,
      publicClaimCount: config.publicClaims?.length ?? 0,
      capabilityEvidenceCount: config.capabilityEvidence?.length ?? 0,
      subprocessorCount: driftReport.integrity?.subprocessorCount ?? 0,
      consentInventoryCount: config.consentAndStorage?.inventory?.length ?? 0,
      complianceMappingCount: config.complianceTraceability?.mappings?.length ?? 0,
    },
    requiredValidationCommands: config.requiredValidationCommands ?? [],
    trustSurfaces: (config.trustSurfaces ?? []).map(generatedTrustSurface),
    publicClaims: config.publicClaims ?? [],
    claimFindings,
    subprocessorIntegrity: config.subprocessorIntegrity ?? null,
    consentObservations,
    complianceTraceability: config.complianceTraceability ?? null,
    markerRows,
    delegatedChecks,
    manualBoundary: config.manualBoundary ?? null,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

const report = buildOperationalLegalTrustComplianceReport();

if (WRITE) {
  writeJson(ARTIFACT_REL, report);
} else {
  const existing = readJson(ARTIFACT_REL, null);
  if (!existing) {
    report.issues.push(issue("operational_legal_trust_artifact_missing", { artifact: ARTIFACT_REL }));
    report.issueCount = report.issues.length;
    report.ok = false;
  } else if (stableStringify(existing) !== stableStringify(report)) {
    report.issues.push(issue("operational_legal_trust_artifact_drift", { artifact: ARTIFACT_REL, writeCommand: "npm run write:operational-legal-trust-compliance" }));
    report.issueCount = report.issues.length;
    report.ok = false;
  }
}

console.log(stableStringify(report));

if (!report.ok) {
  process.exitCode = 1;
}
