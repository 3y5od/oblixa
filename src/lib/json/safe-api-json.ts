/**
 * JSON.stringify for API payloads; coerces BigInt to decimal string (JSON has no bigint).
 */
export function stringifyApiJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v));
}
