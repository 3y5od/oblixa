/**
 * Centralized date display helpers. Pass a `timeZone` (IANA name) from user profile
 * to render dates in the viewer's preferred zone; omit to use the runtime default.
 */

export interface FormatDateOptions {
  timeZone?: string;
  /** Locale tag — defaults to "en-US". */
  locale?: string;
}

const DEFAULT_LOCALE = "en-US";

function toDate(input: Date | string | number): Date | null {
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Short numeric date — "Mar 5, 2026". */
export function formatDate(input: Date | string | number, opts: FormatDateOptions = {}): string {
  const d = toDate(input);
  if (!d) return "—";
  return new Intl.DateTimeFormat(opts.locale ?? DEFAULT_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: opts.timeZone,
  }).format(d);
}

/** Date + time — "Mar 5, 2026, 2:14 PM". */
export function formatDateTime(input: Date | string | number, opts: FormatDateOptions = {}): string {
  const d = toDate(input);
  if (!d) return "—";
  return new Intl.DateTimeFormat(opts.locale ?? DEFAULT_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: opts.timeZone,
  }).format(d);
}

/** ISO date only — "2026-03-05" — in the viewer's timezone. */
export function formatISODate(input: Date | string | number, opts: FormatDateOptions = {}): string {
  const d = toDate(input);
  if (!d) return "—";
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: opts.timeZone,
  }).format(d);
  return parts;
}
