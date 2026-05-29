/** Max manual + background extraction runs per contract (abuse / cost guard). */
export const MAX_EXTRACTION_ATTEMPTS = 8;

/**
 * If status stays "processing" longer than this (crash, timeout, deploy), a new run is allowed.
 * Used for UI "may be stuck" messaging (amber banner).
 */
export const EXTRACTION_PROCESSING_STALE_MS = 30 * 60 * 1000;

/**
 * While a run is younger than this, another extract returns 409 and the button stays disabled.
 * After this, a new run is allowed even if the row still says "processing" (orphaned job).
 * Should exceed worst-case pipeline time (large PDF + OpenAI + multi-chunk) but unblock stuck states.
 * Route `maxDuration` is 300s; this window allows several retries and host variance.
 */
export const EXTRACTION_PROCESSING_BLOCKING_MS = 15 * 60 * 1000;

/** Full-text search column cap (matches single-pass extraction window). */
export const EXTRACTION_SEARCH_DOCUMENT_CAP = 120_000;

/**
 * When preprocessed text exceeds this, split into overlapping chunks for extraction (see chunk-text.ts).
 */
export const EXTRACTION_CHUNK_THRESHOLD_CHARS = 120_000;

/** Chunk size for long contracts (must stay under model input limits with prompt overhead). */
export const EXTRACTION_CHUNK_CHUNK_SIZE = 48_000;

/** Overlap between consecutive chunks so fields spanning boundaries are not lost. */
export const EXTRACTION_CHUNK_OVERLAP = 2_000;
export const EXTRACTION_MAX_TEXT_CHARS = 720_000;
export const EXTRACTION_MAX_CHUNKS = 16;
export const OPENAI_EXTRACTION_MAX_RETRY_ATTEMPTS = 4;
export const OPENAI_PDF_OCR_MAX_RETRY_ATTEMPTS = 3;
export const OPENAI_EXTRACTION_ATTEMPT_TIMEOUT_MS = 30_000;
export const OPENAI_PDF_OCR_ATTEMPT_TIMEOUT_MS = 30_000;
export const EXTRACTION_MODEL_OUTPUT_MAX_CHARS = 20_000;

/** True when a processing job is old enough to treat as abandoned and allow retry. */
export function isExtractionProcessingStale(
  startedAt: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!startedAt) return false;
  const t = Date.parse(startedAt);
  if (Number.isNaN(t)) return false;
  return nowMs - t > EXTRACTION_PROCESSING_STALE_MS;
}

/** True while we should block concurrent extraction (matches server 409 window). */
export function isExtractionActivelyBlocking(
  startedAt: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!startedAt) return false;
  const t = Date.parse(startedAt);
  if (Number.isNaN(t)) return false;
  return nowMs - t < EXTRACTION_PROCESSING_BLOCKING_MS;
}
