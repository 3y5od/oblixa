/**
 * Normalize extracted document text before sending to the model (token efficiency, consistency).
 */
export function preprocessContractTextForExtraction(raw: string): string {
  let t = raw.replace(/\r\n/g, "\n");
  t = t.replace(/[ \t]+/g, " ");
  t = t.replace(/\n{4,}/g, "\n\n\n");
  return t.trim();
}

/**
 * Count Unicode letters and digits after stripping file-marker lines (--- name ---).
 * Used to detect scanned PDFs / empty parses.
 */
export function substantiveTextCharCount(text: string): number {
  const withoutMarkers = text.replace(/^---[^\n]*---\s*/gm, "");
  const matches = withoutMarkers.match(/[\p{L}\p{N}]/gu);
  return matches?.length ?? 0;
}
