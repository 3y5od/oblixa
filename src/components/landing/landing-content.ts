/** Marketing copy — single source for landing UI and JSON-LD FAQ. */

export const heroEyebrow = "Contract operations, not CLM";

export const heroTitle =
  "Run renewals, approvals, and obligations from one trusted system";

export const heroSubcopy =
  "Oblixa gives operations teams a practical execution layer: centralize agreements, verify extracted fields with evidence, and execute date-driven workflows with clear ownership.";

export const ctaPrimaryLabel = "Create free account";
export const ctaSecondaryLabel = "Sign in";
export const navGetStartedLabel = "Get started";

/** Accurate for email/password signup (billing is a separate admin flow after sign-in). */
export const riskReducerLine =
  "Sign up with email to create a workspace—no credit card required to get started.";

export const antiGoalSummary =
  "Not a full CLM suite—Oblixa focuses on post-signature execution: dates, ownership, and audit-friendly operational records.";

export const objectionBullets = [
  {
    title: "Spreadsheets drift",
    body: "Dates and owners live in one place with review history instead of scattered files.",
  },
  {
    title: "CLM can be heavy",
    body: "Start with operational workflows you run weekly—without a months-long implementation program.",
  },
  {
    title: "AI needs guardrails",
    body: "Extracted fields stay tied to source snippets until your team approves what drives reminders.",
  },
] as const;

export const useCaseItems = [
  {
    title: "Renewals and notice windows",
    body: "Track end dates, notice deadlines, and who must act before options expire.",
  },
  {
    title: "Approvals and exceptions",
    body: "Route decisions through checkpoints so changes to operational fields stay accountable.",
  },
  {
    title: "Obligations and tasks",
    body: "Turn contract language into owned work with reminders tied to approved dates.",
  },
] as const;

export const faqItems = [
  {
    question: "Is Oblixa a contract lifecycle management (CLM) system?",
    answer:
      "No. Oblixa is built for post-signature execution: centralizing agreements, validating extracted operational fields, and running date-driven workflows with clear ownership. It complements—not replaces—your drafting or repository tools.",
  },
  {
    question: "Does Oblixa provide legal advice?",
    answer:
      "No. Oblixa does not provide legal advice, legal analysis, or a substitute for qualified counsel. Always verify critical terms against the original documents and your own policies.",
  },
  {
    question: "How does AI extraction work?",
    answer:
      "The product suggests fields such as renewal, notice, and term dates from uploaded documents. Your team reviews source snippets and approves only what you are willing to operate on before reminders and workflows use that data.",
  },
  {
    question: "Who is Oblixa for?",
    answer:
      "Operations, finance, and legal-adjacent teams at organizations that need accountable contract execution without standing up a full CLM program.",
  },
  {
    question: "Can we export our data?",
    answer:
      "Yes. You can export operational data for reporting and use bulk import when clearing a backlog, so you are not locked into a spreadsheet-only workflow.",
  },
  {
    question: "How do reminders work?",
    answer:
      "Email reminders are tied to approved dates and the assigned owner so handoffs are less likely to strand follow-ups.",
  },
] as const;

export const trustSummary =
  "Role-aware access, API key controls, signed outbound webhooks, and configurable workflows help teams scale operations safely.";

export const softwareFeatureList = [
  "Contract document storage by counterparty",
  "AI-assisted field extraction with human approval",
  "Renewal and obligation tracking",
  "Email reminders tied to approved dates",
  "CSV export and bulk import",
] as const;
