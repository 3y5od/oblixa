/**
 * Canonical `/contracts` list URL helpers for in-page filtering and CmdK "contracts"
 * search-class jumps — keep query encoding and search sanitization aligned (§9.3 + §16).
 */
const CONTRACTS_SEARCH_STRIP_RE = /[%_\\()"',.*]/g;

export function normalizeContractsSearchQuery(raw: string): string {
  return raw.replace(CONTRACTS_SEARCH_STRIP_RE, "").trim();
}

export function buildContractsListHref(
  params: Record<string, string | null | undefined>
): string {
  const search = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(params)) {
    if (typeof rawValue !== "string") continue;
    const value = key === "search" ? normalizeContractsSearchQuery(rawValue) : rawValue.trim();
    if (!value) continue;
    search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `/contracts?${qs}` : "/contracts";
}

export function buildContractsSearchListHref(query: string): string {
  return buildContractsListHref({ search: query });
}
