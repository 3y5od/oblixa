export const RELEASE_STATE_PUBLIC_PROMISE = "Replace your contract-tracking spreadsheet." as const;

export const RELEASE_STATE_SUPPORTING_PROMISE =
  "Oblixa helps small teams track renewals, obligations, owners, evidence, and reports from signed contracts, with AI-assisted extraction that stays source-backed and human-reviewed." as const;

export const RELEASE_STATE_PUBLIC_PAGES = [
  { path: "/", purpose: "Homepage and public promise", primaryCta: "Request early access" },
  { path: "/product", purpose: "Core workflow explanation", primaryCta: "Request early access" },
  { path: "/early-access", purpose: "Early-access request capture", primaryCta: "Request early access" },
  { path: "/pricing", purpose: "Early-access pricing guidance", primaryCta: "Request early access" },
  { path: "/security", purpose: "Security basics with early-access limits", primaryCta: "Request early access" },
  { path: "/contact", purpose: "Early-access and support contact", primaryCta: "Request early access" },
  { path: "/login", purpose: "Existing approved-user login", primaryCta: "Sign in" },
] as const;

export const RELEASE_STATE_BEST_FIT_SIGNALS = [
  "small_b2b_company",
  "agency_or_consultancy",
  "founder_led_or_operations_led",
  "finance_or_operations_owner",
  "no_formal_legal_ops",
  "spreadsheet_folder_email_calendar_or_memory_tracker",
  "visible_renewal_owner_obligation_evidence_or_reporting_pain",
  "can_start_with_small_contract_subset",
  "low_procurement_burden",
  "willing_to_use_early_product_with_feedback",
] as const;

export const RELEASE_STATE_POOR_FIT_SIGNALS = [
  "large_enterprise_procurement",
  "public_company_procurement",
  "healthcare_or_hipaa_need",
  "financial_institution_security_review",
  "government_or_education_procurement",
  "soc2_iso_or_custom_dpa_required_before_evaluation",
  "drafting_redlining_negotiation_or_esignature_need",
  "legal_advice_or_compliance_certification_need",
  "full_clm_migration_need",
  "urgent_mission_critical_deadline",
  "sla_required",
] as const;

export const RELEASE_STATE_ICP_HYPOTHESES = [
  {
    id: "b2b_service_firms",
    label: "B2B service firms",
    test: "Do they track client renewals, SOW dates, cancellation windows, or deliverable obligations manually?",
  },
  {
    id: "small_saas_or_tech_startups",
    label: "Small SaaS or tech startups",
    test: "Is contract tracking painful before they have legal operations?",
  },
  {
    id: "small_operations_or_finance_teams",
    label: "Small operations or finance teams",
    test: "Do recurring vendor, lease, financing, or service-contract reports affect operations?",
  },
] as const;

export const RELEASE_STATE_DISCOVERY_QUESTIONS = [
  "Where do signed contracts live today?",
  "Do you have a spreadsheet or tracker for them?",
  "Who updates the tracker after signature?",
  "Who owns renewal dates and notice deadlines?",
  "What happens when someone asks which contracts renew in the next 90 days?",
  "What contract detail is most annoying to find?",
  "Have you ever missed, almost missed, or manually chased a renewal or obligation?",
  "What reports or summaries do leadership, finance, customers, or auditors ask for?",
  "What would make the current process break as you grow?",
  "Would you trust AI-suggested contract fields if every value had a source snippet and required review?",
] as const;

export const RELEASE_STATE_DISCOVERY_NOTE_FIELDS = [
  "company",
  "contact",
  "role",
  "segment",
  "contractTypes",
  "estimatedContractCount",
  "currentSystem",
  "trackerOwner",
  "spreadsheetColumns",
  "mostPainfulTrackingJob",
  "renewalNoticeProcess",
  "ownerAssignmentProcess",
  "obligationFollowUpProcess",
  "reportingNeeds",
  "evidenceNeeds",
  "securityProcurementConcerns",
  "switchMotivation",
  "adoptionBlockers",
  "exactPhrases",
  "fitVerdict",
  "nextAction",
] as const;

export const RELEASE_STATE_OBJECTION_ANSWERS = [
  {
    id: "is_clm",
    question: "Is this a CLM?",
    answer:
      "Not a full CLM. Oblixa starts after signature and focuses on replacing the tracker for renewals, owners, obligations, evidence, and reports.",
  },
  {
    id: "draft_redline_negotiate",
    question: "Can it draft, redline, or negotiate contracts?",
    answer:
      "No. Oblixa is intentionally focused on signed contracts and post-signature tracking.",
  },
  {
    id: "legal_advice",
    question: "Does it provide legal advice?",
    answer:
      "No. Oblixa helps organize and track contract information. Your team remains responsible for reviewing fields and making business or legal decisions.",
  },
  {
    id: "renewal_guarantee",
    question: "Can it guarantee we never miss a renewal?",
    answer:
      "No system should promise that. Oblixa is designed to make renewal and notice tracking more visible and accountable, especially compared with spreadsheets.",
  },
  {
    id: "security_questionnaire",
    question: "Can you pass our security questionnaire?",
    answer:
      "Oblixa has security-conscious defaults, roles, audit history, and exportability, but early access is not intended for teams that require formal enterprise security review before evaluation.",
  },
  {
    id: "full_migration",
    question: "Do we have to migrate every contract?",
    answer:
      "No. The recommended evaluation starts with a small subset or a redacted sample set. The goal is to validate the workflow before migrating everything.",
  },
  {
    id: "cost",
    question: "What does it cost?",
    answer:
      "Early-access pricing is being shaped through evaluations. If Oblixa becomes part of your workflow, continued use should be expected to move to a paid founding monthly plan.",
  },
  {
    id: "keep_spreadsheet",
    question: "Why not just keep using a spreadsheet?",
    answer:
      "If the spreadsheet is reliable, owned, and easy to report from, keep it. Oblixa is for teams where the tracker is becoming unreliable.",
  },
] as const;

export const RELEASE_STATE_OUTREACH_TEMPLATES = {
  warmInitial:
    "I am building Oblixa for teams that track signed contracts in spreadsheets. It is not a CLM or e-signature tool. Would you be open to showing how you track signed agreements today?",
  warmFollowUp:
    "Just following up. A redacted tracker or rough async description would be enough if a call is inconvenient.",
  coldInitial:
    "Do you track signed contracts in a spreadsheet today? I am looking for a few early users who can show me how contract tracking works today.",
  coldFollowUp:
    "Oblixa is not for drafting or signing contracts; it is for the work after signature: renewal dates, owners, obligations, evidence, and reports.",
  finalFollowUp:
    "Last note from me. Is there someone else who owns the contract tracker, renewals, or signed customer/vendor agreements?",
} as const;

export const RELEASE_STATE_EVALUATION_STATES = [
  "requested",
  "reviewed",
  "qualified",
  "invited",
  "started",
  "active",
  "activated",
  "paused",
  "closed",
  "converted",
  "not_qualified",
] as const;

export const RELEASE_STATE_ACTIVATION_REQUIREMENTS = [
  "upload_or_import_contracts",
  "approve_source_backed_field",
  "assign_owner_or_key_date",
  "dashboard_or_work_state_updates",
] as const;

export const RELEASE_STATE_GRADUATION_CRITERIA = [
  "three_evaluations_with_real_or_realistic_workflows",
  "two_evaluations_reach_activation",
  "one_user_would_be_disappointed_to_lose_product",
  "same_pain_repeats_across_prospects",
  "onboarding_mostly_async",
  "support_issues_bounded",
  "copy_reflects_customer_language",
  "pricing_tested_with_real_buyers",
  "security_deletion_export_expectations_clear",
] as const;

export const RELEASE_STATE_MANUAL_BOUNDARIES = [
  "final_pricing",
  "paid_plan_timing",
  "legal_page_approval",
  "dpa_support_decision",
  "security_claim_approval",
  "customer_qualification",
  "evaluation_start",
  "outreach_sending",
  "live_billing_activation",
  "release_approval",
] as const;

export function classifyEarlyAccessFit(input: {
  hasManualTracker: boolean;
  canShowCurrentProcess: boolean;
  hasTrackingPain: boolean;
  canStartSmall: boolean;
  requiresEnterpriseProcurement: boolean;
  needsLegalAdviceOrClm: boolean;
}) {
  if (input.requiresEnterpriseProcurement || input.needsLegalAdviceOrClm) return "poor_fit";
  if (
    input.hasManualTracker &&
    input.canShowCurrentProcess &&
    input.hasTrackingPain &&
    input.canStartSmall
  ) {
    return "good_fit";
  }
  return "needs_review";
}
