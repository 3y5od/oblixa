/**
 * Section data for /product — shared between the page (rendered content) and
 * the client-side ProductAnchorNav (scroll-spy + chip strip).
 *
 * Per ui-design-principles §10.18, per-section identity is a restrained tone
 * cue on the eyebrow + chapter index only. The record stage, rules, bullets,
 * and metric stay neutral so the tone reads as quiet wayfinding, not
 * decorative color-coding.
 *
 * Vocabulary contract (release-state §Surface Vocabulary): user-facing copy
 * says contract details (not fields), suggested/confirmed details (not
 * approve/approved fields), contract requirements (not obligations), problems
 * (not exceptions), tasks (not work), confirmations (not approvals).
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
 * Structured metric — a caps label + tabular value, rendered as a quiet ruled
 * ledger tag beside the message (not a rounded pill).
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
    title: "Move signed-contract tracking into one workspace",
    message:
      "Confirmed terms, dates, and owners stay connected — no more re-typing the same contract details across rows, tabs, and shared documents.",
    bullets: [
      "Start with a spreadsheet import or a small contract set",
      "Keep contract records and files together",
      "See missing owners, dates, and key details",
      "Turn confirmed details into reminders, tasks, and reports",
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
    title: "Upload signed contracts or import tracker rows",
    message:
      "Bring in agreements one at a time or by CSV. Keep the original files alongside the contract details your team will actually use.",
    bullets: [
      "Upload individual agreements as PDF or DOCX",
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
    eyebrow: "Confirm details",
    title: "Confirm suggested details before they appear in reminders, tasks, and reports",
    message:
      "Suggested details come back source-backed and awaiting review — each tied to the contract clause it was pulled from, and confirmed by a reviewer before it drives a reminder, task, or report.",
    bullets: [
      "Suggested details",
      "Source text from the original document",
      "Human confirmation before details become trusted data",
      "Model confidence shown as extraction metadata, not a trust state",
      "Manual correction at any time",
    ],
    bulletVariant: "check",
    tone: "warm",
    phaseId: "day-to-day",
    metric: { label: "Per contract", value: "4–6 details" },
  },
  {
    id: "dates",
    number: "4",
    iconName: "CalendarClock",
    eyebrow: "Review dates",
    title: "Track confirmed, calculated, suggested, and missing renewal dates",
    message:
      "Renewal, notice, termination, and effective dates surface on a single timeline — each with its owner, its provenance, and the relevant clause one click away.",
    bullets: [
      "Renewal and notice deadlines",
      "Notice windows",
      "Owner assignment per date",
      "Email reminders to the owner",
      "Confirmed, calculated, suggested, and missing states",
    ],
    bulletVariant: "check",
    tone: "warm",
    phaseId: "day-to-day",
    metric: { label: "Reminders", value: "90 / 30 / 7 days" },
  },
  {
    id: "work",
    number: "5",
    iconName: "ListChecks",
    eyebrow: "Create tasks",
    title: "Turn contract requirements and follow-up into owned tasks",
    message:
      "Convert clause-level contract requirements into tasks, confirmations, and problems with named owners and due dates. Follow-up stops living in inboxes.",
    bullets: [
      "Tasks",
      "Confirmations",
      "Contract requirements",
      "Problems",
      "Due dates",
      "Owners",
    ],
    bulletVariant: "check",
    tone: "warm",
    phaseId: "day-to-day",
    metric: { label: "Task types", value: "4" },
  },
  {
    id: "evidence",
    number: "6",
    iconName: "ShieldCheck",
    eyebrow: "Request evidence",
    title: "Request evidence for contract requirements and tasks",
    message:
      "When a contract requirement needs proof — an insurance certificate, a signed renewal notice, a vendor confirmation — request it inside the contract record and track status until it arrives.",
    bullets: [
      "Evidence requests",
      "Due dates",
      "Status tracking",
      "Linked contracts and requirements",
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
    eyebrow: "Export reports",
    title: "Export contract follow-up reports without rebuilding a tracker",
    message:
      "Operational reports answer the questions your team asks every quarter: what is renewing, what is missing, what is overdue. Export anything to CSV in one click.",
    bullets: [
      "Upcoming renewals",
      "Notice deadlines",
      "Missing owners",
      "Missing key details",
      "Open requirements",
      "Overdue tasks",
      "Problems by owner",
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
  "day-to-day": "Confirm contract details, watch deadlines, assign accountable tasks.",
  output: "Collect proof and export the reports your team needs.",
} as const;
