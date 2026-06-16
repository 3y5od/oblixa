import Link from "next/link";
import { X } from "lucide-react";
import type { RefObject } from "react";

// Brand "O" tile — shared lockup with the marketing chrome, toned for the
// porcelain margin (neutral tile; accent stays reserved for active nav).
const BRAND_TILE_CLASS =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.5rem] border border-[color:color-mix(in_oklab,var(--sidebar-fg)_24%,transparent)] bg-[color:color-mix(in_oklab,var(--sidebar-fg)_7%,transparent)] font-serif text-[17px] font-semibold leading-none text-[var(--sidebar-fg)] shadow-[var(--sidebar-brand-shadow)]";

export function SidebarBrand({
  mobile,
  collapsed,
  onCloseMobile,
  closeButtonRef,
}: {
  mobile: boolean;
  collapsed: boolean;
  onCloseMobile: () => void;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  // Brand area height tracks the topbar so the two chrome surfaces share one
  // horizon line. The collapse control now lives in the stable sidebar footer,
  // so the brand is a clean product lockup in every state.
  if (collapsed && !mobile) {
    return (
      <div className="flex h-16 shrink-0 items-center justify-center border-b border-[var(--sidebar-section-border)] px-2">
        <Link
          href="/dashboard"
          aria-label="Oblixa — go to dashboard"
          className={`${BRAND_TILE_CLASS} transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_36%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]`}
        >
          <span aria-hidden>O</span>
        </Link>
      </div>
    );
  }
  return (
    <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--sidebar-section-border)] px-3">
      <Link
        href="/dashboard"
        className="group flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-[color:var(--sidebar-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"
      >
        <span className={BRAND_TILE_CLASS} aria-hidden>
          O
        </span>
        {/* Legal-product lockup: wordmark over a quiet category line so the rail
            names the product, not just an app placeholder. */}
        <span className="flex min-w-0 flex-col leading-none">
          <span className="truncate text-[15px] font-bold leading-none tracking-tight text-[var(--sidebar-fg)]">
            Oblixa
          </span>
          <span className="mt-1 truncate text-[10.5px] font-medium leading-tight tracking-[0.02em] text-[var(--sidebar-muted)]">
            Contract follow-up
          </span>
        </span>
      </Link>
      {mobile ? (
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onCloseMobile}
          className="ui-icon-button border-[color:color-mix(in_oklab,var(--sidebar-fg)_12%,transparent)] bg-[color:color-mix(in_oklab,var(--sidebar-fg)_3%,transparent)] p-2 text-[var(--sidebar-muted)] hover:bg-[color:var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"
          aria-label="Close navigation"
        >
          <X size={18} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
