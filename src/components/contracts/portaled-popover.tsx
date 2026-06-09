"use client";

import { type ReactNode } from "react";
import { DropdownLayer, useDropdownLayer } from "@/components/ui/dropdown";

interface PortaledPopoverProps {
  /** Inner content of the trigger button (icon + label + caret). May be
   *  server-rendered JSX passed down from a server component. */
  triggerContent: ReactNode;
  /** Class list for the trigger <button> (e.g. `ui-toolbar-dropdown`). */
  triggerClassName: string;
  /** Panel body (sections / links / forms). Server-rendered children are
   *  fine — they're rendered into the portal by this client component. */
  children: ReactNode;
  /** Accessible name shared by the trigger and the dialog panel. */
  ariaLabel: string;
  /** Horizontal anchor relative to the trigger. Left-aligned by default;
   *  right-aligned panels grow leftward from the trigger's right edge. */
  align?: "left" | "right";
  /** Tailwind width class for the panel. */
  widthClassName?: string;
  /** Tailwind classes for the inner scroll region. Defaults to `p-3`;
   *  pass `""`/`py-1` for menus whose rows carry their own padding. */
  scrollClassName?: string;
}

/**
 * Portaled `role="dialog"` popover for toolbar menus (Export / Filters / Saved
 * views). Now a thin skin over the shared overlay layer: `useDropdownLayer`
 * owns open-state + fixed positioning + outside-click/Escape/scroll dismissal,
 * and `DropdownLayer` owns the opaque portal surface + internal scroll + the
 * "more below" bottom fade. The public API is unchanged so `contracts/page.tsx`
 * stays untouched.
 *
 * A dialog (rich panels), not a menu, so it uses the hook + layer directly
 * rather than `DropdownMenu`. `maxHeight` is intentionally large so a tall panel
 * (Filters) fills the available viewport height and scrolls internally.
 */
export function PortaledPopover({
  triggerContent,
  triggerClassName,
  children,
  ariaLabel,
  align = "left",
  widthClassName = "w-[21rem]",
  scrollClassName = "p-3",
}: PortaledPopoverProps) {
  const layer = useDropdownLayer({
    role: "dialog",
    align: align === "right" ? "end" : "start",
    collide: false,
    // Fill the available viewport height; tall panels scroll internally.
    maxHeight: 9999,
    minHeight: 160,
    onViewportChange: "close",
  });

  return (
    <>
      <button
        {...layer.triggerProps}
        type="button"
        aria-label={ariaLabel}
        className={triggerClassName}
      >
        {triggerContent}
      </button>
      <DropdownLayer
        open={layer.open}
        position={layer.position}
        surfaceRef={layer.surfaceRef}
        role="dialog"
        ariaLabel={ariaLabel}
        zIndexClassName="z-[60]"
        widthClassName={`${widthClassName} max-w-[calc(100vw-1.5rem)]`}
        scrollClassName={scrollClassName}
        bottomFade
      >
        {children}
      </DropdownLayer>
    </>
  );
}
