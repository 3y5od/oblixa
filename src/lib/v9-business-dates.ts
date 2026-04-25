import { format } from "date-fns";

/** Shared “due soon” horizon in calendar days (V9 temporal contract). */
export const V9_DUE_SOON_DAYS = 14;

/**
 * Parse YYYY-MM-DD (or ISO date prefix) as a stable local noon instant to avoid TZ drift
 * on due/overdue comparisons.
 */
export function parseBusinessDateAtNoon(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const day = raw.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = new Date(`${day}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatBusinessDateAtNoon(raw: string | null | undefined, fallback = "—"): string {
  const parsed = parseBusinessDateAtNoon(raw);
  return parsed ? format(parsed, "MMM d, yyyy") : fallback;
}
