"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { sendJsonKeepalive } from "@/lib/http/client-json";

const MEASURED_PREFIXES = [
  "/dashboard",
  "/contracts",
  "/work",
  "/reports",
  "/decisions",
  "/assurance",
  "/accounts",
  "/campaigns",
  "/counterparties",
  "/more",
  "/relationship-workspaces",
  "/settings",
  "/onboarding/calibration",
] as const;

function isMeasuredPath(path: string): boolean {
  for (const p of MEASURED_PREFIXES) {
    if (path === p || path.startsWith(`${p}/`)) return true;
  }
  return false;
}

function sendPageLoadMeasuredTelemetry(input: { path: string; durationMs: number }) {
  const body = JSON.stringify(input);
  sendJsonKeepalive("/api/product-telemetry/page-load", body);
}

/**
 * §23.2 / §28.2 — post-paint navigation timing (rate-limited server-side per user+IP).
 * Per-path client debounce avoids StrictMode double fire and navigation churn noise.
 */
export function V9PageLoadReporter() {
  const path = usePathname() ?? "";
  const rafRef = useRef<number | null>(null);
  const lastEmit = useRef<{ path: string; at: number } | null>(null);

  useEffect(() => {
    if (!path || !isMeasuredPath(path)) return;
    const now = Date.now();
    const prev = lastEmit.current;
    if (prev && prev.path === path && now - prev.at < 8000) return;

    const t0 = typeof performance !== "undefined" ? performance.now() : now;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
        lastEmit.current = { path, at: Date.now() };
        sendPageLoadMeasuredTelemetry({ path, durationMs: t1 - t0 });
      });
    });
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [path]);

  return null;
}
