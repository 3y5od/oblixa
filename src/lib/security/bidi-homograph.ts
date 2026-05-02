/**
 * Detect mixed-script / homograph patterns in user-visible strings (display names, hosts).
 * Conservative: flags Latin + Cyrillic/Greek in one identifier (common homograph phishing).
 */

const CYRILLIC = /\p{Script=Cyrillic}/u;
const GREEK = /\p{Script=Greek}/u;
const LATIN = /\p{Script=Latin}/u;

export function hasConfusableMixedScript(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  const hasLatin = LATIN.test(value);
  if (!hasLatin) return false;
  return CYRILLIC.test(value) || GREEK.test(value);
}

/** True when hostname uses punycode (IDN) — callers may combine with allowlists. */
export function isPunycodeInternationalizedDomain(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h.includes("xn--");
}
