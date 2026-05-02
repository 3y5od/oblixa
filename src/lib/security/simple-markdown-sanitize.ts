/**
 * Minimal HTML/script injection strip for untrusted markdown previews (not a full sanitizer).
 */
export function stripDangerousHtmlTags(input: string): string {
  return input.replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "").replace(/<\s*iframe\b[^>]*>/gi, "");
}
