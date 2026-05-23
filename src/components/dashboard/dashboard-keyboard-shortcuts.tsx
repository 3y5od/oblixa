"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Global keyboard shortcuts for the dashboard surface.
 *
 * Bindings:
 *   u       → /contracts/new
 *   /       → focus search pill
 *   r       → router.refresh()
 *   g d     → /dashboard
 *   g c     → /contracts
 *   ?       → open shortcut help overlay (Esc to close)
 *
 * Disabled while typing in inputs/textareas/contenteditable.
 */
export function DashboardKeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const gPendingRef = useRef<number | null>(null);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      return false;
    }

    function clearGPending(): void {
      if (gPendingRef.current != null) {
        window.clearTimeout(gPendingRef.current);
        gPendingRef.current = null;
      }
    }

    function focusSearch(): void {
      const el =
        document.querySelector<HTMLInputElement>(
          'input[type="search"], [data-dashboard-search] input, input[placeholder*="Search" i]'
        );
      if (el) {
        el.focus();
        el.select?.();
      }
    }

    function onKeyDown(e: KeyboardEvent): void {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape" && helpOpen) {
        setHelpOpen(false);
        return;
      }
      if (isTypingTarget(e.target)) return;

      // g-prefixed navigation
      if (gPendingRef.current != null) {
        if (e.key === "d") {
          clearGPending();
          e.preventDefault();
          router.push("/dashboard");
          return;
        }
        if (e.key === "c") {
          clearGPending();
          e.preventDefault();
          router.push("/contracts");
          return;
        }
        clearGPending();
      }

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        focusSearch();
        return;
      }
      if (e.key === "u") {
        e.preventDefault();
        router.push("/contracts/new");
        return;
      }
      if (e.key === "r") {
        e.preventDefault();
        router.refresh();
        return;
      }
      if (e.key === "g") {
        e.preventDefault();
        gPendingRef.current = window.setTimeout(clearGPending, 800);
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearGPending();
    };
  }, [router, helpOpen]);

  if (!helpOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[color:color-mix(in_oklab,black_42%,transparent)] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) setHelpOpen(false);
      }}
    >
      <div className="ui-card-raised w-full max-w-md space-y-4 rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-2)]">
        <header className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            className="ui-link text-[12px]"
            onClick={() => setHelpOpen(false)}
          >
            Close (Esc)
          </button>
        </header>
        <dl className="grid grid-cols-1 gap-y-2 text-[12.5px]">
          {[
            { keys: ["u"], desc: "Upload a new contract" },
            { keys: ["/"], desc: "Focus search" },
            { keys: ["r"], desc: "Refresh dashboard data" },
            { keys: ["g", "d"], desc: "Go to dashboard" },
            { keys: ["g", "c"], desc: "Go to contracts" },
            { keys: ["?"], desc: "Toggle this help overlay" },
          ].map((row) => (
            <div
              key={row.desc}
              className="flex items-center justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] py-1.5 last:border-b-0"
            >
              <span className="text-[var(--text-secondary)]">{row.desc}</span>
              <span className="inline-flex items-center gap-1">
                {row.keys.map((k, i) => (
                  <kbd
                    key={i}
                    className="inline-flex min-w-[1.5rem] items-center justify-center rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-mono font-semibold text-[var(--text-primary)]"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
