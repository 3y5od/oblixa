"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DropdownAlign, DropdownPosition, DropdownRole } from "./types";

/**
 * The single overlay engine for every portaled dropdown surface (listbox, menu,
 * dialog). Owns open-state, fixed-position geometry, viewport tracking, outside-
 * click, and Escape/Tab dismissal — the logic that was hand-rolled seven times
 * across UiSelect / PortaledPopover / AccountMenu / the row menus / RoleDropdown.
 *
 * It renders nothing. Pair it with <DropdownLayer> for the surface and either
 * <DropdownListbox> (options) or <DropdownMenu> (menuitems) for the body.
 *
 * Positioning mirrors the proven UiSelect rule (collision flip when the menu
 * would overflow below the fold and there is more room above) so migrated
 * callers keep identical behaviour.
 */
export interface UseDropdownLayerOptions {
  role: DropdownRole;
  /** Horizontal anchor. Defaults: listbox→stretch, menu/dialog→start. */
  align?: DropdownAlign;
  /** Gap (px) between trigger and surface. */
  gap?: number;
  /** Viewport breathing room (px). */
  margin?: number;
  maxHeight?: number;
  minHeight?: number;
  /** Flip up when the surface would overflow below and there is more room above. */
  collide?: boolean;
  /**
   * On scroll/resize while open: `reposition` follows the trigger (UiSelect's
   * deliberate choice for in-flow selects); `close` dismisses (menus/popovers).
   */
  onViewportChange?: "reposition" | "close";
  /** Return focus to the trigger when closed via Escape/programmatic close. */
  returnFocusOnClose?: boolean;
}

export interface DropdownTriggerProps {
  ref: React.RefObject<HTMLButtonElement | null>;
  "aria-haspopup": DropdownRole;
  "aria-expanded": boolean;
  onClick: () => void;
}

export interface UseDropdownLayerResult {
  open: boolean;
  setOpen: (open: boolean) => void;
  close: (restoreFocus?: boolean) => void;
  toggle: () => void;
  position: DropdownPosition | null;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  reposition: () => void;
  /** Spread onto a <button> trigger (bespoke triggers included). */
  triggerProps: DropdownTriggerProps;
}

const DEFAULT_ALIGN: Record<DropdownRole, DropdownAlign> = {
  listbox: "stretch",
  menu: "start",
  dialog: "start",
};

export function useDropdownLayer(
  options: UseDropdownLayerOptions,
): UseDropdownLayerResult {
  const {
    role,
    align = DEFAULT_ALIGN[role],
    gap = 6,
    margin = 8,
    maxHeight = 264,
    minHeight = 140,
    collide = true,
    onViewportChange = "close",
    returnFocusOnClose = true,
  } = options;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  const [open, setOpenState] = useState(false);
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  openRef.current = open;

  const computePosition = useCallback((): DropdownPosition | null => {
    const el = triggerRef.current;
    if (!el || typeof window === "undefined") return null;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - margin;
    const spaceAbove = r.top - margin;
    const up = collide && spaceBelow < maxHeight && spaceAbove > spaceBelow;
    const available = up ? spaceAbove : spaceBelow;
    const horizontal =
      align === "stretch"
        ? { left: r.left, width: r.width }
        : align === "end"
          ? // Right-aligned menus size to content (or an explicit width class);
            // anchoring minWidth to a tiny row trigger would be useless.
            { right: Math.max(margin, window.innerWidth - r.right) }
          : { left: r.left, minWidth: r.width };
    return {
      ...horizontal,
      placement: up ? "up" : "down",
      offset: up ? window.innerHeight - r.top + gap : r.bottom + gap,
      maxHeight: Math.max(minHeight, Math.min(maxHeight, available)),
    };
  }, [align, collide, gap, margin, maxHeight, minHeight]);

  const reposition = useCallback(() => {
    setPosition(computePosition());
  }, [computePosition]);

  const close = useCallback(
    (restoreFocus: boolean = returnFocusOnClose) => {
      setOpenState(false);
      if (restoreFocus) triggerRef.current?.focus();
    },
    [returnFocusOnClose],
  );

  const setOpen = useCallback(
    (next: boolean) => {
      // Measure synchronously before opening so the portal never paints at (0,0).
      if (next) setPosition(computePosition());
      setOpenState(next);
    },
    [computePosition],
  );

  const toggle = useCallback(() => {
    setOpen(!openRef.current);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node;
      // Exclude both trigger and surface so a (portaled) option click does not
      // dismiss the menu on mousedown before its own click handler fires.
      if (triggerRef.current?.contains(t)) return;
      if (surfaceRef.current?.contains(t)) return;
      close(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(true);
      } else if (e.key === "Tab") {
        // Let focus proceed naturally, but close the surface.
        close(false);
      }
    }
    function onViewport() {
      if (onViewportChange === "reposition") {
        setPosition(computePosition());
      } else {
        // Return focus only when it was inside the surface (keyboard users),
        // never on an incidental trackpad/inertia scroll past a focused trigger.
        const inside = Boolean(surfaceRef.current?.contains(document.activeElement));
        close(inside);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onViewport, true);
    window.addEventListener("resize", onViewport);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onViewport, true);
      window.removeEventListener("resize", onViewport);
    };
  }, [open, onViewportChange, computePosition, close]);

  const triggerProps: DropdownTriggerProps = {
    ref: triggerRef,
    "aria-haspopup": role,
    "aria-expanded": open,
    onClick: toggle,
  };

  return {
    open,
    setOpen,
    close,
    toggle,
    position,
    triggerRef,
    surfaceRef,
    reposition,
    triggerProps,
  };
}
