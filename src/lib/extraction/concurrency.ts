const DEFAULT_EXTRACTION_CHUNK_CONCURRENCY = 3;

/**
 * Max concurrent OpenAI chunk requests (long contracts).
 * Override with env `EXTRACTION_CHUNK_CONCURRENCY` (integer 1-8); invalid values use default.
 */
export function getExtractionChunkConcurrency(): number {
  const raw = process.env.EXTRACTION_CHUNK_CONCURRENCY?.trim();
  if (!raw) return DEFAULT_EXTRACTION_CHUNK_CONCURRENCY;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_EXTRACTION_CHUNK_CONCURRENCY;
  }
  return Math.min(8, Math.floor(n));
}

/**
 * Run async work over items with at most `concurrency` in flight (pool).
 * Preserves result order (index-aligned with `items`).
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) break;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}
