"use client";

import { useEffect, type ReactNode } from "react";
import { useDropdownLayer, type DropdownTriggerProps } from "./use-dropdown-layer";
import { DropdownLayer } from "./dropdown-layer";
import { moveRovingFocus } from "./dropdown-keyboard";
import type { DropdownAlign } from "./types";

/**
 * The shared `role="menu"` action-menu surface. Replaces the five hand-rolled
 * menus (AccountMenu, the contract/work row menus, RenewalRowActionsMenu) — each
 * was re-implementing portal + positioning + roving keyboard + dismissal.
 *
 * Renders ARBITRARY children as the menu body so callers keep full control of
 * their `[role="menuitem"]` links/buttons, including server-rendered forms (the
 * RenewalRowActionsMenu case). The host owns trigger chrome via `trigger`.
 */
export interface DropdownMenuProps {
  /** Render the trigger; spread the given props onto a `<button>`. */
  trigger: (props: DropdownTriggerProps) => ReactNode;
  /** Accessible name for the menu. */
  ariaLabel: string;
  /** Horizontal anchor — "end" for right-aligned row/account menus. */
  align?: DropdownAlign;
  /** z-index utility preserved per caller (e.g. "z-[60]"). */
  zIndexClassName?: string;
  widthClassName?: string;
  /** Flip up near the viewport bottom (row menus close to the fold). */
  collide?: boolean;
  /** Menuitems — caller-supplied `[role="menuitem"]` links/buttons. */
  children: ReactNode;
}

function isSubmitMenuItem(menuItem: HTMLElement) {
  if (!menuItem.closest("form")) return false;
  if (menuItem instanceof HTMLButtonElement) return menuItem.type === "submit";
  if (menuItem instanceof HTMLInputElement) {
    return menuItem.type === "submit" || menuItem.type === "image";
  }
  return false;
}

export function DropdownMenu({
  trigger,
  ariaLabel,
  align = "start",
  zIndexClassName = "z-50",
  widthClassName,
  collide = false,
  children,
}: DropdownMenuProps) {
  const layer = useDropdownLayer({
    role: "menu",
    align,
    collide,
    onViewportChange: "close",
  });
  const { open, surfaceRef, close } = layer;

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Home" ||
        e.key === "End"
      ) {
        if (moveRovingFocus(surfaceRef.current, e.key, '[role="menuitem"]:not([disabled])')) {
          e.preventDefault();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    const raf = requestAnimationFrame(() => {
      surfaceRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')
        ?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(raf);
    };
  }, [open, surfaceRef]);

  return (
    <>
      {trigger(layer.triggerProps)}
      <DropdownLayer
        open={open}
        position={layer.position}
        surfaceRef={surfaceRef}
        zIndexClassName={zIndexClassName}
        widthClassName={widthClassName}
      >
        <div
          role="menu"
          aria-orientation="vertical"
          aria-label={ariaLabel}
          className="flex flex-col gap-0.5"
          onClick={(e) => {
            // Submit-backed menuitems need to stay mounted until the browser
            // performs the form submit default action.
            const menuItem = (e.target as HTMLElement).closest<HTMLElement>('[role="menuitem"]');
            if (menuItem && !isSubmitMenuItem(menuItem)) close(true);
          }}
        >
          {children}
        </div>
      </DropdownLayer>
    </>
  );
}
