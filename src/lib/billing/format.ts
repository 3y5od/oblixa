// SPEC: docs/billing-page-refinement-pass.md §1.11 — locale-aware
// date formatting (replaces hardcoded "MMM d, yyyy" date-fns calls).

export function formatBillingDate(
  input: Date | number | string,
  locale?: string
): string {
  const date =
    typeof input === "number"
      ? new Date(input * 1000)
      : typeof input === "string"
        ? new Date(input)
        : input;
  try {
    return new Intl.DateTimeFormat(locale ?? undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

export function formatBillingDateRange(
  start: number,
  end: number,
  locale?: string
): string {
  try {
    return new Intl.DateTimeFormat(locale ?? undefined, {
      month: "short",
      day: "numeric",
    }).formatRange(new Date(start * 1000), new Date(end * 1000));
  } catch {
    return `${formatBillingDate(start, locale)} – ${formatBillingDate(end, locale)}`;
  }
}

// §9.6 — timezone disclosure
export function getTimeZoneShort(): string {
  try {
    const opts = new Intl.DateTimeFormat(undefined, {
      timeZoneName: "short",
    }).resolvedOptions();
    return opts.timeZone ?? "UTC";
  } catch {
    return "UTC";
  }
}
