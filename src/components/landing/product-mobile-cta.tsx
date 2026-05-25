"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import {
  readProductMobileCtaDismissed,
  writeProductMobileCtaDismissed,
} from "@/lib/security/client-storage";

/**
 * v5 T16.2 — Mobile-only floating CTA pill.
 *
 * Appears after the user scrolls past ~600px on viewports < md. Dismissible
 * via the close button (per-session). Always respects iOS safe-area-inset.
 *
 * Hidden on md+ where the desktop sticky anchor nav is already visible.
 */
export function ProductMobileCta() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return readProductMobileCtaDismissed();
  });

  useEffect(() => {
    if (dismissed) return;
    function onScroll() {
      setVisible(window.scrollY > 600);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [dismissed]);

  if (dismissed || !visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-3 z-30 flex justify-end md:hidden"
      style={{ bottom: "calc(16px + env(safe-area-inset-bottom))" }}
    >
      <div className="product-anchor-nav-surface pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_oklab,var(--accent-strong)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--surface-raised)_94%,transparent)] py-1 pl-3 pr-1 shadow-[var(--shadow-2)] backdrop-blur-md">
        <Link
          href="/signup"
          className="ui-btn-primary inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold"
        >
          Start free trial
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
        </Link>
        <button
          type="button"
          aria-label="Dismiss start-free-trial banner"
          onClick={() => {
            setDismissed(true);
            writeProductMobileCtaDismissed();
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-raised)_88%,transparent)] hover:text-[var(--text-secondary)] motion-reduce:transition-none"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
