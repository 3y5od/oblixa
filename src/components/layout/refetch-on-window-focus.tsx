"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const MIN_INTERVAL_MS = 45_000;
const MIN_BACKGROUND_MS = 60_000;
const REFRESH_PREFIXES = [
  "/dashboard",
  "/contracts",
  "/work",
  "/reports",
  "/decisions",
  "/assurance",
  "/settings",
] as const;

function shouldRefreshPath(pathname: string): boolean {
  return REFRESH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isEditingElement(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  return element.matches("input, textarea, select");
}

/**
 * When the user returns to a backgrounded tab, gently reconcile server-rendered
 * data without dropping client-side form state (uses Next `router.refresh()` only).
 */
export function RefetchOnWindowFocus() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const lastRunRef = useRef(0);
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (document.visibilityState !== "visible") return;
      if (!shouldRefreshPath(pathname)) return;
      if (isEditingElement(document.activeElement)) return;
      const now = Date.now();
      const hiddenAt = hiddenAtRef.current;
      if (hiddenAt != null && now - hiddenAt < MIN_BACKGROUND_MS) return;
      if (now - lastRunRef.current < MIN_INTERVAL_MS) return;
      lastRunRef.current = now;
      router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pathname, router]);

  return null;
}
