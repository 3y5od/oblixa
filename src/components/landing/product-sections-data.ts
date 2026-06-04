/**
 * Section data for /product — shared between the page (rendered content) and
 * the client-side ProductAnchorNav (scroll-spy + chip strip).
 *
 * Per ui-design-principles §10.18, per-section identity is a restrained tone
 * cue on the eyebrow + medallion only. The card rail, background, bullets, and
 * metric chip stay neutral so the tone reads as quiet wayfinding, not
 * decorative color-coding.
 */

export type SectionTone = "cool" | "warm" | "amber" | "success";

/**
 * Tone CSS variable references. globals.css provides forced-colors fallbacks.
 * For Safari ≤ 15.3 cross-browser support, components using these should wrap
 * color-mix() usage in @supports blocks with a solid-color fallback.
 */
export const TONE_TOKENS: Record<SectionTone, string> = {
  cool: "var(--accent-strong)",
  warm: "var(--accent-warm, var(--accent))",
  amber: "var(--warning-ink)",
  success: "var(--success-ink)",
} as const;

export type Phase = {
  id: "setup" | "day-to-day" | "output";
  label: string;
  number: string;
  tone: SectionTone;
};

export const PHASES: readonly Phase[] = [
  { id: "setup", label: "Get started", number: "1", tone: "cool" },
  { id: "day-to-day", label: "Day-to-day", number: "2", tone: "warm" },
  { id: "output", label: "Prove and report", number: "3", tone: "success" },
] as const;

/**
 * 7 product sections — id, eyebrow, number, tone, phase.
 * The icon name is a key into the icon registry (page imports the actual
 * lucide component to avoid bundling all icons via this data module).
 */
export type SectionIconName =
  | "FileSpreadsheet"
  | "Database"
  | "FileText"
  | "CalendarClock"
  | "ListChecks"
  | "ShieldCheck"
  | "BarChart3";

/**
 * Structured metric chip — a caps label + tabular value, rendered as a
 * `<KeyValueChip>`. Replaces the older prose `microStat` mini-sentence so the
 * inline fact reads as a bounded chip rather than a floating sentence.
 */
export type SectionMetric = {
  label: string;
  value: string;
};

export type ProductSection = {
  id: string;
  number: string;
  iconName: SectionIconName;
  eyebrow: string;
  title: string;
  message: string;
  bullets: readonly string[];
  bulletVariant: "check" | "dot";
  tone: SectionTone;
  phaseId: Phase["id"];
  /** Single structured fact shown below the message (label + tabular value). */
  metric?: SectionMetric;
};

export const PRODUCT_SECTIONS: readonly ProductSection[] = [
  {
    id: "replace",
    number: "1",
    iconName: "FileSpreadsheet",
    eyebrow: "Replace the spreadsheet",
    title: "Move your tracker into one live workspace",
    message:
      "Reviewed terms, dates, and owners stay connected — no more re-typing the same fields across rows, tabs, and shared documents.",
    bullets: [
      "Start with a spreadsheet import or a small contract set",
      "Keep contract records and files together",
      "See missing owners, dates, and key fields",
      "Turn reviewed fields into reminders, work, and reports",
    ],
    bulletVariant: "dot",
    tone: "cool",
    phaseId: "setup",
    metric: { label: "First import", value: "25–50" },
  },
  {
    id: "upload",
    number: "2",
    iconName: "Database",
    eyebrow: "Upload and import",
    title: "Add signed contracts from PDF, DOCX, or CSV",
    message:
      "Bring in agreements one at a time or by CSV. Keep the original files alongside the structured fields your team will actually use.",
    bullets: [
      "Upload individual agreements",
      "Import contract records by CSV",
      "Track files and metadata together",
      "Start with a small contract set",
    ],
    bulletVariant: "dot",
    tone: "cool",
    phaseId: "setup",
    metric: { label: "Formats", value: "PDF DOCX CSV" },
  },
  {
    id: "review",
    number: "3",
    iconName: "FileText",
    eyebrow: "Review suggested fields",
    title: "Confirm suggested fields before you trust them",
    message:
      "Suggested fields come back source-backed and human-reviewed — each tied to the snippet it was pulled from, and confirmed by a reviewer before it drives a reminder, work item, or report.",
    bullets: [
      "Suggested fields",
      "Source snippets from the original document",
      "Human approval before fields become trusted data",
      "Confidence shown as a hint, not a verdict",
      "Manual correction at any time",
    ],
    bulletVariant: "check",
    tone: "warm",
    phaseId: "day-to-day",
    metric: { label: "Per contract", value: "4–6 fields" },
  },
  {
    id: "dates",
    number: "4",
    iconName: "CalendarClock",
    eyebrow: "Track dates",
    title: "Keep renewal and notice dates visible",
    message:
      "Renewal, notice, termination, and effective dates surface on a single timeline — with the owner and the relevant clause one click away.",
    bullets: [
      "Upcoming deadlines",
      "Notice windows",
      "Owner assignment per date",
      "Email reminder support",
      "Renewal status",
    ],
    bulletVariant: "check",
    tone: "warm",
    phaseId: "day-to-day",
    metric: { label: "Reminders", value: "30 / 60 / 90 days" },
  },
  {
    id: "work",
    number: "5",
    iconName: "ListChecks",
    eyebrow: "Assign work",
    title: "Turn obligations and follow-up into owned work",
    message:
      "Convert clause-level obligations into tasks, approvals, and exceptions with named owners and due dates. Follow-up stops living in inboxes.",
    bullets: [
      "Tasks",
      "Approvals",
      "Obligations",
      "Exceptions",
      "Due dates",
      "Owners",
    ],
    bulletVariant: "check",
    tone: "warm",
    phaseId: "day-to-day",
    metric: { label: "Work types", value: "4" },
  },
  {
    id: "evidence",
    number: "6",
    iconName: "ShieldCheck",
    eyebrow: "Collect evidence",
    title: "Request and track proof of follow-up",
    message:
      "When an obligation needs proof — a certificate, a renewal confirmation, a vendor attestation — request it inside the contract record and track status until it arrives.",
    bullets: [
      "Evidence requests",
      "Due dates",
      "Status tracking",
      "Linked contracts and obligations",
    ],
    bulletVariant: "check",
    tone: "amber",
    phaseId: "output",
    metric: { label: "Default due", value: "14 days" },
  },
  {
    id: "reports",
    number: "7",
    iconName: "BarChart3",
    eyebrow: "Report and export",
    title: "Produce reports without rebuilding spreadsheets",
    message:
      "Operational reports answer the questions your team asks every quarter: what is renewing, what is missing, what is overdue. Export anything to CSV in one click.",
    bullets: [
      "Upcoming renewals",
      "Notice deadlines",
      "Missing owners",
      "Missing key fields",
      "Open obligations",
      "Overdue work",
      "Exceptions by owner",
      "Evidence requests",
      "Contract inventory",
      "Review completeness",
    ],
    bulletVariant: "check",
    tone: "success",
    phaseId: "output",
    metric: { label: "Export", value: "CSV" },
  },
] as const;

/**
 * Phase descriptions shown below each phase header.
 */
export const PHASE_DESCRIPTIONS: Record<Phase["id"], string> = {
  setup: "Bring your contracts in and see what's missing.",
  "day-to-day": "Confirm fields, watch deadlines, assign accountable work.",
  output: "Collect proof and export the reports your team needs.",
} as const;
