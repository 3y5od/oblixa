"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

/** Floating label shown beside a collapsed-rail icon on hover/focus. Portaled to
 *  the body with fixed positioning so it escapes the rail's overflow clip and is
 *  never hidden behind the topbar; the vertical position is clamped to the
 *  viewport. Content-surface styling (not the dark sidebar) so it reads as an
 *  overlay. Decorative (aria-hidden) — the link's aria-label carries the name. */
export function CollapsedTooltip({
  id,
  label,
  anchorRef,
}: {
  id: string;
  label: string;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    const top = Math.min(Math.max(8, r.top + r.height / 2), window.innerHeight - 8);
    setPos({ top, left: r.right + 8 });
  }, [anchorRef, label]);

  if (!pos || typeof document === "undefined") return null;
  return createPortal(
    <span
      id={id}
      aria-hidden="true"
      style={{ position: "fixed", top: pos.top, left: pos.left, transform: "translateY(-50%)", maxWidth: "var(--shell-tooltip-w)" }}
      className="pointer-events-none z-[70] truncate whitespace-nowrap rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] shadow-[var(--shadow-2)]"
    >
      {label}
    </span>,
    document.body
  );
}
