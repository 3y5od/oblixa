"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Sticky in-page section nav for the landing page.
 *
 * Replaces the former persistent second header row (two loose rows read as two
 * separate nav systems). This strip lives below the hero and sticks beneath the
 * single-row marketing header, mirroring the /product anchor-nav recipe
 * (`product-anchor-*` surface + chip CSS, segmented progress, scroll-spy,
 * keyboard ← / → and an aria-live announcement) for cross-page chrome parity.
 *
 * Section ids must match the landing page section anchors. The "Capabilities"
 * label is also pinned by landing-page.ui.test.tsx (a link named "Capabilities"
 * must exist), so keep that entry.
 */
const SECTIONS = [
  { id: "problem", label: "Problem" },
  { id: "compare", label: "Compare" },
  { id: "how-it-works", label: "How it works" },
  { id: "capabilities", label: "Capabilities" },
  { id: "objections", label: "Honest answers" },
  { id: "faq", label: "FAQ" },
] as const;

function readInitialActiveIdFromHash(): string {
  if (typeof window === "undefined") return SECTIONS[0].id;
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return SECTIONS[0].id;
  return SECTIONS.some((s) => s.id === raw) ? raw : SECTIONS[0].id;
}

export function LandingAnchorNav() {
  const [activeId, setActiveId] = useState<string>(() => readInitialActiveIdFromHash());
  const ratiosRef = useRef<Map<string, number>>(new Map());
  const navRef = useRef<HTMLUListElement | null>(null);

  // IntersectionObserver scroll-spy — tracks the most-visible section.
  useEffect(() => {
    const sections = SECTIONS.map((s) => document.getElementById(s.id)).filter(
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
        let bestId: string = SECTIONS[0].id;
        let bestRatio = -1;
        for (const [id, r] of ratios.entries()) {
          if (r > bestRatio) {
            bestRatio = r;
            bestId = id;
          }
        }
        if (bestRatio > 0) setActiveId(bestId);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.2, 0.5, 0.8, 1] }
    );

    for (const s of sections) observer.observe(s);
    return () => observer.disconnect();
  }, []);

  const currentIdx = SECTIONS.findIndex((s) => s.id === activeId);
  const activeSection = SECTIONS[currentIdx];

  // Keyboard ← / → moves focus between chips.
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
      aria-label="On this page"
      className="relative z-10 flex justify-center px-4 sm:sticky sm:top-0 sm:px-6"
      style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
    >
      <div className="product-anchor-nav-surface max-w-full rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_88%,transparent)] backdrop-blur-md">
        {/* Segmented progress bar — one segment per section. */}
        <div
          aria-hidden
          className="flex h-[2px] w-full gap-px overflow-hidden rounded-t-2xl bg-[color:color-mix(in_oklab,var(--border-subtle)_40%,transparent)]"
        >
          {SECTIONS.map((s, idx) => (
            <span
              key={s.id}
              className="flex-1 transition-[background-color] duration-200 ease-out motion-reduce:transition-none"
              style={{
                background:
                  idx <= currentIdx
                    ? "color-mix(in oklab, var(--accent-strong) 55%, transparent)"
                    : "transparent",
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto px-2 py-2 sm:px-3">
          <ul ref={navRef} onKeyDown={onKeyDown} className="flex min-w-max items-center gap-1.5">
            {SECTIONS.map((s, idx) => {
              const isActive = s.id === activeId;
              return (
                <li key={s.id} className="flex items-center gap-1.5">
                  <a
                    href={`#${s.id}`}
                    data-anchor-chip
                    aria-current={isActive ? "true" : undefined}
                    className={
                      "product-anchor-chip ui-chip-focus inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors motion-reduce:transition-none " +
                      (isActive
                        ? "border-[color:color-mix(in_oklab,var(--accent-strong)_38%,var(--border-strong))] bg-[color:color-mix(in_oklab,var(--accent-soft)_20%,var(--surface-raised))] text-[var(--accent-strong)]"
                        : "border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-strong))] hover:text-[var(--text-primary)]")
                    }
                  >
                    <span
                      aria-hidden
                      className={
                        "text-[10px] font-bold tabular-nums tracking-[0.16em] " +
                        (isActive ? "text-[var(--accent-strong)]" : "text-[var(--text-tertiary)]")
                      }
                      style={{ fontVariantNumeric: "tabular-nums lining-nums slashed-zero" }}
                    >
                      {idx + 1}
                    </span>
                    {s.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      {/* Screen-reader announcement of the current section. */}
      <span aria-live="polite" aria-atomic="true" className="product-sr-only">
        {activeSection ? `Now reading: ${activeSection.label}` : ""}
      </span>
    </nav>
  );
}
