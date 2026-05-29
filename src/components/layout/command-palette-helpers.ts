import type { FeatureFlagKey } from "@/lib/feature-flags";
import {
  NAV_ITEMS,
  SEARCH_GROUP_LABELS,
  WORKFLOW_AREA_LABELS,
  getWorkflowAreaForNavItem,
  resolveSearchGroupForNavItem,
  type NavItem,
  type SearchGroup,
  type WorkspaceRole,
} from "@/lib/navigation";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { CMDK_EXTRA_NAV_ITEMS } from "@/lib/product-surface/resolver";
import { normalizeContractsSearchQuery } from "@/lib/contracts-search-url";

export type PaletteItem = NavItem & { resultMeta?: string; resultOrder?: number };
export type ContractPaletteResult = {
  id: string;
  title: string;
  counterparty?: string | null;
  status?: string | null;
  ownerLabel?: string | null;
  href?: string | null;
  resultType?: string | null;
  description?: string | null;
  actionLabel?: string | null;
};
export type CommandPaletteRecoveryAction = {
  label: string;
  href: string;
  reason?: string | null;
};
export type CommandPaletteRecovery = {
  message: string;
  diagnosticId?: string | null;
  actions: CommandPaletteRecoveryAction[];
};

export function fallbackNavSurface(role: WorkspaceRole, flags: Record<FeatureFlagKey, boolean>): NavSurfaceInput {
  return {
    mode: "core",
    role,
    featureFlags: flags,
    seesAdvancedPrimaryNav: false,
    seesAssuranceNav: false,
    advancedModulesHidden: [],
    assuranceModulesHidden: [],
    utilityModulesHidden: [],
    searchScope: "match_mode",
  };
}

/** Dedupe key that preserves fragment + query so destinations like
 *  `/reports` and `/reports#exports` count as distinct rows. The earlier
 *  query-strip behavior caused the inventory export entry to be silently
 *  dropped by the bare `Reports` entry; preserving the fragment keeps both
 *  destinations addressable. */
function paletteDedupeKey(href: string): string {
  return href;
}

/** Build the search index from NAV_ITEMS + navChildren + CMDK_EXTRA_NAV_ITEMS.
 *  Children carry their own descriptions (no parent inheritance).
 *  Deduped by full href so `/reports` and `/reports#exports` surface
 *  separately. `/search` is excluded from its own index. The bare
 *  `/settings` row is dropped whenever any cmd-K extra points to a
 *  sub-route or fragment of `/settings`, so users see the specific
 *  sub-page rather than the redundant landing. */
export function allCommandItems(): PaletteItem[] {
  const flattened: PaletteItem[] = [
    ...NAV_ITEMS,
    ...NAV_ITEMS.flatMap((parent) =>
      (parent.navChildren ?? [])
        .filter((child) => child.href !== parent.href)
        .map(
          (child): PaletteItem => ({
            name: child.name,
            href: child.href,
            description: child.description ?? "",
            section: parent.section,
            v5FlagsAnyOf: child.v5FlagsAnyOf,
            badgeKey: child.badgeKey,
            searchGroup: child.searchGroup ?? parent.searchGroup,
            searchSynonyms: child.searchSynonyms ?? parent.searchSynonyms,
            // Children get their own icon when set; otherwise the search row
            // would inherit the parent's icon and lose visual distinction.
            // No icon means the Compass fallback in `resolveNavIcon`.
            icon: child.icon,
          })
        )
    ),
    ...CMDK_EXTRA_NAV_ITEMS,
  ];

  // V1 T0.13 — exclude /search from its own search index.
  const withoutSelf = flattened.filter((item) => {
    const path = paletteHrefKey(item.href);
    return path !== "/search";
  });

  // V2 T0.1 — when any extra entry targets a `/settings` sub-route or
  // fragment, suppress the bare `/settings` landing row. The sub-pages
  // cover every destination; the landing is redundant.
  const hasSettingsSubroute = withoutSelf.some((item) => {
    const path = item.href;
    return /^\/settings[/#]/.test(path);
  });
  const withoutSettingsLanding = hasSettingsSubroute
    ? withoutSelf.filter((item) => item.href !== "/settings")
    : withoutSelf;

  // Dedupe by full href (preserves fragment + query) — V2 T0.3.
  // Prefer entries with explicit resultMeta when collisions occur.
  const byKey = new Map<string, PaletteItem>();
  for (const item of withoutSettingsLanding) {
    const key = paletteDedupeKey(item.href);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }
    const incomingHasMeta = Boolean(item.resultMeta);
    const existingHasMeta = Boolean(existing.resultMeta);
    if (incomingHasMeta && !existingHasMeta) byKey.set(key, item);
  }
  return [...byKey.values()];
}

export function paletteHrefKey(href: string): string {
  return href.split("?")[0] ?? href;
}

/** T0.5 — meta label format. Sentence-case "Group · /path" using the public
 *  search-group taxonomy. Custom resultMeta overrides win when present (T2.5
 *  pre-normalized at the source). */
export function resultMetaLabel(item: PaletteItem): string {
  if (item.resultMeta) return item.resultMeta;
  const groupLabel = SEARCH_GROUP_LABELS[resolveSearchGroupForNavItem(item)];
  const path = item.href.split("?")[0] ?? item.href;
  return `${groupLabel} · ${path}`;
}

/** Legacy export — kept for backwards compatibility with any caller that still
 *  reasons about the internal workflow-area taxonomy. New callers should use
 *  `resolveSearchGroupForNavItem` from `@/lib/navigation`. */
export function workflowAreaMetaLabel(item: PaletteItem): string {
  if (item.resultMeta) return item.resultMeta;
  const area = WORKFLOW_AREA_LABELS[getWorkflowAreaForNavItem(item)];
  const path = item.href.split("?")[0] ?? item.href;
  return `${area} · ${path}`;
}

function isCmdkContractsListSearchJumpHref(href: string): boolean {
  const path = href.split("?")[0] ?? "";
  return path === "/contracts" && href.includes("search=");
}

/** Legacy boolean matcher kept for the contracts-list jump (which has its own
 *  normalized-query logic) and for any older callers. New callers should use
 *  `matchScore` for ranked results. */
export function cmdkJumpMatchesPaletteQuery(item: PaletteItem, q: string): boolean {
  if (isCmdkContractsListSearchJumpHref(item.href)) {
    if (/z{3,}/i.test(q) && !/\b(contract|search)\b/i.test(q)) return false;
    const n = normalizeContractsSearchQuery(q.trim());
    const nameBase = item.name.replace(/^Search contracts:\s*.+$/i, "Search contracts");
    const desc = item.description.replace(/prefiltered for "[^"]*"/, "prefiltered");
    const haystack = `${nameBase} ${desc} ${item.resultMeta ?? ""} ${n} ${item.href.split("?")[0] ?? ""}`.toLowerCase();
    return haystack.includes(q);
  }
  return matchScore(item, q) !== null;
}

// =====================================================================
// T4 — scored matcher with multi-word AND, fuzzy, synonyms
// =====================================================================

/** Normalize text for matching: NFKD decompose + strip combining marks +
 *  lowercase. Lets queries like "renewals" match "Renewals" + accent-free
 *  comparisons in non-Latin scripts. */
function normalizeForMatch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase();
}

/** Split a query into non-empty tokens. Whitespace-only queries yield []. */
export function tokenizeSearchQuery(q: string): string[] {
  return q.trim().split(/\s+/).filter(Boolean).map(normalizeForMatch);
}

/** Haystack composition: name + description + path + synonyms, normalized. */
function buildHaystack(item: PaletteItem): {
  name: string;
  description: string;
  path: string;
  synonyms: string;
  combined: string;
} {
  const name = normalizeForMatch(item.name);
  const description = normalizeForMatch(item.description ?? "");
  const path = normalizeForMatch(item.href.split("?")[0] ?? item.href);
  const synonyms = (item.searchSynonyms ?? []).map(normalizeForMatch).join(" ");
  return { name, description, path, synonyms, combined: `${name} ${description} ${path} ${synonyms}` };
}

/** Damerau-Levenshtein distance, bounded to `max` for early exit. */
function damerauLevenshtein(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
      rowMin = Math.min(rowMin, dp[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return dp[m][n];
}

/** Token score on a single haystack. Returns null if the token doesn't match
 *  any of the matching strategies (exact, prefix, word-boundary, substring,
 *  fuzzy ≤ 1 transposition for tokens ≥ 4 chars). Lower is better. */
function scoreToken(token: string, hay: ReturnType<typeof buildHaystack>): number | null {
  if (!token) return null;
  // Exact name match — best
  if (hay.name === token) return 0;
  // Name prefix
  if (hay.name.startsWith(token)) return 10;
  // Word-boundary in name (whole word or word-start)
  const wordBoundary = new RegExp(`(^|[\\s/-])${escapeRegExp(token)}`);
  if (wordBoundary.test(hay.name)) return 20;
  // Substring in name
  if (hay.name.includes(token)) return 30;
  // Substring in description
  if (hay.description.includes(token)) return 40;
  // Substring in path
  if (hay.path.includes(token)) return 45;
  // Synonym hit
  if (hay.synonyms.includes(token)) return 50;
  // Fuzzy — only for tokens long enough that a typo distinction is plausible
  if (token.length >= 4) {
    const words = hay.name.split(/[\s/-]+/).filter(Boolean);
    for (const word of words) {
      if (damerauLevenshtein(token, word, 1) <= 1) return 60;
    }
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Compute a match score for an item against a query. Returns null when the
 *  item doesn't match (any token misses). Lower scores rank higher.
 *  Multi-word AND: every token must match somewhere; total score is the sum
 *  of per-token best scores. */
export function matchScore(item: PaletteItem, q: string): number | null {
  const tokens = tokenizeSearchQuery(q);
  if (tokens.length === 0) return 0; // empty query matches all (caller handles order)
  const hay = buildHaystack(item);
  let total = 0;
  for (const token of tokens) {
    const score = scoreToken(token, hay);
    if (score === null) return null;
    total += score;
  }
  return total;
}

/** Sort items by match score, then by declared NAV_ITEMS order (stable). */
export function scoreAndSortItems(
  items: readonly PaletteItem[],
  q: string,
  recentBoostHrefs?: ReadonlySet<string>
): PaletteItem[] {
  const scored: { item: PaletteItem; score: number; idx: number }[] = [];
  items.forEach((item, idx) => {
    const score = matchScore(item, q);
    if (score === null) return;
    // T4.3 — recent destination boost. Subtract 5 from score for recent items
    // so a tie between a never-visited and a recently-visited destination
    // surfaces the recent one first.
    const adjusted = recentBoostHrefs?.has(paletteHrefKey(item.href)) ? score - 5 : score;
    scored.push({ item, score: adjusted, idx });
  });
  scored.sort((a, b) => a.score - b.score || a.idx - b.idx);
  return scored.map((entry) => entry.item);
}

/** Group items by their resolved SearchGroup. Returns a Map preserving the
 *  insertion order of `SEARCH_GROUP_ORDER`. */
export function groupItemsBySearchGroup(items: readonly PaletteItem[]): Map<SearchGroup, PaletteItem[]> {
  const groups = new Map<SearchGroup, PaletteItem[]>();
  for (const item of items) {
    const group = resolveSearchGroupForNavItem(item);
    const list = groups.get(group) ?? [];
    list.push(item);
    groups.set(group, list);
  }
  return groups;
}

/** V2 T5.4 — origin of a match. When the user's query hits an item ONLY via
 *  its `searchSynonyms` (not name / description / path), return the synonym
 *  token that landed the hit. UI surfaces this as a small "via 'renew'" chip
 *  so users learn the vocabulary. Returns null when the query matches
 *  name/description/path directly or doesn't match at all. */
export function matchOriginToken(
  item: PaletteItem,
  q: string
): { token: string; via: "synonym" } | null {
  const tokens = tokenizeSearchQuery(q);
  if (tokens.length === 0) return null;
  const synonyms = (item.searchSynonyms ?? []).map((s) => s.toLowerCase());
  if (synonyms.length === 0) return null;
  const name = item.name.toLowerCase();
  const description = (item.description ?? "").toLowerCase();
  const path = (item.href.split("?")[0] ?? "").toLowerCase();
  for (const token of tokens) {
    if (name.includes(token) || description.includes(token) || path.includes(token)) {
      continue;
    }
    const synHit = synonyms.find((s) => s.includes(token));
    if (synHit) return { token: synHit, via: "synonym" };
  }
  return null;
}

/** Closest single-word suggestion for a zero-results query — used to render
 *  "Did you mean: …" affordance (T4.5). */
export function closestNameSuggestion(items: readonly PaletteItem[], q: string): PaletteItem | null {
  const tokens = tokenizeSearchQuery(q);
  if (tokens.length === 0) return null;
  const probe = tokens.join(" ");
  let best: { item: PaletteItem; distance: number } | null = null;
  for (const item of items) {
    const name = normalizeForMatch(item.name);
    const distance = damerauLevenshtein(probe, name, 3);
    if (distance > 3) continue;
    if (!best || distance < best.distance) {
      best = { item, distance };
    }
  }
  return best ? best.item : null;
}
