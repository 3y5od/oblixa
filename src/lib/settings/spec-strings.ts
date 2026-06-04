// SPEC: docs/oblixa-release-state.md + settings page surface contracts.
export const SETTINGS_PAGE_STRINGS = {
  eyebrow: "Settings",
  title: "Settings",
  lead: "Manage workspace, team, billing, notifications, security, and data export.",
  directoryTitle: "Directory",
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
    currentStateLabel: "Contracts and files",
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
  // V4 §2.4 — legend drops the "(UTC)" parenthetical; a UTC chip now
  // sits beside the range so the timezone reads as structured metadata
  // rather than low-signal parens. (V2 was "Quiet hours (UTC)".)
  quietHoursLegend: "Quiet hours",
  // V4 §2.1 — visible Start/End caps labels return above each input as
  // the canonical time-range control. (V3 had hidden these to sr-only;
  // a bare "0 → 0" pair was ambiguous about which end was which.)
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
  // V4 §2.4 — UTC chip beside the quiet-hours range (replaces the
  // "(UTC)" legend parenthetical).
  utcLabel: "UTC",
  // V4 §3 — read-only (non-admin) state reads as a titled notice with an
  // icon + a quiet footer line, not a thin one-line banner that looked
  // like an input. `nonAdminBanner` (above) supplies the body copy.
  readOnlyTitle: "Read-only",
  readOnlyFooter: "Ask a workspace admin to change these settings.",
  // V4 §5 — summary rail: a quiet companion surface that reflects the
  // derived posture of the current (pending) form. Pairs with the form
  // so the page reads as two columns instead of one isolated card, and
  // surfaces the *interpreted* quiet window (any-time / overnight) that
  // the raw number inputs don't make obvious.
  summary: {
    eyebrow: "Summary",
    title: "Current setup",
    context: "Workspace defaults applied to everyone on the team.",
    emailLabel: "Email",
    quietLabel: "Quiet hours",
    remindersLabel: "Reminders",
    digestLabel: "Weekly digest",
    anyTime: "Any time",
    overnight: "Overnight",
    pausedNote: "No reminders will send while email is off.",
  },
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
  lead: "Review early-access status and billing questions.",
  leadFreeState: "Billing starts after evaluation, once Oblixa is part of your workflow.",
  leadActiveState: "Review your current access and billing status.",
  backLabel: "Back to settings",
  primaryCta: "Contact support about billing",
  secondaryCta: "Review early-access pricing",
  trialCta: "Request billing help",
  reactivateCta: "Reactivate subscription",
  resumeCheckoutCta: "Resume checkout",
  paymentMethodCta: "Update payment method",
  portalLabel: "Open customer portal",
  invoiceLabel: "Invoice access",
  cancellationLabel: "Cancellation path",
  unavailableTitle: "Billing checkout is unavailable in this environment.",
  unavailableCopy: "Account status remains visible. Configure billing on the server to enable checkout and customer portal actions.",
  // Polish-pass §2.10 + finishing-pass §2.5 — body ≤ 80 chars.
  emptyStateBody: "Billing is secondary during early access.",
  trialEndedLabel: "EVALUATION",
  // Polish-pass §2.9 — sub-eyebrow above plan-includes feature list
  planIncludesEyebrow: "Included during early access",
  // Polish-pass §3.4 — invoices section eyebrow
  invoicesEyebrow: "Invoices",
  // Polish-pass §3.1 — compact empty invoices copy
  noInvoicesYet: "No invoices yet",
  // Polish-pass §4.7 — release-state §305 exact phrasing (drops ?)
  contactSalesPromptSpec:
    "Larger teams and higher contract volumes are handled during early access.",
  startTrialCta: "Request early-access billing help",
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
  trialCapBadge: "EVALUATION SCOPE",
  // Polish-pass §6.2 — admin utility-row prefix
  adminUtilityLabel: "Billing administration",
  trialMicrocopy: "Early access — Billing after evaluation",
  taxNote: "Pricing is finalized during early-access evaluations.",
  contactSalesPrompt: "Questions about billing during early access?",
  contactSalesCta: "Contact support",
  contactSalesHref: "mailto:support@oblixa.com",
  testModeBanner: "Stripe TEST MODE active — no real charges will be made.",
  // §Plan Limits — release-state §289-307
  coreLimits: { contracts: 500, teamMembers: 10 } as const,
  trialCaps: { contracts: 25, teamMembers: 3, days: 0 } as const,
  planContent: {
    aiExtraction: "Source-backed, human-reviewed",
    auditHistory: "Available in security",
    csvExport: "Available in imports & exports",
    support: "Product support during evaluation",
    emailReminders: "Included",
  } as const,
  foundingCustomerOffer: {
    priceDisplay: "Founding monthly plan after evaluation",
    limit: 25,
    ctaLabel: "Discuss founding access",
    description: "Available only after evaluation value is clear.",
  } as const,
  guidedPilotOffer: {
    priceDisplay: "Evaluation first",
    description:
      "Start with a small contract subset. Continued use can move to a founding monthly plan.",
  } as const,
  // Placeholder values rendered as em-dash sentinels — see §1.26, §17.1
  // NOTE: "Free" is NOT a placeholder — it's a legitimate plan label
  // when subscriptionStatus === "none". Was previously included here
  // and caused the em-dash bug (refinement §1.1).
  placeholders: {
    noActiveTrial: "No active evaluation",
    notConfigured: "Not configured",
    planDependent: "Plan dependent",
    notScheduled: "Not scheduled",
    trialEndUnavailable: "Evaluation review date unavailable",
    unavailableUntilBilling: "Available after billing is configured",
    askAdminCancel: "Ask a workspace admin to manage cancellation.",
  } as const,
  cancellationConfirmation:
    "You'll get a cancellation confirmation email and access continues through {date}. You can reactivate any time before then.",
  contactSalesPromptShort: "Questions about early-access billing?",
  whatYouGetEyebrow: "What you get",
  includedEyebrow: "Included",
  enterpriseInterestLabel: "Manual boundary",
  enterpriseInterestVerb: "Contact support",
  publicPricingLink: "Review early-access pricing →",
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
    "Early access",
    "Billing after evaluation",
  ] as const,
  faq: [
    "What happens after evaluation?",
    "Can I export before cancelling?",
    "When would paid use start?",
    "Can I add more contracts?",
    "Can I add more team members?",
    "Do you offer setup help?",
  ] as const,
  faqAnswers: {
    "What happens after evaluation?":
      "If Oblixa becomes useful to your workflow, continued use can move to a paid founding monthly plan. You can also export records and reports.",
    "Can I export before cancelling?":
      "Yes. Export your contract inventory from Settings → Imports and exports before you cancel. Exports stop being available 7 days after cancellation.",
    "When would paid use start?":
      "Paid use starts only after evaluation, if Oblixa becomes part of your workflow — continued use moves to a founding monthly plan.",
    "Can I add more contracts?":
      "Start with a small evaluation set. Larger migrations should wait until the workflow proves useful.",
    "Can I add more team members?":
      "Invite teammates from Settings → Team when they need to help review fields, owners, work, or evidence.",
    "Do you offer setup help?":
      "Early access includes product support during evaluation, not managed implementation. We don't run migrations, spreadsheet cleanup, or legal review.",
  } as const,
} as const;

// Billing strings — keep in lockstep with the canonical release-state
// spec: Billing Page + early-access evaluation billing guidance. Keep this
// subdued until public billing is intentionally activated.

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
    // De-jargoned from "STEP-UP" (a security-engineering term) to the
    // plain category noun "ACCESS". The card h2 "Password confirmation"
    // already says what the control does, and "ACCESS" parallels the
    // MFA / SESSIONS / POLICY sibling eyebrows without doubling "confirm".
    stepUp: "ACCESS",
    policy: "POLICY",
    workspace: "WORKSPACE",
    legal: "LEGAL",
  },
  resources: {
    recentActivity: "Recent security activity",
    // V2 §4.3 — more specific destination wording.
    auditHistory: "Audit history",
    // Release-state: this row is a contact path for data/security
    // questions, not a formal DPA/procurement flow — labelled "Data
    // handling" so it doesn't imply a Data Processing Agreement we don't
    // offer at release.
    dpaContact: "Data handling",
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
  // Step-up state badges. The resting (locked) label reads "REQUIRES
  // PASSWORD" rather than the terse "LOCKED" so it states exactly what
  // unlocks sensitive actions — consistent with the "Confirm password"
  // form beneath it. Rendered with whitespace-nowrap so the longer label
  // never wraps the card h2.
  stepUpActiveLabel: "ACTIVE",
  stepUpExpiredLabel: "EXPIRED",
  stepUpEmptyLabel: "REQUIRES PASSWORD",
  stepUpMfaSessionLabel: "MFA SESSION",
  // §16.15 AAL2 frictionless-path helper
  stepUpAal2Note: "YOUR MFA SESSION COVERS SENSITIVE ACTIONS",
  // §1.33 contextual prompt when needStepUp: true returns
  stepUpRequiredPrompt: "Confirm your password below to continue.",
  // §16.6 rate-limit error
  rateLimitedCopy: "Too many attempts — try again in a minute.",
  // V2 §4.6 Sessions positive-action body shortened.
  sessionsBody: "Sign out other devices.",
  sessionsCurrentLabel: "THIS DEVICE",
  // Sign-out / change-password render as ghost pills in the Devices
  // card action cluster, so the trailing arrow glyph is dropped — the
  // pill shape carries the affordance and keeps all three actions in
  // one consistent vocabulary.
  signOutSelfCta: "Sign out this device",
  // V3 §4.6 shortened from 104 chars (2 sentences) → 52 chars
  // (1 sentence). Existing-sessions footnote dropped.
  orgMfaConsequence:
    "Members must enroll an authenticator at next sign-in.",
  // Kept for the OFF-gating confirmation dialog per V3 §1.17.
  orgMfaOffConsequence:
    "Allow members to skip MFA enrollment? Current authenticators stay enrolled.",
  // Self-lockout guard: an admin with no authenticator of their own must
  // not force workspace-wide MFA — they'd be forced to enroll at next
  // sign-in with no factor ready. Shown beneath the disabled toggle.
  orgMfaSelfLockoutHint:
    "Enroll your own authenticator first to avoid losing access.",
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
  // §3.3 security / data-handling mailto.
  contactEmail: "security@oblixa.com",
  // "Request DPA" overpromised a formal Data Processing Agreement flow
  // that doesn't exist at release (release-state: no procurement-readiness
  // implication). Reframed as a plain contact path to the security team.
  contactCta: "Email security team",
  // §3.4 password change — ghost pill in the Devices action cluster.
  passwordChangeCta: "Change password",
  // §1.39 banner state machine
  mfaBannerRequired:
    "Enroll an authenticator to access your workspace.",
  mfaBannerEnrolled: "Authenticator enrolled.",
  mfaBannerExpired: "Password confirmation expired. Confirm again to continue.",
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
  // Disclosure triggers render as sentence-case accent links with a
  // chevron (not caps eyebrows) so they read as a secondary "learn
  // more" affordance rather than a section heading.
  mfaExplainerSummary: "What is two-factor sign-in?",
  mfaExplainerBody:
    "Adds a 6-digit code from your authenticator app at sign-in. Works with 1Password, Authy, Google Authenticator, Microsoft Authenticator.",
  policyExplainerSummary: "What changes for members?",
  policyExplainerBody:
    "Members signing in for the first time after enabling are prompted to enroll an authenticator. Existing sessions stay valid until natural expiry.",
} as const;
