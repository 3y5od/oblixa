/**
 * Sanitize tenant- or user-controlled hrefs for rich text / markdown.
 * Blocks dangerous schemes; optional policy for secondary schemes (mailto, tel, sms, intent).
 */
const DANGEROUS_SCHEME = /^(javascript|data|vbscript|file)\s*:/i;

export type SecondarySchemePolicy = "allow" | "strip";

export function sanitizeExternalHref(
  raw: string,
  secondary: SecondarySchemePolicy = "allow"
): string | null {
  const t = String(raw).trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower.startsWith("#")) return t;
  if (DANGEROUS_SCHEME.test(lower)) return null;
  if (secondary === "strip") {
    if (/^(mailto|tel|sms|intent)\s*:/i.test(lower)) return null;
  }
  if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("/")) return t;
  if (secondary === "allow" && /^(mailto|tel|sms):/i.test(lower)) return t;
  if (secondary === "allow" && lower.startsWith("intent:")) return t;
  return null;
}

export function externalLinkRelAndReferrer(): { rel: string; referrerPolicy: "no-referrer" } {
  return { rel: "noopener noreferrer", referrerPolicy: "no-referrer" };
}
