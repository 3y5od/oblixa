/**
 * Deterministic tie-breakers so equal-priority rows do not reshuffle across refreshes (V9).
 */
export function compareUuidAsc(aId: string, bId: string): number {
  return aId.localeCompare(bId);
}

export function compareNullableStringAsc(a: string | null, b: string | null): number {
  const as = a ?? "";
  const bs = b ?? "";
  if (as !== bs) return as.localeCompare(bs);
  return 0;
}
