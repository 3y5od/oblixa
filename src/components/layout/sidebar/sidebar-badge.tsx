import type { CSSProperties } from "react";
import type { SidebarBadgeModel } from "../sidebar-model";

/* Nav count chip — tokenized status tones tuned for the always-dark sidebar
   (the page-content CountChip's light-surface anchors wouldn't read here, so the
   shared shape/typography is kept while the surface anchor differs). Review and
   approval queues read as "needs attention" (warning); obligations escalate to
   danger; everything else stays neutral. */
function navCountToneStyle(tone: SidebarBadgeModel["tone"]): CSSProperties {
  if (tone === "obligations") {
    return {
      color: "var(--sidebar-danger-ink)",
      background: "color-mix(in oklab, var(--sidebar-danger-ink) 15%, transparent)",
      borderColor: "color-mix(in oklab, var(--sidebar-danger-ink) 42%, transparent)",
    };
  }
  if (tone === "reviewQueue" || tone === "approvals") {
    return {
      color: "var(--sidebar-warn-ink)",
      background: "color-mix(in oklab, var(--sidebar-warn-ink) 14%, transparent)",
      borderColor: "color-mix(in oklab, var(--sidebar-warn-ink) 42%, transparent)",
    };
  }
  return {
    color: "color-mix(in oklab, var(--sidebar-fg) 80%, transparent)",
    background: "color-mix(in oklab, var(--sidebar-fg) 10%, transparent)",
    borderColor: "color-mix(in oklab, var(--sidebar-fg) 22%, transparent)",
  };
}

export function SidebarBadge({ badge, collapsed }: { badge?: SidebarBadgeModel; collapsed: boolean }) {
  if (!badge) return null;
  const toneStyle = navCountToneStyle(badge.tone);
  // One geometry rule across states: a circle for single digits, a capsule for
  // two-or-more so "99+" never gets squeezed into a circle.
  const single = badge.displayValue.length === 1;
  if (collapsed) {
    // Collapsed rail: a compact count nudged past the tile's top-right corner so
    // it sits in the rail gutter, clear of the centered icon glyph. The 2px ring
    // against the sidebar keeps it legible where it overlaps nothing.
    // Decorative (aria-hidden) — the link keeps a terse accessible name; the full
    // count + label live in the tooltip/title.
    return (
      <span
        aria-hidden="true"
        title={badge.label}
        style={toneStyle}
        className={`absolute -right-1 -top-1 inline-flex h-[1.05rem] items-center justify-center rounded-full border text-[9px] font-semibold leading-none tabular-nums ring-2 ring-[var(--sidebar)] ${
          single ? "w-[1.05rem]" : "min-w-[1.05rem] px-1"
        }`}
      >
        {badge.displayValue}
      </span>
    );
  }
  return (
    <span
      className={`ml-auto inline-flex h-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold leading-none tabular-nums ${
        single ? "w-5" : "min-w-[1.5rem] px-1.5"
      }`}
      style={toneStyle}
      aria-label={badge.label}
      title={badge.label}
    >
      {badge.displayValue}
    </span>
  );
}
