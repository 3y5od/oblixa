/** Strip file headers we add so we measure real document text. */
export function meaningfulTextLength(combined: string): number {
  const withoutHeaders = combined.replace(/\n?--- [^\n]+ ---\n?/g, "\n");
  return withoutHeaders.replace(/\s+/g, " ").trim().length;
}

/** Below this, the PDF/DOCX likely has no usable text (e.g. scan-only PDF). */
export const MIN_MEANINGFUL_CHARS_FOR_EXTRACTION = 80;
