/** Max manual + background extraction runs per contract (abuse / cost guard). */
export const MAX_EXTRACTION_ATTEMPTS = 8;

/**
 * If status stays "processing" longer than this (crash, timeout, deploy), a new run is allowed.
 * Keep in sync with typical serverless / upstream timeouts.
 */
export const EXTRACTION_PROCESSING_STALE_MS = 25 * 60 * 1000;

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
