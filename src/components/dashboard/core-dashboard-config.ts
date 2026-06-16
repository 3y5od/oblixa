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
