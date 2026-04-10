"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useRef } from "react";
import { Search, Command } from "lucide-react";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import {
  NAV_ITEMS,
  WORKFLOW_AREA_LABELS,
  canAccessItem,
  getWorkflowAreaForNavItem,
  isV5NavItemVisible,
  type NavItem,
  type WorkspaceRole,
} from "@/lib/navigation";

const RECENT_COMMANDS_KEY = "oblixa.command-palette.recent";

const DEEP_LINK_COMMANDS: NavItem[] = [
  {
    name: "Compare campaigns & simulations",
    href: "/campaigns/compare",
    description: "Side-by-side campaign progress and simulation inputs.",
    section: "primary",
    v5FlagsAnyOf: ["v5PortfolioCampaigns"],
  },
];

function navItemVisible(item: NavItem, v5Flags: Record<FeatureFlagKey, boolean>) {
  return isV5NavItemVisible(item, v5Flags);
}

export function CommandPalette(props: {
  role?: WorkspaceRole;
  v5Flags?: Record<FeatureFlagKey, boolean>;
}) {
  const role = props.role ?? "viewer";
  const v5Flags = useMemo(
    () => props.v5Flags ?? ({} as Record<FeatureFlagKey, boolean>),
    [props.v5Flags]
  );
  const [open, setOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const prevOpen = useRef(false);
  const [query, setQuery] = useState("");
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

  const items = useMemo(() => {
    const base = [...NAV_ITEMS, ...DEEP_LINK_COMMANDS];
    const filtered = base.filter(
      (item) => canAccessItem(item, role) && navItemVisible(item, v5Flags)
    );
    if (!query.trim()) return filtered;
    const q = query.trim().toLowerCase();
    return filtered.filter((item) =>
      `${item.name} ${item.description} ${item.href}`.toLowerCase().includes(q)
    );
  }, [query, role, v5Flags]);
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
        className={`fixed bottom-5 right-4 z-40 inline-flex min-h-10 min-w-10 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-surface/95 px-2.5 py-2 text-[11px] font-medium text-zinc-700 shadow-sm backdrop-blur hover:bg-zinc-50/90 sm:px-3 sm:text-xs ${
          footerVisible ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        aria-label="Open command palette"
      >
        <Command size={14} aria-hidden />
        <span className="text-zinc-900">Open</span>
        <span className="ui-kbd">K</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
        >
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setOpen(false)}
            aria-label="Close command palette overlay"
          />
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-surface shadow-2xl">
            <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
              <Search size={16} className="text-zinc-400" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                placeholder="Jump to queue, page, or report..."
              />
            </div>
            {!query && recentHrefs.length > 0 && (
              <div className="border-b border-zinc-100 px-4 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Recent
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {recentHrefs.map((href) => {
                    const match = NAV_ITEMS.find((item) => item.href === href);
                    if (!match) return null;
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => {
                          rememberCommand(match);
                          setOpen(false);
                        }}
                        className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100"
                      >
                        {match.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
            <ul className="max-h-[55vh] overflow-y-auto py-1">
              {flatItems.length === 0 ? (
                <li className="px-4 py-5 text-sm text-zinc-500">No matches found.</li>
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
                      <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
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
                                className={`block px-4 py-3 transition-colors ${
                                  active ? "bg-zinc-100" : "hover:bg-zinc-50"
                                }`}
                              >
                                <p className="text-sm font-semibold text-zinc-900">{item.name}</p>
                                <p className="mt-0.5 text-xs text-zinc-500">{item.description}</p>
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
          </div>
        </div>
      )}
    </>
  );
}
