"use client";

import { useEffect } from "react";

/**
 * Subtle cursor-following accent halo. Tracks mouse position and updates two
 * CSS variables (--cursor-x, --cursor-y) on the document root. The dashboard
 * layout uses these variables to position a low-opacity radial gradient.
 *
 * Throttled to ~30fps via requestAnimationFrame. Disables when the user
 * prefers reduced motion or is on a coarse pointer (touch).
 */
export function CursorGlow() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia?.("(pointer: coarse)").matches
    ) {
      return;
    }

    const root = document.documentElement;
    root.dataset.cursorGlow = "1";

    let pending = false;
    let lastX = 0;
    let lastY = 0;

    function onMove(e: MouseEvent): void {
      lastX = e.clientX;
      lastY = e.clientY;
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        root.style.setProperty("--cursor-x", `${lastX}px`);
        root.style.setProperty("--cursor-y", `${lastY}px`);
        pending = false;
      });
    }

    function onLeave(): void {
      root.style.setProperty("--cursor-x", "-1000px");
      root.style.setProperty("--cursor-y", "-1000px");
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      delete root.dataset.cursorGlow;
      root.style.removeProperty("--cursor-x");
      root.style.removeProperty("--cursor-y");
    };
  }, []);

  return null;
}
