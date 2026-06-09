"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileSpreadsheet, Search, UploadCloud } from "lucide-react";
import { MAIN_CONTENT_ID } from "@/lib/qa/test-ids";
import {
  DASHBOARD_PRIMARY_CTA,
  DASHBOARD_SECONDARY_CTA,
} from "@/lib/dashboard/spec-strings";

// var(--shell-topbar-h) = 3.5rem. The bar parks just beneath the sticky app
// topbar; we also use this to decide when the page header has scrolled away.
const TOPBAR_PX = 56;

interface DashboardStickyToolbarProps {
  totalContracts: number;
  needsReview: number;
}

/**
 * A condensed quick-action bar that slides in after the page header scrolls
 * under the app topbar, so Upload / Import / Review / Search stay reachable deep
 * in a long dashboard. It is purely additive chrome: it links only to Core
 * surfaces the dashboard already exposes and never to a hidden route.
 *
 * Positioning: the app sidebar is collapsible (16rem ⇄ 4.5rem) and the topbar is
 * `sticky`, so a `fixed` bar can't hard-code a left offset. Instead it measures
 * the live `<main>` rect and matches its left/width, re-measuring on resize and
 * sidebar collapse via a ResizeObserver. Reveal is gated on the page `<header>`
 * crossing under the topbar, so it tracks the real header height instead of a
 * magic scroll number.
 */
export function DashboardStickyToolbar({
  totalContracts,
  needsReview,
}: DashboardStickyToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  // Keep the fixed bar aligned to the content column across viewport resizes and
  // sidebar collapse (both change `<main>`'s box).
  useEffect(() => {
    const main = document.getElementById(MAIN_CONTENT_ID);
    if (!main) return;
    const measure = () => {
      const rect = main.getBoundingClientRect();
      setBox({ left: Math.round(rect.left), width: Math.round(rect.width) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(main);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Reveal once the page header has (mostly) scrolled under the topbar.
  useEffect(() => {
    const main = document.getElementById(MAIN_CONTENT_ID);
    const headerEl = main?.querySelector("header") ?? null;
    let raf = 0;
    const update = () => {
      raf = 0;
      if (headerEl) {
        setVisible(headerEl.getBoundingClientRect().bottom <= TOPBAR_PX + 4);
      } else {
        setVisible(window.scrollY > 150);
      }
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <nav
      aria-label="Dashboard quick actions"
      aria-hidden={!visible}
      style={box ? { left: box.left, width: box.width } : { left: 0, right: 0 }}
      className={`fixed top-[var(--shell-topbar-h)] z-20 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_92%,transparent)] shadow-[var(--shadow-1)] backdrop-blur-md transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none invisible -translate-y-2 opacity-0"
      }`}
    >
      <div className="mx-auto flex w-full max-w-[var(--shell-content-max)] items-center justify-between gap-3 px-4 py-2 md:px-6 xl:px-8">
        {/* Left: condensed identity + live counts (parity with the header meta
            chip; hidden on the narrowest screens so the actions never wrap). */}
        <div className="hidden min-w-0 items-center gap-2 sm:flex">
          <span className="ui-caps-2 shrink-0 text-[10px] text-[var(--text-tertiary)]">
            Contract tracking
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface)] px-2 py-0.5">
            <span className="font-mono text-[11.5px] font-semibold tabular-nums text-[var(--text-primary)]">
              {totalContracts}
            </span>
            <span className="ui-caps-2 text-[9.5px] text-[var(--text-tertiary)]">
              {totalContracts === 1 ? "Contract" : "Contracts"}
            </span>
          </span>
          {needsReview > 0 ? (
            <Link
              href="/contracts/review"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 transition-colors hover:brightness-110"
              style={{
                borderColor:
                  "color-mix(in oklab, var(--accent) 30%, var(--border-card))",
                background:
                  "color-mix(in oklab, var(--accent-soft) 14%, var(--surface-raised))",
              }}
            >
              <span className="font-mono text-[11.5px] font-semibold tabular-nums text-[var(--accent-strong)]">
                {needsReview}
              </span>
              <span className="ui-caps-2 text-[9.5px] text-[var(--accent-strong)]">
                To review
              </span>
            </Link>
          ) : null}
        </div>

        {/* Right: the same intake actions as the header, condensed. Search lands
            on the Core /search surface. */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/search"
            className="ui-btn-ghost inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            <span className="hidden md:inline">Search</span>
          </Link>
          <Link
            href="/contracts/bulk"
            prefetch={false}
            className="ui-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            <span className="hidden md:inline">{DASHBOARD_SECONDARY_CTA}</span>
            <span className="md:hidden">Import</span>
          </Link>
          <Link
            href="/contracts/new"
            className="ui-btn-primary inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold"
          >
            <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            <span className="hidden md:inline">{DASHBOARD_PRIMARY_CTA}</span>
            <span className="md:hidden">Upload</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
