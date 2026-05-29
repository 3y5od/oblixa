/**
 * Canonical caps verb vocabulary for structured dashboard surfaces.
 *
 * Use these constants instead of inline prose verbs so the visible vocabulary
 * stays small and consistent. Add new verbs here rather than scattering them.
 */

export const CAPS_VERBS = {
  extracted: "EXTRACTED",
  approved: "APPROVED",
  rejected: "REJECTED",
  edited: "EDITED",
  uploaded: "UPLOADED",
  created: "CREATED",
  deleted: "DELETED",
  completed: "COMPLETED",
  assigned: "ASSIGNED",
  signed: "SIGNED",
  reviewed: "REVIEWED",
  received: "RECEIVED",
  exported: "EXPORTED",
  changed: "CHANGED",
  triage: "TRIAGE",
  open: "OPEN",
  pending: "PENDING",
  blocked: "BLOCKED",
  healthy: "HEALTHY",
  idle: "IDLE",
  active: "ACTIVE",
  renewal: "RENEWAL",
  notice: "NOTICE",
  expires: "EXPIRES",
  overdue: "OVERDUE",
  draft: "DRAFT",
  done: "DONE",
  next: "NEXT",
  stale: "STALE",
  new: "NEW",
  error: "ERROR",
  paused: "PAUSED",
  locked: "LOCKED",
  unassigned: "UNASSIGNED",
} as const;

export type CapsVerb = (typeof CAPS_VERBS)[keyof typeof CAPS_VERBS];

/**
 * Format a date as a compact caps-tracking time chip value.
 * `4D`, `2H`, `30M`, `JUST NOW`, or `MAY 9` depending on age.
 */
export function formatRelativeCompact(input: Date | string | null | undefined): string {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const absMs = Math.abs(diffMs);
  const minutes = Math.round(absMs / 60000);
  if (minutes < 1) return "NOW";
  if (minutes < 60) return `${minutes}M`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}H`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}D`;
  // Older than 2 weeks — fall back to compact MMM D
  const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
  return `${month} ${d.getDate()}`;
}

/**
 * Format a date as a readable lowercase relative time.
 * `just now`, `16 min`, `2 hr`, `4 d`, `May 9`. Use when there's space and
 * `formatRelativeCompact`'s caps-tracking abbreviations would be cryptic.
 */
export function formatRelativeReadable(input: Date | string | null | undefined): string {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const absMs = Math.abs(diffMs);
  const minutes = Math.round(absMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} d`;
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${month} ${d.getDate()}`;
}

/**
 * Format a date as a caps-tracking absolute calendar chip.
 * `MAY 9` / `JAN 1` / `MAR 4 · 2025`.
 */
export function formatCalendarCompact(input: Date | string | null | undefined): string {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(d.getTime())) return "—";
  const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const dayOfMonth = d.getDate();
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return sameYear ? `${month} ${dayOfMonth}` : `${month} ${dayOfMonth} · ${d.getFullYear()}`;
}
