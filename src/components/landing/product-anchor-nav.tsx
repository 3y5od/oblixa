"use client";

import { useEffect, useRef, useState } from "react";
import { PRODUCT_SECTIONS } from "@/components/landing/product-sections-data";

/**
 * Sticky scroll-spy chip strip for /product.
 *
 * v6 additions:
 * - T26.1 Hash-init: read window.location.hash synchronously for initial active id
 *   so deep-linking to /product#evidence doesn't flicker through "replace"
 * - T6.1 Segmented progress bar (7 segments, one per section)
 * - T25.1 Live region announcing "Now reading: <section eyebrow>"
 * - T25.7 history.replaceState on scroll-spy section change for shareable URLs
 * - T6.5 Keyboard arrow key navigation (← / → moves between chips)
 * - T6.6 Phase boundary visual dividers in the chip strip
 *
 * All hover affordances behind @media (pointer: fine) so iOS doesn't sticky-fire.
 */
function readInitialActiveIdFromHash(): string {
  if (typeof window === "undefined") return PRODUCT_SECTIONS[0].id;
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return PRODUCT_SECTIONS[0].id;
  return PRODUCT_SECTIONS.some((s) => s.id === raw) ? raw : PRODUCT_SECTIONS[0].id;
}

export function ProductAnchorNav() {
  const [activeId, setActiveId] = useState<string>(() => readInitialActiveIdFromHash());
  const ratiosRef = useRef<Map<string, number>>(new Map());
  const lastReportedRef = useRef<string>("");
  const suspendHashUpdateRef = useRef<boolean>(false);
  const hashResetTimerRef = useRef<number | null>(null);
  const navRef = useRef<HTMLUListElement | null>(null);

  // v6 T26.1 — also re-sync if the hash changes via History API
  useEffect(() => {
    function onHashChange() {
      const raw = window.location.hash.replace(/^#/, "");
      if (raw && PRODUCT_SECTIONS.some((s) => s.id === raw)) {
        suspendHashUpdateRef.current = true;
        setActiveId(raw);
        if (hashResetTimerRef.current != null) {
          window.clearTimeout(hashResetTimerRef.current);
        }
        hashResetTimerRef.current = window.setTimeout(() => {
          suspendHashUpdateRef.current = false;
          hashResetTimerRef.current = null;
        }, 800);
      }
    }
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      if (hashResetTimerRef.current != null) {
        window.clearTimeout(hashResetTimerRef.current);
        hashResetTimerRef.current = null;
      }
    };
  }, []);

  // IntersectionObserver scroll-spy
  useEffect(() => {
    const sections = PRODUCT_SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (n): n is HTMLElement => n != null
    );
    if (sections.length === 0) return;

    const ratios = ratiosRef.current;
    sections.forEach((s) => ratios.set(s.id, 0));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          ratios.set(e.target.id, e.intersectionRatio);
        }
        let bestId = PRODUCT_SECTIONS[0].id;
        let bestRatio = -1;
        for (const [id, r] of ratios.entries()) {
          if (r > bestRatio) {
            bestRatio = r;
            bestId = id;
          }
        }
        if (bestRatio > 0) {
          setActiveId(bestId);
          // T25.7 — update URL hash on scroll-spy (replaceState, not pushState)
          if (!suspendHashUpdateRef.current && typeof window !== "undefined") {
            const desired = `#${bestId}`;
            if (window.location.hash !== desired) {
              window.history.replaceState({}, "", desired);
            }
          }
        }
      },
      {
        rootMargin: "-40% 0px -40% 0px",
        threshold: [0, 0.2, 0.5, 0.8, 1],
      }
    );

    for (const s of sections) observer.observe(s);
    return () => observer.disconnect();
  }, []);

  // T25.1 — Live region message text (throttled via lastReported)
  useEffect(() => {
    if (lastReportedRef.current === activeId) return;
    lastReportedRef.current = activeId;
  }, [activeId]);

  const currentIdx = PRODUCT_SECTIONS.findIndex((s) => s.id === activeId);
  const progress = Math.max(
    1,
    Math.min(PRODUCT_SECTIONS.length, currentIdx + 1)
  );
  const activeSection = PRODUCT_SECTIONS[currentIdx];

  // T6.5 — Keyboard arrow navigation inside the nav
  function onKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const items = Array.from(
      navRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-anchor-chip]") ?? []
    );
    if (items.length === 0) return;
    const currentFocusIdx = items.findIndex((el) => el === document.activeElement);
    if (currentFocusIdx === -1) return;
    e.preventDefault();
    const nextIdx =
      e.key === "ArrowLeft"
        ? Math.max(0, currentFocusIdx - 1)
        : Math.min(items.length - 1, currentFocusIdx + 1);
    items[nextIdx].focus();
  }

  return (
    <nav
      aria-label="Product sections"
      className="sticky top-[72px] z-10 -mx-2 mt-6 px-2"
      style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
    >
      <div className="product-anchor-nav-surface rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_88%,transparent)] backdrop-blur-md">
        {/* T6.1 — Segmented progress bar (7 segments) */}
        <div
          aria-hidden
          className="flex h-[3px] w-full gap-px overflow-hidden rounded-t-2xl bg-[color:color-mix(in_oklab,var(--border-subtle)_40%,transparent)]"
        >
          {PRODUCT_SECTIONS.map((s, idx) => (
            <span
              key={s.id}
              className="flex-1 transition-[background-color] duration-200 ease-out motion-reduce:transition-none"
              style={{
                background:
                  idx <= currentIdx
                    ? "var(--accent-strong)"
                    : "transparent",
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto px-2 py-2 sm:px-3">
          <ul
            ref={navRef}
            onKeyDown={onKeyDown}
            className="flex min-w-max items-center gap-1.5"
          >
            {PRODUCT_SECTIONS.map((s, idx) => {
              const isActive = s.id === activeId;
              // T6.6 — phase boundary divider after sections 02 and 05
              const showPhaseDivider = idx === 2 || idx === 5;
              return (
                <li key={s.id} className="flex items-center gap-1.5">
                  {showPhaseDivider ? (
                    <span
                      aria-hidden
                      className="inline-block h-3 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]"
                    />
                  ) : null}
                  <a
                    href={`#${s.id}`}
                    data-anchor-chip
                    aria-current={isActive ? "true" : undefined}
                    className={
                      "product-anchor-chip inline-flex min-w-[2.5rem] items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors motion-reduce:transition-none " +
                      (isActive
                        ? "border-[color:color-mix(in_oklab,var(--accent-strong)_38%,var(--border-strong))] bg-[color:color-mix(in_oklab,var(--accent-soft)_50%,var(--surface-raised))] text-[var(--accent-strong)]"
                        : "border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-strong))] hover:text-[var(--text-primary)]")
                    }
                  >
                    <span
                      className={
                        "text-[10px] font-bold tabular-nums tracking-[0.16em] " +
                        (isActive ? "text-[var(--accent-strong)]" : "text-[var(--text-tertiary)]")
                      }
                    >
                      {s.number}
                    </span>
                    {s.eyebrow}
                  </a>
                </li>
              );
            })}
          </ul>
          {/* v7 T27.24 — counter hidden below md to prevent overflow on narrow viewports.
              The segmented progress bar already conveys position. */}
          <span
            aria-hidden
            className="ml-auto hidden shrink-0 whitespace-nowrap px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-tertiary)] md:inline-flex"
          >
            Section {progress} of {PRODUCT_SECTIONS.length}
          </span>
        </div>
      </div>
      {/* T25.1 — Screen-reader announcement of section changes */}
      <span
        aria-live="polite"
        aria-atomic="true"
        className="product-sr-only"
      >
        {activeSection ? `Now reading: ${activeSection.eyebrow}` : ""}
      </span>
    </nav>
  );
}
