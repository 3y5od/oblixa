/**
 * Serialize JSON-LD for embedding in <script type="application/ld+json">.
 * Escapes `<` so a string cannot emit a literal </script> sequence that closes the tag.
 */
export function serializeJsonLdForInlineScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
