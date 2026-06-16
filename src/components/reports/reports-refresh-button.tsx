"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";

/**
 * Re-runs the server render (and its queries) to recover stale/partial report
 * data in place. This is the Core-safe PRIMARY recovery for the partial-data
 * banner, shown to every user so a Core report warning never depends on leaving
 * Reports for the admin-only health page.
 *
 * Surfaces the full lifecycle the banner asks for:
 *  - loading  → "Refreshing…" + spinner, disabled, while the transition runs;
 *  - success  → a brief success-tinted "Refreshed" + check on the falling edge
 *               of the pending transition (the data has re-rendered in place);
 *  - failure  → a danger-tinted "Couldn’t refresh — retry" if the refresh throws
 *               synchronously (defensive; `router.refresh()` is otherwise
 *               fire-and-forget).
 */
export function ReportsRefreshButton({ label = "Refresh report" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<"idle" | "done" | "error">("idle");
  const wasPending = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // Flash a success state when the pending transition falls from true → false
  // (the refresh round-trip completed and the page re-rendered). State writes go
  // through timers, never synchronously in the effect body, so this stays a
  // deferred side-effect rather than a cascading-render setState-in-effect.
  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }
    if (!wasPending.current) return;
    wasPending.current = false;
    clearTimers();
    timers.current.push(setTimeout(() => setPhase("done"), 0));
    timers.current.push(setTimeout(() => setPhase("idle"), 2200));
  }, [pending]);

  useEffect(() => () => clearTimers(), []);

  const handleClick = () => {
    clearTimers();
    setPhase("idle");
    try {
      startTransition(() => router.refresh());
    } catch {
      setPhase("error");
    }
  };

  const view = pending
    ? { Icon: RefreshCw, text: "Refreshing…", spin: true, tint: undefined as string | undefined }
    : phase === "done"
      ? { Icon: Check, text: "Refreshed", spin: false, tint: "var(--success-ink)" }
      : phase === "error"
        ? { Icon: AlertTriangle, text: "Couldn’t refresh — retry", spin: false, tint: "var(--danger-ink)" }
        : { Icon: RefreshCw, text: label, spin: false, tint: undefined };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-live="polite"
      // Icon + text inherit `currentColor`, so a single tint on the button paints
      // both for the success/failure states.
      style={view.tint ? { color: view.tint } : undefined}
      className="ui-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <view.Icon
        className={`h-3.5 w-3.5 ${view.spin ? "animate-spin" : ""}`}
        strokeWidth={2}
        aria-hidden
      />
      {view.text}
    </button>
  );
}
