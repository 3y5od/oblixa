/**
 * Detect SVG/CSS patterns that commonly enable SSRF or data exfil via external subresources.
 * Used before accepting user-controlled markup (uploads, rich text).
 */
const REMOTE_REF_RE =
  /\b(?:xlink:)?href\s*=\s*["']?\s*(?:https?:|\/\/)/i;
const CSS_IMPORT_RE = /@import\s+["']?(?:https?:|\/\/)/i;
const FE_IMAGE_RE = /<feImage[^>]+(?:xlink:)?href\s*=\s*["']?\s*(?:https?:|\/\/)/i;

export function svgOrCssTextHasRemoteSubresourceRefs(text: string): boolean {
  const s = text.slice(0, 2_000_000);
  return REMOTE_REF_RE.test(s) || CSS_IMPORT_RE.test(s) || FE_IMAGE_RE.test(s);
}
