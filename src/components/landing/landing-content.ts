/** Marketing copy — single source for landing UI and JSON-LD FAQ.
 *  Aligned to the intended release state: track what signed contracts require
 *  next, with reviewed source-backed data and controlled workspace access.
 *
 *  v18 vocabulary contract (release-state §Surface Vocabulary): user-facing
 *  copy says contract details (not fields), requirements (not obligations),
 *  problems (not exceptions), tasks (not work), and confirm (not approve). */

export const heroEyebrow = "Contract tracking";

export const heroTitle = "Track what signed contracts require next.";

/* v45 public-language standard: input → what Oblixa identifies → who
   confirms → what happens after, in concrete contract nouns. The internal
   program phrasing stays verbatim in
   src/lib/release-state/program-assets.ts (RELEASE_STATE_SUPPORTING_PROMISE);
   the public page translates it for users. */
export const heroSubcopy =
  "Upload signed contracts or import your tracker. Oblixa identifies renewal dates, notice windows, owners, evidence needs, and required follow-up. Your team confirms each item before reminders, tasks, or reports use it.";

export const ctaPrimaryLabel = "Request access";
/* v23: spec §`/` secondary CTA revised from "View product tour" in the same
   change (docs/oblixa-release-state.md) — label and contract move together. */
export const ctaSecondaryLabel = "View product";
export const navGetStartedLabel = "Request access";

export const riskReducerLine =
  "Reviewed workspace access for teams tracking signed contracts in spreadsheets, folders, inboxes, calendars, or memory.";

export const antiGoalSummary =
  "Oblixa is not a full CLM, legal-advice tool, or autonomous agent. It tracks renewals, requirements, owners, evidence, and reports from agreements you have already signed.";

/* FAQ — release-state spec §`/` > FAQ requires coverage of: CLM boundary,
   no legal advice, starting small, file types, AI review, AI-provider/file
   handling, export, deletion/contact recovery, and paid continuation.
   v20: `featured` items render as visible editorial rows in the merged
   trust-and-boundaries section (the former objection bullets are absorbed);
   the rest stay in the accordion. JSON-LD consumes all items either way. */
export const faqItems: ReadonlyArray<{
  question: string;
  answer: string;
  featured?: boolean;
}> = [
  {
    question: "Is Oblixa a CLM?",
    answer:
      "No. Oblixa is a tracking workspace for agreements you have already signed. It does not replace drafting, redlining, or e-signature tools — it picks up where they leave off, tracking renewals, owners, requirements, evidence, and reports.",
    featured: true,
  },
  {
    question: "Does Oblixa provide legal advice?",
    answer:
      "No. Oblixa is not a law firm and does not provide legal advice. Users are responsible for reviewing contract information and making business or legal decisions.",
    featured: true,
  },
  {
    question: "Can I start without migrating every contract?",
    answer:
      "Yes. Start with a small contract set or import your existing tracking spreadsheet. You do not need to migrate every agreement before the workspace is useful.",
  },
  {
    question: "Can Oblixa replace our manual tracker?",
    answer:
      "Yes. Import your CSV, attach the signed agreements as you go, and turn renewals, owners, requirements, evidence, and problems into reminders, tasks, and reports.",
  },
  {
    question: "What file types are supported?",
    answer:
      "PDF and DOCX for signed agreements, plus CSV for spreadsheet imports. Files and metadata are tracked together against each contract record.",
  },
  {
    question: "How do AI suggestions work?",
    answer:
      "Oblixa suggests contract details such as renewal, notice, and termination dates from uploaded agreements. Each suggestion is shown with the contract clause it came from, and your team confirms each item before reminders, tasks, or reports use it.",
    featured: true,
  },
  {
    question: "Are uploaded files shared with an AI provider?",
    answer:
      "Uploaded files or extracted text may be sent to an AI provider to suggest contract details and locate the clauses they come from. Files stay workspace-scoped, and suggestions are not used for reminders or reports until someone on your team confirms them. The privacy page describes data handling in more detail.",
    featured: true,
  },
  {
    question: "Can I export my data?",
    answer:
      "Yes. Export operational reports and contract records as CSV at any time so you are never locked in.",
    featured: true,
  },
  {
    question: "How do I delete my data or get help?",
    answer:
      "Workspace admins can export contract records and request deletion of workspace data. For deletion requests, account recovery, or anything else, the contact page reaches the team asynchronously.",
  },
  {
    question: "What happens after access is approved?",
    answer:
      "An approved workspace can start with a bounded contract set. Continued use is paid after access approval and price disclosure; you can also export records and reports.",
  },
] as const;

/* Problem section — release-state spec §`/` > Problem section. v18 aligns
   bullet 2 with the spec's own wording ("contract requirements buried in
   PDFs"); the prior "Obligations" phrasing predated the vocabulary contract. */
export const problemSectionTitle =
  "Your contracts are signed. The follow-up is scattered.";
export const problemBullets = [
  "Renewal and notice dates live in spreadsheets",
  "Contract requirements are buried in PDFs",
  "Owners are unclear or outdated",
  "Follow-up happens over email",
  "Evidence is hard to request and collect",
  "Reports take hours to rebuild",
] as const;

/* Display ledger — the v45 plain-language renderings of the spec bullets
   (recognizable user problems, concrete contract nouns). The spec wording
   itself stays verbatim in `problemBullets` above, which keeps its sr-only
   render-path anchor. Five rows: the former email + evidence bullets merge
   into one evidence-over-email failure. */
export const problemItems: ReadonlyArray<{
  title: string;
  description: string;
  /** Mono specimen rendered in the failure map, tagged by source kind so each
   *  row reads as a distinct operational object. */
  specimen: string;
  tag: string;
}> = [
  {
    title: "Renewal dates are kept in spreadsheets.",
    description: "Spreadsheets don't remind anyone when dates approach.",
    specimen: "renewals.xlsx · row 214 — “May renewal?? check w/ legal”",
    tag: "XLSX",
  },
  {
    title: "Notice requirements are buried in signed PDFs.",
    description: "The terms stay where they were signed: inside the PDF.",
    specimen: "MSA §9.2, page 14 — “…sixty (60) days written notice…”",
    tag: "PDF",
  },
  {
    title: "Owners are unclear or out of date.",
    description: "Nobody knows whose contract this is until something breaks.",
    specimen: "Owner: — · last updated 8 months ago",
    tag: "OWNER",
  },
  {
    title: "Evidence requests happen over email.",
    description: "Requests scatter into threads, and the trail goes cold.",
    specimen: "RE: RE: FW: Northwind renewal — 23 replies",
    tag: "EMAIL",
  },
  {
    title: "Reports are rebuilt by hand.",
    description: "Every quarter, someone reassembles the same numbers from scratch.",
    specimen: "Q2_report_FINAL.xlsx — rebuilt by hand",
    tag: "REPORT",
  },
] as const;

/* Outcomes section — release-state spec §`/` > Outcome section. */
export const outcomesSectionTitle =
  "Know what needs attention before it becomes a problem";
export const outcomesBullets = [
  "See contracts that need review",
  "Catch upcoming renewal and notice dates",
  "Assign tasks to the right owner",
  "Track requirements and evidence",
  "Export reports without rebuilding the spreadsheet again",
] as const;

/* Best-Fit section — release-state spec §`/` > Best-fit section. */
export const bestFitSectionTitle = "Built for teams outgrowing manual contract tracking";
export const bestFitItems = [
  "Signed contracts already exist and need operational follow-up",
  "Tracking happens in a spreadsheet, folder, email thread, calendar, or someone's memory",
  "Owners, renewal dates, requirements, evidence, or reports are becoming unreliable",
  "The first workspace can start with a small contract set, not a full migration",
] as const;

/* Pricing CTA section — release-state spec §"Billing, Pricing, And
   Cancellation": the public Core offer is decided and published plainly
   ($249 per month per workspace, month-to-month, charged only after approval +
   explicit checkout). Access review is a condition, not the headline.
   v35: formal section title per directive 64 — the offer sheet's masthead
   carries the price; the heading names the record. Pinned by
   landing-page.ui.test.tsx (/core pricing/i). */
export const pricingCtaMessage = "Core pricing";
export const pricingCtaLead =
  "Billed month-to-month, with up to 500 active contracts and 10 users. You're charged only after access is approved and you explicitly check out — no free trial, no annual lock-in.";

/* Trust chip badges — rendered in the marketing footer.
   v18: "TLS 1.3 encryption" softened to "Encrypted in transit" — the specific
   protocol-version claim has no claim-evidence record (release-state §Public
   Legal, Trust, And Policy Behavior requires claim-level evidence; conservative
   wording is the mandated fallback). Restore the version claim only with a
   named verification record. */
export const trustChipBadges = [
  "Encrypted in transit",
  "Role-based access",
  "Audit history",
] as const;

export const softwareFeatureList = [
  "Upload signed agreements and import existing contract spreadsheets",
  "Source-backed suggestions your team reviews",
  "Renewal, notice, and termination date tracking with reminders",
  "Owner assignment, requirements, approvals, and problem tracking",
  "Evidence requests linked to contract requirements",
  "Reports and CSV export without rebuilding the spreadsheet",
] as const;
