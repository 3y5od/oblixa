"use client";

import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "@/lib/http/client-json";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { STATUS_LABELS } from "@/lib/contracts";
import { pushAppHref } from "@/lib/navigation/client-navigation";
import {
  SEARCH_GROUP_LABELS,
  SEARCH_GROUP_ORDER,
  resolveSearchGroupForNavItem,
  type WorkspaceRole,
} from "@/lib/navigation";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import { isNavItemVisibleForSurface } from "@/lib/product-surface/nav-visibility";
import {
  cmdkFilterRecentHrefsForSurface,
  cmdkResultSortKey,
  isCmdkHrefAllowed,
} from "@/lib/product-surface/resolver";
import { getCmdkSearchJumpItems } from "@/lib/product-surface/cmdk-search-jumps";
import {
  COMMAND_PALETTE_OPEN_EVENT,
  type CommandPaletteOpenDetail,
} from "@/lib/product-surface/command-palette-bridge";
import {
  readCommandPaletteRecentCommands,
  writeCommandPaletteRecentCommands,
} from "@/lib/security/client-storage";
import {
  emitCmdkPaletteOpenedTelemetry,
  emitCmdkResultSelectedTelemetry,
  emitCmdkSearchFailedTelemetry,
  emitCmdkZeroResultsTelemetry,
} from "@/actions/product-telemetry";
import { resolveRowActionVerb } from "@/components/search/result-row";
import type { SearchFieldHandle } from "@/components/search/search-field";
import {
  allCommandItems,
  cmdkJumpMatchesPaletteQuery,
  fallbackNavSurface,
  groupItemsBySearchGroup,
  paletteHrefKey,
  scoreAndSortItems,
  type CommandPaletteRecovery,
  type ContractPaletteResult,
  type PaletteItem,
} from "./command-palette-helpers";

const QUICK_PICK_HREFS: readonly string[] = ["/dashboard", "/work", "/reports", "/settings#profile"];

function persistRecentCommands(next: string[]) {
  writeCommandPaletteRecentCommands(next);
}

export type CommandPaletteProps = {
  role?: WorkspaceRole;
  v5Flags?: Record<FeatureFlagKey, boolean>;
  navSurface?: NavSurfaceInput | null;
  showToolsLink?: boolean;
  contractResults?: ContractPaletteResult[];
  initialQuery?: string;
};

export function useCommandPaletteState(props: CommandPaletteProps) {
  const router = useRouter();
  const role = props.role ?? "viewer";
  const v5Flags = useMemo(() => props.v5Flags ?? ({} as Record<FeatureFlagKey, boolean>), [props.v5Flags]);
  const baseSurface = useMemo(
    () => props.navSurface ?? fallbackNavSurface(role, v5Flags),
    [props.navSurface, role, v5Flags]
  );
  const surface = useMemo((): NavSurfaceInput => {
    const hidden = baseSurface.utilityModulesHidden;
    if (hidden.includes("more_tools")) return baseSurface;
    return { ...baseSurface, utilityModulesHidden: [...hidden, "more_tools"] };
  }, [baseSurface]);

  const [open, setOpen] = useState(true);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<SearchFieldHandle>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const prevOpen = useRef(false);
  const [query, setQuery] = useState(() => props.initialQuery ?? "");
  const deferredFilterQ = useDeferredValue(query.trim().toLowerCase());
  const hasQuery = deferredFilterQ.length > 0;
  const [remoteContractResults, setRemoteContractResults] = useState<ContractPaletteResult[]>(
    () => props.contractResults ?? []
  );
  const [remoteSearchFailed, setRemoteSearchFailed] = useState(false);
  const [remoteSearchPartial, setRemoteSearchPartial] = useState<string | null>(null);
  const [remoteSearchRecovery, setRemoteSearchRecovery] = useState<CommandPaletteRecovery | null>(null);
  const [remoteSearchRetryNonce, setRemoteSearchRetryNonce] = useState(0);
  const [activeIndex, setActiveIndex] = useState(() => (props.initialQuery?.trim() ? 0 : -1));
  const [railVisible, setRailVisible] = useState(true);
  const [footerVisible, setFooterVisible] = useState(false);
  const [recentHrefs, setRecentHrefs] = useState<string[]>(() => readCommandPaletteRecentCommands());
  const [remoteSearchLoading, setRemoteSearchLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const lastCmdkTelemetryAt = useRef(0);
  const lastZeroQueryKey = useRef<string | null>(null);

  const rememberCommand = useCallback((item: PaletteItem) => {
    setRecentHrefs((current) => {
      const next = [item.href, ...current.filter((href) => href !== item.href)].slice(0, 6);
      persistRecentCommands(next);
      return next;
    });
  }, []);

  const isPaletteItemVisible = useCallback(
    (item: PaletteItem) => isNavItemVisibleForSurface(item, surface) && isCmdkHrefAllowed(item.href, surface),
    [surface]
  );

  const clearRemoteSearchFeedback = useCallback(() => {
    setRemoteSearchFailed(false);
    setRemoteSearchPartial(null);
    setRemoteSearchRecovery(null);
  }, []);

  const rememberReturnFocusTarget = useCallback(() => {
    if (typeof document === "undefined") return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active === document.body) {
      returnFocusRef.current = null;
      return;
    }
    returnFocusRef.current = active;
  }, []);

  const handleQueryChange = useCallback((next: string) => {
    setQuery(next);
    if (next.trim().length < 2) {
      setRemoteSearchFailed(false);
      setRemoteSearchPartial(null);
      setRemoteSearchRecovery(null);
    }
    setActiveIndex(next.trim() ? 0 : -1);
    setRailVisible(true);
  }, []);

  useEffect(() => {
    queueMicrotask(() => fieldRef.current?.focus());
  }, []);

  useEffect(() => {
    if (open) {
      prevOpen.current = true;
      const now = Date.now();
      if (now - lastCmdkTelemetryAt.current > 30_000) {
        lastCmdkTelemetryAt.current = now;
        void emitCmdkPaletteOpenedTelemetry();
      }
    } else if (prevOpen.current) {
      const returnTarget = returnFocusRef.current;
      if (returnTarget && returnTarget.isConnected) returnTarget.focus();
      else openButtonRef.current?.focus();
      prevOpen.current = false;
      returnFocusRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    function onPaletteOpen(event: Event) {
      const ce = event as CustomEvent<CommandPaletteOpenDetail>;
      const q = typeof ce.detail?.query === "string" ? ce.detail.query : "";
      rememberReturnFocusTarget();
      setQuery(q);
      if (q.trim().length < 2) clearRemoteSearchFeedback();
      setActiveIndex(q.trim() ? 0 : -1);
      setRailVisible(true);
      setOpen(true);
      queueMicrotask(() => fieldRef.current?.focus());
    }
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onPaletteOpen);
    return () => window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onPaletteOpen);
  }, [clearRemoteSearchFeedback, rememberReturnFocusTarget]);

  useEffect(() => {
    const q = deferredFilterQ;
    if (q.length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setRemoteSearchLoading(true);
      void fetchJson(`/api/command-palette/contracts?q=${encodeURIComponent(q)}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      })
        .then((result) => {
          if (!result.ok) return null;
          return result.data as
            | {
                contracts?: ContractPaletteResult[];
                partial?: { reason?: string; diagnosticId?: string } | null;
                recovery?: CommandPaletteRecovery | null;
              }
            | null;
        })
        .then((payload) => {
          if (!controller.signal.aborted) {
            setRemoteSearchLoading(false);
            setRemoteContractResults(payload?.contracts ?? []);
            setRemoteSearchFailed(payload === null);
            setRemoteSearchPartial(payload?.partial?.reason ?? null);
            setRemoteSearchRecovery(payload?.recovery ?? null);
            if (payload === null) void emitCmdkSearchFailedTelemetry({ queryLen: q.length });
          }
        })
        .catch((error) => {
          if (!controller.signal.aborted && error instanceof Error && error.name !== "AbortError") {
            setRemoteSearchLoading(false);
            setRemoteContractResults([]);
            setRemoteSearchFailed(true);
            setRemoteSearchPartial(null);
            setRemoteSearchRecovery(null);
            void emitCmdkSearchFailedTelemetry({ queryLen: q.length });
          }
        });
    }, 160);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [deferredFilterQ, remoteSearchRetryNonce]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        rememberReturnFocusTarget();
        setOpen((v) => !v);
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, rememberReturnFocusTarget]);

  useEffect(() => {
    const footer = document.getElementById("legal-footer");
    if (!footer || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      setFooterVisible(Boolean(entry?.isIntersecting));
    }, { root: null, threshold: 0.05 });
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const searchJumpNavItems = useMemo((): PaletteItem[] => {
    return getCmdkSearchJumpItems(surface, query).map((j) => ({
      name: j.name,
      href: j.href.startsWith("/contracts/exceptions") ? "/work?tab=exceptions" : j.href,
      description: j.description,
      section: "workspace",
      resultMeta: j.meta,
    }));
  }, [surface, query]);

  const contractItems = useMemo((): PaletteItem[] => {
    const q = deferredFilterQ;
    if (q.length < 2) return [];
    return remoteContractResults
      .map((row, index): PaletteItem | null => {
        const title = row.title.trim();
        const counterparty = row.counterparty?.trim() ?? "";
        const ownerLabel = row.ownerLabel?.trim() ?? "";
        const resultType = row.resultType?.trim() ?? "";
        const description = row.description?.trim() ?? "";
        const actionLabel = row.actionLabel?.trim() ?? "";
        return {
          name: title,
          href: row.href || `/contracts/${row.id}`,
          description:
            description ||
            [
              counterparty || "No counterparty",
              ownerLabel,
              row.status ? STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] ?? row.status : null,
            ]
              .filter(Boolean)
              .join(" \u00B7 "),
          section: "workspace" as const,
          resultMeta: [
            resultType || "Contract",
            actionLabel || null,
            counterparty || "No counterparty",
            ownerLabel || null,
            row.status ? STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] ?? row.status : null,
          ]
            .filter(Boolean)
            .join(" \u00B7 "),
          resultOrder: index,
        };
      })
      .filter((row): row is PaletteItem => row !== null)
      .sort((a, b) => {
        const orderDelta = (a.resultOrder ?? 99) - (b.resultOrder ?? 99);
        if (orderDelta !== 0) return orderDelta;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [deferredFilterQ, remoteContractResults]);

  const visibleRecentHrefs = useMemo(
    () => cmdkFilterRecentHrefsForSurface(recentHrefs, surface).filter((href) => isCmdkHrefAllowed(href, surface)),
    [surface, recentHrefs]
  );
  const recentHrefSet = useMemo(
    () => new Set(visibleRecentHrefs.map((href) => paletteHrefKey(href))),
    [visibleRecentHrefs]
  );
  const recentItems = useMemo(
    () =>
      visibleRecentHrefs
        .map((href) => allCommandItems().find((item) => item.href === href) ?? null)
        .filter((match): match is PaletteItem => match !== null && isNavItemVisibleForSurface(match, surface) && isCmdkHrefAllowed(match.href, surface)),
    [surface, visibleRecentHrefs]
  );

  const quickPickItems = useMemo<PaletteItem[]>(() => {
    const byHref = new Map(
      allCommandItems()
        .filter((item) => isPaletteItemVisible(item))
        .map((item) => [paletteHrefKey(item.href), item] as const)
    );
    return QUICK_PICK_HREFS.map((href) => byHref.get(href)).filter((item): item is PaletteItem => Boolean(item));
  }, [isPaletteItemVisible]);

  useEffect(() => {
    if (
      visibleRecentHrefs.length === recentHrefs.length &&
      visibleRecentHrefs.every((href, index) => href === recentHrefs[index])
    ) {
      return;
    }
    persistRecentCommands(visibleRecentHrefs);
  }, [recentHrefs, visibleRecentHrefs]);

  const navAndJumpItems = useMemo(() => {
    const navBase = allCommandItems().filter((item) => isPaletteItemVisible(item));
    const q = deferredFilterQ;
    const navOrdered = q
      ? scoreAndSortItems(navBase, q, recentHrefSet)
      : [...navBase].sort((a, b) => {
          const d = cmdkResultSortKey(a.href) - cmdkResultSortKey(b.href);
          if (d !== 0) return d;
          return a.name.localeCompare(b.name);
        });

    const remoteHrefSeen = new Set(contractItems.map((item) => paletteHrefKey(item.href)));
    const dedupedNav =
      q.length > 0
        ? navOrdered.filter((item) => {
            const key = paletteHrefKey(item.href);
            return !remoteHrefSeen.has(key) && !remoteHrefSeen.has(item.href);
          })
        : navOrdered;

    const hrefSeen = new Set([...contractItems, ...dedupedNav].map((i) => paletteHrefKey(i.href)));
    const baseSeen = new Set([...contractItems, ...dedupedNav].map((i) => (i.href.split("?")[0] ?? i.href).split("#")[0] ?? i.href));
    const jumps = !q ? searchJumpNavItems : searchJumpNavItems.filter((item) => cmdkJumpMatchesPaletteQuery(item, q));
    const extraJumps = jumps.filter((item) => {
      const key = paletteHrefKey(item.href);
      if (hrefSeen.has(key) || hrefSeen.has(item.href)) return false;
      const base = (item.href.split("?")[0] ?? item.href).split("#")[0] ?? item.href;
      if (!item.href.includes("?") && baseSeen.has(base)) return false;
      return true;
    });

    return [...dedupedNav, ...extraJumps];
  }, [contractItems, deferredFilterQ, isPaletteItemVisible, recentHrefSet, searchJumpNavItems]);

  const orderedGroups = useMemo(() => {
    const out: Array<{ key: string; label: string; items: PaletteItem[] }> = [];
    if (contractItems.length > 0) out.push({ key: "results", label: "Results", items: contractItems });
    const navGrouped = groupItemsBySearchGroup(navAndJumpItems);
    for (const group of SEARCH_GROUP_ORDER) {
      const groupItems = navGrouped.get(group) ?? [];
      if (groupItems.length > 0) out.push({ key: group, label: SEARCH_GROUP_LABELS[group], items: groupItems });
    }
    return out;
  }, [contractItems, navAndJumpItems]);

  const flatItems = useMemo(() => orderedGroups.flatMap((g) => g.items), [orderedGroups]);
  const flatIndexByHref = useMemo(() => new Map(flatItems.map((item, idx) => [item.href, idx])), [flatItems]);
  const clampedActiveIndex = activeIndex < 0 || flatItems.length === 0 ? -1 : Math.min(activeIndex, flatItems.length - 1);
  const foldedRecentHref = !hasQuery && recentItems.length === 1 ? paletteHrefKey(recentItems[0]!.href) : null;
  const recentsForBand = !hasQuery && recentItems.length >= 2 ? recentItems : null;
  const showQuickPick = !hasQuery && recentItems.length === 0;
  const activeItem = flatItems[clampedActiveIndex] ?? null;
  const activeVerb = activeItem ? resolveRowActionVerb(activeItem, role) : "OPEN";
  const activeGroupLabel = activeItem
    ? activeItem.resultOrder != null
      ? "Results"
      : SEARCH_GROUP_LABELS[resolveSearchGroupForNavItem(activeItem)]
    : "";

  useEffect(() => {
    if (!open) {
      lastZeroQueryKey.current = null;
      return;
    }
    const q = deferredFilterQ;
    if (!q || flatItems.length > 0) return;
    const key = `${q}`;
    if (lastZeroQueryKey.current === key) return;
    lastZeroQueryKey.current = key;
    const t = window.setTimeout(() => {
      void emitCmdkZeroResultsTelemetry({ queryLen: q.length });
    }, 450);
    return () => window.clearTimeout(t);
  }, [open, deferredFilterQ, flatItems.length]);

  const handleSelectRow = useCallback(
    (item: PaletteItem) => {
      void emitCmdkResultSelectedTelemetry({ href: item.href, queryLen: deferredFilterQ.length });
      rememberCommand(item);
      setOpen(false);
    },
    [deferredFilterQ.length, rememberCommand]
  );

  const handleResultsScroll = useCallback(() => {
    const ul = document.getElementById("command-palette-results");
    const active = ul?.querySelector('[data-active="true"]');
    if (!ul || !(active instanceof HTMLElement)) {
      setRailVisible(false);
      return;
    }
    const ur = ul.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    setRailVisible(ar.bottom > ur.top + 4 && ar.top < ur.bottom - 4);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const len = flatItems.length;
    if (len === 0) return;
    function onNav(event: KeyboardEvent) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setRailVisible(true);
        setActiveIndex((idx) => (idx < 0 ? 0 : (idx + 1) % len));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setRailVisible(true);
        setActiveIndex((idx) => (idx < 0 ? len - 1 : (idx - 1 + len) % len));
      } else if (event.key === "Home") {
        event.preventDefault();
        setRailVisible(true);
        setActiveIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setRailVisible(true);
        setActiveIndex(len - 1);
      }
    }
    window.addEventListener("keydown", onNav);
    return () => window.removeEventListener("keydown", onNav);
  }, [open, flatItems.length]);

  useEffect(() => {
    if (!open) return;
    const node = document.querySelector('#command-palette-results [data-active="true"]');
    if (node instanceof HTMLElement && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ block: "nearest" });
    }
  }, [open, clampedActiveIndex]);

  useEffect(() => {
    if (!open || !hasQuery) return;
    const n = flatItems.length;
    const t = window.setTimeout(() => {
      setAnnouncement(`${n} result${n === 1 ? "" : "s"}`);
    }, 400);
    return () => window.clearTimeout(t);
  }, [open, hasQuery, deferredFilterQ, flatItems.length]);

  useEffect(() => {
    if (!open) return;
    function onEnter(event: KeyboardEvent) {
      if (event.key !== "Enter") return;
      if (event.target instanceof HTMLElement && event.target.closest("a, button")) return;
      const item = flatItems[clampedActiveIndex >= 0 ? clampedActiveIndex : 0];
      if (!item) return;
      void emitCmdkResultSelectedTelemetry({ href: item.href, queryLen: deferredFilterQ.length });
      rememberCommand(item);
      if (pushAppHref(router, item.href)) setOpen(false);
    }
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
  }, [clampedActiveIndex, deferredFilterQ.length, flatItems, open, rememberCommand, router]);

  const fullSearchHref =
    query.trim().length > 0 ? `/search?q=${encodeURIComponent(query.trim().slice(0, 120))}` : "/search";

  return {
    openButtonRef,
    fieldRef,
    role,
    open,
    setOpen,
    footerVisible,
    query,
    hasQuery,
    announcement,
    flatItems,
    orderedGroups,
    flatIndexByHref,
    clampedActiveIndex,
    recentsForBand,
    showQuickPick,
    quickPickItems,
    foldedRecentHref,
    activeItem,
    activeGroupLabel,
    activeVerb,
    railVisible,
    remoteSearchLoading,
    remoteSearchFailed,
    remoteSearchPartial,
    remoteSearchRecovery,
    deferredFilterQ,
    fullSearchHref,
    rememberReturnFocusTarget,
    clearRemoteSearchFeedback,
    handleQueryChange,
    handleSelectRow,
    handleResultsScroll,
    setQuery,
    setActiveIndex,
    setRailVisible,
    setRemoteSearchFailed,
    setRemoteSearchRetryNonce,
  };
}
