import { format, formatDistanceToNowStrict } from "date-fns";

// SPEC: docs/security-page-v3-pass.md §1.1 — centralize date
// formatting across the security settings page. Three variants
// cover the rendered cases:
//   - "date"     → "May 17, 2026"        (calendar date only)
//   - "dateTime" → "May 22 · 9:20 PM"    (date + time)
//   - "monthYear" → "May 2026"           (compact)
//
// Per ui-design-principles §11.5 ISO timestamps anti-pattern + §10.16
// cross-page chrome parity. All dates render in user's browser
// timezone; UTC equivalent is exposed via `<time title="UTC: ..." />`
// at call sites that need forensic clarity (per V3 §1.27).

export type DateVariant = "date" | "dateTime" | "monthYear";

export function formatDate(
  value: Date | string | number | null | undefined,
  variant: DateVariant = "date"
): string {
  if (value == null) return "—";
  let d: Date;
  try {
    d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "—";
  } catch {
    return "—";
  }
  switch (variant) {
    case "dateTime":
      return format(d, "MMM d · h:mm a");
    case "monthYear":
      return format(d, "MMM yyyy");
    case "date":
    default:
      return format(d, "MMM d, yyyy");
  }
}

/**
 * V4 §1.2 / V4 user-report §3 — relative-time formatter for chip
 * contexts. Returns abbreviated but unambiguous units so caps-tier
 * rendering ("IN 3 HR" / "IN 39 MIN") stays readable; single-letter
 * abbreviations like "39M" in caps were ambiguous (mega-?).
 */
export function fmtRelative(
  value: Date | string | number | null | undefined
): string {
  if (value == null) return "—";
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "—";
    const distance = formatDistanceToNowStrict(d, { addSuffix: true });
    // formatDistanceToNowStrict returns e.g. "in 3 hours" / "5 minutes ago".
    // Compress to short unit while keeping word boundary unambiguous
    // when rendered in caps tier ("IN 3 HR", "IN 39 MIN").
    return distance
      .replace(/\s*hours?\b/, " hr")
      .replace(/\s*minutes?\b/, " min")
      .replace(/\s*seconds?\b/, " sec")
      .replace(/\s*days?\b/, " d")
      .replace(/\s*months?\b/, " mo")
      .replace(/\s*years?\b/, " yr")
      .trim();
  } catch {
    return "—";
  }
}

/**
 * V3 §1.27 — UTC equivalent for forensics. Used in `<time title>`.
 */
export function formatDateUTC(
  value: Date | string | number | null | undefined
): string {
  if (value == null) return "—";
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  } catch {
    return "—";
  }
}

/**
 * V3 §1.27 — `<time>`-element helper. Returns props to spread:
 *   <time {...timeAttrs(iso)}>{formatDate(iso, "dateTime")}</time>
 * Produces machine-readable dateTime + UTC hover for sighted users
 * + SR label fallback.
 */
export function timeAttrs(value: Date | string | number | null | undefined) {
  if (value == null) return {} as { dateTime?: string; title?: string };
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return {} as { dateTime?: string; title?: string };
    return {
      dateTime: d.toISOString(),
      title: `UTC: ${formatDateUTC(d)}`,
    };
  } catch {
    return {} as { dateTime?: string; title?: string };
  }
}
