import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/search/page.tsx");
const VIEW = join(process.cwd(), "src/app/(dashboard)/search/search-view.tsx");
const LOADING = join(process.cwd(), "src/app/(dashboard)/search/loading.tsx");
const ERROR = join(process.cwd(), "src/app/(dashboard)/search/error.tsx");
const RESULT_ROW = join(process.cwd(), "src/components/search/result-row.tsx");
const SEARCH_FIELD = join(process.cwd(), "src/components/search/search-field.tsx");
const HELPERS = join(process.cwd(), "src/components/layout/command-palette-helpers.ts");
const NAV = join(process.cwd(), "src/lib/navigation.ts");

const pageSrc = readFileSync(PAGE, "utf8");
const viewSrc = readFileSync(VIEW, "utf8");
const loadingSrc = readFileSync(LOADING, "utf8");
const errorSrc = readFileSync(ERROR, "utf8");
const rowSrc = readFileSync(RESULT_ROW, "utf8");
const fieldSrc = readFileSync(SEARCH_FIELD, "utf8");
const helpersSrc = readFileSync(HELPERS, "utf8");
const navSrc = readFileSync(NAV, "utf8");

describe("Search page — auth + route metadata", () => {
  it("guards with getAuthContext + WorkspaceRequiredState", () => {
    expect(pageSrc).toContain("getAuthContext");
    expect(pageSrc).toContain("WorkspaceRequiredState");
  });

  it("exports force-dynamic + noindex robots metadata", () => {
    expect(pageSrc).toContain('export const dynamic = "force-dynamic"');
    expect(pageSrc).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it("metadata title is 'Search'", () => {
    expect(pageSrc).toMatch(/title:\s*"Search"/);
  });

  it("bounds q to 200 chars server-side", () => {
    expect(pageSrc).toMatch(/MAX_QUERY_LENGTH\s*=\s*200|slice\(0,\s*200\)/);
  });
});

describe("Search page — T10 workspace surface filtering parity", () => {
  it("computes navSurface server-side via loadProductSurfaceContext + toNavSurfaceInput", () => {
    expect(pageSrc).toContain("loadProductSurfaceContext");
    expect(pageSrc).toContain("toNavSurfaceInput");
  });

  it("passes navSurface prop to SearchView", () => {
    expect(pageSrc).toMatch(/navSurface=\{navSurface\}/);
  });

  it("client view filters items via isNavItemVisibleForSurface + isCmdkHrefAllowed", () => {
    expect(viewSrc).toContain("isNavItemVisibleForSurface");
    expect(viewSrc).toContain("isCmdkHrefAllowed");
  });

  it("client view filters recents via cmdkFilterRecentHrefsForSurface", () => {
    expect(viewSrc).toContain("cmdkFilterRecentHrefsForSurface");
  });
});

describe("Search page — T11 telemetry parity", () => {
  it("emits emitCmdkPaletteOpenedTelemetry on mount with source: 'page'", () => {
    expect(viewSrc).toContain("emitCmdkPaletteOpenedTelemetry");
    expect(viewSrc).toMatch(/source:\s*"page"/);
  });

  it("emits emitCmdkResultSelectedTelemetry on row select", () => {
    expect(viewSrc).toContain("emitCmdkResultSelectedTelemetry");
  });

  it("emits emitCmdkZeroResultsTelemetry on debounced zero-result", () => {
    expect(viewSrc).toContain("emitCmdkZeroResultsTelemetry");
  });
});

describe("Search page — T6.3+T6.4 shared primitives", () => {
  it("/search uses the shared ResultRow component", () => {
    expect(viewSrc).toContain('from "@/components/search/result-row"');
    expect(viewSrc).toContain("<ResultRow");
  });

  it("/search uses the shared SearchField component", () => {
    expect(viewSrc).toContain('from "@/components/search/search-field"');
    expect(viewSrc).toContain("<SearchField");
  });
});

describe("Search page — T12 input semantics & query robustness", () => {
  it("SearchField handles IME composition (compositionstart/end)", () => {
    expect(fieldSrc).toContain("isComposingRef");
    expect(fieldSrc).toContain("onCompositionStart");
    expect(fieldSrc).toContain("onCompositionEnd");
  });

  it("SearchField sanitizes paste (control/bidi/BOM regex)", () => {
    expect(fieldSrc).toContain("UNSAFE_TEXT_RE");
    expect(fieldSrc).toContain("onPaste");
  });

  it("SearchField sets inputMode='search', enterKeyHint, no autocorrect/autocapitalize", () => {
    expect(fieldSrc).toContain('inputMode="search"');
    expect(fieldSrc).toContain('enterKeyHint="search"');
    expect(fieldSrc).toContain('autoComplete="off"');
    expect(fieldSrc).toContain('autoCorrect="off"');
    expect(fieldSrc).toContain('autoCapitalize="off"');
    expect(fieldSrc).toMatch(/spellCheck=\{false\}/);
  });

  it("SearchField has maxLength=200 (T15.6 bounded query)", () => {
    expect(fieldSrc).toContain("MAX_QUERY_LENGTH");
    expect(fieldSrc).toMatch(/maxLength=\{MAX_QUERY_LENGTH\}/);
  });

  it("SearchField has no form action attribute (T15.8)", () => {
    expect(fieldSrc).not.toMatch(/<form[^>]+action=/);
  });
});

describe("Search page — T3 visual polish on ResultRow", () => {
  it("ResultRow renders a leading icon column at stable width", () => {
    expect(rowSrc).toContain("resolveNavIcon");
    expect(rowSrc).toMatch(/w-5 shrink-0/);
  });

  it("ResultRow has highlightMatches wrapping matched substrings in <mark>", () => {
    expect(rowSrc).toContain("highlightMatches");
    expect(rowSrc).toContain("<mark");
  });

  it("ResultRow has 44px min touch target", () => {
    expect(rowSrc).toContain("min-h-[44px]");
  });

  it("ResultRow respects prefers-reduced-motion via motion-safe variant", () => {
    expect(rowSrc).toContain("motion-safe:");
  });

  it("ResultRow resets visited link color (T0.12)", () => {
    expect(rowSrc).toContain("visited:text-[var(--text-primary)]");
  });

  it("ResultRow resets webkit tap highlight (T13.3)", () => {
    expect(rowSrc).toContain("-webkit-tap-highlight-color:transparent");
  });

  it("ResultRow uses prefetch=false + on-hover/focus warm-prefetch (T14.1)", () => {
    expect(rowSrc).toContain("prefetch={false}");
    expect(rowSrc).toContain("router.prefetch");
    expect(rowSrc).toContain("onMouseEnter");
    expect(rowSrc).toContain("onFocus");
  });

  it("ResultRow shows an Enter-key kbd on the active row only", () => {
    // The literal `⏎` glyph rendered as a shrunken dot in dense kbd badges
    // on macOS Safari. Switched to the lucide `CornerDownLeft` SVG so the
    // visual is render-stable across browsers + fonts.
    expect(rowSrc).toMatch(/isActive[\s\S]{0,1200}CornerDownLeft/);
    expect(rowSrc).toContain('aria-label="Press Enter to open"');
  });

  it("ResultRow uses semantic role='option' with aria-selected (T5.1)", () => {
    expect(rowSrc).toContain('role="option"');
    expect(rowSrc).toContain("aria-selected={isActive}");
  });
});

describe("Search page — T4 matcher + synonyms + recovery", () => {
  it("helpers expose matchScore with multi-word AND", () => {
    expect(helpersSrc).toContain("export function matchScore");
    expect(helpersSrc).toContain("tokenizeSearchQuery");
  });

  it("helpers expose scoreAndSortItems with recent-boost", () => {
    expect(helpersSrc).toContain("export function scoreAndSortItems");
    expect(helpersSrc).toContain("recentBoostHrefs");
  });

  it("helpers expose closestNameSuggestion for zero-results", () => {
    expect(helpersSrc).toContain("export function closestNameSuggestion");
  });

  it("helpers expose groupItemsBySearchGroup", () => {
    expect(helpersSrc).toContain("export function groupItemsBySearchGroup");
  });

  it("helpers use NFKD normalization + Damerau-Levenshtein", () => {
    expect(helpersSrc).toContain("normalize(\"NFKD\")");
    expect(helpersSrc).toContain("damerauLevenshtein");
  });

  it("helpers dedupe (preserves fragment/query — V2 T0.3) + exclude /search from index", () => {
    expect(helpersSrc).toMatch(/path !== "\/search"/);
    expect(helpersSrc).toContain("paletteDedupeKey");
    expect(helpersSrc).toContain("byKey.set(key, item)");
  });

  it("zero-results recovery offers contracts search + closest suggestion", () => {
    expect(viewSrc).toContain("Search contracts for");
    expect(viewSrc).toContain("Did you mean");
  });
});

describe("Search page — T7+T14 perf", () => {
  it("/search debounces typing via useDeferredValue", () => {
    expect(viewSrc).toContain("useDeferredValue");
  });

  it("/search memoizes matched/grouped results", () => {
    expect(viewSrc).toMatch(/useMemo[\s\S]{0,200}scoreAndSortItems/);
    expect(viewSrc).toMatch(/useMemo[\s\S]{0,200}groupItemsBySearchGroup/);
  });

  it("/search warm-prefetches top of each group on mount (T14.2)", () => {
    expect(viewSrc).toContain("router.prefetch");
  });
});

describe("Search page — T5 a11y", () => {
  it("/search renders a LiveRegion for result-count announcements (T5.2)", () => {
    expect(viewSrc).toContain("<LiveRegion");
  });

  it("/search wires combobox + listbox ARIA pattern (T5.1)", () => {
    expect(viewSrc).toContain('role="listbox"');
    expect(fieldSrc).toContain('role="combobox"');
    expect(fieldSrc).toContain("aria-controls");
    expect(fieldSrc).toContain("aria-activedescendant");
  });

  it("/search sets aria-busy during deferred filter (T15.5)", () => {
    expect(viewSrc).toMatch(/aria-busy=\{isStale \? "true" : "false"\}/);
  });

  it("skip-link present (T15.3)", () => {
    expect(pageSrc).toContain("Skip to search");
    expect(pageSrc).toMatch(/ui-skip-link/);
  });
});

describe("Search page — T15 route states", () => {
  it("loading.tsx has role=status + aria-busy + aria-live (T15.1)", () => {
    expect(loadingSrc).toContain('role="status"');
    expect(loadingSrc).toContain('aria-busy="true"');
    expect(loadingSrc).toContain('aria-live="polite"');
  });

  it("error.tsx has retry + open-palette + dashboard recovery (T15.2)", () => {
    expect(errorSrc).toContain("Try again");
    expect(errorSrc).toContain("Open command palette");
    expect(errorSrc).toContain("/dashboard");
    expect(errorSrc).toContain("COMMAND_PALETTE_OPEN_EVENT");
  });

  it("keyboard shortcut discoverability lives on the input via aria-keyshortcuts + a `/` hint", () => {
    // The trailing-tip ⌘K nudge was replaced by an input-level kbd hint
    // and aria-keyshortcuts attribute. Discoverability moved to where the
    // shortcut takes effect.
    expect(viewSrc).toContain("ariaKeyShortcuts");
    expect(viewSrc).toMatch(/kbdHint=\{\{ meta: "", key: "\/" \}\}/);
  });
});

describe("Search page — T2 voice + T8 anti-pattern compliance", () => {
  it("public Core search has no banned vocabulary on the page surface", () => {
    const banned = [
      "Portfolio",
      "Pulse",
      "Execution workspace",
      "Health graph",
      "Autopilot",
      "Assurance workflows",
      "Platform",
      "Transformation",
      "Intelligence",
    ];
    const surfaces = `${pageSrc}\n${viewSrc}\n${loadingSrc}\n${errorSrc}`;
    for (const word of banned) {
      expect(surfaces).not.toContain(word);
    }
  });

  it("group eyebrow taxonomy is the public placeholder set: Pages/Queues/Reports/Tools (T1.2)", () => {
    expect(navSrc).toMatch(/SEARCH_GROUP_LABELS[\s\S]{0,150}Pages[\s\S]{0,200}Queues[\s\S]{0,200}Reports[\s\S]{0,200}Tools/);
    expect(navSrc).toContain('"pages"');
    expect(navSrc).toContain('"queues"');
    expect(navSrc).toContain('"reports"');
    expect(navSrc).toContain('"tools"');
  });

  it("navChild descriptions are first-class fields (T0.2)", () => {
    expect(navSrc).toContain("description?: string");
    // helpers no longer inherit parent.description for children
    expect(helpersSrc).toContain("child.description ?? \"\"");
  });
});

describe("Search page — sensitive storage", () => {
  it("/search persists recents via client-storage helpers, not raw localStorage", () => {
    expect(viewSrc).toContain("readCommandPaletteRecentCommands");
    expect(viewSrc).toContain("writeCommandPaletteRecentCommands");
    expect(viewSrc).not.toMatch(/window\.localStorage\b/);
  });
});

// =====================================================================
// V2 pass surface pins
// =====================================================================

describe("Search V2 — T0 defects", () => {
  it("V2 T0.1 Settings landing row dropped when any /settings sub-route extra exists", () => {
    expect(helpersSrc).toContain("hasSettingsSubroute");
    expect(helpersSrc).toMatch(/item\.href !== "\/settings"/);
  });

  it("V2 T0.2 every CMDK_EXTRA has per-destination icon (no Compass fallback)", () => {
    const resolverSrc = readFileSync(
      join(process.cwd(), "src/lib/product-surface/resolver.ts"),
      "utf8"
    );
    // Each of the 7 settings-related extras + Imports + Contract inventory export has an icon.
    for (const icon of [
      '"profile"',
      '"workspace-identity"',
      '"team"',
      '"billing"',
      '"notifications"',
      '"security-account"',
      '"imports"',
      '"export"',
    ]) {
      expect(resolverSrc).toContain(`icon: ${icon}`);
    }
  });

  it("V2 T0.3 dedupe preserves fragment/query (paletteDedupeKey != paletteHrefKey)", () => {
    expect(helpersSrc).toContain("function paletteDedupeKey");
    // The dedupe map uses the full href (which includes fragment).
    const resolverSrc = readFileSync(
      join(process.cwd(), "src/lib/product-surface/resolver.ts"),
      "utf8"
    );
    expect(resolverSrc).toContain('href: "/reports#exports"');
  });

  it("loading skeleton mirrors the filter-chip row + single-card band shape", () => {
    expect(loadingSrc).toMatch(/flex flex-wrap items-center gap-1\.5/);
    // 4 filter chip slots (one per visible search group)
    expect(loadingSrc).toMatch(/length:\s*4/);
    // Single outer band card with `divide-y` separators
    expect(loadingSrc).toMatch(/divide-y/);
  });
});

describe("Search V2 — T1+T10 IA + URL state", () => {
  it("V2 T1.2 NavItem.searchSubgroup field exists + Tools extras tagged", () => {
    expect(navSrc).toContain('"account"');
    expect(navSrc).toContain('"workspace"');
    expect(navSrc).toContain('"operations"');
    const resolverSrc = readFileSync(
      join(process.cwd(), "src/lib/product-surface/resolver.ts"),
      "utf8"
    );
    expect(resolverSrc).toContain('searchSubgroup: "account"');
    expect(resolverSrc).toContain('searchSubgroup: "workspace"');
    expect(resolverSrc).toContain('searchSubgroup: "operations"');
  });

  it("no per-group truncation — all matched items render without 'Show N more'", () => {
    // The "Show N more" disclosure + per-group row cap were removed; every
    // group renders its matched items in full so the inventory is visible
    // at a glance.
    expect(viewSrc).not.toContain("MAX_RESULTS_PER_GROUP_BROWSE");
    expect(viewSrc).not.toContain("MAX_RESULTS_PER_GROUP_QUERY");
    expect(viewSrc).not.toMatch(/function rowCap/);
    expect(viewSrc).not.toContain("ShowMoreFooter");
    expect(viewSrc).not.toMatch(/Show \$\{remaining\} more/);
  });

  it("filter chip toolbar renders 4 group chips (no bare All chip; toggle clears)", () => {
    expect(viewSrc).toContain("FilterChips");
    expect(viewSrc).toMatch(/aria-label="Filter by group"/);
    expect(viewSrc).toMatch(/aria-pressed=/);
    // Clicking an active chip clears the filter (toggle pattern)
    expect(viewSrc).toMatch(/onChange\(isActive \? null : group\)/);
    // Numeric quick-keys are wired (1/2/3/4 per group, 0 clears)
    expect(viewSrc).toContain("CHIP_SHORTCUTS");
  });

  it("quick-pick band renders for truly empty state via ResultsCard", () => {
    expect(viewSrc).toContain("QUICK_PICK_HREFS");
    expect(viewSrc).toContain("quickPickItems");
    // Band header carries the "Quick pick" label
    expect(viewSrc).toContain('label="Quick pick"');
  });

  it("V2 T10.1 + T10.2 URL state for filter chip (?group=...)", () => {
    expect(viewSrc).toContain("buildSearchUrl");
    expect(viewSrc).toContain('params.set("group"');
    expect(pageSrc).toContain("parseFilterGroup");
    expect(pageSrc).toContain("initialFilterGroup");
  });

  it("group band header carries an h2 with stronger caps-tracking", () => {
    // Bumped from 0.16em → 0.18em so band headers visually outrank any
    // remaining inline labels and read clearly as parent eyebrows.
    expect(viewSrc).toMatch(/uppercase tracking-\[0\.18em\]/);
    expect(viewSrc).toMatch(/<h2 className="text-\[10\.5px\] font-semibold uppercase tracking/);
  });
});

describe("Search V2 — T11 state coherence", () => {
  it("V2 T11.1 activeIndex clamps when filteredMatched narrows", () => {
    expect(viewSrc).toMatch(/setActiveIndex\(\(idx\) => Math\.min\(idx,/);
  });

  it("V2 T11.2 activeIndex resets to 0 on query/filter change", () => {
    expect(viewSrc).toMatch(/setActiveIndex\(0\)/);
  });

  it("V2 T11.3 recents hide when filter chip is active", () => {
    expect(viewSrc).toContain("showRecents = !hasQuery && !filterGroup");
  });

  it("V2 T11.4 quick-pick hides when filter chip is active", () => {
    expect(viewSrc).toContain("showQuickPick = !hasQuery && !filterGroup");
  });

  it("no expandedGroups state — disclosure was removed, so no state to reset", () => {
    expect(viewSrc).not.toContain("expandedGroups");
    expect(viewSrc).not.toContain("setExpandedGroups");
  });
});

describe("Search V2 — T2 visual polish", () => {
  it("group count renders as tabular-nums tertiary text, not a saturated chip", () => {
    // Accent color reserved for action affordances; static counts use
    // tertiary text-color so they don't compete with the eyebrow.
    expect(viewSrc).toMatch(/tabular-nums text-\[var\(--text-tertiary\)\]/);
    // Count chip is conditionally rendered only when count > 1
    expect(viewSrc).toContain("showCount");
  });

  it("active row carries a 2.5px accent left-rail", () => {
    // Bumped from 2px → 2.5px so the rail has a touch more presence
    // without crowding the icon column. `pl-[13.5px]` compensates so the
    // icon stays at its original left edge.
    expect(rowSrc).toContain("border-l-[2.5px] border-[var(--accent)]");
    expect(rowSrc).toContain("pl-[13.5px]");
  });

  it("results render inside a single outer band card with hairline dividers", () => {
    // Single-card layout: one outer wrapper for all bands; rounded-2xl edge.
    expect(viewSrc).toMatch(/divide-y[\s\S]{0,200}overflow-hidden rounded-2xl/);
  });

  it("V2 T2.7 page variant input scaled up (min-h-13, text-16)", () => {
    expect(fieldSrc).toContain("min-h-13");
    expect(fieldSrc).toContain("text-[16px]");
  });

  it("result row description wraps (no truncate) and uses secondary text", () => {
    // Description span does not use the `truncate` utility — it can wrap on
    // narrow viewports so descriptive copy isn't lost mid-word.
    expect(rowSrc).toMatch(/leading-snug text-\[var\(--text-secondary\)\]/);
    expect(rowSrc).not.toMatch(/description[\s\S]{0,80}\btruncate\b/);
  });
});

describe("Search V2 — T3 per-destination icons", () => {
  it("V2 T3.1 icon token union extended with 7 new keys", () => {
    expect(navSrc).toContain('"profile"');
    expect(navSrc).toContain('"workspace-identity"');
    expect(navSrc).toContain('"team"');
    expect(navSrc).toContain('"imports"');
    expect(navSrc).toContain('"security-account"');
    expect(navSrc).toContain('"notifications"');
    expect(navSrc).toContain('"export"');
  });

  it("V2 T3.2 nav-icon.tsx maps new tokens to distinct lucide icons", () => {
    const navIconSrc = readFileSync(
      join(process.cwd(), "src/components/search/nav-icon.tsx"),
      "utf8"
    );
    expect(navIconSrc).toContain("UserRound");
    expect(navIconSrc).toContain("Building2");
    expect(navIconSrc).toContain("Users");
    expect(navIconSrc).toContain("Upload");
    expect(navIconSrc).toContain("ShieldCheck");
    expect(navIconSrc).toContain("Bell");
    expect(navIconSrc).toContain("Download");
  });
});

describe("Search V2 — T4 copy", () => {
  it("V2 T4.1 Notifications description ≤ 80 chars", () => {
    const resolverSrc = readFileSync(
      join(process.cwd(), "src/lib/product-surface/resolver.ts"),
      "utf8"
    );
    const match = resolverSrc.match(/name:\s*"Notifications"[\s\S]{0,400}?description:\s*"([^"]+)"/);
    expect(match).toBeTruthy();
    if (match) {
      expect(match[1].length).toBeLessThanOrEqual(80);
    }
  });

  it("page header is rendered inline: compact medallion + h1, no DashboardPageHeader", () => {
    // /search is input-first, so the page no longer uses the canonical
    // DashboardPageHeader (which exists for medium-density data pages).
    // Header renders directly so it can stay small without forking the
    // shared component.
    expect(pageSrc).not.toContain("DashboardPageHeader");
    expect(pageSrc).toContain('<h1 className="text-[1.625rem]');
    expect(pageSrc).toMatch(/h-8 w-8/);
    // Page constrained to max-w-2xl so the input feels like a search input
    // rather than a page-spanning span.
    expect(pageSrc).toContain("max-w-2xl");
    // Metadata description still carries the SEO string
    expect(pageSrc).toContain('"Find anything in the workspace."');
  });

  it("shortcut discoverability lives on the input, not a separate hint strip", () => {
    // The dedicated KeyboardHintStrip was removed; the input itself carries
    // `aria-keyshortcuts` and a compact `/` kbd hint that swaps to `Esc`
    // once the user types — keeping the discoverability without the
    // standalone row of glyphs above the result card.
    expect(viewSrc).not.toContain("KeyboardHintStrip");
    expect(viewSrc).toContain("ariaKeyShortcuts");
    expect(viewSrc).toMatch(/kbdHint=\{\{ meta: "", key: "\/" \}\}/);
  });
});

describe("Search V2 — T5 keyboard nav", () => {
  it("V2 T5.1 + T5.2 ↑↓ wrap-around in window keydown handler", () => {
    expect(viewSrc).toContain('event.key === "ArrowDown"');
    expect(viewSrc).toContain('event.key === "ArrowUp"');
    // wrap-around: when at last row, ↓ goes to 0
    expect(viewSrc).toMatch(/next >= filteredMatched\.length \? 0/);
  });

  it("V2 T5.3 active row scrolls into view", () => {
    expect(viewSrc).toContain("scrollIntoView");
    expect(viewSrc).toContain("prefers-reduced-motion");
  });

  it("V2 T5.4 matchOriginToken helper + synonym chip render", () => {
    expect(helpersSrc).toContain("export function matchOriginToken");
    expect(rowSrc).toContain("matchOriginToken");
    expect(rowSrc).toMatch(/aria-label=\{`matched via synonym/);
  });

  it("V2 T5.5 ESC clears query", () => {
    expect(fieldSrc).toContain('event.key === "Escape"');
    expect(fieldSrc).toContain("onClear");
  });

  it("V2 T5.8 Cmd+Enter opens in new tab", () => {
    expect(fieldSrc).toContain("onSubmitNewTab");
    expect(viewSrc).toContain('window.open(active.href, "_blank"');
  });
});

describe("Search V2 — T12 edge cases", () => {
  it("V2 T12.1 fully-restricted surface renders FullyRestrictedState", () => {
    expect(viewSrc).toContain("FullyRestrictedState");
    expect(viewSrc).toContain("isFullyRestricted");
  });

  it("zero-in-filter renders ZeroInFilter with clear-filter recovery button", () => {
    expect(viewSrc).toContain("ZeroInFilter");
    // Recovery button label
    expect(viewSrc).toContain("Clear filter");
    expect(viewSrc).toContain("onClearFilter");
  });

  it("groups render their full matched set (no row cap, no truncation footer)", () => {
    // Each band lists `items.map(...)`, not `items.slice(0, cap).map(...)`.
    expect(viewSrc).not.toMatch(/items\.slice\(0/);
    expect(viewSrc).not.toContain("ShowMoreFooter");
  });
});

describe("Search V2 — T8 a11y refinements", () => {
  it("V2 T8.1 group count carries aria-label '<group>, N results'", () => {
    expect(viewSrc).toMatch(/aria-label=\{`\$\{count\} result/);
  });

  it("V2 T8.5 filter chips are <button aria-pressed>", () => {
    expect(viewSrc).toMatch(/<button[\s\S]{0,400}aria-pressed=\{isActive\}/);
  });

  it("V2 T8.7 synonym chip aria-label for SR", () => {
    expect(rowSrc).toMatch(/aria-label=\{`matched via synonym \$\{synonymHit\.token\}/);
  });

  it("V2 T8.8 skip-link target has scroll-margin-top accommodation", () => {
    expect(pageSrc).toContain('id="search-input"');
    expect(pageSrc).toMatch(/scroll-mt-\d+/);
  });
});

describe("Search — empty state + responsive", () => {
  it("browse-mode flow: quick-pick + recents conditionally shown", () => {
    expect(viewSrc).toContain("showQuickPick");
    expect(viewSrc).toContain("showRecents");
    // Both hide when a filter chip is active (state coherence)
    expect(viewSrc).toMatch(/showQuickPick = !hasQuery && !filterGroup/);
    expect(viewSrc).toMatch(/showRecents = !hasQuery && !filterGroup/);
  });
});

describe("Search — refinement pass (defects + voice + new affordances)", () => {
  it("Review fields icon resolves to ClipboardCheck (no Compass fallback)", () => {
    expect(navSrc).toContain('"review-fields"');
    expect(navSrc).toContain('icon: "review-fields"');
    const navIconSrc = readFileSync(
      join(process.cwd(), "src/components/search/nav-icon.tsx"),
      "utf8"
    );
    expect(navIconSrc).toContain("ClipboardCheck");
    expect(navIconSrc).toContain('"review-fields": ClipboardCheck');
  });

  it("navChildren can declare an icon override; allCommandItems propagates it", () => {
    expect(navSrc).toMatch(/icon\?:\s*NonNullable<NavItem\["icon"\]>/);
    expect(helpersSrc).toMatch(/icon:\s*child\.icon/);
  });

  it("voice rule: banned 'portfolio' vocabulary removed from Contracts copy", () => {
    // The Contracts entry's user-facing description anchors to renewal /
    // notice dates rather than the older "portfolio context" wording.
    const contractsBlock = navSrc.match(
      /name:\s*"Contracts"[\s\S]{0,300}?description:\s*"([^"]+)"/
    );
    expect(contractsBlock).toBeTruthy();
    if (contractsBlock) {
      expect(contractsBlock[1].toLowerCase()).not.toContain("portfolio");
      expect(contractsBlock[1]).toContain("renewal and notice dates");
    }
  });

  it("every CMDK_EXTRA description is ≤80 chars (design-principles §10.7)", () => {
    const resolverSrc = readFileSync(
      join(process.cwd(), "src/lib/product-surface/resolver.ts"),
      "utf8"
    );
    const descriptions = [...resolverSrc.matchAll(/description:\s*"([^"]+)"/g)].map(
      (m) => m[1]
    );
    expect(descriptions.length).toBeGreaterThan(5);
    for (const d of descriptions) {
      expect(d.length).toBeLessThanOrEqual(80);
    }
  });

  it("voice audit: 'Portfolio' wording purged from all user-facing strings", () => {
    // "Portfolio" is unambiguous spreadsheet-replacement-mode language for
    // Oblixa's launch wedge. Other terms in the voice spec (Autopilot,
    // Assurance, Programs, etc.) are scoped by surface mode — they remain
    // permissible when gated behind a flag (e.g., `v6Autopilot`). The
    // universal ban applies to "Portfolio" since the launch positions
    // against manual contract tracking, not portfolio management.
    const resolverSrc = readFileSync(
      join(process.cwd(), "src/lib/product-surface/resolver.ts"),
      "utf8"
    );
    const userFacingStrings = [
      ...navSrc.matchAll(/description:\s*"([^"]+)"/g),
      ...resolverSrc.matchAll(/description:\s*"([^"]+)"/g),
      ...navSrc.matchAll(/name:\s*"([^"]+)"/g),
      ...resolverSrc.matchAll(/name:\s*"([^"]+)"/g),
    ].map((m) => m[1]);
    for (const s of userFacingStrings) {
      expect(s.toLowerCase()).not.toContain("portfolio");
    }
  });

  it("page header is inline: 32px medallion + 1.625rem h1, no DashboardPageHeader import", () => {
    expect(pageSrc).not.toContain("DashboardPageHeader");
    expect(pageSrc).toContain("h-8 w-8");
    expect(pageSrc).toContain('<h1 className="text-[1.625rem]');
    // Tighter page max-width gives the input a more focused-search feel.
    expect(pageSrc).toContain("max-w-2xl");
  });

  it("Recent pill is text-tertiary (no saturated accent fill) and yields to active state", () => {
    // The accent-soft pill bg made the Recent badge compete with the row's
    // own active-state cues. Marker now reads as quiet metadata: tertiary
    // text + tracked caps + an accent dot.
    expect(rowSrc).toMatch(/uppercase tracking-\[0\.12em\] text-\[var\(--text-tertiary\)\]/);
    expect(viewSrc).toMatch(/!isActive\s*&&\s*foldedRecentHref/);
  });

  it("filter chips constrain to min-w-[5rem] so the row reads as a segmented control", () => {
    expect(viewSrc).toContain("min-w-[5rem]");
    expect(viewSrc).toContain("active:scale-[0.97]");
  });

  it("results card carries an elevation shadow and stronger hairline dividers", () => {
    expect(viewSrc).toContain("shadow-[var(--shadow-1)]");
    expect(viewSrc).toMatch(/border-subtle\)_70%,transparent\)/);
  });

  it("band header bg unified to surface-raised (no zebra banding) with h2 70% primary", () => {
    expect(viewSrc).toMatch(/bg-\[var\(--surface-raised\)\] px-4 py-2/);
    expect(viewSrc).toMatch(/text-\[color:color-mix\(in_oklab,var\(--text-primary\)_70%,transparent\)\]/);
  });

  it("page summary line removed (per-band counts are sufficient)", () => {
    expect(viewSrc).not.toContain("showBrowseCount");
    expect(viewSrc).not.toContain("browseGroupCount");
    expect(viewSrc).not.toMatch(/destinations? across/);
  });

  it("search-field clear-X button + reserves right padding for the kbd hint", () => {
    expect(fieldSrc).toContain('aria-label="Clear search"');
    expect(fieldSrc).toContain("h-3.5 w-3.5");
    expect(fieldSrc).toMatch(/pr-16/);
  });

  it("filter chips drop the visible kbd digit (count/shortcut ambiguity)", () => {
    // The old chip shape `<span>Pages</span><kbd>1</kbd>` looked like a
    // count chip and confused users. The shortcut still works via the
    // page-level keydown handler; aria-keyshortcuts on each chip carries
    // the binding for SR users.
    expect(viewSrc).not.toMatch(/<kbd[\s\S]{0,200}\{CHIP_SHORTCUTS\[group\]\}/);
    expect(viewSrc).toMatch(/aria-keyshortcuts=\{CHIP_SHORTCUTS\[group\]\}/);
  });

  it("active row's Enter kbd uses the lucide CornerDownLeft SVG (render-stable)", () => {
    expect(rowSrc).toContain("CornerDownLeft");
    expect(rowSrc).not.toMatch(/<kbd[\s\S]{0,80}⏎/);
  });

  it("single-recent fold: foldedRecentHref marks the row in-group instead of a 1-row band", () => {
    expect(viewSrc).toContain("foldedRecentHref");
    expect(viewSrc).toMatch(/recentItems\.length === 1/);
    expect(viewSrc).toMatch(/recentsForBand =/);
    expect(rowSrc).toContain("isRecent");
  });

  it("tools band drops subgroup labels; ordering preserved by Account → Workspace → Operations", () => {
    // Three stacked caps-tracking labels (band + subgroup) created visual
    // noise without scan payoff. Subgroup ordering is preserved by sorting
    // items via subgroupRank; the labels themselves are gone.
    expect(viewSrc).toContain("subgroupRank");
    expect(viewSrc).not.toMatch(/subgroupLabels/);
  });

  it('"Workspace" cmd-K entry renamed to "Workspace identity" to avoid subgroup-label collision', () => {
    const resolverSrc = readFileSync(
      join(process.cwd(), "src/lib/product-surface/resolver.ts"),
      "utf8"
    );
    expect(resolverSrc).toContain('name: "Workspace identity"');
  });

  it('"Contract inventory export" cmd-K entry trimmed to "Inventory export"', () => {
    const resolverSrc = readFileSync(
      join(process.cwd(), "src/lib/product-surface/resolver.ts"),
      "utf8"
    );
    expect(resolverSrc).toContain('name: "Inventory export"');
    expect(resolverSrc).not.toContain("Contract inventory export");
  });

  it("slash key focuses the search input from anywhere on the page", () => {
    expect(viewSrc).toMatch(/event\.key === "\/"/);
    expect(viewSrc).toMatch(/fieldRef\.current\?\.focus\(\)/);
  });

  it("filter chip click-clear: clicking an active chip clears the filter", () => {
    expect(viewSrc).toMatch(/onChange\(isActive \? null : group\)/);
  });

  it("filter chip numeric quick-keys map 1/2/3/4 → group; 0 clears", () => {
    expect(viewSrc).toMatch(/CHIP_SHORTCUTS:\s*Record<SearchGroup, string>/);
    expect(viewSrc).toMatch(/pages:\s*"1"/);
    expect(viewSrc).toMatch(/event\.key === "0"/);
  });

  it("click on the search icon focuses + selects the input", () => {
    expect(fieldSrc).toMatch(/Focus search input/);
    expect(fieldSrc).toMatch(/inputRef\.current\?\.select\(\)/);
  });

  it("trailing arrow hides on inactive rows (opacity-0 + group-hover/focus reveal)", () => {
    expect(rowSrc).toMatch(/opacity-0[\s\S]{0,100}group-hover:opacity-100/);
  });

  it("in-group rows pass hideMeta to drop the redundant group label", () => {
    // The band header already labels the group; repeating it on every row
    // creates pure redundancy.
    expect(viewSrc).toMatch(/hidePath[\s\S]{0,40}hideMeta/);
    expect(rowSrc).toContain("hideMeta");
  });

  it("group band uses h2 with stronger caps-tracking (0.18em)", () => {
    expect(viewSrc).toMatch(/<h2 className="text-\[10\.5px\] font-semibold uppercase tracking-\[0\.18em\]/);
  });

  it("subgroup labels are dropped entirely from the Tools band", () => {
    // Replaced visible subgroup labels with order-preserving sort. Three
    // stacked caps-tracking levels (band + subgroup + row) added noise
    // without scan payoff at this inventory size.
    expect(viewSrc).not.toMatch(/subgroupLabels/);
    expect(viewSrc).not.toMatch(/text-\[10px\][\s\S]{0,80}uppercase tracking-\[0\.14em\][\s\S]{0,80}text-\[var\(--text-tertiary\)\]/);
  });

  it("Recent band header drops the Clock icon (uniform group eyebrow treatment)", () => {
    // Recent is now just another band; no special leading icon.
    expect(viewSrc).not.toMatch(/Clock\s+className=/);
  });

  it("single-card layout: outer card wraps all bands with divide-y hairlines", () => {
    expect(viewSrc).toMatch(/divide-y[\s\S]{0,200}overflow-hidden rounded-2xl border/);
  });

  it("no per-group truncation: no 'Show more' / 'Show less' / expand state", () => {
    expect(viewSrc).not.toMatch(/Show \d+ more|Show \$\{remaining\} more|Show less/);
    expect(viewSrc).not.toContain("isExpanded");
    expect(viewSrc).not.toContain("onShowMore");
  });
});
