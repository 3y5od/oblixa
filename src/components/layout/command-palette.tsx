"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useEffect, useRef, useDeferredValue } from "react";
import { ArrowRight, Search } from "lucide-react";
import { fetchJson } from "@/lib/http/client-json";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { STATUS_LABELS } from "@/lib/contracts";
import { pushAppHref } from "@/lib/navigation/client-navigation";
import {
  WORKFLOW_AREA_LABELS,
  getWorkflowAreaForNavItem,
  type WorkspaceRole,
} from "@/lib/navigation";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import {
  isNavItemVisibleForSurface,
} from "@/lib/product-surface/nav-visibility";
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
import { shellTestIds } from "@/lib/qa/test-ids";
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
import { V10RecoverableState } from "@/components/ui/v10-recoverable-state";
import {
  allCommandItems,
  cmdkJumpMatchesPaletteQuery,
  fallbackNavSurface,
  paletteHrefKey,
  resultMetaLabel,
  type CommandPaletteRecovery,
  type ContractPaletteResult,
  type PaletteItem,
} from "./command-palette-helpers";
import { CommandPaletteRecentDestinations } from "./command-palette-recent-destinations";

function persistRecentCommands(next: string[]) {
  writeCommandPaletteRecentCommands(next);
}

export function CommandPalette(props: {
  role?: WorkspaceRole;
  v5Flags?: Record<FeatureFlagKey, boolean>;
  navSurface?: NavSurfaceInput | null;
  showToolsLink?: boolean;
  contractResults?: ContractPaletteResult[];
  initialQuery?: string;
}) {
  const router = useRouter();
  const role = props.role ?? "viewer";
  const v5Flags = useMemo(
    () => props.v5Flags ?? ({} as Record<FeatureFlagKey, boolean>),
    [props.v5Flags]
  );
  const baseSurface = useMemo(
    () => props.navSurface ?? fallbackNavSurface(role, v5Flags),
    [props.navSurface, role, v5Flags]
  );
  const showToolsLink = props.showToolsLink ?? true;
  const surface = useMemo((): NavSurfaceInput => {
    const hidden = baseSurface.utilityModulesHidden;
    const hasMoreHidden = hidden.includes("more_tools");
    if (showToolsLink && hasMoreHidden) {
      return { ...baseSurface, utilityModulesHidden: hidden.filter((key) => key !== "more_tools") };
    }
    if (!showToolsLink && !hasMoreHidden) {
      return { ...baseSurface, utilityModulesHidden: [...hidden, "more_tools"] };
    }
    return baseSurface;
  }, [showToolsLink, baseSurface]);
  const [open, setOpen] = useState(true);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const prevOpen = useRef(false);
  const [query, setQuery] = useState(() => props.initialQuery ?? "");
  const deferredFilterQ = useDeferredValue(query.trim().toLowerCase());
  const [remoteContractResults, setRemoteContractResults] = useState<ContractPaletteResult[]>(
    () => props.contractResults ?? []
  );
  const [remoteSearchFailed, setRemoteSearchFailed] = useState(false);
  const [remoteSearchPartial, setRemoteSearchPartial] = useState<string | null>(null);
  const [remoteSearchRecovery, setRemoteSearchRecovery] = useState<CommandPaletteRecovery | null>(null);
  const [remoteSearchRetryNonce, setRemoteSearchRetryNonce] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [footerVisible, setFooterVisible] = useState(false);
  const [recentHrefs, setRecentHrefs] = useState<string[]>(() => {
    return readCommandPaletteRecentCommands();
  });

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
    (item: PaletteItem) => {
      return isNavItemVisibleForSurface(item, surface) && isCmdkHrefAllowed(item.href, surface);
    },
    [surface]
  );

  function clearRemoteSearchFeedback() {
    setRemoteSearchFailed(false);
    setRemoteSearchPartial(null);
    setRemoteSearchRecovery(null);
  }

  function rememberReturnFocusTarget() {
    if (typeof document === "undefined") return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) {
      returnFocusRef.current = null;
      return;
    }
    if (searchInputRef.current?.contains(active) || openButtonRef.current?.contains(active)) {
      returnFocusRef.current = active;
      return;
    }
    if (active === document.body) {
      returnFocusRef.current = null;
      return;
    }
    returnFocusRef.current = active;
  }

  useEffect(() => {
    queueMicrotask(() => searchInputRef.current?.focus());
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
      if (returnTarget && returnTarget.isConnected) {
        returnTarget.focus();
      } else {
        openButtonRef.current?.focus();
      }
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
      setActiveIndex(0);
      setOpen(true);
      queueMicrotask(() => searchInputRef.current?.focus());
    }
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onPaletteOpen);
    return () => window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onPaletteOpen);
  }, []);

  useEffect(() => {
    const q = deferredFilterQ;
    if (q.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void fetchJson(`/api/command-palette/contracts?q=${encodeURIComponent(q)}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      })
        .then((result) => {
          if (!result.ok) return null;
          return result.data as
            | { contracts?: ContractPaletteResult[]; partial?: { reason?: string; diagnosticId?: string } | null; recovery?: CommandPaletteRecovery | null }
            | null;
        })
        .then((payload) => {
          if (!controller.signal.aborted) {
            setRemoteContractResults(payload?.contracts ?? []);
            setRemoteSearchFailed(payload === null);
            setRemoteSearchPartial(payload?.partial?.reason ?? null);
            setRemoteSearchRecovery(payload?.recovery ?? null);
            if (payload === null) void emitCmdkSearchFailedTelemetry({ queryLen: q.length });
          }
        })
        .catch((error) => {
          if (!controller.signal.aborted && error instanceof Error && error.name !== "AbortError") {
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

  const searchJumpNavItems = useMemo((): PaletteItem[] => {
    return getCmdkSearchJumpItems(surface, query).map((j) => ({
      name: j.name,
      href: j.href,
      description: j.description,
      section: "workspace",
      resultMeta: j.meta,
    }));
  }, [surface, query]);

  const contractItems = useMemo((): PaletteItem[] => {
    const q = deferredFilterQ;
    if (q.length < 2) return [];
    const rows = remoteContractResults;
    const ranked = rows
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
              .join(" · "),
          section: "workspace" as const,
          resultMeta: [
            resultType || "Contract",
            actionLabel || null,
            counterparty || "No counterparty",
            ownerLabel || null,
            row.status ? STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] ?? row.status : null,
          ]
            .filter(Boolean)
            .join(" · "),
          resultOrder: index,
        };
      })
      .filter((row): row is PaletteItem => row !== null)
      .sort((a, b) => {
        const orderDelta = (a.resultOrder ?? 99) - (b.resultOrder ?? 99);
        if (orderDelta !== 0) return orderDelta;
        return a.name.localeCompare(b.name);
      });
    return ranked.slice(0, 8);
  }, [deferredFilterQ, remoteContractResults]);

  const items = useMemo(() => {
    const base = allCommandItems();
    const filtered = base.filter((item) => isPaletteItemVisible(item));
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
    const remoteHrefSeen = new Set(contractItems.map((item) => paletteHrefKey(item.href)));
    const dedupedNavPart =
      q.length > 0
        ? navPart.filter((item) => {
            const key = paletteHrefKey(item.href);
            return !remoteHrefSeen.has(key) && !remoteHrefSeen.has(item.href);
          })
        : navPart;
    const hrefSeen = new Set(
      [...contractItems, ...dedupedNavPart].map((i) => paletteHrefKey(i.href))
    );
    const jumps = !q
      ? searchJumpNavItems
      : searchJumpNavItems.filter((item) => cmdkJumpMatchesPaletteQuery(item, q));
    const extra = jumps.filter((item) => {
      const path = paletteHrefKey(item.href);
      return !hrefSeen.has(path) && !hrefSeen.has(item.href);
    });
    return q ? [...contractItems, ...extra, ...dedupedNavPart] : [...dedupedNavPart, ...extra];
  }, [contractItems, deferredFilterQ, isPaletteItemVisible, searchJumpNavItems]);

  const visibleRecentHrefs = useMemo(
    () => cmdkFilterRecentHrefsForSurface(recentHrefs, surface).filter((href) => isCmdkHrefAllowed(href, surface)),
    [surface, recentHrefs]
  );
  const recentItems = useMemo(
    () =>
      visibleRecentHrefs
        .map((href) => allCommandItems().find((item) => item.href === href) ?? null)
        .filter((match): match is PaletteItem => match !== null && isNavItemVisibleForSurface(match, surface) && isCmdkHrefAllowed(match.href, surface)),
    [surface, visibleRecentHrefs]
  );

  useEffect(() => {
    if (
      visibleRecentHrefs.length === recentHrefs.length &&
      visibleRecentHrefs.every((href, index) => href === recentHrefs[index])
    ) {
      return;
    }
    persistRecentCommands(visibleRecentHrefs);
  }, [recentHrefs, visibleRecentHrefs]);

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

  useEffect(() => {
    if (!open) return;
    function onEnter(event: KeyboardEvent) {
      if (event.key !== "Enter") return;
      const item = flatItems[clampedActiveIndex];
      if (!item) return;
      void emitCmdkResultSelectedTelemetry({
        href: item.href,
        queryLen: deferredFilterQ.length,
      });
      rememberCommand(item);
      if (pushAppHref(router, item.href)) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
  }, [clampedActiveIndex, deferredFilterQ.length, flatItems, open, rememberCommand, router]);

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => {
          rememberReturnFocusTarget();
          setOpen(true);
        }}
        data-testid={shellTestIds.commandPaletteTrigger}
        className={`fixed bottom-5 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_90%,white)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--text-primary)] shadow-[var(--shadow-2)] backdrop-blur-md transition-[opacity,transform] hover:-translate-y-0.5 lg:hidden ${
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
          <div className="ui-command-modal relative my-auto w-full max-w-3xl">
            <div className="ui-command-search">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_78%,transparent)] text-[var(--accent-strong)]">
                <Search size={18} aria-hidden />
              </div>
              <input
                ref={searchInputRef}
                data-testid={shellTestIds.commandPaletteInput}
                autoFocus
                value={query}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  setQuery(nextQuery);
                  if (nextQuery.trim().length < 2) clearRemoteSearchFeedback();
                  setActiveIndex(0);
                }}
                className="min-h-0 min-w-0 w-full bg-transparent py-0 pl-0 pr-1.5 text-[14px] font-medium text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
                placeholder="Search pages, queues, reports, tools"
              />
              <div className="hidden items-center gap-1 justify-self-end text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)] sm:flex">
                <span className="ui-kbd">⌘</span>
                <span className="ui-kbd">K</span>
              </div>
            </div>
            {!query && (
              <CommandPaletteRecentDestinations
                items={recentItems}
                onSelect={(item) => {
                  void emitCmdkResultSelectedTelemetry({ href: item.href, queryLen: deferredFilterQ.length });
                  rememberCommand(item);
                  setOpen(false);
                }}
              />
            )}
            {remoteSearchPartial ? (
              <div className="border-b border-[var(--border-subtle)] px-4 py-2 sm:px-5">
                <V10RecoverableState
                  state="partial"
                  title="Command search is partially available"
                  reason={remoteSearchRecovery?.message ?? remoteSearchPartial}
                  accessibleName="Command palette partial search state"
                  surface="command_palette"
                  section="remote_search"
                  sourceObject="setting_destination"
                  diagnosticId={remoteSearchRecovery?.diagnosticId}
                  nextActionLabel="Review recovery destination"
                  className="border-0 bg-transparent p-0"
                  nextAction={(remoteSearchRecovery?.actions ?? [{ label: "Review workspace health", href: "/settings/health" }]).slice(0, 2).map((action) => (
                    <Link key={action.href} href={action.href} onClick={() => setOpen(false)} className="ui-link inline-flex">
                      {action.label}
                    </Link>
                  ))}
                />
              </div>
            ) : null}
            <ul data-testid={shellTestIds.commandPaletteResults} className="max-h-[58vh] overflow-y-auto py-2">
              {flatItems.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-[var(--text-secondary)] sm:px-5">
                  <V10RecoverableState
                    state={remoteSearchFailed ? "failed" : "empty"}
                    title={remoteSearchFailed ? "Command search could not load." : (remoteSearchRecovery?.message ?? "No matches found.")}
                    reason={
                      remoteSearchFailed
                        ? "Retry command search or open workspace health for recovery diagnostics."
                        : "No eligible command destination matched this query. Search contracts or use a recovery destination."
                    }
                    accessibleName={remoteSearchFailed ? "Command palette failed search state" : "Command palette empty search state"}
                    surface="command_palette"
                    section="zero_results"
                    sourceObject="setting_destination"
                    diagnosticId={remoteSearchRecovery?.diagnosticId}
                    nextActionLabel={remoteSearchFailed ? "Retry command search" : "Search contracts for this query"}
                    className="border-0 bg-transparent p-0"
                    nextAction={
                      <>
                        {remoteSearchFailed ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRemoteSearchFailed(false);
                              setRemoteSearchRetryNonce((value) => value + 1);
                            }}
                            className="ui-button-secondary min-h-9 rounded-full px-3 text-xs"
                          >
                            Retry search
                          </button>
                        ) : null}
                        <Link href="/settings/health" onClick={() => setOpen(false)} className="ui-link inline-flex">
                          Review workspace health
                        </Link>
                        {remoteSearchRecovery
                          ? remoteSearchRecovery.actions.map((action) => (
                              <Link
                                key={`${action.href}:${action.reason ?? "recovery"}`}
                                href={action.href}
                                onClick={() => setOpen(false)}
                                className="ui-button-secondary min-h-9 rounded-full px-3 text-xs"
                              >
                                {action.label}
                              </Link>
                            ))
                          : null}
                        <Link
                          href={`/contracts?search=${encodeURIComponent(query.trim())}`}
                          onClick={() => setOpen(false)}
                          className="ui-link inline-flex"
                        >
                          Search contracts for this query
                        </Link>
                      </>
                    }
                    noActionExplanation={
                      remoteSearchRecovery ? undefined : "Recovery action: route to eligible contract search instead of leaving a blank panel."
                    }
                  />
                </li>
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
                      <p className="ui-command-group-label">
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
                                  void emitCmdkResultSelectedTelemetry({
                                    href: item.href,
                                    queryLen: deferredFilterQ.length,
                                  });
                                  rememberCommand(item);
                                  setOpen(false);
                                }}
                                className={`ui-command-item group ${
                                  active ? "ui-command-item-active" : "ui-command-item-idle"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="break-words text-sm font-semibold text-[var(--text-primary)]">{item.name}</p>
                                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.description}</p>
                                    <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                                      {resultMetaLabel(item)}
                                    </p>
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
              batch actions where available.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
