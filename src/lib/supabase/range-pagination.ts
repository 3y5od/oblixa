import type { PostgrestError } from "@supabase/supabase-js";

export type SupabaseRangePage<T> = { data: T[] | null; error: PostgrestError | null };

const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_MAX_OFFSET_EXCLUSIVE = 1_000_000;
const DEFAULT_MAX_ROWS = 250_000;

/**
 * Invokes fetchPage with inclusive Supabase `.range(from, to)` windows until a short page or an error.
 * Use for aggregations where full materialization in memory is unnecessary.
 */
export async function forEachSupabaseRangePage<T>(
  fetchPage: (from: number, to: number) => PromiseLike<SupabaseRangePage<T>>,
  consume: (chunk: T[]) => void | Promise<void>,
  options?: { pageSize?: number; maxOffsetExclusive?: number }
): Promise<{ error: PostgrestError | null; stoppedByOffsetCap: boolean }> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxOffsetExclusive = options?.maxOffsetExclusive ?? DEFAULT_MAX_OFFSET_EXCLUSIVE;
  let from = 0;
  for (;;) {
    if (from >= maxOffsetExclusive) {
      return { error: null, stoppedByOffsetCap: true };
    }
    const to = from + pageSize - 1;
    const { data, error } = await Promise.resolve(fetchPage(from, to));
    if (error) return { error, stoppedByOffsetCap: false };
    const chunk = data ?? [];
    await consume(chunk);
    if (chunk.length < pageSize) {
      return { error: null, stoppedByOffsetCap: false };
    }
    from += pageSize;
  }
}

/**
 * Concatenates all rows from paged `.range` requests. Stops at maxRows (truncated=true) or end of data.
 */
export async function collectSupabaseRangePages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<SupabaseRangePage<T>>,
  options?: { pageSize?: number; maxRows?: number }
): Promise<{ rows: T[]; error: PostgrestError | null; truncated: boolean }> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS;
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await Promise.resolve(fetchPage(from, to));
    if (error) return { rows, error, truncated: false };
    const chunk = data ?? [];
    for (const row of chunk) {
      rows.push(row);
      if (rows.length >= maxRows) {
        return { rows, error: null, truncated: chunk.length === pageSize };
      }
    }
    if (chunk.length < pageSize) return { rows, error: null, truncated: false };
    from += pageSize;
  }
}
