/**
 * US-style weekend skipping for ownerless grace (v6.md §9.1 business days).
 * Does not observe holidays.
 */
export function addBusinessDays(start: Date, businessDays: number): Date {
  if (businessDays <= 0) return new Date(start.getTime());
  const d = new Date(start.getTime());
  let remaining = businessDays;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return d;
}

export function subtractBusinessDays(start: Date, businessDays: number): Date {
  if (businessDays <= 0) return new Date(start.getTime());
  const d = new Date(start.getTime());
  let remaining = businessDays;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() - 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return d;
}

/** Instant threshold: contracts with created_at before this and no owner exceed the grace window. */
export function ownerlessBusinessDaysCutoffIso(businessDays: number): string {
  return subtractBusinessDays(new Date(), businessDays).toISOString();
}
