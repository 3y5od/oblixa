"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createElement, useCallback, useEffect, useRef, type MutableRefObject, type ReactNode } from "react";
import { ArrowRight, CornerDownLeft } from "lucide-react";
import { resolveNavIcon } from "@/components/search/nav-icon";
import {
  matchOriginToken,
  paletteHrefKey,
  resultMetaLabel,
  type PaletteItem,
} from "@/components/layout/command-palette-helpers";
import { SEARCH_GROUP_LABELS } from "@/lib/navigation";

/** Result row used by the `/search` page and the cmd-K overlay.
 *  - Leading icon at a stable left edge for scan rhythm.
 *  - Highlighted matched substrings via `<mark>` (multi-token).
 *  - Left-rail tone on keyboard-active row, distinct from hover tint.
 *  - Trailing arrow appears only on hover or when active — keeps inactive
 *    rows visually quiet on dense lists.
 *  - `prefetch=false` by default; warmed on hover/focus.
 *  - `hidePath` strips the `/path` suffix in meta; `hideMeta` drops the line.
 *  - Synonym-match chip carries `aria-label="matched via synonym X"`.
 */

export interface ResultRowProps {
  item: PaletteItem;
  query?: string;
  isActive?: boolean;
  rowId?: string;
  /** Drop `/path` from the meta line. With `hideMeta` unset, the group label
   *  (e.g. "Tools") still renders so cross-group sections like Recent stay
   *  oriented. */
  hidePath?: boolean;
  /** Drop the meta line entirely. Use inside grouped bands where the band
   *  header already labels the group — repeating it on every row is pure
   *  redundancy. */
  hideMeta?: boolean;
  /** When true, render a small `Recent` dot/pill next to the row name. Used
   *  for single-recent folding: instead of a separate Recent band with one
   *  row, mark the row inside its native group. */
  isRecent?: boolean;
  refMap?: MutableRefObject<Map<string, HTMLElement>>;
  onSelect?: (href: string) => void;
}

export function highlightMatches(text: string, query: string | undefined): ReactNode {
  if (!query) return text;
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase());
  if (tokens.length === 0) return text;

  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const segments = text.split(re);
  return segments.map((seg, i) => {
    if (i % 2 === 1) {
      return (
        <mark
          key={i}
          className="rounded-sm bg-[color:color-mix(in_oklab,var(--accent-soft)_55%,transparent)] px-0.5 text-[var(--text-primary)]"
        >
          {seg}
        </mark>
      );
    }
    return <span key={i}>{seg}</span>;
  });
}

export function ResultRow({
  item,
  query,
  isActive = false,
  rowId,
  hidePath = false,
  hideMeta = false,
  isRecent = false,
  refMap,
  onSelect,
}: ResultRowProps) {
  const router = useRouter();
  const anchorRef = useRef<HTMLAnchorElement>(null);
  // `react-hooks/static-components` flags capitalized locals assigned from a
  // function call, even when the call is a pure value lookup. Render via
  // `createElement` so the rule sees an explicit dynamic-component render.
  const iconComponent = resolveNavIcon(item);
  const baseMeta = resultMetaLabel(item);
  // hidePath → keep just the group label; hideMeta → drop the line entirely.
  const meta = hidePath
    ? item.searchGroup
      ? SEARCH_GROUP_LABELS[item.searchGroup]
      : baseMeta.split(" · ")[0] ?? baseMeta
    : baseMeta;
  const showMeta = !hideMeta;
  const synonymHit = query ? matchOriginToken(item, query) : null;

  const handleClick = useCallback(() => {
    onSelect?.(paletteHrefKey(item.href));
  }, [item.href, onSelect]);

  // Warm-prefetch on hover/focus only.
  const handlePrefetch = useCallback(() => {
    try {
      router.prefetch(item.href);
    } catch {
      // ignore
    }
  }, [item.href, router]);

  // Register the anchor in the parent's ref map for scroll-into-view.
  useEffect(() => {
    if (!refMap || !rowId) return;
    const map = refMap.current;
    const node = anchorRef.current;
    if (!node) return;
    map.set(rowId, node);
    return () => {
      const current = map.get(rowId);
      if (current === node) map.delete(rowId);
    };
  }, [refMap, rowId]);

  // 2.5 px rail gives a slightly stronger keyboard-active signal than a
  // hairline 2 px without crowding the icon column. `pl-[13.5px]` shaves the
  // extra 0.5 px so the icon stays at its original left edge.
  const activeStripe = isActive
    ? "border-l-[2.5px] border-[var(--accent)] pl-[13.5px]"
    : "border-l-[2.5px] border-transparent";
  const activeBg = isActive
    ? "bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))]"
    : "";

  return (
    <Link
      ref={anchorRef}
      href={item.href}
      prefetch={false}
      role="option"
      id={rowId}
      aria-selected={isActive}
      onClick={handleClick}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      data-active={isActive ? "true" : undefined}
      className={`group flex min-h-[44px] cursor-pointer items-center gap-3 px-4 py-2 transition-colors visited:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_45%,transparent)] [-webkit-tap-highlight-color:transparent] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_12%,var(--surface-raised))] ${activeStripe} ${activeBg}`}
    >
      <span
        aria-hidden
        className={`inline-flex w-5 shrink-0 justify-center motion-safe:transition-colors ${
          isActive
            ? "text-[var(--accent-strong)]"
            : "text-[var(--text-secondary)] group-hover:text-[var(--accent-strong)]"
        }`}
      >
        {createElement(iconComponent, { className: "h-4 w-4", strokeWidth: 1.85 })}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text-primary)]">
          <span>{highlightMatches(item.name, query)}</span>
          {isRecent ? (
            <span
              aria-label="Recently visited"
              className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]"
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              <span aria-hidden>Recent</span>
            </span>
          ) : null}
          {synonymHit ? (
            <span
              className="inline-block rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-[var(--text-tertiary)]"
              aria-label={`matched via synonym ${synonymHit.token}`}
            >
              <span aria-hidden>via &ldquo;{synonymHit.token}&rdquo;</span>
            </span>
          ) : null}
        </span>
        {item.description ? (
          <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--text-secondary)]">
            {highlightMatches(item.description, query)}
          </span>
        ) : null}
        {showMeta ? (
          <span className="mt-0.5 block truncate text-[11px] text-[var(--text-tertiary)]">
            {meta}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {isActive ? (
          // When the row is keyboard-active, the kbd picks up an accent-tint
          // so it visually belongs to the row's selection state (the default
          // `ui-kbd` gray reads as muted against the accent-soft row bg).
          <kbd
            className="ui-kbd hidden min-w-[1.6rem] sm:inline-flex"
            aria-label="Press Enter to open"
            style={{
              background: "color-mix(in oklab, var(--accent-soft) 65%, var(--surface))",
              color: "var(--accent-strong)",
              borderColor: "color-mix(in oklab, var(--accent) 35%, transparent)",
            }}
          >
            <CornerDownLeft aria-hidden className="h-3 w-3" strokeWidth={2} />
          </kbd>
        ) : null}
        {/* Arrow appears only on hover or active row. Keeps inactive rows
            visually quiet on dense lists. */}
        <ArrowRight
          className={`h-4 w-4 motion-safe:transition-[opacity,transform] motion-safe:group-hover:translate-x-0.5 ${
            isActive
              ? "text-[var(--accent-strong)] opacity-100"
              : "text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          }`}
          strokeWidth={1.85}
          aria-hidden
        />
      </span>
    </Link>
  );
}
