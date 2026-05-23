"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRecentItems, type RecentItem } from "@/lib/recent-items";

export interface UiRecentItemsProps {
  kind: string;
  limit?: number;
  ariaLabel?: string;
  emptyLabel?: string;
}

interface RecentItemsState {
  items: RecentItem[];
  hydratedKey: string | null;
}

/**
 * Renders a compact "recent items" list from localStorage.
 * Hydrates client-side; renders nothing on the server (no SSR for client-only state).
 */
export function UiRecentItems({ kind, limit = 5, ariaLabel, emptyLabel }: UiRecentItemsProps) {
  const hydrationKey = `${kind}:${limit}`;
  const [state, setState] = useState<RecentItemsState>({
    items: [],
    hydratedKey: null,
  });

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      setState({
        items: getRecentItems(kind, limit),
        hydratedKey: hydrationKey,
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [hydrationKey, kind, limit]);

  if (state.hydratedKey !== hydrationKey) return null;
  if (state.items.length === 0) {
    return emptyLabel ? (
      <p className="px-3 py-1.5 text-[11px] text-[var(--text-tertiary)]">{emptyLabel}</p>
    ) : null;
  }

  return (
    <nav aria-label={ariaLabel ?? `Recent ${kind}`} className="space-y-0.5">
      {state.items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="ui-sidebar-link ui-sidebar-link-idle"
        >
          <span className="truncate text-[12.5px]">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
