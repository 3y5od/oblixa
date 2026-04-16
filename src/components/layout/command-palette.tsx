"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useRef, useDeferredValue } from "react";
import { ArrowRight, Clock3, Search } from "lucide-react";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import {
  NAV_ITEMS,
  WORKFLOW_AREA_LABELS,
  getWorkflowAreaForNavItem,
  type NavItem,
  type WorkspaceRole,
} from "@/lib/navigation";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import {
  isNavItemVisibleForSurface,
} from "@/lib/product-surface/nav-visibility";
import {
  CMDK_EXTRA_NAV_ITEMS,
  cmdkFilterRecentHrefsForSurface,
  cmdkResultSortKey,
  isCmdkHrefAllowed,
} from "@/lib/product-surface/resolver";
import { getCmdkSearchJumpItems } from "@/lib/product-surface/cmdk-search-jumps";
import {
  COMMAND_PALETTE_OPEN_EVENT,
  type CommandPaletteOpenDetail,
} from "@/lib/product-surface/command-palette-bridge";
import { shellTestIds } from "@/lib/qa/test-ids";

const RECENT_COMMANDS_KEY = "oblixa.command-palette.recent";

function fallbackNavSurface(
  role: WorkspaceRole,
  flags: Record<FeatureFlagKey, boolean>
): NavSurfaceInput {
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

function allCommandItems(): NavItem[] {
  return [...NAV_ITEMS, ...CMDK_EXTRA_NAV_ITEMS];
}

export function CommandPalette(props: {
  role?: WorkspaceRole;
  v5Flags?: Record<FeatureFlagKey, boolean>;
  navSurface?: NavSurfaceInput | null;
}) {
  const role = props.role ?? "viewer";
  const v5Flags = useMemo(
    () => props.v5Flags ?? ({} as Record<FeatureFlagKey, boolean>),
    [props.v5Flags]
  );
  const surface = useMemo(
    () => props.navSurface ?? fallbackNavSurface(role, v5Flags),
    [props.navSurface, role, v5Flags]
  );
  const [open, setOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const prevOpen = useRef(false);
  const [query, setQuery] = useState("");
  const deferredFilterQ = useDeferredValue(query.trim().toLowerCase());
  const [activeIndex, setActiveIndex] = useState(0);
  const [footerVisible, setFooterVisible] = useState(false);
  const [recentHrefs, setRecentHrefs] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(RECENT_COMMANDS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as string[];
      return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (open) {
      prevOpen.current = true;
    } else if (prevOpen.current) {
      openButtonRef.current?.focus();
      prevOpen.current = false;
    }
  }, [open]);

  useEffect(() => {
    function onPaletteOpen(event: Event) {
      const ce = event as CustomEvent<CommandPaletteOpenDetail>;
      const q = typeof ce.detail?.query === "string" ? ce.detail.query : "";
      setQuery(q);
      setActiveIndex(0);
      setOpen(true);
      queueMicrotask(() => searchInputRef.current?.focus());
    }
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onPaletteOpen);
    return () => window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onPaletteOpen);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
      }
      if (!open) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((idx) => idx + 1);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((idx) => Math.max(0, idx - 1));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    const footer = document.getElementById("legal-footer");
    if (!footer || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setFooterVisible(Boolean(entry?.isIntersecting));
      },
      { root: null, threshold: 0.05 }
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const searchJumpNavItems = useMemo((): NavItem[] => {
    return getCmdkSearchJumpItems(surface, query).map((j) => ({
      name: j.name,
      href: j.href,
      description: j.description,
      section: "workspace",
    }));
  }, [query, surface]);

  const items = useMemo(() => {
    const base = allCommandItems();
    const filtered = base.filter(
      (item) => isNavItemVisibleForSurface(item, surface) && isCmdkHrefAllowed(item.href, surface)
    );
    const sorted = [...filtered].sort((a, b) => {
      const d = cmdkResultSortKey(a.href) - cmdkResultSortKey(b.href);
      if (d !== 0) return d;
      return a.name.localeCompare(b.name);
    });
    const q = deferredFilterQ;
    const navPart = !q
      ? sorted
      : sorted.filter((item) =>
          `${item.name} ${item.description} ${item.href}`.toLowerCase().includes(q)
        );
    const hrefSeen = new Set(navPart.map((i) => i.href.split("?")[0] ?? i.href));
    const jumps = !q
      ? searchJumpNavItems
      : searchJumpNavItems.filter((item) =>
          `${item.name} ${item.description} ${item.href}`.toLowerCase().includes(q)
        );
    const extra = jumps.filter((item) => {
      const path = item.href.split("?")[0] ?? item.href;
      return !hrefSeen.has(path) && !hrefSeen.has(item.href);
    });
    return [...navPart, ...extra];
  }, [deferredFilterQ, surface, searchJumpNavItems]);

  const visibleRecentHrefs = useMemo(
    () => cmdkFilterRecentHrefsForSurface(recentHrefs, surface),
    [recentHrefs, surface]
  );

  const grouped = useMemo(() => {
    const groups = {
      monitor: items.filter((item) => getWorkflowAreaForNavItem(item) === "monitor"),
      workflows: items.filter((item) => getWorkflowAreaForNavItem(item) === "workflows"),
      assurance: items.filter((item) => getWorkflowAreaForNavItem(item) === "assurance"),
      insights: items.filter((item) => getWorkflowAreaForNavItem(item) === "insights"),
      workspace: items.filter((item) => getWorkflowAreaForNavItem(item) === "workspace"),
    };
    return groups;
  }, [items]);

  const flatItems = useMemo(
    () => [
      ...grouped.monitor,
      ...grouped.workflows,
      ...grouped.assurance,
      ...grouped.insights,
      ...grouped.workspace,
    ],
    [grouped]
  );
  const flatIndexByHref = useMemo(() => {
    return new Map(flatItems.map((item, idx) => [item.href, idx]));
  }, [flatItems]);

  const clampedActiveIndex =
    flatItems.length === 0 ? 0 : Math.min(activeIndex, flatItems.length - 1);

  useEffect(() => {
    if (!open) return;
    function onEnter(event: KeyboardEvent) {
      if (event.key !== "Enter") return;
      const item = flatItems[clampedActiveIndex];
      if (!item) return;
      window.location.assign(item.href);
    }
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
  }, [clampedActiveIndex, flatItems, open]);

  function rememberCommand(item: NavItem) {
    const next = [item.href, ...recentHrefs.filter((href) => href !== item.href)].slice(0, 6);
    setRecentHrefs(next);
    try {
      window.localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage write errors.
    }
  }

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        data-testid={shellTestIds.commandPaletteTrigger}
        className={`fixed bottom-5 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-[1rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_90%,white)] px-3.5 py-2.5 text-[12px] font-semibold text-[var(--text-primary)] shadow-[var(--shadow-2)] backdrop-blur-md transition-[opacity,transform] hover:-translate-y-0.5 lg:hidden ${
          footerVisible ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        aria-label="Open command palette"
      >
        <Search size={14} aria-hidden />
        <span>Search</span>
        <span className="ui-kbd">K</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          data-testid={shellTestIds.commandPaletteRoot}
          className="ui-overlay-scrim fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-3 pb-6 pt-6 sm:px-4 sm:pt-[10vh]"
        >
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setOpen(false)}
            aria-label="Close command palette overlay"
          />
          <div className="relative my-auto w-full max-w-3xl overflow-hidden rounded-[1.75rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_92%,white)] shadow-[var(--shadow-3)]">
            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-4 sm:px-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-[1rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_78%,transparent)] text-[var(--accent-strong)]">
                <Search size={18} aria-hidden />
              </div>
              <input
                ref={searchInputRef}
                data-testid={shellTestIds.commandPaletteInput}
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
                placeholder="Search pages, queues, reports, or tools"
              />
              <div className="ml-auto hidden items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)] sm:flex">
                <span className="ui-kbd">⌘</span>
                <span className="ui-kbd">K</span>
              </div>
            </div>
            {!query && visibleRecentHrefs.length > 0 && (
              <div className="border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  Recent
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {visibleRecentHrefs.map((href) => {
                    const match = allCommandItems().find((item) => item.href === href);
                    if (
                      !match ||
                      !isNavItemVisibleForSurface(match, surface) ||
                      !isCmdkHrefAllowed(match.href, surface)
                    )
                      return null;
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => {
                          rememberCommand(match);
                          setOpen(false);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_72%,transparent)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_92%,transparent)]"
                      >
                        <Clock3 size={12} aria-hidden />
                        {match.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
            <ul data-testid={shellTestIds.commandPaletteResults} className="max-h-[58vh] overflow-y-auto py-2">
              {flatItems.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-[var(--text-secondary)] sm:px-5">No matches found.</li>
              ) : (
                ([
                  [WORKFLOW_AREA_LABELS.monitor, grouped.monitor],
                  [WORKFLOW_AREA_LABELS.workflows, grouped.workflows],
                  [WORKFLOW_AREA_LABELS.assurance, grouped.assurance],
                  [WORKFLOW_AREA_LABELS.insights, grouped.insights],
                  [WORKFLOW_AREA_LABELS.workspace, grouped.workspace],
                ] as const).map(([label, groupItems]) => {
                  if (groupItems.length === 0) return null;
                  return (
                    <li key={label}>
                      <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)] sm:px-5">
                        {label}
                      </p>
                      <ul>
                        {groupItems.map((item) => {
                          const idx = flatIndexByHref.get(item.href) ?? -1;
                          const active = idx === clampedActiveIndex;
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={() => {
                                  rememberCommand(item);
                                  setOpen(false);
                                }}
                                className={`group block px-4 py-3.5 transition-colors sm:px-5 ${
                                  active
                                    ? "bg-[color:color-mix(in_oklab,var(--accent-soft)_68%,transparent)]"
                                    : "hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_74%,transparent)]"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="break-words text-sm font-semibold text-[var(--text-primary)]">{item.name}</p>
                                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.description}</p>
                                  </div>
                                  <span className={`shrink-0 text-[var(--text-tertiary)] transition-transform ${active ? "translate-x-0.5" : "group-hover:translate-x-0.5"}`}>
                                    <ArrowRight size={15} aria-hidden />
                                  </span>
                                </div>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })
              )}
            </ul>
            <p className="border-t border-[var(--border-subtle)] px-4 py-3 text-[11px] text-[var(--text-tertiary)] sm:px-5">
              Arrow keys and Enter to open · Esc to close · On tables with checkboxes, use row selection for
              batch actions where available (refinement §16.1).
            </p>
          </div>
        </div>
      )}
    </>
  );
}
