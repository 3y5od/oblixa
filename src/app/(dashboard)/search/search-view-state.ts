"use client";

import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  SEARCH_GROUP_LABELS,
  SEARCH_GROUP_ORDER,
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
import type { SearchFieldHandle } from "@/components/search/search-field";
import {
  emitCmdkPaletteOpenedTelemetry,
  emitCmdkResultSelectedTelemetry,
  emitCmdkZeroResultsTelemetry,
} from "@/actions/product-telemetry";

const MAX_RECENTS = 6;
const QUICK_PICK_HREFS: readonly string[] = ["/dashboard", "/work", "/reports", "/settings#profile"];

export type SearchViewProps = {
  role: WorkspaceRole;
  navSurface: NavSurfaceInput;
  initialQuery: string;
  initialFilterGroup: SearchGroup | null;
};

function buildSearchUrl(q: string, filter: SearchGroup | null): string {
  const params = new URLSearchParams();
  const trimmed = q.trim();
  if (trimmed) params.set("q", trimmed.slice(0, 120));
  if (filter) params.set("group", filter);
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

export function useSearchViewState({
  role,
  navSurface,
  initialQuery,
  initialFilterGroup,
}: SearchViewProps) {
  const router = useRouter();
  const fieldRef = useRef<SearchFieldHandle | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const [filterGroup, setFilterGroup] = useState<SearchGroup | null>(initialFilterGroup);
  const [storedRecentHrefs, setStoredRecentHrefs] = useState(() => readCommandPaletteRecentCommands());
  const [rawActiveIndex, setActiveIndex] = useState(0);
  const [announcement, setAnnouncement] = useState<string | undefined>();
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastZeroQueryRef = useRef<string>("");
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());
  const listId = useId();

  const visibleItems = useMemo(() => {
    const all = allCommandItems();
    return all.filter(
      (item) => isNavItemVisibleForSurface(item, navSurface) && isCmdkHrefAllowed(item.href, navSurface)
    );
  }, [navSurface]);

  const recents = useMemo(
    () => cmdkFilterRecentHrefsForSurface(storedRecentHrefs, navSurface).slice(0, MAX_RECENTS),
    [storedRecentHrefs, navSurface]
  );

  useEffect(() => {
    void emitCmdkPaletteOpenedTelemetry({ source: "page" }).catch(() => undefined);
  }, []);

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
  const filteredMatched = useMemo(() => {
    if (!filterGroup) return matched;
    return matched.filter((item) => (item.searchGroup ?? "pages") === filterGroup);
  }, [matched, filterGroup]);
  const grouped = useMemo(() => groupItemsBySearchGroup(filteredMatched), [filteredMatched]);
  const countsByGroup = useMemo(() => {
    const byGroup = groupItemsBySearchGroup(matched);
    const out = new Map<SearchGroup, number>();
    for (const group of SEARCH_GROUP_ORDER) out.set(group, byGroup.get(group)?.length ?? 0);
    return out;
  }, [matched]);

  const totalResults = filteredMatched.length;
  const activeIndex = Math.min(rawActiveIndex, Math.max(0, filteredMatched.length - 1));
  const handleQueryChange = useCallback((nextQuery: string) => {
    setQuery(nextQuery);
    setActiveIndex(0);
  }, []);
  const handleFilterChange = useCallback((nextGroup: SearchGroup | null) => {
    setFilterGroup(nextGroup);
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    if (!hasQuery || totalResults > 0) return;
    const q = deferredQuery.trim();
    if (q.length < 2 || lastZeroQueryRef.current === q) return;
    lastZeroQueryRef.current = q;
    void emitCmdkZeroResultsTelemetry({ q, source: "page" }).catch(() => undefined);
  }, [hasQuery, totalResults, deferredQuery]);

  useEffect(() => {
    if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    if (!hasQuery && !filterGroup) return;
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

  useEffect(() => {
    const visibleByGroup = groupItemsBySearchGroup(visibleItems);
    const topPerGroup: string[] = [];
    for (const group of SEARCH_GROUP_ORDER) {
      const first = visibleByGroup.get(group)?.[0]?.href;
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
  }, [visibleItems, router]);

  const recentItems = useMemo(() => {
    const byHref = new Map(visibleItems.map((i) => [paletteHrefKey(i.href), i]));
    return recents.map((href) => byHref.get(href)).filter((item): item is PaletteItem => Boolean(item));
  }, [recents, visibleItems]);

  const quickPickItems = useMemo<PaletteItem[]>(() => {
    const byHref = new Map(visibleItems.map((i) => [paletteHrefKey(i.href), i]));
    return QUICK_PICK_HREFS.map((href) => byHref.get(href)).filter((item): item is PaletteItem => Boolean(item));
  }, [visibleItems]);

  const recordVisit = useCallback(
    (href: string) => {
      const key = paletteHrefKey(href);
      const next = [key, ...recents.filter((h) => h !== key)].slice(0, MAX_RECENTS);
      setStoredRecentHrefs(next);
      writeCommandPaletteRecentCommands(next);
    },
    [recents]
  );

  const handleSelect = useCallback(
    (href: string) => {
      recordVisit(href);
      void emitCmdkResultSelectedTelemetry({ href, queryLen: deferredQuery.length, source: "page" }).catch(() => undefined);
    },
    [deferredQuery.length, recordVisit]
  );

  const handleSubmit = useCallback(
    (value: string) => {
      const active = filteredMatched[activeIndex] ?? filteredMatched[0];
      if (!active) return;
      recordVisit(active.href);
      void emitCmdkResultSelectedTelemetry({ href: active.href, queryLen: value.length, source: "page" }).catch(() => undefined);
      router.push(active.href);
    },
    [filteredMatched, activeIndex, recordVisit, router]
  );

  const handleSubmitNewTab = useCallback(() => {
    const active = filteredMatched[activeIndex] ?? filteredMatched[0];
    if (!active) return;
    recordVisit(active.href);
    window.open(active.href, "_blank", "noopener,noreferrer");
  }, [filteredMatched, activeIndex, recordVisit]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        const isInput = tag === "INPUT" || tag === "TEXTAREA" || event.target.isContentEditable;
        if (event.key === "/" && !isInput && !event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          fieldRef.current?.focus();
          fieldRef.current?.select();
          return;
        }
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
        setActiveIndex((idx) => (idx <= 0 ? Math.max(0, filteredMatched.length - 1) : idx - 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filteredMatched.length]);

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
  const foldedRecentHref = showRecents && recentItems.length === 1 ? paletteHrefKey(recentItems[0]!.href) : null;
  const recentsForBand = showRecents && recentItems.length >= 2 ? recentItems : null;
  const activeItem = filteredMatched[activeIndex] ?? null;

  return {
    role,
    initialQuery,
    fieldRef,
    listId,
    query,
    deferredQuery,
    filterGroup,
    countsByGroup,
    hasQuery,
    totalResults,
    liveRegionMessage: !hasQuery && !filterGroup ? undefined : announcement,
    grouped,
    isStale,
    handleQueryChange,
    handleFilterChange,
    handleSubmit,
    handleSubmitNewTab,
    handleSelect,
    closestSuggestion,
    recentItems,
    rowRefs,
    activeRowId,
    filteredMatched,
    visibleGroupsForFilter,
    recentsForBand,
    showQuickPick,
    quickPickItems,
    foldedRecentHref,
    isFullyRestricted,
    activeItem,
    setActiveIndex,
  };
}
