"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
 * Portaled popover panel for toolbar menus (Export / Filters / Saved views).
 *
 * Why a portal instead of the previous `<details>` + absolute `.ui-popover`:
 * - The panel renders to `document.body` with `position: fixed`, so it can
 *   never be clipped by an ancestor's `overflow` and never widens the page.
 * - `max-height` is computed from the trigger's viewport position, so a tall
 *   panel (Filters) is capped to the visible area and scrolls internally
 *   rather than running off-screen.
 * - A bottom fade appears only while the body is scrollable and not at the
 *   bottom — a real "more below" affordance.
 * - Closes on outside-click, Escape (focus returns to the trigger), and on
 *   scroll/resize (since fixed coords don't track the trigger).
 *
 * One component for all three toolbar menus → consistent chrome + behavior.
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
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{
    top: number;
    left?: number;
    right?: number;
    maxHeight: number;
  } | null>(null);
  const [fade, setFade] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const gap = 6;
      const margin = 12;
      const top = r.bottom + gap;
      const maxHeight = Math.max(160, window.innerHeight - top - margin);
      setBox(
        align === "right"
          ? {
              top,
              right: Math.max(margin, window.innerWidth - r.right),
              maxHeight,
            }
          : {
              top,
              left: Math.max(margin, Math.min(r.left, window.innerWidth - margin)),
              maxHeight,
            }
      );
    };
    place();
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t))
        return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    // capture=true also catches scrolls inside nested scroll containers.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, align]);

  // Show the bottom fade only while the body overflows AND isn't scrolled to
  // the end — so it reads as a genuine "more content below" cue.
  useEffect(() => {
    if (!open || !box) return;
    const el = scrollRef.current;
    if (!el) return;
    const update = () =>
      setFade(
        el.scrollHeight - el.clientHeight > 4 &&
          el.scrollTop + el.clientHeight < el.scrollHeight - 4
      );
    update();
    el.addEventListener("scroll", update);
    return () => el.removeEventListener("scroll", update);
  }, [open, box]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {triggerContent}
      </button>
      {open && box
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={ariaLabel}
              // Critical panel chrome is set inline (not via a freshly-added
              // CSS class) so the surface is guaranteed opaque + bordered even
              // if those component classes fail to emit/HMR — a see-through
              // panel (table bleeding through) is a far worse failure than a
              // plain one. Width/padding stay as standard utility classes,
              // which are always emitted.
              style={{
                position: "fixed",
                top: box.top,
                left: box.left,
                right: box.right,
                maxHeight: box.maxHeight,
                maxWidth: "calc(100vw - 1.5rem)",
                zIndex: 60,
                overflow: "hidden",
                borderRadius: "var(--radius-2xl)",
                border: "1px solid var(--border-card)",
                background: "var(--surface-raised)",
                boxShadow: "var(--shadow-2)",
              }}
              className={widthClassName}
            >
              <div
                ref={scrollRef}
                className={scrollClassName}
                style={{ overflowY: "auto", maxHeight: box.maxHeight }}
              >
                {children}
              </div>
              <span
                aria-hidden
                style={{
                  pointerEvents: "none",
                  position: "absolute",
                  insetInline: 0,
                  bottom: 0,
                  height: "1.75rem",
                  background:
                    "linear-gradient(to top, var(--surface-raised), transparent)",
                  opacity: fade ? 1 : 0,
                  transition:
                    "opacity var(--ui-duration, 150ms) var(--ui-ease-out, ease)",
                }}
              />
            </div>,
            document.body
          )
        : null}
    </>
  );
}
