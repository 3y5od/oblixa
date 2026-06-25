import type { CSSProperties } from "react";
import type { SidebarBadgeModel } from "../sidebar-model";

/* Nav count chip — tokenized status tones tuned for the porcelain margin (the
   page-content CountChip's light-surface anchors wouldn't read here, so the
   shared shape/typography is kept while the surface anchor differs). Review and
   approval queues read as "needs attention" (muted amber, thin border);
   obligations escalate to problem oxblood; everything else stays neutral. */
function navCountToneStyle(tone: SidebarBadgeModel["tone"]): CSSProperties {
  if (tone === "obligations") {
    return {
      color: "var(--sidebar-danger-ink)",
      background: "color-mix(in oklab, var(--sidebar-danger-ink) 13%, transparent)",
      borderColor: "color-mix(in oklab, var(--sidebar-danger-ink) 40%, transparent)",
    };
  }
  if (tone === "reviewQueue" || tone === "approvals") {
    return {
      color: "var(--sidebar-warn-ink)",
      background: "color-mix(in oklab, var(--sidebar-warn-ink) 13%, transparent)",
      borderColor: "color-mix(in oklab, var(--sidebar-warn-ink) 40%, transparent)",
    };
  }
  return {
    color: "color-mix(in oklab, var(--sidebar-fg) 80%, transparent)",
    background: "color-mix(in oklab, var(--sidebar-fg) 9%, transparent)",
    borderColor: "color-mix(in oklab, var(--sidebar-fg) 20%, transparent)",
  };
}

/* Object-type noun so the expanded chip is never a naked number (§19 / §34).
   The chip reads "1 review", "3 approvals" — the count's object type stays
   visible without hover. Collapsed rails fall back to the compact count, with
   the full meaning carried by the link's accessible name + tooltip. */
function navCountNoun(tone: SidebarBadgeModel["tone"], value: number): string {
  const base =
    tone === "reviewQueue"
      ? "review"
      : tone === "approvals"
        ? "approval"
        : tone === "obligations"
          ? "requirement"
          : "alert";
  return value === 1 ? base : `${base}s`;
}

export function SidebarBadge({ badge, collapsed }: { badge?: SidebarBadgeModel; collapsed: boolean }) {
  if (!badge) return null;
  const toneStyle = navCountToneStyle(badge.tone);
  if (collapsed) {
    // Collapsed rail: a compact count nudged past the tile's top-right corner so
    // it sits in the rail gutter, clear of the centered icon glyph. The 2px ring
    // against the sidebar keeps it legible where it overlaps nothing.
    // Decorative (aria-hidden) — the link keeps a terse accessible name; the full
    // count + label live in the tooltip/title.
    const single = badge.displayValue.length === 1;
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
  // Expanded: a labeled status chip ("1 review") so the count states its object
  // type. Sharp 4px edge to match the app's status-label language (§14).
  return (
    <span
      className="ml-auto inline-flex h-[1.15rem] shrink-0 items-center gap-1 rounded-[4px] border px-1.5 text-[10.5px] font-semibold leading-none"
      style={toneStyle}
      aria-label={badge.label}
      title={badge.label}
    >
      <span className="tabular-nums">{badge.displayValue}</span>
      <span className="font-medium tracking-tight">{navCountNoun(badge.tone, badge.value)}</span>
    </span>
  );
}
