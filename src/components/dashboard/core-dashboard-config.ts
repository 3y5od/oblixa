import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckSquare,
  FileText,
  Inbox,
  ListChecks,
  ShieldAlert,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { DashboardSectionKey, DashboardTopCardKey } from "@/lib/dashboard/core-dashboard-model";

export const SECTION_ICONS: Record<DashboardSectionKey, LucideIcon> = {
  review_queue: CheckSquare,
  upcoming_deadlines: CalendarClock,
  work_needing_action: ListChecks,
  data_gaps: Inbox,
  recent_activity: FileText,
};

export const TOP_CARD_ICON: Record<DashboardTopCardKey, LucideIcon> = {
  needs_review: CheckSquare,
  upcoming_deadlines: CalendarClock,
  blocked_work: Ban,
  missing_owners: UserX,
  open_exceptions: AlertTriangle,
  evidence_requested: ShieldAlert,
};

export const TOP_CARD_DESCRIPTION: Record<DashboardTopCardKey, string> = {
  needs_review: "Suggested dates, owners, and terms must be confirmed before reminders and reports rely on them.",
  upcoming_deadlines: "Confirmed or calculated renewal, notice, end, or effective dates inside the next 90 days.",
  blocked_work: "Tasks that cannot proceed until an answer, approval, file, or owner is provided.",
  missing_owners: "Assign an owner so reminders and follow-up have a clear responsible person.",
  open_exceptions: "Open contract problems that need an owner, decision, or resolution.",
  evidence_requested: "Open requests for files or confirmation tied to contract requirements.",
};

// Tight one-line consequence for the compact ledger cell — the long-form
// TOP_CARD_DESCRIPTION reads as a paragraph in a dense register, so each card
// gets a single scannable clause that fits one line beside the count column.
export const TOP_CARD_NOTE: Record<DashboardTopCardKey, string> = {
  needs_review: "Confirm before reminders and reports use them",
  upcoming_deadlines: "Renewal, notice, and end dates within 90 days",
  blocked_work: "Held until an answer, approval, file, or owner",
  missing_owners: "Assign an owner to route reminders and follow-up",
  open_exceptions: "Needs an owner, decision, or resolution",
  evidence_requested: "Files or confirmations tied to requirements",
};

export const TOP_CARD_UNIT: Record<DashboardTopCardKey, string> = {
  needs_review: "contracts",
  upcoming_deadlines: "dates",
  blocked_work: "tasks",
  missing_owners: "contracts",
  open_exceptions: "problems",
  evidence_requested: "evidence requests",
};

export const TOP_CARD_STATE: Record<DashboardTopCardKey, string> = {
  needs_review: "Needs confirmation",
  upcoming_deadlines: "Within 90 days",
  blocked_work: "Cannot proceed",
  missing_owners: "Missing owner",
  open_exceptions: "Decision needed",
  evidence_requested: "Awaiting review",
};

// Cleared-state phrasing for a zero count, so an all-clear row reads as a calm
// "No … " line rather than "0 …" competing as another metric (§8 critique #8).
export const TOP_CARD_ZERO_STATEMENT: Record<DashboardTopCardKey, string> = {
  needs_review: "No contracts need review",
  upcoming_deadlines: "No dates within the next 90 days",
  blocked_work: "No tasks are held up",
  missing_owners: "Every contract has an owner",
  open_exceptions: "No open problems",
  evidence_requested: "No evidence requests awaiting review",
};

// Each snapshot signal reads as one operational statement — number + object +
// condition in a single sentence ("1 contract needs review") rather than a bare
// numeral with scattered supporting fragments (§19 count semantics, §7 critique).
// The builder returns the words that follow the emphasized count, singular-aware.
export const TOP_CARD_STATEMENT: Record<DashboardTopCardKey, (count: number) => string> = {
  needs_review: (n) => (n === 1 ? "contract needs review" : "contracts need review"),
  upcoming_deadlines: (n) => (n === 1 ? "date within the next 90 days" : "dates within the next 90 days"),
  blocked_work: (n) => (n === 1 ? "task cannot proceed" : "tasks cannot proceed"),
  missing_owners: (n) => (n === 1 ? "contract is missing an owner" : "contracts are missing an owner"),
  open_exceptions: (n) => (n === 1 ? "open problem needs a decision" : "open problems need a decision"),
  evidence_requested: (n) => (n === 1 ? "evidence request is awaiting review" : "evidence requests are awaiting review"),
};

// Terse label for the compact metric filter chip ("1 to review", "1 blocked").
// Count-aware where a plural would read wrong; invariant adjectives otherwise.
export const TOP_CARD_CHIP: Record<DashboardTopCardKey, (count: number) => string> = {
  needs_review: () => "Review",
  upcoming_deadlines: () => "Dates",
  blocked_work: () => "Blocked",
  missing_owners: () => "Owners",
  open_exceptions: () => "Problems",
  evidence_requested: () => "Evidence",
};

export const TOP_CARD_ZERO_DESCRIPTION: Record<DashboardTopCardKey, string> = {
  needs_review: "No contracts are waiting for detail review.",
  upcoming_deadlines: "No renewal or notice dates fall inside the next 90 days.",
  blocked_work: "No tasks are held for a response, approval, file, or owner.",
  missing_owners: "Every active contract has an assigned owner.",
  open_exceptions: "No open contract problems need attention.",
  evidence_requested: "No evidence requests are currently awaiting review.",
};

// Object-class noun rendered inside each panel's count chip so a bare "6" reads
// as "6 tasks" (§19 count semantics). Plural form; the chip singularizes at 1.
export const SECTION_COUNT_NOUN: Record<DashboardSectionKey, string> = {
  review_queue: "details",
  upcoming_deadlines: "dates",
  work_needing_action: "tasks",
  data_gaps: "contracts",
  recent_activity: "changes",
};

export const SECTION_DESCRIPTION: Record<DashboardSectionKey, string> = {
  review_queue: "Suggested dates, owners, and terms awaiting confirmation before reminders and reports rely on them.",
  upcoming_deadlines: "Confirmed or calculated renewal, notice, end, or effective dates that may need action soon.",
  work_needing_action: "Tasks that need a response, decision, approval, file, or owner.",
  data_gaps: "Missing owners, dates, or counterparties that weaken routing and reports.",
  recent_activity: "Recent confirmed changes across contracts, tasks, evidence, and reports.",
};
