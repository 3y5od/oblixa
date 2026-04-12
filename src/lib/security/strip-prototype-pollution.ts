/** Remove prototype-pollution keys from plain objects before merge/assign into app state. */
const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

export function stripPrototypePollutionKeys<T extends Record<string, unknown>>(obj: T): T {
  const next = { ...obj } as Record<string, unknown>;
  for (const k of FORBIDDEN) {
    delete next[k];
  }
  return next as T;
}
