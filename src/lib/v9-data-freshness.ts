import { formatDistanceToNow } from "date-fns";

/** User-visible freshness line for pipeline / reliability samples (V9 §27 / status-age). */
export function formatRelativeSampleAge(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Sample as of ${formatDistanceToNow(d, { addSuffix: true })}`;
}
