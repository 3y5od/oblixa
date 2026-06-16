export const features: Array<{ title: string; description: string }> = [
  {
    title: "Every suggestion shows its clause",
    description: "Renewal dates, notice windows, and owners are shown with the exact contract clause they came from.",
  },
  {
    title: "Reminders that match ownership",
    description: "Reminders are created from confirmed dates and go to the owner, not a shared inbox.",
  },
  {
    title: "Built for small teams",
    description: "Finance, ops, and legal share one follow-up list without role setup.",
  },
  {
    title: "Import and export by CSV",
    description: "CSV in from your tracker; CSV out for reports.",
  },
];

export const steps = [
  {
    n: "1",
    title: "Bring in signed contracts",
    body: "Add PDF or DOCX agreements, or import your tracker by CSV.",
  },
  {
    n: "2",
    title: "Confirm important dates and owners",
    body: "Each date is shown with the contract clause it came from - nothing is used until your team confirms it.",
  },
  {
    n: "3",
    title: "Track reminders, evidence, tasks, and reports",
    body: "Confirmed dates create reminders, tasks, and CSV reports - each with an owner.",
  },
] as const;

export const compareColumns = ["Spreadsheets", "Full CLM suites", "Oblixa"] as const;

export const compareRows: Array<{ label: string; cells: [string, string, string] }> = [
  { label: "Time to value", cells: ["Instant, fragile", "Months of setup", "Days, with a bounded set"] },
  { label: "Detail-level review", cells: ["None", "Optional", "Required"] },
  { label: "Task ownership", cells: ["Drifts across files", "Heavy role config", "Built into queues"] },
  { label: "Reminders tied to dates", cells: ["Manual", "Configurable", "From confirmed details"] },
  { label: "Audit trail", cells: ["Scattered email", "Comprehensive", "Audit history"] },
  { label: "Right for", cells: ["Solo operators", "Large, complex orgs", "Ops & finance teams"] },
];

export const bestFitProofs = [
  "about 120 signed agreements - PDF + DOCX",
  "renewals.xlsx - inbox - shared drive",
  "Owner: unassigned - last updated 8 months ago",
  "first_set.csv - 32 contracts",
] as const;

export const boundaryBlockTitles = [
  {
    kicker: "Legal",
    title: "Not legal advice",
    accent: "var(--danger-ink)",
    summary:
      "Oblixa is not a law firm and does not provide legal advice - your team reviews contract information and decides.",
  },
  {
    kicker: "AI review",
    title: "Suggestions require confirmation",
    accent: "var(--warning-ink)",
    summary:
      "Suggested dates are shown with the contract clause they came from and are not used until your team confirms them.",
  },
  {
    kicker: "Data handling",
    title: "Workspace-scoped files",
    accent: "var(--success-ink)",
    summary:
      "Files or extracted text may be sent to an AI provider to suggest details; files stay workspace-scoped.",
  },
  {
    kicker: "Export",
    title: "Export and delete paths",
    accent: "var(--accent-strong)",
    summary: "Export operational reports and contract records as CSV at any time - you are never locked in.",
  },
] as const;

export const faqCategories = ["Getting started", "Migration", "Files", "Data & support", "Access"] as const;
