/**
 * Client-side recent-items tracking, scoped per item kind (e.g. "contract").
 * Persisted in localStorage via the approved client-storage helper.
 * Capped at 5 entries by default; newest first.
 */

import {
  clearStoredRecentItems,
  readRecentItems,
  writeRecentItems,
  type StoredRecentItem,
} from "@/lib/security/client-storage";

export type RecentItem = StoredRecentItem;

const DEFAULT_LIMIT = 5;

export function getRecentItems(kind: string, limit = DEFAULT_LIMIT): RecentItem[] {
  return readRecentItems(kind, limit);
}

export function recordRecentItem(
  kind: string,
  entry: Omit<RecentItem, "visitedAt">,
  limit = DEFAULT_LIMIT
): void {
  const existing = readRecentItems(kind, 50);
  const filtered = existing.filter((e) => e.id !== entry.id);
  const next: RecentItem[] = [{ ...entry, visitedAt: Date.now() }, ...filtered].slice(0, limit);
  writeRecentItems(kind, next, limit);
}

export function clearRecentItems(kind: string): void {
  clearStoredRecentItems(kind);
}
