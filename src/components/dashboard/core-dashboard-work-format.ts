import {
  AlertTriangle,
  BadgeCheck,
  Calendar,
  CalendarClock,
  ListChecks,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import type { SemanticStatus } from "@/components/ui/status-badge";
import { WORK_STATUS_LABELS, WORK_TYPE_LABELS } from "@/lib/work/spec-strings";
import type { CoreDashboardWorkRow } from "@/lib/dashboard/core-dashboard-model";

export function statusForWork(row: CoreDashboardWorkRow): SemanticStatus {
  if (row.status === "blocked" || row.status === "waiting") return "blocked";
  if (row.dueState === "overdue") return "overdue";
  if (row.status === "done") return "healthy";
  if (row.status === "in_progress") return "in_review";
  return "empty";
}

export function workStatusInk(status: SemanticStatus): string {
  if (status === "blocked" || status === "overdue" || status === "critical") return "var(--danger-ink)";
  if (status === "warning") return "var(--warning-ink)";
  if (status === "in_review") return "var(--accent-strong)";
  if (status === "healthy") return "var(--success-ink)";
  return "var(--text-secondary)";
}

function humanize(value: string | null | undefined, fallback: string): string {
  const raw = String(value || fallback).replace(/_/g, " ").trim();
  if (raw.length === 0) return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

export function workTypeLabel(type: string): string {
  return WORK_TYPE_LABELS[type as keyof typeof WORK_TYPE_LABELS] ?? humanize(type, "Task");
}

export function workStatusLabel(row: CoreDashboardWorkRow): string {
  if (row.status === "blocked" || row.status === "waiting") return "Cannot proceed";
  if (row.dueState === "overdue") return "Past due";
  // A status should name the condition without echoing the type label beside it
  // ("Approval · Needs approval" reads as a stutter), so approvals read "Needs
  // decision" (§18.5 status language — answer "what is needed?").
  const t = row.type.toLowerCase();
  if (row.status === "open") {
    if (t.includes("approval")) return "Needs decision";
    if (t.includes("evidence")) return "Needs evidence";
    if (t.includes("exception") || t.includes("issue") || t.includes("problem")) return "Needs resolution";
    if (t.includes("renewal") || t.includes("checkpoint")) return "Needs review";
    if (t.includes("obligation") || t.includes("requirement")) return "Needs response";
    return "To do";
  }
  if (row.status === "in_progress") {
    if (t.includes("approval")) return "Needs decision";
    return "In review";
  }
  return WORK_STATUS_LABELS[row.status as keyof typeof WORK_STATUS_LABELS] ?? humanize(row.status, "Open");
}

export function sanitizeWorkTitle(title: string): string {
  return title
    .replace(/\bextracted fields?\b/gi, "details")
    .replace(/\bextraction\b/gi, "details")
    .replace(/\s+\b(blockers?|blocked)\b\s*$/i, "")
    .replace(/\bexceptions?\b/gi, "problem")
    .replace(/\bblockers?\b/gi, "hold")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function workTypeIcon(type: string): LucideIcon {
  const t = type.toLowerCase();
  if (t.includes("approval")) return BadgeCheck;
  if (t.includes("obligation")) return Calendar;
  if (t.includes("exception") || t.includes("issue")) return AlertTriangle;
  if (t.includes("evidence")) return ShieldAlert;
  if (t.includes("renewal") || t.includes("checkpoint")) return CalendarClock;
  return ListChecks;
}

export function workHoverVerb(row: CoreDashboardWorkRow): string {
  // Every verb names its object so the hover affordance is unambiguous on its
  // own (§18.6). Urgency is already carried by the row's danger rail and the
  // "Cannot proceed" / "Past due" status badge, so the verb does not repeat it.
  const t = row.type.toLowerCase();
  if (t.includes("approval")) return "Approve";
  if (t.includes("evidence")) return "Review evidence";
  if (t.includes("exception") || t.includes("issue")) return "Resolve problem";
  if (t.includes("renewal") || t.includes("checkpoint")) return "Review renewal";
  if (t.includes("obligation") || t.includes("requirement")) return "Open requirement";
  return "Open task";
}
