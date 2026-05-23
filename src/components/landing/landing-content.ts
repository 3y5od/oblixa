/** Marketing copy — single source for landing UI and JSON-LD FAQ.
 *  Aligned to docs/oblixa-release-state.md — the wedge is "Replace the contract
 *  tracking spreadsheet"; voice rules forbid "Contract execution" / "Execution
 *  layer" / "Platform" / "Transformation" / "Autonomous" in public copy. */

export const heroEyebrow = "Contract tracking";

export const heroTitle =
  "Track renewals, obligations, and owners from signed contracts.";

/* v10 — Restored to release-state spec verbatim (`docs/oblixa-release-state.md`
   §Home Page > Hero). The v9 tightening (to "Replace your contract tracking
   spreadsheet…") violated the spec; reverting for compliance. */
export const heroSubcopy =
  "Oblixa replaces contract tracking spreadsheets with a workspace for reviewed terms, key dates, assigned owners, obligation follow-up, evidence, and reports.";

export const ctaPrimaryLabel = "Start free trial";
export const ctaSecondaryLabel = "Book setup call";
export const navGetStartedLabel = "Start free trial";

/** Trust micro-copy under hero CTAs. Voice-sweep bans middle dots — em-dash. */
export const riskReducerLine =
  "21-day free trial — no credit card required.";

export const antiGoalSummary =
  "Oblixa is not a full CLM, legal-advice tool, or autonomous agent. It tracks renewals, obligations, owners, evidence, and reports from agreements you have already signed.";

export const objectionBullets = [
  {
    title: "Your contract spreadsheet drifts",
    body: "Renewal dates, owners, and follow-up live in one workspace with review history instead of scattered files and inbox threads.",
  },
  {
    title: "Full CLM is too heavy to migrate",
    body: "Start with a small contract set or your existing spreadsheet — no months-long implementation, no redlining workflow you do not need.",
  },
  {
    title: "AI extraction needs human review",
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
    question: "Can Oblixa replace our contract spreadsheet?",
    answer:
      "Yes — that is what it is built for. Import your CSV, attach the signed agreements as you go, and turn renewals, owners, and obligations into reminders, work, and reports.",
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
    question: "What happens when the trial ends?",
    answer:
      "Your data stays available. Choose a plan to keep tracking renewals, work, evidence, and reports — or export everything to CSV and continue in your existing tools.",
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
  "Approvals and follow-up happen over email",
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
    title: "Approvals and follow-up happen over email",
    description: "Threads scatter; outcomes are hard to reconstruct.",
    iconName: "MailQuestion",
    tone: "neutral",
  },
  {
    title: "Evidence is hard to request and collect",
    description: "Auditors ask; teams hunt; the trail goes cold.",
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
export const bestFitSectionTitle = "Built for teams outgrowing contract spreadsheets";
export const bestFitItems = [
  "50 to 500 active agreements",
  "Vendor, customer, service, lease, financing, partnership, or renewal-heavy contracts",
  "Shared responsibility across operations, finance, legal, procurement, or account teams",
  "A need to track dates, owners, obligations, evidence, and reports in one place",
] as const;

/* Pricing CTA section — release-state spec §Home Page > Pricing CTA.
   Restored in v10 after v9 deletion violated the spec. */
export const pricingCtaMessage =
  "Start by replacing the spreadsheet. Add larger-team workflows only when you need them.";

/* Trust chip badges — moved to the marketing footer in v9 (was a standalone
   Trust band section on the landing page). */
export const trustChipBadges = [
  "TLS 1.3 encryption",
  "Role-based access",
  "Signed webhooks",
  "Audit-logged events",
] as const;

export const softwareFeatureList = [
  "Upload signed agreements and import existing contract spreadsheets",
  "AI-assisted extraction with source-backed human review",
  "Renewal, notice, and termination date tracking with reminders",
  "Owner assignment, obligations, approvals, and exceptions",
  "Evidence requests linked to contract obligations",
  "Reports and CSV export without rebuilding the spreadsheet",
] as const;
