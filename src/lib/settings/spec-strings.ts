export const SETTINGS_PAGE_STRINGS = {
  eyebrow: "Settings",
  title: "Settings",
  lead: "Manage workspace, team, billing, notifications, security, and export settings.",
  directoryTitle: "Settings directory",
} as const;

export const SETTINGS_GROUP_STRINGS = {
  account: "Account",
  workspace: "Workspace",
  operations: "Operations",
} as const;

export const SETTINGS_DESTINATION_STRINGS = {
  profile: {
    title: "Profile",
    description: "Update your name and account identity.",
    actionLabel: "Edit profile",
    currentStateLabel: "Name and email",
  },
  security: {
    title: "Security",
    description: "Manage password and account security settings.",
    actionLabel: "Open security",
    currentStateLabel: "Account security",
  },
  workspace: {
    title: "Workspace",
    description: "Rename the workspace shown in navigation, invites, exports, and billing.",
    actionLabel: "Rename",
    currentStateLabel: "Editable",
    readOnlyLabel: "Read-only",
  },
  team: {
    title: "Team",
    description: "Review members, roles, invitations, and pending access.",
    actionLabel: "Invite member",
  },
  billing: {
    title: "Billing",
    description: "Review subscription status, plan posture, and billing portal access.",
    actionLabel: "Open billing",
  },
  notifications: {
    title: "Notifications",
    description: "Manage renewal, notice deadline, field review, work assignment, evidence request, and weekly digest reminders.",
    actionLabel: "Edit notifications",
    currentStateLabel: "Reminder defaults",
  },
  imports_exports: {
    title: "Imports and exports",
    description: "Import contracts and review operational export tools.",
    actionLabel: "Open imports",
    currentStateLabel: "CSV and signed files",
  },
  data_export: {
    title: "Data export",
    description: "Export reviewed contract data and operational reports.",
    actionLabel: "Export data",
    currentStateLabel: "Contract inventory",
  },
} as const;

// V3 polish on top of V2. V3 changes: all sub-card eyebrows dropped
// (WORKSPACE / REMINDER CATEGORIES / DIGEST / ACCOUNT), helper prose
// removed, category descriptions recast (no "Notify..." prefix),
// labels align with descriptions ("Field reviews" → "Field
// approvals"), badges drop caps to "On"/"Off", saveLabel "Save",
// perUserCta "Open account", channel-off banner rewritten.
export type NotificationCategoryKey =
  | "renewal_reminder"
  | "notice_deadline"
  | "field_review"
  | "work_assignment"
  | "evidence_request"
  | "weekly_digest";

export const SETTINGS_NOTIFICATIONS_STRINGS = {
  eyebrow: "Settings",
  title: "Notifications",
  lead: "Manage reminder defaults and quiet hours for workspace email.",
  backLabel: "Back to settings",
  sections: {
    emailReminders: "Email reminders",
    personalPreferences: "Personal preferences",
  },
  // V3 §1.1 + §1.2 + §1.3 + §1.4 — all sub-card caps eyebrows
  // dropped per §10.14 subtraction. Only the page-header SETTINGS
  // eyebrow remains as visible caps decoration.
  // V2 strings retained for backwards-compat with downstream tests
  // that grep for the constant; UI no longer renders any of them.
  eyebrows: {
    workspace: "WORKSPACE",
    account: "ACCOUNT",
    reminderCategories: "REMINDER CATEGORIES",
    digest: "DIGEST",
  },
  // V3 §13.4 — sentence case replaces caps; aligns with the page's
  // reduced-caps direction post-Tier 1.
  badges: {
    emailOn: "On",
    emailOff: "Off",
  },
  // V2 §1.22 — body kept in spec-strings but the UI no longer
  // renders it (free-floating disclaimer dropped per §11.15).
  bodies: {
    emailReminders: "Defaults apply unless individual members adjust them.",
  },
  // V2 §1.2 — checkbox label drops redundant "Email" (h2 carries it).
  emailRemindersToggleLabel: "Send reminders",
  // V3 §1.5 — toggle help line dropped per §10.4 (category
  // descriptions name their own audiences). Constant retained for
  // backwards-compat; UI no longer renders it.
  emailRemindersToggleHelp:
    "Reminders go to owners, reviewers, and assignees.",
  // V2 §1.4 — parens replace bare middle-dot per §11.16.
  quietHoursLegend: "Quiet hours (UTC)",
  // V3 §1.6 — visible START/END caps labels dropped per §11.15
  // (helper between label and input). Sr-only aria-labels carry
  // the SR semantic. Constants retained for backwards-compat.
  quietStartLabel: "Start",
  quietEndLabel: "End",
  // V3 §2.7 — quietHoursHelp dropped entirely; the legend "Quiet
  // hours (UTC)" + the empty-state caption carry the unit context.
  // Constant retained for backwards-compat.
  quietHoursHelp: "24-HOUR UTC  0 = MIDNIGHT",
  // V3 §0.2 — bare middle-dot dropped per §11.16; caption shortened.
  quietHoursNoneCaption: "Reminders send any time",
  // V3 §2.5 — channel-off banner rewritten; drops "categories"
  // terminology since post-V3 the categories eyebrow is gone.
  channelOffBanner: "Email is off. No reminders will send.",
  // V3 §2.2 — Save button label shortened ("preferences" implicit).
  saveLabel: "Save",
  // V3 §0.4 + §2.3 — drop in-text arrow; trailing ChevronRight
  // carries the affordance. Shortened from "Adjust from account →"
  // (21) → "Open account" (12).
  perUserCta: "Open account",
  // V2 §1.1 + §1.12 — caps label dropped; UI no longer renders it.
  perUserEmptyLabel: "PERSONAL OVERRIDES",
  // V3 §22.x — sr-only legend text for the categories fieldset
  // (visible REMINDER CATEGORIES eyebrow dropped per §1.2).
  categoriesLegendSrOnly: "Reminder categories",
  // V3 §22.1 — save-success announcement text for LiveRegion.
  saveSuccessAnnouncement: "Notification preferences saved",
  // V3 §22.2 — save-error announcement text.
  saveErrorAnnouncement: "Failed to save notification preferences",
  // V3 §22.3 — channel toggle announcements.
  channelOnAnnouncement: "Email reminders enabled",
  channelOffAnnouncement: "Email reminders disabled. Settings preserved.",
  // V3 §22.4 — discard announcement.
  discardAnnouncement: "Changes discarded",
  // V3 §4.1 — discard button label.
  discardLabel: "Discard",
  // V3 §8.7 — read-only banner for non-admins.
  nonAdminBanner: "Notification settings can only be changed by workspace admins.",
  // V3 §16.7 — schema-parse-failure inline error.
  policyLoadError: "Notification settings could not be loaded.",
  policyReloadCta: "Reload",
  categories: [
    // V3 §2.1 — recast descriptions to drop redundant "Notify {audience}"
    // prefix. Storage keys unchanged for backwards-compat.
    {
      key: "renewal_reminder",
      label: "Renewals",
      description: "Before approved renewal dates need a decision.",
    },
    {
      key: "notice_deadline",
      label: "Notice deadlines",
      description: "Before notice windows close.",
    },
    {
      // V3 §13.1 — visible label aligned with description verb
      // ("approval"). Storage key `field_review` unchanged.
      key: "field_review",
      label: "Field approvals",
      description: "When extracted fields still need approval.",
    },
    {
      key: "work_assignment",
      label: "Work assignments",
      description: "When work is assigned or due dates approach.",
    },
    {
      key: "evidence_request",
      label: "Evidence requests",
      description: "Before evidence is overdue.",
    },
    {
      key: "weekly_digest",
      label: "Weekly digest",
      // V3 §13.2 — tightened from "Weekly summary of contract
      // activity." (36) → "Weekly contract activity summary." (32).
      description: "Weekly contract activity summary.",
    },
  ],
} as const;

export const SETTINGS_BILLING_STRINGS = {
  eyebrow: "Settings",
  title: "Billing",
  // Finishing-pass §1.11 + §5.1 — shortened from 92 chars to satisfy
  // spec §10.7 (≤80 chars between structured elements). State-specific
  // variants below; this `lead` is the generic fallback.
  lead: "Manage your plan, payment method, and invoices.",
  leadFreeState: "Pick a plan to keep your contract tracking past the trial.",
  leadActiveState: "Manage your plan, payment method, and invoices.",
  backLabel: "Back to settings",
  primaryCta: "Choose annual plan",
  secondaryCta: "Continue monthly",
  trialCta: "Convert to paid plan",
  reactivateCta: "Reactivate subscription",
  resumeCheckoutCta: "Resume checkout",
  paymentMethodCta: "Update payment method",
  portalLabel: "Open customer portal",
  invoiceLabel: "Invoice access",
  cancellationLabel: "Cancellation path",
  unavailableTitle: "Billing checkout is unavailable in this environment.",
  unavailableCopy: "Account status remains visible. Configure billing on the server to enable checkout and customer portal actions.",
  // Polish-pass §2.10 + finishing-pass §2.5 — body ≤ 80 chars, with
  // 21-day specificity per spec §10.7.
  emptyStateBody: "Subscribe to keep editing past the 21-day trial.",
  // Finishing-pass §5.3 — caps chip label when trial ended on free
  trialEndedLabel: "TRIAL ENDED",
  // Polish-pass §2.9 — sub-eyebrow above plan-includes feature list
  planIncludesEyebrow: "Plan includes",
  // Polish-pass §3.4 — invoices section eyebrow
  invoicesEyebrow: "Invoices",
  // Polish-pass §3.1 — compact empty invoices copy
  noInvoicesYet: "No invoices yet",
  // Polish-pass §4.7 — release-state §305 exact phrasing (drops ?)
  contactSalesPromptSpec:
    "Larger teams and higher contract volumes are available on custom plans.",
  // Polish-pass §7.1 — tertiary trial CTA (gated on no prior trial)
  startTrialCta: "Or start a 21-day free trial",
  // Polish-pass §7.2 — promo-code discoverability prompt
  promoCodePrompt: "Have a discount code?",
  // Polish-pass §7.4 — founding ribbon (no emoji, no bare dot)
  foundingRibbonLabel: "FOUNDING",
  foundingRibbonSuffix: "spots left of 25",
  // Polish-pass §7.5 — workspace ID label
  workspaceIdLabel: "WORKSPACE",
  customerIdLabel: "CUSTOMER",
  // Polish-pass §9.9 — explicit noscript JS-required list
  noscriptCopy:
    "Without JavaScript: subscribe, manage subscription, copy IDs, print, and expand FAQ items are disabled. Read-only data remains visible.",
  // Polish-pass §3.10 — auto-renews chip label
  autoRenewsLabel: "Auto-renews",
  // Polish-pass §5.7 — trial cap badge
  trialCapBadge: "TRIAL CAP",
  // Polish-pass §6.2 — admin utility-row prefix
  adminUtilityLabel: "Admin",
  trialMicrocopy: "21-day free trial · No card required",
  taxNote: "Pricing shown in USD. Taxes calculated at checkout based on your billing region.",
  contactSalesPrompt: "Need a custom plan or enterprise terms?",
  contactSalesCta: "Talk to us",
  contactSalesHref: "mailto:sales@oblixa.com",
  testModeBanner: "Stripe TEST MODE active — no real charges will be made.",
  // §Plan Limits — release-state §289-307
  coreLimits: { contracts: 500, teamMembers: 10 } as const,
  trialCaps: { contracts: 25, teamMembers: 3, days: 21 } as const,
  planContent: {
    aiExtraction: "Fair-use included",
    auditHistory: "Available in security",
    csvExport: "Available in imports & exports",
    support: "Standard support",
    emailReminders: "Included",
  } as const,
  foundingCustomerOffer: {
    priceDisplay: "$2,400 for the first year",
    limit: 25,
    ctaLabel: "Apply for founding customer pricing",
    description: "Limited availability. Includes one setup call.",
  } as const,
  guidedPilotOffer: {
    priceDisplay: "$1,500 for 60 days",
    description:
      "Credited toward your first annual subscription if you continue. Includes setup call, import planning, owner mapping, first-report review.",
  } as const,
  // Placeholder values rendered as em-dash sentinels — see §1.26, §17.1
  // NOTE: "Free" is NOT a placeholder — it's a legitimate plan label
  // when subscriptionStatus === "none". Was previously included here
  // and caused the em-dash bug (refinement §1.1).
  placeholders: {
    noActiveTrial: "No active trial",
    notConfigured: "Not configured",
    planDependent: "Plan dependent",
    notScheduled: "Not scheduled",
    trialEndUnavailable: "Trial end unavailable",
    unavailableUntilBilling: "Available after billing is configured",
    askAdminCancel: "Ask a workspace admin to manage cancellation.",
  } as const,
  cancellationConfirmation:
    "You'll get a cancellation confirmation email and access continues through {date}. You can reactivate any time before then.",
  contactSalesPromptShort: "Need higher limits or a custom plan?",
  whatYouGetEyebrow: "What you get",
  includedEyebrow: "Included",
  enterpriseInterestLabel: "Enterprise",
  enterpriseInterestVerb: "Talk to us",
  publicPricingLink: "View public pricing →",
  publicPricingHref: "/pricing",
  testModeBannerShort: "Test billing mode — no real charges.",
  testCardHints: [
    { card: "4242 4242 4242 4242", outcome: "succeeds" },
    { card: "4000 0000 0000 9995", outcome: "declined (generic_decline)" },
    { card: "4000 0027 6000 3184", outcome: "requires 3DS authentication" },
  ] as const,
  // §1.12 + §11.6 — Stripe decline_code → remediation copy.
  declineRemediation: {
    insufficient_funds:
      "Check available balance or use another card.",
    expired_card:
      "Card has expired. Add a new payment method.",
    incorrect_cvc:
      "Double-check the security code on the back of your card.",
    card_declined:
      "Try another card or contact your card issuer.",
    processing_error:
      "Stripe couldn't process this payment. Retry in a few minutes.",
    default: "Contact support if this persists.",
  } as const,
  // §11.3 — structured microcopy parts for ChipPair rendering
  trialMicrocopyParts: [
    "21-day free trial",
    "No card required",
  ] as const,
  faq: [
    "What happens when the trial ends?",
    "Can I export before cancelling?",
    "Can I change plans?",
    "Can I add more contracts?",
    "Can I add more team members?",
    "Do you offer setup help?",
  ] as const,
  faqAnswers: {
    "What happens when the trial ends?":
      "Your workspace stays accessible in read-only mode. Subscribe to keep editing, importing, and exporting contracts.",
    "Can I export before cancelling?":
      "Yes. Export your contract inventory from Settings → Imports and exports before you cancel. Exports stop being available 7 days after cancellation.",
    "Can I change plans?":
      "Switch monthly and annual any time in the customer portal. Prorated credits apply on upgrade; downgrades take effect at the next renewal.",
    "Can I add more contracts?":
      "Annual plans include unmetered contracts. Monthly plans cap at the limit shown on this page. Contact us to discuss higher limits.",
    "Can I add more team members?":
      "Invite teammates from Settings → Team. Additional seats can be added in the customer portal.",
    "Do you offer setup help?":
      "Yes. The Guided Pilot is $1,500 for 60 days and includes a setup call, import planning, owner mapping, and first-report review — credited toward your first annual subscription if you continue. Email support@oblixa.com to start.",
  } as const,
} as const;

// Billing strings — keep in lockstep with the canonical release-state
// spec: Billing Page (lines 1645-1683) + Plan Limits (289-307) + Trial
// (309-322) + Founding Customer Offer + Guided Pilot. Edit the spec
// doc first, then propagate here.

// Security strings — structured spec-strings for the security
// settings surface. The `legalNote` matches release-state §1700-1702
// exactly. Voice rules: no "platform", "transformation",
// "governance", "autopilot", "intelligence", or the internal
// tier-name "public Core".
export const SETTINGS_SECURITY_STRINGS = {
  eyebrow: "Settings",
  title: "Security",
  // V3 §1.8 — "Manage" reads more directly than "Confirm" per
  // release-state §1685 ("Let admins manage access and reduce risk").
  // 52 chars, well under §10.7 80-char limit.
  lead: "Manage authenticators, devices, and access policy.",
  backLabel: "Back to settings",
  // §4.3 release-state §1700-1702 exact phrasing (NOT marketing §757).
  legalNote: "Oblixa helps organize contract information, but it does not provide legal advice.",
  sections: {
    // V2 §1.1 + §1.28 / V4 user-report §3 — h2s renamed to avoid
    // §11.8 word-doubling with their eyebrows:
    //   SESSIONS + Active sessions → SESSIONS + Devices
    //   POLICY   + MFA policy     → POLICY   + MFA enforcement
    //   RESOURCES + Resources     → RESOURCES + Account & workspace context (V2)
    mfa: "Authenticators",
    sessions: "Devices",
    stepUp: "Password confirmation",
    teamRoles: "Team roles",
    resources: "Account & workspace context",
    workspaceMfa: "MFA enforcement",
  },
  // V2 §1.9 sub-card eyebrow tier — each card carries an eyebrow per §2.4.
  eyebrows: {
    resources: "RESOURCES",
    mfa: "MFA",
    sessions: "SESSIONS",
    // V2 §4.8 — STEP-UP is the industry term + matches stepUpFormCta.
    stepUp: "STEP-UP",
    policy: "POLICY",
    workspace: "WORKSPACE",
    legal: "LEGAL",
  },
  resources: {
    recentActivity: "Recent security activity",
    // V2 §4.3 — more specific destination wording.
    auditHistory: "Audit history",
    // §4.2 — DPA rephrased to less-jargon "Legal contact"
    dpaContact: "Legal contact",
    // V2 §1.37 sign-in provider row
    signInMethod: "Sign-in method",
    // V2 §1.48 account creation date
    memberSince: "Member since",
    // V2 §1.36 email verification status
    emailStatus: "Email status",
  },
  // §1.5 + §1.7 MFA copy
  mfaEmptyLabel: "NO AUTHENTICATORS",
  mfaSingleLabel: "SINGLE-FACTOR",
  mfaTwoFactorLabel: "TWO-FACTOR",
  // §1.6 empty-state body — branched on org policy per V2 §1.19.
  mfaEmptyBody: "Enroll a TOTP authenticator to enable two-factor sign-in.",
  mfaEmptyBodyRequired:
    "Your workspace requires MFA. Enroll an authenticator now.",
  // §1.12 step-up state badges — V2 §1.34 + §2.6 rename NOT REQUIRED → INACTIVE.
  stepUpActiveLabel: "ACTIVE",
  stepUpExpiredLabel: "EXPIRED",
  stepUpEmptyLabel: "INACTIVE",
  stepUpMfaSessionLabel: "MFA SESSION",
  // §16.15 AAL2 frictionless-path helper
  stepUpAal2Note: "YOUR MFA SESSION COVERS SENSITIVE ACTIONS",
  // §1.33 contextual prompt when needStepUp: true returns
  stepUpRequiredPrompt: "Step-up required — confirm password below to retry.",
  // §16.6 rate-limit error
  rateLimitedCopy: "Too many attempts — try again in a minute.",
  // V2 §4.6 Sessions positive-action body shortened.
  sessionsBody: "Sign out other devices.",
  sessionsCurrentLabel: "THIS DEVICE",
  // V2 §1.47 sign out current device link
  signOutSelfCta: "Sign out this device →",
  // V3 §4.6 shortened from 104 chars (2 sentences) → 52 chars
  // (1 sentence). Existing-sessions footnote dropped.
  orgMfaConsequence:
    "Members must enroll an authenticator at next sign-in.",
  // Kept for the OFF-gating confirmation dialog per V3 §1.17.
  orgMfaOffConsequence:
    "Allow members to skip MFA enrollment? Current authenticators stay enrolled.",
  // §10.5 non-admin policy view
  workspaceMfaRequiredReadOnly:
    "Your workspace requires multi-factor authentication. Enroll an authenticator below.",
  // §1.41 friendly-name fallback
  factorFallbackName: (idx: number) => `Authenticator ${idx + 1}`,
  factorRenameAriaLabel: (idx: number) => `Rename authenticator ${idx + 1}`,
  // §1.18 QR alt
  qrAlt:
    "Scan this QR code with your authenticator app to enroll a new factor",
  // §1.17 manual key
  manualKeyEyebrow: "MANUAL KEY",
  manualKeyWarning: "TREAT AS PASSWORD",
  // §1.19 TOTP code hint
  totpCodeHint: "6-DIGIT CODE FROM AUTHENTICATOR APP",
  // §3.3 DPA mailto
  contactEmail: "security@oblixa.com",
  // V2 §1.16 — drop trailing arrow; rendered as separate ChevronRight.
  contactCta: "Request DPA",
  // §3.4 password change link
  passwordChangeCta: "Change password →",
  // §1.39 banner state machine
  mfaBannerRequired:
    "Enroll an authenticator to access your workspace.",
  mfaBannerEnrolled: "Authenticator enrolled.",
  mfaBannerExpired: "Step-up expired. Confirm password to continue.",
  // §1.44 account identity chip
  accountLabel: "ACCOUNT",
  workspaceLabelChip: "WORKSPACE",
  // §3.1 activity-feed empty — V2 §4.5 + §4.10 reframed.
  activityEyebrow: "ACTIVITY",
  activityEmptyLabel: "0 events in the last 90 days",
  activityViewAllCta: "OPEN AUDIT LOG",
  activityRetentionNote: "EVENTS RETAINED FOR 90 DAYS",
  // Step-up form CTA + helper — V2 §1.4 sentence-case the helper.
  stepUpFormCta: "Confirm password",
  stepUpFormHelp:
    "Confirm your password to unlock sensitive changes.",
  // §1.20 / §1.16 — Cancel-enrollment button label
  enrollmentCancelCta: "Cancel enrollment",
  // V2 §1.51 — recovery hint when enrollment fails on max-factors.
  enrollMaxFactorsHint:
    "Remove an existing authenticator before adding a new one.",
  // V3 §1.3 — drop placeholder text; visually identical to typed
  // password creates ambiguity ("did I already type this?").
  // Empty string keeps the prop optional + intentional.
  passwordPlaceholder: "",
  // V2 §3.9 offline copy
  offlineCopy: "You're offline. Security changes will not save until reconnected.",
  // V2 §1.54 dev environment marker; V4 §2.1 — "is mocked" not
  // "may be mocked" (the condition that triggers the banner is
  // deterministic — secret missing → mocked).
  devModeCopy: "Development environment — step-up cookie validation is mocked.",
  // V2 §1.36 email verification chips
  emailVerifiedLabel: "VERIFIED",
  emailUnverifiedLabel: "UNVERIFIED",
  // V3 §1.15 — Resend verification CTA when email unverified
  resendVerificationCta: "Resend verification →",
  // V3 §1.9 / §7.3 — Last sign-in row label
  lastSignInLabel: "Last sign-in",
  // V3 §1.22 — Forgot password link in STEP-UP form
  forgotPasswordCta: "Forgot password?",
  // V3 §1.26 — per-section retry copy
  sectionFetchError: "We couldn't load this section.",
  sectionRetryCta: "Retry →",
  // V4 §6.1 — MFA explainer disclosure (resolves §1.3 height
  // asymmetry + adds UX value for non-technical admins).
  mfaExplainerSummary: "WHAT IS TWO-FACTOR SIGN-IN?",
  mfaExplainerBody:
    "Adds a 6-digit code from your authenticator app at sign-in. Works with 1Password, Authy, Google Authenticator, Microsoft Authenticator.",
  // V4 §6.2 — POLICY explainer disclosure (resolves §1.4 height
  // asymmetry).
  policyExplainerSummary: "WHAT CHANGES FOR MEMBERS?",
  policyExplainerBody:
    "Members signing in for the first time after enabling are prompted to enroll an authenticator. Existing sessions stay valid until natural expiry.",
} as const;
