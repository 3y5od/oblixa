"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileCheck2, FileSpreadsheet, UploadCloud } from "lucide-react";
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
      className={`fixed top-[var(--shell-topbar-h)] z-20 border-b border-[color:var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-raised)_90%,transparent)] shadow-[0_6px_18px_-12px_color-mix(in_oklab,var(--text-primary)_30%,transparent)] backdrop-blur-md transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none invisible -translate-y-2 opacity-0"
      }`}
    >
      <div className="mx-auto flex w-full max-w-[var(--shell-content-max)] items-center justify-between gap-3 px-4 py-2.5 md:px-6 xl:px-8">
        {/* Left: route identity (icon + page title) the scrolled-away masthead no
            longer shows, then the live counts. A clearer anchor so the bar reads as
            this page's context, not a detached action strip (§4 route identity). */}
        <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)]">
            <FileCheck2 className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
          </span>
          <span className="shrink-0 text-[14px] font-bold tracking-tight text-[var(--text-primary)]">
            Contract tracking
          </span>
          <span aria-hidden className="h-4 w-px shrink-0 bg-[color:color-mix(in_oklab,var(--border-strong)_55%,transparent)]" />
          {/* Live counts as deliberate inline status text, not boxed pills: the
              contract total recedes; the needs-review count carries tone + a link. */}
          <span className="shrink-0 text-[12.5px] font-medium text-[var(--text-tertiary)]">
            <span className="font-semibold tabular-nums text-[var(--text-secondary)]">{totalContracts}</span>{" "}
            {totalContracts === 1 ? "contract" : "contracts"}
          </span>
          {needsReview > 0 ? (
            <>
              <span aria-hidden className="text-[var(--text-tertiary)]">&middot;</span>
              <Link
                href="/contracts/review"
                aria-label={`${needsReview} ${needsReview === 1 ? "contract" : "contracts"} needing review`}
                className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold text-[var(--warning-ink)] underline-offset-2 hover:underline"
              >
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--warning-ink)]" />
                <span className="tabular-nums">{needsReview}</span>
                {needsReview === 1 ? "needs review" : "need review"}
              </Link>
            </>
          ) : null}
        </div>

        {/* Right: the intake actions that scroll out of reach with the page
            header. Order matches the masthead exactly — primary Upload first, then
            secondary Import — so action order and prominence stay stable as the
            page scrolls (§15 consistent primary action). Search is intentionally
            NOT repeated here: the global topbar search is sticky and always
            present, so a second search affordance would be redundant chrome. */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/contracts/new"
            className="ui-btn-primary inline-flex items-center justify-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[12px] font-semibold"
          >
            <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            <span className="hidden md:inline">{DASHBOARD_PRIMARY_CTA}</span>
            <span className="md:hidden">Upload</span>
          </Link>
          <Link
            href="/contracts/bulk"
            prefetch={false}
            className="ui-btn-secondary inline-flex items-center justify-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[12px] font-semibold"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            <span className="hidden md:inline">{DASHBOARD_SECONDARY_CTA}</span>
            <span className="md:hidden">Import</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
