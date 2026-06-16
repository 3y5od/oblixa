"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import type { SidebarItemModel } from "../sidebar-model";
import { iconByKey } from "./sidebar-icons";
import { SidebarBadge } from "./sidebar-badge";
import { CollapsedTooltip } from "./collapsed-tooltip";

export function SidebarNavItem({
  item,
  collapsed,
  child = false,
  onNavigate,
  tooltipHref,
  setTooltipHref,
}: {
  item: SidebarItemModel;
  collapsed: boolean;
  child?: boolean;
  onNavigate: () => void;
  tooltipHref: string | null;
  setTooltipHref: (href: string | null) => void;
}) {
  const Icon = item.icon ? iconByKey[item.icon] : null;
  const tooltipId = `sidebar-tooltip-${item.href.replace(/[^a-z0-9]+/gi, "-")}`;
  const tooltipVisible = collapsed && tooltipHref === item.href;
  // Three distinct top-level states: a "selected" leaf (accent rail + wash +
  // accent icon), a "parent-expanded" section header (brighter text + chevron,
  // no accent — the accent belongs to the selected child), and idle.
  const isParentExpanded = !child && !collapsed && item.children.length > 0;
  const selected = !child && item.active && !isParentExpanded;
  // Collapsed-rail tooltip timing: a short hover delay so sweeping the rail
  // doesn't flash every label, but immediate on keyboard focus.
  const tooltipTimer = useRef<number | null>(null);
  const clearTooltip = useCallback(() => {
    if (tooltipTimer.current != null) window.clearTimeout(tooltipTimer.current);
    tooltipTimer.current = null;
    setTooltipHref(null);
  }, [setTooltipHref]);
  const showTooltipAfterDelay = useCallback(() => {
    if (tooltipTimer.current != null) window.clearTimeout(tooltipTimer.current);
    tooltipTimer.current = window.setTimeout(() => setTooltipHref(item.href), 350);
  }, [item.href, setTooltipHref]);
  useEffect(
    () => () => {
      if (tooltipTimer.current != null) window.clearTimeout(tooltipTimer.current);
    },
    []
  );
  const linkRef = useRef<HTMLAnchorElement>(null);
  const childClass = child
    ? `ui-sidebar-sublink-indent text-[12.5px] ${
        item.active ? "ui-sidebar-sublink-active" : "ui-sidebar-sublink-idle"
      }`
    : collapsed
      ? item.active
        ? "ui-sidebar-link-active-rail"
        : "ui-sidebar-link-idle"
      : isParentExpanded
        ? "ui-sidebar-link-parent"
        : item.active
          ? "ui-sidebar-link-active"
          : "ui-sidebar-link-idle";

  return (
    <Link
      ref={linkRef}
      href={item.href}
      prefetch={item.prefetch}
      onClick={onNavigate}
      onFocus={() => collapsed && setTooltipHref(item.href)}
      onBlur={() => collapsed && clearTooltip()}
      onMouseEnter={() => collapsed && showTooltipAfterDelay()}
      onMouseLeave={() => collapsed && clearTooltip()}
      className={`ui-sidebar-link ${
        collapsed && !child
          ? "mx-auto h-[var(--shell-collapsed-slot)] w-[var(--shell-collapsed-slot)] justify-center px-0"
          : ""
      } ${childClass}`}
      aria-current={item.exactActive ? "page" : undefined}
      aria-label={collapsed ? item.collapsedLabel : undefined}
      aria-describedby={tooltipVisible ? tooltipId : undefined}
      data-sidebar-href={item.href}
    >
      {Icon ? (
        // Icon inherits the link's currentColor (muted when idle, sidebar-fg on
        // a parent header) so glyph and label never drift apart; the selected
        // leaf is the one place the icon takes the accent.
        <Icon
          size={16}
          strokeWidth={1.75}
          className="shrink-0"
          style={{
            color: selected
              ? "var(--accent-strong)"
              : isParentExpanded
                ? undefined
                : "var(--sidebar-icon-idle)",
          }}
          aria-hidden
        />
      ) : child ? null : (
        /* Top-level row without icon → render an empty-ring marker, not a
           filled gray dot. The empty ring communicates "indeterminate /
           leaf" rather than implying a status signal. */
        <span
          aria-hidden
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            item.active
              ? "bg-[var(--sidebar-fg)]"
              : "border border-[color:color-mix(in_oklab,var(--sidebar-fg)_35%,transparent)] bg-transparent"
          }`}
        />
      )}
      {collapsed && <SidebarBadge badge={item.badge} collapsed />}
      {!collapsed && <span className="ui-nowrap-safe min-w-0 flex-1">{item.name}</span>}
      {!collapsed && isParentExpanded ? (
        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[var(--sidebar-muted)]" strokeWidth={2} aria-hidden />
      ) : !collapsed ? (
        <SidebarBadge badge={item.badge} collapsed={false} />
      ) : null}
      {tooltipVisible ? (
        <CollapsedTooltip id={tooltipId} label={item.collapsedLabel} anchorRef={linkRef} />
      ) : null}
    </Link>
  );
}
