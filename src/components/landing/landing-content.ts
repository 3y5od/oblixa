/** Marketing copy — single source for landing UI and JSON-LD FAQ.
 *  Aligned to the intended release state: track what signed contracts require
 *  next, with reviewed source-backed data and controlled workspace access. */

export const heroEyebrow = "Contract tracking";

export const heroTitle = "Track what signed contracts require next.";

export const heroSubcopy =
  "Upload agreements or import your tracker, review source-backed fields, and turn dates, owners, obligations, evidence, and exceptions into accountable work and exportable reports.";

export const ctaPrimaryLabel = "Request access";
export const ctaSecondaryLabel = "View product tour";
export const navGetStartedLabel = "Request access";

export const riskReducerLine =
  "Reviewed workspace access for teams tracking signed contracts in spreadsheets, folders, inboxes, calendars, or memory.";

export const antiGoalSummary =
  "Oblixa is not a full CLM, legal-advice tool, or autonomous agent. It tracks renewals, obligations, owners, evidence, and reports from agreements you have already signed.";

export const objectionBullets = [
  {
    title: "Your contract spreadsheet drifts",
    body: "Renewal dates, owners, and follow-up live in one workspace with review history instead of scattered files and inbox threads.",
  },
  {
    title: "Heavy contract suites are too much to migrate",
    body: "Start with a small contract set or your existing spreadsheet — no months-long implementation, no redlining workflow you do not need.",
  },
  {
    title: "Suggested fields need human review",
    body: "Suggested fields stay tied to source snippets until your team approves what drives reminders, work, and reports.",
  },
] as const;

/* FAQ — restored to release-state spec §Home Page > FAQ (8 questions verbatim)
   after v9 reduced to 5. Spec-mandated coverage. */
export const faqItems = [
  {
    question: "Is Oblixa a CLM?",
    answer:
      "No. Oblixa is a tracking workspace for agreements you have already signed. It does not replace drafting, redlining, or e-signature tools — it picks up where they leave off, tracking renewals, owners, obligations, evidence, and reports.",
  },
  {
    question: "Does Oblixa provide legal advice?",
    answer:
      "No. Oblixa is not a law firm and does not provide legal advice. Users are responsible for reviewing contract information and making business or legal decisions.",
  },
  {
    question: "Can I start without migrating every contract?",
    answer:
      "Yes. Start with a small contract set or import your existing tracking spreadsheet. You do not need to migrate every agreement before the workspace is useful.",
  },
  {
    question: "Can Oblixa replace our manual tracker?",
    answer:
      "Yes. Import your CSV, attach the signed agreements as you go, and turn renewals, owners, obligations, evidence, and exceptions into reminders, work, and reports.",
  },
  {
    question: "What file types are supported?",
    answer:
      "PDF and DOCX for signed agreements, plus CSV for spreadsheet imports. Files and metadata are tracked together against each contract record.",
  },
  {
    question: "How does AI extraction work?",
    answer:
      "Oblixa suggests key fields such as renewal, notice, and termination dates from uploaded agreements. Each suggestion stays tied to a source snippet from the document, and your team reviews and approves the fields you are willing to operate on before reminders and reports use them.",
  },
  {
    question: "Can I export my data?",
    answer:
      "Yes. Export operational reports and contract records as CSV at any time so you are never locked in.",
  },
  {
    question: "What happens after access is approved?",
    answer:
      "An approved workspace can start with a bounded contract set. Continued use is paid after access approval and price disclosure; you can also export records and reports.",
  },
] as const;

/* Problem section — restored to release-state spec verbatim
   (`docs/oblixa-release-state.md` §Home Page > Problem). v9 trim to 4
   violated the spec; v10 restores all 6 bullets. */
export const problemSectionTitle =
  "Your contracts are signed. The follow-up is scattered.";
export const problemBullets = [
  "Renewal and notice dates live in spreadsheets",
  "Obligations are buried in PDFs",
  "Owners are unclear or outdated",
  "Follow-up happens over email",
  "Evidence is hard to request and collect",
  "Reports take hours to rebuild",
] as const;

/* Visual-density pass: each spec bullet pairs with a supporting one-liner +
   icon name + tone so the Problem section can render substantial cards
   rather than compact pills. The `title` matches `problemBullets` verbatim
   (spec content unchanged); the `description` restates the same problem in
   one supporting sentence (voice work, not new content). */
export type ProblemTone = "warning" | "neutral" | "danger";
export const problemCards: ReadonlyArray<{
  title: string;
  description: string;
  iconName: "Calendar" | "ScrollText" | "Users" | "MailQuestion" | "FolderSearch" | "BarChart3";
  tone: ProblemTone;
}> = [
  {
    title: "Renewal and notice dates live in spreadsheets",
    description: "Spreadsheets don't remind anyone when dates approach.",
    iconName: "Calendar",
    tone: "warning",
  },
  {
    title: "Obligations are buried in PDFs",
    description: "Commitments stay where they were signed: inside the PDF.",
    iconName: "ScrollText",
    tone: "warning",
  },
  {
    title: "Owners are unclear or outdated",
    description: "Nobody knows whose contract this is until something breaks.",
    iconName: "Users",
    tone: "neutral",
  },
  {
    title: "Follow-up happens over email",
    description: "Threads scatter; outcomes are hard to reconstruct.",
    iconName: "MailQuestion",
    tone: "neutral",
  },
  {
    title: "Evidence is hard to request and collect",
    description: "Requests come in; teams hunt; the trail goes cold.",
    iconName: "FolderSearch",
    tone: "danger",
  },
  {
    title: "Reports take hours to rebuild",
    description: "Re-built from scratch every quarter, by hand.",
    iconName: "BarChart3",
    tone: "warning",
  },
] as const;

/* Outcomes section — release-state spec §Home Page > Outcomes. Restored
   in v10 after v9 deletion violated the spec. */
export const outcomesSectionTitle =
  "Know what needs attention before it becomes a problem";
export const outcomesBullets = [
  "See contracts that need review",
  "Catch upcoming renewal and notice dates",
  "Assign work to the right owner",
  "Track obligations and evidence",
  "Export reports without rebuilding the spreadsheet again",
] as const;

/* Best-Fit section — release-state spec §Home Page > Best-Fit. Restored
   in v10 after v9 deletion violated the spec. */
export const bestFitSectionTitle = "Built for teams outgrowing manual contract tracking";
export const bestFitItems = [
  "Signed contracts already exist and need operational follow-up",
  "Tracking happens in a spreadsheet, folder, email thread, calendar, or someone's memory",
  "Owners, renewal dates, obligations, evidence, or reports are becoming unreliable",
  "The first evaluation can start with a small contract subset, not a full migration",
] as const;

/* Pricing CTA section — release-state spec §"Billing, Pricing, And
   Cancellation": the public Core offer is decided and published plainly
   ($249 per month per workspace, month-to-month, charged only after approval +
   explicit checkout). Access review is a condition, not the headline — the
   prior "Request reviewed workspace access" framing led with access and hid
   the price, which the release-state pricing posture forbids. */
export const pricingCtaMessage = "One Core plan. $249 per workspace, monthly.";
export const pricingCtaLead =
  "Billed month-to-month, with up to 500 active contracts and 10 users. You're charged only after access is approved and you explicitly check out — no free trial, no annual lock-in.";

/* Trust chip badges — moved to the marketing footer in v9 (was a standalone
   Trust band section on the landing page). */
/* v14: trimmed to three claims. "Signed webhooks" is dropped per repeated
   review request even though it is genuinely implemented (HMAC-SHA256
   x-oblixa-signature in src/app/api/webhooks/dispatch/route.ts) — it read as
   too implementation-detail-y for a public trust strip. Re-add if desired. */
export const trustChipBadges = [
  "TLS 1.3 encryption",
  "Role-based access",
  "Audit history",
] as const;

export const softwareFeatureList = [
  "Upload signed agreements and import existing contract spreadsheets",
  "Source-backed suggestions your team reviews",
  "Renewal, notice, and termination date tracking with reminders",
  "Owner assignment, obligations, approvals, and exceptions",
  "Evidence requests linked to contract obligations",
  "Reports and CSV export without rebuilding the spreadsheet",
] as const;
