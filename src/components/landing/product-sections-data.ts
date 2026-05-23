/**
 * Section data for /product — shared between the page (rendered content) and
 * the client-side ProductAnchorNav (scroll-spy + chip strip).
 *
 * v5 visual pass: per-section tone tokens, badge stamps, group phases.
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
 * 7 product sections — id, eyebrow, number, badge stamp, tone, phase.
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
  badge: string;
  phaseId: Phase["id"];
  /**
   * v6 T8.3 — section-specific micro-stat (kept as the single in-body pill).
   * Per v7 T27.4: the context strip caps line was removed; per v7 T28.1 the
   * abstract decoration SVG was removed. `microStat` is the only inline pill left.
   */
  microStat?: string;
  /**
   * v6 T8.1 — abstract decoration name. Retained in the data shape for
   * type-stability but NO LONGER RENDERED (v7 T28.1 — competes with the badge
   * stamp for the top-right corner, medallion already carries section identity).
   */
  decoration: SectionDecorationName;
};

/** v6 T8.1 — abstract SVG decoration identifiers per section. */
export type SectionDecorationName =
  | "grid-tree"
  | "upload-arrow"
  | "magnifier-check"
  | "calendar-dot"
  | "nodes"
  | "shield-check"
  | "bar-chart";

export const PRODUCT_SECTIONS: readonly ProductSection[] = [
  {
    id: "replace",
    number: "1",
    iconName: "FileSpreadsheet",
    eyebrow: "Replace the spreadsheet",
    title: "Move from a static spreadsheet to a tracking workspace",
    message:
      "Reviewed terms, dates, and owners stay connected — no more re-typing the same fields across rows, tabs, and shared documents.",
    bullets: [
      "Start with a spreadsheet import or a small contract set",
      "Keep contract records and files together",
      "See missing owners, dates, and key fields",
      "Turn reviewed contract information into reminders, work, and reports",
    ],
    bulletVariant: "dot",
    tone: "cool",
    badge: "Start here",
    phaseId: "setup",
    microStat: "Average first import: 25–50 contracts",
    decoration: "grid-tree",
  },
  {
    id: "upload",
    number: "2",
    iconName: "Database",
    eyebrow: "Upload and import",
    title: "Add signed contracts from PDFs, DOCX, or your existing spreadsheet",
    message:
      "Bring in agreements one at a time or by CSV. Keep the original files alongside the structured fields your team will actually use.",
    bullets: [
      "Upload individual agreements",
      "Import contract records by CSV",
      "Track files and metadata together",
      "Start with a small contract set instead of migrating everything",
    ],
    bulletVariant: "dot",
    tone: "cool",
    badge: "Input",
    phaseId: "setup",
    microStat: "Supported formats: PDF, DOCX, CSV",
    decoration: "upload-arrow",
  },
  {
    id: "review",
    number: "3",
    iconName: "FileText",
    eyebrow: "Review key terms",
    title: "Confirm important fields before they drive reminders, work, or reports",
    message:
      "Suggested extracted terms come back with source snippets and confidence indicators. A reviewer confirms each important field before it drives a reminder, work item, or report.",
    bullets: [
      "Suggested extracted terms",
      "Source snippets from the original document",
      "Confidence indicators",
      "Human approval before fields become trusted data",
      "Manual correction at any time",
    ],
    bulletVariant: "check",
    tone: "warm",
    badge: "Trust check",
    phaseId: "day-to-day",
    microStat: "Typical review: 4–6 fields per contract",
    decoration: "magnifier-check",
  },
  {
    id: "dates",
    number: "4",
    iconName: "CalendarClock",
    eyebrow: "Track dates",
    title: "Keep renewal, notice, termination, and effective dates visible",
    message:
      "Renewal, notice, termination, and effective dates surface on a single calendar — with the owner and the relevant clause one click away.",
    bullets: [
      "Upcoming deadlines",
      "Notice windows",
      "Owner assignment per date",
      "Email reminder support",
      "Renewal status",
    ],
    bulletVariant: "check",
    tone: "warm",
    badge: "Most used",
    phaseId: "day-to-day",
    microStat: "Default reminder windows: 30, 60, and 90 days",
    decoration: "calendar-dot",
  },
  {
    id: "work",
    number: "5",
    iconName: "ListChecks",
    eyebrow: "Assign work",
    title: "Turn contract obligations and follow-up into accountable work",
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
    badge: "Active",
    phaseId: "day-to-day",
    microStat: "Default approvers: Owner + Admin",
    decoration: "nodes",
  },
  {
    id: "evidence",
    number: "6",
    iconName: "ShieldCheck",
    eyebrow: "Collect evidence",
    title: "Request and attach proof when contract work needs evidence",
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
    badge: "Proof",
    phaseId: "output",
    microStat: "Default ack window: 14 days",
    decoration: "shield-check",
  },
  {
    id: "reports",
    number: "7",
    iconName: "BarChart3",
    eyebrow: "Report and export",
    title: "Produce operational reports without rebuilding spreadsheets",
    message:
      "Pre-built lists answer the questions your team asks every quarter: what is renewing, what is missing, what is overdue. Export anything to CSV in one click.",
    bullets: [
      "Upcoming renewals",
      "Missing owners",
      "Missing key fields",
      "Open obligations",
      "Overdue work",
      "Exceptions",
      "Contract inventory",
    ],
    bulletVariant: "check",
    tone: "success",
    badge: "Output",
    phaseId: "output",
    microStat: "Default exports: CSV (every plan)",
    decoration: "bar-chart",
  },
] as const;

/**
 * v6 — Phase descriptions shown below each phase header.
 */
export const PHASE_DESCRIPTIONS: Record<Phase["id"], string> = {
  setup: "Bring your contracts in and see what's missing.",
  "day-to-day": "Confirm fields, watch deadlines, assign accountable work.",
  output: "Collect proof and export the reports your team needs.",
} as const;

/**
 * v6 T11.4 — REMOVED v7 T27.10. Pull quotes were short italic sentences
 * floating between sections with no editorial framing; they read as accidental.
 * Page narrative works without them.
 */

/**
 * The four outcomes shown in the strip below the hero. Tone-coded.
 */
export const OUTCOMES = [
  {
    id: "renewals",
    label: "Track renewals",
    subtitle: "Renewals + notice dates",
    tone: "cool" as SectionTone,
    iconName: "CalendarClock" as SectionIconName,
    anchor: "#dates",
  },
  {
    id: "work",
    label: "Assign work",
    subtitle: "Tasks + approvals",
    tone: "warm" as SectionTone,
    iconName: "ListChecks" as SectionIconName,
    anchor: "#work",
  },
  {
    id: "evidence",
    label: "Collect evidence",
    subtitle: "Proof of follow-up",
    tone: "amber" as SectionTone,
    iconName: "ShieldCheck" as SectionIconName,
    anchor: "#evidence",
  },
  {
    id: "reports",
    label: "Produce reports",
    subtitle: "CSV exports",
    tone: "success" as SectionTone,
    iconName: "BarChart3" as SectionIconName,
    anchor: "#reports",
  },
] as const;

