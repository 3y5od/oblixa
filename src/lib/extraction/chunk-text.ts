import {
  EXTRACTION_CHUNK_CHUNK_SIZE,
  EXTRACTION_CHUNK_OVERLAP,
  EXTRACTION_CHUNK_THRESHOLD_CHARS,
} from "@/lib/extraction/constants";

/**
 * Splits long contract text into overlapping windows for multi-pass extraction.
 * Short texts return a single chunk (no split).
 */
export function splitTextIntoExtractionChunks(preparedText: string): string[] {
  const t = preparedText;
  if (t.length <= EXTRACTION_CHUNK_THRESHOLD_CHARS) {
    return [t];
  }

  const size = EXTRACTION_CHUNK_CHUNK_SIZE;
  const overlap = Math.min(EXTRACTION_CHUNK_OVERLAP, size - 1);
  const chunks: string[] = [];
  let start = 0;
  while (start < t.length) {
    const end = Math.min(start + size, t.length);
    chunks.push(t.slice(start, end));
    if (end >= t.length) break;
    start = end - overlap;
  }
  return chunks;
}
