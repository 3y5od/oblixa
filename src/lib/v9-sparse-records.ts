/** Prefer explicit unknown copy over blank or misleading defaults for legacy rows. */
export function v9DisplayOrUnknown(value: string | null | undefined, emptyLabel = "Unknown"): string {
  const t = value?.trim();
  return t ? t : emptyLabel;
}
