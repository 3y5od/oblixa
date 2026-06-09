"use client";

import {
  createElement,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Copy, FilterX, Lock, SearchX, X } from "lucide-react";
import {
  SEARCH_GROUP_LABELS,
  SEARCH_GROUP_ORDER,
  resolveSearchGroupForNavItem,
  type SearchGroup,
  type WorkspaceRole,
} from "@/lib/navigation";
import {
  allCommandItems,
  closestNameSuggestion,
  groupItemsBySearchGroup,
  paletteHrefKey,
  scoreAndSortItems,
  type PaletteItem,
} from "@/components/layout/command-palette-helpers";
import {
  cmdkFilterRecentHrefsForSurface,
  isCmdkHrefAllowed,
} from "@/lib/product-surface/resolver";
import {
  isNavItemVisibleForSurface,
  type NavSurfaceInput,
} from "@/lib/product-surface/nav-visibility";
import {
  readCommandPaletteRecentCommands,
  writeCommandPaletteRecentCommands,
} from "@/lib/security/client-storage";
import { LiveRegion } from "@/components/ui/live-region";
import { ResultRow, resolveRowActionVerb } from "@/components/search/result-row";
import { resolveNavIcon } from "@/components/search/nav-icon";
import { SearchField, type SearchFieldHandle } from "@/components/search/search-field";
import {
  emitCmdkPaletteOpenedTelemetry,
  emitCmdkResultSelectedTelemetry,
  emitCmdkZeroResultsTelemetry,
} from "@/actions/product-telemetry";

const MAX_RECENTS = 6;
const QUICK_PICK_HREFS: readonly string[] = ["/dashboard", "/work", "/reports", "/settings#profile"];

function buildSearchUrl(q: string, filter: SearchGroup | null): string {
  const params = new URLSearchParams();
  const trimmed = q.trim();
  if (trimmed) params.set("q", trimmed.slice(0, 120));
  if (filter) params.set("group", filter);
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

export function SearchView({
  role,
  navSurface,
  initialQuery,
  initialFilterGroup,
}: {
  role: WorkspaceRole;
  navSurface: NavSurfaceInput;
  initialQuery: string;
  initialFilterGroup: SearchGroup | null;
}) {
  // role shapes the Billing action verb (VIEW vs MANAGE) in rows and the rail.
  const router = useRouter();
  const fieldRef = useRef<SearchFieldHandle | null>(null);

  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const [filterGroup, setFilterGroup] = useState<SearchGroup | null>(initialFilterGroup);
  const [recents, setRecents] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [announcement, setAnnouncement] = useState<string | undefined>();
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastZeroQueryRef = useRef<string>("");
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());

  const listId = useId();

  // Client surface filter.
  const visibleItems = useMemo(() => {
    const all = allCommandItems();
    return all.filter(
      (item) =>
        isNavItemVisibleForSurface(item, navSurface) &&
        isCmdkHrefAllowed(item.href, navSurface)
    );
  }, [navSurface]);

  useEffect(() => {
    const stored = readCommandPaletteRecentCommands();
    const filtered = cmdkFilterRecentHrefsForSurface(stored, navSurface).slice(0, MAX_RECENTS);
    setRecents(filtered);
  }, [navSurface]);

  // Telemetry: page-open mount.
  useEffect(() => {
    void emitCmdkPaletteOpenedTelemetry({ source: "page" }).catch(() => undefined);
  }, []);

  // URL sync: ?q= + ?group=. RAF-debounced replaceState; back/forward
  // does not get polluted with intermediate keystrokes.
  useEffect(() => {
    const target = buildSearchUrl(deferredQuery, filterGroup);
    const handle = window.requestAnimationFrame(() => {
      window.history.replaceState(null, "", target);
    });
    return () => window.cancelAnimationFrame(handle);
  }, [deferredQuery, filterGroup]);

  const recentsSet = useMemo(() => new Set(recents), [recents]);
  const hasQuery = deferredQuery.trim().length > 0;

  const matched = useMemo(
    () => scoreAndSortItems(visibleItems, deferredQuery, recentsSet),
    [visibleItems, deferredQuery, recentsSet]
  );

  // Filter chip scopes results post-match.
  const filteredMatched = useMemo(() => {
    if (!filterGroup) return matched;
    return matched.filter((item) => {
      const g = item.searchGroup ?? "pages";
      return g === filterGroup;
    });
  }, [matched, filterGroup]);

  const grouped = useMemo(
    () => groupItemsBySearchGroup(filteredMatched),
    [filteredMatched]
  );

  // Per-group counts come from the *unfiltered* match set so every chip can
  // show how many results it holds even while another chip is active.
  const countsByGroup = useMemo(() => {
    const byGroup = groupItemsBySearchGroup(matched);
    const out = new Map<SearchGroup, number>();
    for (const group of SEARCH_GROUP_ORDER) out.set(group, byGroup.get(group)?.length ?? 0);
    return out;
  }, [matched]);

  const totalResults = filteredMatched.length;

  // activeIndex reset on query/filter change + clamp on length shrink.
  useEffect(() => {
    setActiveIndex(0);
  }, [deferredQuery, filterGroup]);
  useEffect(() => {
    setActiveIndex((idx) => Math.min(idx, Math.max(0, filteredMatched.length - 1)));
  }, [filteredMatched.length]);

  // Zero-results telemetry (debounced; query length ≥ 2).
  useEffect(() => {
    if (!hasQuery) return;
    if (totalResults > 0) return;
    const q = deferredQuery.trim();
    if (q.length < 2) return;
    if (lastZeroQueryRef.current === q) return;
    lastZeroQueryRef.current = q;
    void emitCmdkZeroResultsTelemetry({ q, source: "page" }).catch(() => undefined);
  }, [hasQuery, totalResults, deferredQuery]);

  // Live-region announcement.
  useEffect(() => {
    if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    if (!hasQuery && !filterGroup) {
      setAnnouncement(undefined);
      return;
    }
    const scopeNote = filterGroup ? ` in ${SEARCH_GROUP_LABELS[filterGroup]}` : "";
    announceTimerRef.current = setTimeout(() => {
      setAnnouncement(
        `${totalResults} result${totalResults === 1 ? "" : "s"}${scopeNote}${hasQuery ? ` for ${deferredQuery.trim()}` : ""}`
      );
    }, 600);
    return () => {
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    };
  }, [deferredQuery, totalResults, hasQuery, filterGroup]);

  // Warm-prefetch top of each visible group on mount/surface change.
  useEffect(() => {
    const topPerGroup: string[] = [];
    for (const group of SEARCH_GROUP_ORDER) {
      const first = grouped.get(group)?.[0]?.href;
      if (first) topPerGroup.push(first);
      if (topPerGroup.length >= 4) break;
    }
    for (const href of topPerGroup) {
      try {
        router.prefetch(href);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleItems, router]);

  // Recents resolved to PaletteItems.
  const recentItems = useMemo(() => {
    const byHref = new Map(visibleItems.map((i) => [paletteHrefKey(i.href), i]));
    return recents
      .map((href) => byHref.get(href))
      .filter((item): item is PaletteItem => Boolean(item));
  }, [recents, visibleItems]);

  // Quick-pick (top-of-each-group) for truly empty state.
  const quickPickItems = useMemo<PaletteItem[]>(() => {
    const byHref = new Map(visibleItems.map((i) => [paletteHrefKey(i.href), i]));
    return QUICK_PICK_HREFS.map((href) => byHref.get(href)).filter(
      (item): item is PaletteItem => Boolean(item)
    );
  }, [visibleItems]);

  const recordVisit = useCallback(
    (href: string) => {
      const key = paletteHrefKey(href);
      const next = [key, ...recents.filter((h) => h !== key)].slice(0, MAX_RECENTS);
      setRecents(next);
      writeCommandPaletteRecentCommands(next);
    },
    [recents]
  );

  const handleSelect = useCallback(
    (href: string) => {
      recordVisit(href);
      void emitCmdkResultSelectedTelemetry({
        href,
        queryLen: deferredQuery.length,
        source: "page",
      }).catch(() => undefined);
    },
    [deferredQuery.length, recordVisit]
  );

  // Submit reads the active row (not just top of list).
  const handleSubmit = useCallback(
    (value: string) => {
      const active = filteredMatched[activeIndex] ?? filteredMatched[0];
      if (!active) return;
      recordVisit(active.href);
      void emitCmdkResultSelectedTelemetry({
        href: active.href,
        queryLen: value.length,
        source: "page",
      }).catch(() => undefined);
      router.push(active.href);
    },
    [filteredMatched, activeIndex, recordVisit, router]
  );

  // Cmd/Ctrl+Enter opens in a new tab.
  const handleSubmitNewTab = useCallback(() => {
    const active = filteredMatched[activeIndex] ?? filteredMatched[0];
    if (!active) return;
    recordVisit(active.href);
    window.open(active.href, "_blank", "noopener,noreferrer");
  }, [filteredMatched, activeIndex, recordVisit]);

  // Page-level keyboard nav (↑/↓, slash to focus).
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        const isInput =
          tag === "INPUT" || tag === "TEXTAREA" || event.target.isContentEditable;
        // Slash key focuses the search input from anywhere on the page
        // (skip when already inside an editable element).
        if (event.key === "/" && !isInput && !event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          fieldRef.current?.focus();
          fieldRef.current?.select();
          return;
        }
        // ↑↓ only when input or page focused — not when navigating overlays.
        if (!isInput && event.target.closest("[role=combobox]") === null) return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((idx) => {
          const next = idx + 1;
          return next >= filteredMatched.length ? 0 : next;
        });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((idx) => {
          if (idx <= 0) return Math.max(0, filteredMatched.length - 1);
          return idx - 1;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filteredMatched.length]);

  // Scroll active row into view on activeIndex change.
  useEffect(() => {
    const id = `search-row-${activeIndex}`;
    const node = rowRefs.current.get(id);
    if (!node) return;
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }, [activeIndex]);

  const closestSuggestion = useMemo(
    () => (hasQuery && totalResults === 0 ? closestNameSuggestion(visibleItems, deferredQuery) : null),
    [hasQuery, totalResults, visibleItems, deferredQuery]
  );

  const showRecents = !hasQuery && !filterGroup && recentItems.length > 0;
  const showQuickPick = !hasQuery && !filterGroup && recentItems.length === 0 && quickPickItems.length > 0;
  const isStale = query !== deferredQuery;
  const visibleGroupsForFilter = filterGroup ? [filterGroup] : SEARCH_GROUP_ORDER;

  const isFullyRestricted = visibleItems.length === 0;
  const activeRowId = `search-row-${activeIndex}`;

  if (isFullyRestricted) {
    return <FullyRestrictedState />;
  }

  // Single-recent fold: when the user has just one recent destination, the
  // separate "Recent" band is excessive chrome for one row. Surface the
  // recency as a `● Recent` dot on the row inside its native group instead.
  const foldedRecentHref =
    showRecents && recentItems.length === 1 ? paletteHrefKey(recentItems[0]!.href) : null;
  const recentsForBand = showRecents && recentItems.length >= 2 ? recentItems : null;
  // Active row drives the desktop detail rail.
  const activeItem = filteredMatched[activeIndex] ?? null;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-6">
      <div className="space-y-4">
      <SearchField
        ref={fieldRef}
        variant="page"
        isCombobox
        ariaControls={listId}
        value={query}
        onChange={setQuery}
        onSubmit={handleSubmit}
        onSubmitNewTab={handleSubmitNewTab}
        onClear={() => setQuery("")}
        placeholder="Type to filter destinations…"
        // Compact trailing-edge kbd hint: shows `/` (focus shortcut) when
        // the field is empty, swaps to `Esc` (clear shortcut) automatically
        // once the user has typed something.
        kbdHint={{ meta: "", key: "/" }}
        ariaLabel="Search workspace"
        ariaKeyShortcuts="ArrowUp ArrowDown Enter Meta+Enter Escape /"
        autoFocusDeferred={!initialQuery}
        testId="search-page-input"
      />

      <FilterChips
        active={filterGroup}
        counts={countsByGroup}
        showCounts={hasQuery}
        onChange={(group) => setFilterGroup(group)}
      />

      <LiveRegion message={announcement} politeness="polite" />

      {hasQuery && totalResults === 0 ? (
        <ZeroResults
          query={deferredQuery}
          suggestion={closestSuggestion}
          onSuggestionSelect={handleSelect}
          recents={recentItems}
          rowRefs={rowRefs}
          activeRowId={activeRowId}
        />
      ) : filterGroup && totalResults === 0 ? (
        <ZeroInFilter group={filterGroup} onClearFilter={() => setFilterGroup(null)} />
      ) : (
        <ResultsCard
          listId={listId}
          grouped={grouped}
          query={deferredQuery}
          isStale={isStale}
          onSelect={handleSelect}
          onActivate={setActiveIndex}
          visibleGroups={visibleGroupsForFilter}
          rowRefs={rowRefs}
          activeRowId={activeRowId}
          matchedFlat={filteredMatched}
          recents={recentsForBand}
          quickPick={showQuickPick ? quickPickItems : null}
          foldedRecentHref={foldedRecentHref}
          role={role}
        />
      )}
      </div>
      <SearchDetailRail item={activeItem} role={role} onSelect={handleSelect} />
    </div>
  );
}

// =====================================================================
// Sub-components
// =====================================================================

const CHIP_SHORTCUTS: Record<SearchGroup, string> = {
  pages: "1",
  queues: "2",
  reports: "3",
  tools: "4",
};

function FilterChips({
  active,
  counts,
  showCounts,
  onChange,
}: {
  active: SearchGroup | null;
  counts: Map<SearchGroup, number>;
  showCounts: boolean;
  onChange: (group: SearchGroup | null) => void;
}) {
  // Numeric quick-keys jump to each chip; pressing the active chip's key
  // clears the filter (toggle).
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || event.target.isContentEditable) return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      for (const group of SEARCH_GROUP_ORDER) {
        if (event.key === CHIP_SHORTCUTS[group]) {
          event.preventDefault();
          onChange(active === group ? null : group);
          return;
        }
      }
      if (event.key === "0") {
        event.preventDefault();
        onChange(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, onChange]);

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="toolbar"
      aria-label="Filter by group"
    >
      {SEARCH_GROUP_ORDER.map((group) => {
        const isActive = active === group;
        // No visible numeric badge — the digit is purely a keyboard
        // shortcut, not a count. Showing it on the chip created a
        // count/shortcut ambiguity (chip "Pages 1" read as "1 result").
        // The shortcut stays wired via the page-level keydown handler;
        // discoverability comes from `aria-keyshortcuts` on the input.
        return (
          <button
            key={group}
            type="button"
            aria-pressed={isActive}
            aria-keyshortcuts={CHIP_SHORTCUTS[group]}
            onClick={() => onChange(isActive ? null : group)}
            className={`inline-flex min-h-[32px] min-w-[5rem] items-center justify-center rounded-full border px-3.5 py-1 text-[12.5px] font-semibold transition-[background-color,border-color,transform] motion-safe:active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_45%,transparent)] ${
              isActive
                ? "border-[color:color-mix(in_oklab,var(--accent)_35%,transparent)] bg-[color:color-mix(in_oklab,var(--accent-soft)_55%,var(--surface))] text-[var(--accent-strong)]"
                : "border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            {SEARCH_GROUP_LABELS[group]}
            {showCounts ? (
              <span
                className={`ml-1.5 tabular-nums text-[11px] font-medium ${
                  isActive
                    ? "text-[color:color-mix(in_oklab,var(--accent-strong)_75%,transparent)]"
                    : "text-[var(--text-tertiary)]"
                }`}
              >
                <span className="sr-only">
                  {counts.get(group) ?? 0} result{(counts.get(group) ?? 0) === 1 ? "" : "s"}
                </span>
                <span aria-hidden>{counts.get(group) ?? 0}</span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function GroupBandHeader({
  label,
  count,
  showCount,
}: {
  label: string;
  count: number;
  showCount: boolean;
}) {
  return (
    <header className="flex items-baseline justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] px-4 py-2">
      <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[color:color-mix(in_oklab,var(--text-primary)_70%,transparent)]">
        {label}
      </h2>
      {showCount ? (
        <span className="text-[11px] font-medium tabular-nums text-[var(--text-tertiary)]">
          <span className="sr-only">{count} result{count === 1 ? "" : "s"}</span>
          <span aria-hidden>{count}</span>
        </span>
      ) : null}
    </header>
  );
}

function ResultsCard({
  listId,
  grouped,
  query,
  isStale,
  onSelect,
  onActivate,
  visibleGroups,
  rowRefs,
  activeRowId,
  matchedFlat,
  recents,
  quickPick,
  foldedRecentHref,
  role,
}: {
  listId: string;
  grouped: Map<SearchGroup, PaletteItem[]>;
  query: string;
  isStale: boolean;
  onSelect: (href: string) => void;
  /** Promote a flat-index row to active on hover/focus so the detail rail
   *  tracks the pointer, not just keyboard navigation. */
  onActivate: (index: number) => void;
  visibleGroups: readonly SearchGroup[];
  rowRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  activeRowId: string;
  matchedFlat: PaletteItem[];
  recents: PaletteItem[] | null;
  quickPick: PaletteItem[] | null;
  /** When set, a single-recent row inside its native group renders with a
   *  `Recent` dot/pill marker — and the separate Recent band is skipped to
   *  avoid one-row-band chrome. */
  foldedRecentHref: string | null;
  role: WorkspaceRole;
}) {
  const groupsWithItems = visibleGroups.filter(
    (group) => (grouped.get(group)?.length ?? 0) > 0
  );

  const hasAnyBand = (recents?.length ?? 0) > 0 || (quickPick?.length ?? 0) > 0 || groupsWithItems.length > 0;

  if (!hasAnyBand) {
    return (
      <p className="text-[13px] text-[var(--text-secondary)]">
        Type to search, or pick a destination below.
      </p>
    );
  }

  // Flat-index lookup so each row's id maps back to the matchedFlat index
  // tracked by activeIndex.
  const flatIndexByHref = new Map<string, number>();
  matchedFlat.forEach((item, idx) => {
    flatIndexByHref.set(item.href, idx);
  });

  // Single outer card so the page reads as one cohesive surface rather than
  // a stack of detached panels. Hairline dividers separate the bands.
  return (
    <section
      id={listId}
      aria-label="Search results"
      aria-busy={isStale ? "true" : "false"}
      className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-[var(--shadow-1)]"
    >
      {recents && recents.length > 0 ? (
        <BandSection label="Recent" count={recents.length} showCount={recents.length > 1}>
          <BandList
            items={recents}
            rowIdPrefix="search-recent"
            onSelect={onSelect}
            rowRefs={rowRefs}
            activeRowId={activeRowId}
          />
        </BandSection>
      ) : null}

      {quickPick && quickPick.length > 0 ? (
        <BandSection label="Quick pick" count={quickPick.length} showCount={false}>
          <BandList
            items={quickPick}
            rowIdPrefix="search-quick"
            onSelect={onSelect}
            rowRefs={rowRefs}
            activeRowId={activeRowId}
          />
        </BandSection>
      ) : null}

      {groupsWithItems.map((group) => {
        const items = grouped.get(group) ?? [];
        const showCount = items.length > 1;

        if (group === "tools") {
          return (
            <ToolsBand
              key={group}
              items={items}
              onSelect={onSelect}
              onActivate={onActivate}
              rowRefs={rowRefs}
              activeRowId={activeRowId}
              flatIndexByHref={flatIndexByHref}
              query={query}
              count={items.length}
              showCount={showCount}
              foldedRecentHref={foldedRecentHref}
              role={role}
            />
          );
        }

        return (
          <BandSection
            key={group}
            label={SEARCH_GROUP_LABELS[group]}
            count={items.length}
            showCount={showCount}
          >
            <ul>
              {items.map((item) => {
                const flatIdx = flatIndexByHref.get(item.href) ?? -1;
                const id = `search-row-${flatIdx}`;
                const isActive = id === activeRowId;
                // Suppress the Recent marker on the keyboard-active row so
                // the rail + Enter kbd carry the focal state alone; the
                // Recent pill returns the moment the user navigates away.
                const isRecent =
                  !isActive &&
                  foldedRecentHref !== null &&
                  paletteHrefKey(item.href) === foldedRecentHref;
                return (
                  <li key={item.href}>
                    <ResultRow
                      item={item}
                      query={query}
                      onSelect={onSelect}
                      onActivate={flatIdx >= 0 ? () => onActivate(flatIdx) : undefined}
                      rowId={id}
                      hidePath
                      hideMeta
                      refMap={rowRefs}
                      isActive={isActive}
                      isRecent={isRecent}
                    />
                  </li>
                );
              })}
            </ul>
          </BandSection>
        );
      })}
    </section>
  );
}

function BandSection({
  label,
  count,
  showCount,
  children,
}: {
  label: string;
  count: number;
  showCount: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={label}>
      <GroupBandHeader label={label} count={count} showCount={showCount} />
      {children}
    </section>
  );
}

function BandList({
  items,
  rowIdPrefix,
  onSelect,
  rowRefs,
  activeRowId,
}: {
  items: PaletteItem[];
  rowIdPrefix: string;
  onSelect: (href: string) => void;
  rowRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  activeRowId: string;
}) {
  return (
    <ul>
      {items.map((item, idx) => {
        const id = `${rowIdPrefix}-${idx}`;
        return (
          <li key={item.href}>
            <ResultRow
              item={item}
              onSelect={onSelect}
              rowId={id}
              hidePath
              refMap={rowRefs}
              isActive={id === activeRowId}
            />
          </li>
        );
      })}
    </ul>
  );
}

function ToolsBand({
  items,
  onSelect,
  onActivate,
  rowRefs,
  activeRowId,
  flatIndexByHref,
  query,
  count,
  showCount,
  foldedRecentHref,
  role,
}: {
  items: PaletteItem[];
  onSelect: (href: string) => void;
  onActivate: (index: number) => void;
  rowRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  activeRowId: string;
  flatIndexByHref: Map<string, number>;
  query: string;
  count: number;
  showCount: boolean;
  foldedRecentHref: string | null;
  role: WorkspaceRole;
}) {
  // Preserve subgroup *ordering* (Account → Workspace → Operations) but no
  // longer surface the subgroup labels. The Tools inventory is small enough
  // that three stacked caps-tracking labels (band + subgroup) added
  // scaffolding noise without scan payoff. Icons + names carry the cluster.
  const subgroupOrder: readonly NonNullable<PaletteItem["searchSubgroup"]>[] = [
    "account",
    "workspace",
    "operations",
  ];
  const subgroupRank = new Map<string, number>();
  subgroupOrder.forEach((s, i) => subgroupRank.set(s, i));
  const ordered = [...items].sort((a, b) => {
    const ar = a.searchSubgroup ? (subgroupRank.get(a.searchSubgroup) ?? 99) : 99;
    const br = b.searchSubgroup ? (subgroupRank.get(b.searchSubgroup) ?? 99) : 99;
    return ar - br;
  });

  return (
    <section aria-label={SEARCH_GROUP_LABELS.tools}>
      <GroupBandHeader label={SEARCH_GROUP_LABELS.tools} count={count} showCount={showCount} />
      <ul>
        {ordered.map((item) => {
          const flatIdx = flatIndexByHref.get(item.href) ?? -1;
          const id = `search-row-${flatIdx}`;
          const isActive = id === activeRowId;
          // See `ResultsCard` — Recent marker yields to the active state's
          // rail + Enter kbd; the marker returns once the row is inactive.
          const isRecent =
            !isActive &&
            foldedRecentHref !== null &&
            paletteHrefKey(item.href) === foldedRecentHref;
          return (
            <li key={item.href}>
              <ResultRow
                item={item}
                role={role}
                query={query}
                onSelect={onSelect}
                onActivate={flatIdx >= 0 ? () => onActivate(flatIdx) : undefined}
                rowId={id}
                hidePath
                hideMeta
                refMap={rowRefs}
                isActive={isActive}
                isRecent={isRecent}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ZeroResults({
  query,
  suggestion,
  onSuggestionSelect,
  recents,
  rowRefs,
  activeRowId,
}: {
  query: string;
  suggestion: PaletteItem | null;
  onSuggestionSelect: (href: string) => void;
  recents: PaletteItem[];
  rowRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  activeRowId: string;
}) {
  const trimmed = query.trim();
  const contractsSearchHref = `/contracts?search=${encodeURIComponent(trimmed.slice(0, 120))}`;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-6 shadow-[var(--shadow-1)]">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)]"
        >
          <SearchX className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="ui-caps-2 text-[var(--text-tertiary)]">No matches</p>
          <p className="mt-1 truncate text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
            Nothing matched &ldquo;{trimmed}&rdquo;
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-[var(--text-secondary)]">
            {suggestion ? (
              <span className="inline-flex items-center gap-1">
                Did you mean:
                <Link
                  href={suggestion.href}
                  onClick={() => onSuggestionSelect(suggestion.href)}
                  className="ui-link font-semibold"
                >
                  {suggestion.name}
                </Link>
              </span>
            ) : null}
            <Link href={contractsSearchHref} className="ui-link inline-flex items-center gap-1 font-semibold">
              Search contracts for &ldquo;{trimmed}&rdquo;
              <ArrowRight className="h-3 w-3" strokeWidth={1.85} aria-hidden />
            </Link>
          </div>
        </div>
      </div>
      {recents.length > 0 ? (
        <div className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)]">
          <BandSection label="Recent" count={recents.length} showCount={recents.length > 1}>
            <BandList
              items={recents}
              rowIdPrefix="search-recent"
              onSelect={onSuggestionSelect}
              rowRefs={rowRefs}
              activeRowId={activeRowId}
            />
          </BandSection>
        </div>
      ) : null}
    </div>
  );
}

function ZeroInFilter({
  group,
  onClearFilter,
}: {
  group: SearchGroup;
  onClearFilter: () => void;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-6 shadow-[var(--shadow-1)]">
      <span
        aria-hidden
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)]"
      >
        <FilterX className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="ui-caps-2 text-[var(--text-tertiary)]">Filtered</p>
        <p className="mt-1 text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
          No matches in {SEARCH_GROUP_LABELS[group]}
        </p>
        <button
          type="button"
          onClick={onClearFilter}
          className="ui-btn-secondary mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
        >
          <X className="h-3 w-3" strokeWidth={2} aria-hidden />
          Clear filter
        </button>
      </div>
    </div>
  );
}

/** Desktop-only detail rail mirroring the active result. Sticky so it stays in
 *  view as the page scrolls; hidden below lg where the page is single-column. */
function SearchDetailRail({
  item,
  role,
  onSelect,
}: {
  item: PaletteItem | null;
  role: WorkspaceRole;
  onSelect: (href: string) => void;
}) {
  const verb = item ? resolveRowActionVerb(item, role) : "OPEN";
  const group = item
    ? SEARCH_GROUP_LABELS[item.searchGroup ?? resolveSearchGroupForNavItem(item)]
    : "";
  return (
    <aside className="hidden self-start rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-1)] lg:sticky lg:top-[calc(var(--shell-topbar-h)+1rem)] lg:flex lg:flex-col">
      {item ? (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Selected destination
          </p>
          <span
            aria-hidden
            className="mt-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)]"
          >
            {createElement(resolveNavIcon(item), { className: "h-[1.125rem] w-[1.125rem]", strokeWidth: 1.85 })}
          </span>
          <p className="mt-3 text-[15px] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
            {item.name}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
              {group}
            </span>
            <span className="inline-flex items-center rounded-full border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
              {verb}
            </span>
          </div>
          {item.description ? (
            <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{item.description}</p>
          ) : null}
          <CopyPathRow href={item.href} />
          <Link
            href={item.href}
            onClick={() => onSelect(item.href)}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_35%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_28%,var(--surface-raised))] px-3 py-1.5 text-[12px] font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_48%,var(--surface-raised))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_45%,transparent)]"
          >
            {verb}
            <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden />
          </Link>
        </>
      ) : (
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Keyboard</p>
          <div className="mt-2.5 flex flex-col gap-2 text-[11px] text-[var(--text-tertiary)]">
            <span className="inline-flex items-center justify-center gap-1.5"><kbd className="ui-kbd">↑↓</kbd> Move</span>
            <span className="inline-flex items-center justify-center gap-1.5"><kbd className="ui-kbd">Enter</kbd> Open</span>
            <span className="inline-flex items-center justify-center gap-1.5"><kbd className="ui-kbd">/</kbd> Focus</span>
          </div>
        </div>
      )}
    </aside>
  );
}

/** Mono path + copy-to-clipboard affordance for the detail rail. Copy gives a
 *  brief check-mark confirmation, then reverts. Clipboard write is best-effort
 *  (guarded for browsers/contexts where `navigator.clipboard` is unavailable). */
function CopyPathRow({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending revert timer on unmount (no state set in the effect body,
  // only in the click handler / timer callback — satisfies set-state-in-effect).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = useCallback(() => {
    try {
      const result = navigator.clipboard?.writeText(href);
      if (result) void result.catch(() => undefined);
    } catch {
      // ignore — clipboard may be blocked by permissions/context
    }
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1600);
  }, [href]);

  return (
    <div className="mt-3 flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--text-tertiary)]">{href}</code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Path copied" : "Copy path"}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_45%,transparent)]"
      >
        {copied ? (
          <Check className="h-3 w-3 text-[var(--accent-strong)]" strokeWidth={2.4} aria-hidden />
        ) : (
          <Copy className="h-3 w-3" strokeWidth={2} aria-hidden />
        )}
      </button>
    </div>
  );
}

function FullyRestrictedState() {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-6 shadow-[var(--shadow-1)]">
      <span
        aria-hidden
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--border-strong)_45%,var(--border-subtle))] bg-[var(--surface-muted)] text-[var(--text-tertiary)]"
      >
        <Lock className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="ui-caps-2 text-[var(--text-tertiary)]">Restricted</p>
        <p className="mt-1 text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
          No destinations available
        </p>
        <p className="mt-1 text-[12.5px] leading-snug text-[var(--text-secondary)]">
          This workspace doesn&apos;t expose searchable pages for your role. Contact a workspace admin to expand access.
        </p>
        <Link
          href="/dashboard"
          className="ui-btn-secondary mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={2} aria-hidden />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
