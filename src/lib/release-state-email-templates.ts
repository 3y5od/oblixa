export const RELEASE_STATE_EMAIL_TEMPLATE_KEYS = [
  "verify_email",
  "welcome_after_signup",
  "invite_teammate",
  "calibration_completed",
  "first_contract_uploaded",
  "extraction_ready",
  "extraction_failed",
  "field_review_reminder",
  "upcoming_renewal_reminder",
  "notice_deadline_reminder",
  "work_item_assigned",
  "work_item_overdue",
  "evidence_requested",
  "evidence_overdue",
  "weekly_digest",
  "trial_day_3",
  "trial_day_10",
  "trial_ending_2_days",
  "payment_succeeded",
  "payment_failed",
  "cancellation_confirmation",
] as const;

export type ReleaseStateEmailTemplateKey = (typeof RELEASE_STATE_EMAIL_TEMPLATE_KEYS)[number];

export type ReleaseStateEmailTemplate = {
  key: ReleaseStateEmailTemplateKey;
  subject: string;
  preview: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
};

export const RELEASE_STATE_EMAIL_TEMPLATES: Record<
  ReleaseStateEmailTemplateKey,
  ReleaseStateEmailTemplate
> = {
  verify_email: {
    key: "verify_email",
    subject: "Verify your Oblixa email",
    preview: "Confirm your email address to finish setting up your workspace.",
    body: "Confirm your email address so your team can manage signed contracts, owners, dates, work, evidence, and reports.",
    ctaLabel: "Verify email",
    ctaHref: "/auth/callback",
  },
  welcome_after_signup: {
    key: "welcome_after_signup",
    subject: "Welcome to Oblixa",
    preview: "Start by uploading a few signed agreements.",
    body: "Start by uploading a few signed agreements. Oblixa will help you review key terms, assign owners, track dates, and turn contract obligations into work.",
    ctaLabel: "Upload first contract",
    ctaHref: "/contracts/new",
  },
  invite_teammate: {
    key: "invite_teammate",
    subject: "You are invited to an Oblixa workspace",
    preview: "Join your team to help track signed contracts.",
    body: "Join your team in Oblixa to help track contract deadlines, owners, work, evidence, and reports.",
    ctaLabel: "Accept invitation",
    ctaHref: "/login",
  },
  calibration_completed: {
    key: "calibration_completed",
    subject: "Your contract tracking workspace is ready",
    preview: "Upload a signed agreement to start reviewing fields and dates.",
    body: "Your workspace is ready to track contracts. Upload a signed agreement, review suggested fields, assign an owner, and add key dates.",
    ctaLabel: "Upload first contract",
    ctaHref: "/contracts/new",
  },
  first_contract_uploaded: {
    key: "first_contract_uploaded",
    subject: "Your first contract is in Oblixa",
    preview: "Review suggested fields when extraction is ready.",
    body: "Your contract has been uploaded. Review suggested fields before relying on them for deadlines, work, or reports.",
    ctaLabel: "Review fields",
    ctaHref: "/contracts/review",
  },
  extraction_ready: {
    key: "extraction_ready",
    subject: "Your contract is ready for review",
    preview: "Review source-backed suggestions before using them.",
    body: "Oblixa found suggested fields for your contract. Review the source-backed suggestions before relying on them for deadlines, work, or reports.",
    ctaLabel: "Review fields",
    ctaHref: "/contracts/review",
  },
  extraction_failed: {
    key: "extraction_failed",
    subject: "Manual contract review is needed",
    preview: "Add key fields manually for this contract.",
    body: "Extraction did not complete for this contract. You can still add and review key fields manually.",
    ctaLabel: "Open contract",
    ctaHref: "/contracts",
  },
  field_review_reminder: {
    key: "field_review_reminder",
    subject: "Fields are waiting for review",
    preview: "Confirm suggested contract fields before they drive work.",
    body: "Suggested contract fields are waiting for review. Confirm important values before using them for deadlines, owners, work, or reports.",
    ctaLabel: "Review fields",
    ctaHref: "/contracts/review",
  },
  upcoming_renewal_reminder: {
    key: "upcoming_renewal_reminder",
    subject: "Renewal date approaching",
    preview: "Review the contract owner and next action.",
    body: "A contract renewal or notice deadline is coming up. Review the contract, confirm the owner, and create any needed work.",
    ctaLabel: "Review renewal",
    ctaHref: "/renewals",
  },
  notice_deadline_reminder: {
    key: "notice_deadline_reminder",
    subject: "Notice deadline approaching",
    preview: "Confirm the owner and next step for this contract.",
    body: "A contract notice deadline is approaching. Confirm the owner and create any needed follow-up work.",
    ctaLabel: "Review notice deadline",
    ctaHref: "/renewals",
  },
  work_item_assigned: {
    key: "work_item_assigned",
    subject: "Contract work assigned to you",
    preview: "Open your assigned contract work.",
    body: "A contract work item has been assigned to you. Review the linked contract, due date, and next step.",
    ctaLabel: "Open work",
    ctaHref: "/work",
  },
  work_item_overdue: {
    key: "work_item_overdue",
    subject: "Contract work is overdue",
    preview: "Review overdue contract work and update the status.",
    body: "A contract work item is overdue. Review the linked contract, update the owner or due date, and record the next step.",
    ctaLabel: "Open work",
    ctaHref: "/work?status=overdue",
  },
  evidence_requested: {
    key: "evidence_requested",
    subject: "Evidence requested for contract work",
    preview: "Upload proof for a contract obligation.",
    body: "Evidence has been requested for contract work. Upload proof or update the request status when the work is complete.",
    ctaLabel: "Open evidence request",
    ctaHref: "/evidence",
  },
  evidence_overdue: {
    key: "evidence_overdue",
    subject: "Evidence request overdue",
    preview: "Follow up on overdue contract evidence.",
    body: "A contract evidence request is overdue. Review the linked contract and follow up with the owner.",
    ctaLabel: "Open evidence",
    ctaHref: "/evidence?status=overdue",
  },
  weekly_digest: {
    key: "weekly_digest",
    subject: "Oblixa weekly summary",
    preview: "Review contract deadlines, work, evidence, and reports.",
    body: "Here is your weekly contract tracking summary: upcoming dates, open work, evidence requests, and reports that may need attention.",
    ctaLabel: "Open dashboard",
    ctaHref: "/dashboard",
  },
  trial_day_3: {
    key: "trial_day_3",
    subject: "Get value from your Oblixa trial",
    preview: "Upload contracts and review fields early in the trial.",
    body: "Start with a few signed agreements. Review suggested fields, assign owners, and add key dates so your dashboard becomes useful.",
    ctaLabel: "Upload contract",
    ctaHref: "/contracts/new",
  },
  trial_day_10: {
    key: "trial_day_10",
    subject: "Build your contract tracking workspace",
    preview: "Review fields, assign owners, and export reports.",
    body: "Your trial works best after reviewed fields, assigned owners, renewal dates, work, evidence, and reports are connected.",
    ctaLabel: "Open dashboard",
    ctaHref: "/dashboard",
  },
  trial_ending_2_days: {
    key: "trial_ending_2_days",
    subject: "Your Oblixa trial ends soon",
    preview: "Choose a plan to keep editing your workspace.",
    body: "Keep your reviewed terms, deadlines, owners, work, evidence, and reports active by choosing a plan.",
    ctaLabel: "Choose plan",
    ctaHref: "/settings/billing",
  },
  payment_succeeded: {
    key: "payment_succeeded",
    subject: "Your Oblixa payment succeeded",
    preview: "Your workspace plan is active.",
    body: "Your Oblixa payment succeeded and your contract tracking workspace remains active.",
    ctaLabel: "Open billing",
    ctaHref: "/settings/billing",
  },
  payment_failed: {
    key: "payment_failed",
    subject: "Your Oblixa payment failed",
    preview: "Update billing to keep editing your workspace.",
    body: "Your payment did not complete. Update billing to keep editing contracts, work, evidence, and reports.",
    ctaLabel: "Update billing",
    ctaHref: "/settings/billing",
  },
  cancellation_confirmation: {
    key: "cancellation_confirmation",
    subject: "Your Oblixa cancellation is scheduled",
    preview: "Your workspace remains available through the current billing period.",
    body: "Your cancellation is scheduled. Your workspace remains available through the current billing period, and you can export your contract records before access changes.",
    ctaLabel: "Open billing",
    ctaHref: "/settings/billing",
  },
};

export function getReleaseStateEmailTemplate(
  key: ReleaseStateEmailTemplateKey
): ReleaseStateEmailTemplate {
  return RELEASE_STATE_EMAIL_TEMPLATES[key];
}
