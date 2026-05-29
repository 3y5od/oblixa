/**
 * Canonical `/contracts` list URL helpers for in-page filtering and CmdK "contracts"
 * search-class jumps — keep query encoding and search sanitization aligned (§9.3 + §16).
 */
export const CONTRACTS_SEARCH_MAX_LENGTH = 200;
const CONTRACTS_SEARCH_STRIP_RE = /[%_\\()"',.*]/g;
const CONTRACTS_SEARCH_CONTROL_RE = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\ufeff]/g;

export function normalizeContractsSearchQuery(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(CONTRACTS_SEARCH_CONTROL_RE, "")
    .replace(CONTRACTS_SEARCH_STRIP_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CONTRACTS_SEARCH_MAX_LENGTH);
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
