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
  "reviewed-access-security-boundary",
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

export {
  AS_OF_DATE,
  REQUIRED_FRAMEWORKS,
  REQUIRED_SUBPROCESSOR_DATA_CLASSES,
  REQUIRED_TRUST_SURFACES,
  SCRIPT_MARKERS,
};
