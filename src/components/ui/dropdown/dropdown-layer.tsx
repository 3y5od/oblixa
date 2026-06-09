"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { DropdownPosition } from "./types";

/**
 * The one portaled, opaque, fixed-positioned surface for every dropdown.
 * Role-agnostic: the consumer's children carry the role (a `<ul role="listbox">`
 * via DropdownListbox, or `<div role="menu">` via DropdownMenu).
 *
 * Critical chrome is INLINE, never class-only — a see-through panel over a table
 * is a worse failure than an unstyled one (the PortaledPopover lesson). The
 * z-index is passed through verbatim so each migrated caller keeps its stacking
 * (z-30/50/60/70) against sticky headers and toolbars.
 */
export interface DropdownLayerProps {
  open: boolean;
  position: DropdownPosition | null;
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  /** Optional role applied to the surface itself (e.g. "dialog" for popovers).
   *  Menus/listboxes leave this unset and put their role on an inner element. */
  role?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  /** z-index utility, e.g. "z-50" / "z-[60]". */
  zIndexClassName?: string;
  /** Width utility applied to the surface (when not stretch-anchored). */
  widthClassName?: string;
  /** Padding/utility for the inner scroll region. */
  scrollClassName?: string;
  /** Render a bottom fade when the scroll region actually overflows. */
  bottomFade?: boolean;
  children: ReactNode;
}

export function DropdownLayer({
  open,
  position,
  surfaceRef,
  role,
  ariaLabel,
  ariaLabelledBy,
  zIndexClassName = "z-50",
  widthClassName = "",
  scrollClassName = "p-1.5",
  bottomFade = false,
  children,
}: DropdownLayerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [faded, setFaded] = useState(false);

  useEffect(() => {
    if (!open || !bottomFade) return;
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const overflowing = el.scrollHeight - el.clientHeight > 4;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
      setFaded(overflowing && !atBottom);
    };
    update();
    el.addEventListener("scroll", update);
    return () => el.removeEventListener("scroll", update);
  }, [open, bottomFade, children, position]);

  if (!open || !position || typeof document === "undefined") return null;

  const surfaceStyle: CSSProperties = {
    position: "fixed",
    left: position.left,
    right: position.right,
    width: position.width,
    minWidth: position.minWidth,
    overflow: "hidden",
    borderRadius: "0.75rem",
    border: "1px solid var(--border-strong)",
    background: "var(--surface-raised)",
    // Tight contact shadow over the ambient shadow-3 so the opaque surface reads
    // as clearly lifted above same-tone content directly beneath it.
    boxShadow:
      "0 2px 4px color-mix(in oklab, var(--text-primary) 16%, transparent), var(--shadow-3)",
    ...(position.placement === "up"
      ? { bottom: position.offset }
      : { top: position.offset }),
  };

  const surface = (
    <div
      ref={surfaceRef}
      role={role}
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={`${zIndexClassName} ${widthClassName}`}
      style={surfaceStyle}
    >
      <div
        ref={scrollRef}
        className={`overflow-auto overscroll-contain ${scrollClassName}`}
        style={{ maxHeight: position.maxHeight }}
      >
        {children}
      </div>
      {bottomFade ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-7 transition-opacity"
          style={{
            opacity: faded ? 1 : 0,
            background: "linear-gradient(to top, var(--surface-raised), transparent)",
          }}
        />
      ) : null}
    </div>
  );

  return createPortal(surface, document.body);
}
