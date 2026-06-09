import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import type { RefObject } from "react";
import { shellTestIds } from "@/lib/qa/test-ids";
import { DESKTOP_SIDEBAR_BODY_ID } from "./constants";

// Brand "O" tile — shared lockup with the marketing chrome, toned for the
// always-dark sidebar (neutral tile; accent stays reserved for active nav).
const BRAND_TILE_CLASS =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.7rem] border border-[color:color-mix(in_oklab,var(--sidebar-fg)_16%,transparent)] bg-[color:color-mix(in_oklab,var(--sidebar-fg)_8%,transparent)] text-[15px] font-bold leading-none text-[var(--sidebar-fg)] shadow-[var(--sidebar-brand-shadow)]";

export function SidebarBrand({
  mobile,
  collapsed,
  isOnboarding,
  onToggleCollapsed,
  onCloseMobile,
  closeButtonRef,
}: {
  mobile: boolean;
  collapsed: boolean;
  isOnboarding: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  if (collapsed && !mobile) {
    // Collapsed rail: the brand tile folds in the expand control, so there's one
    // top tile instead of a logo stacked over a separate toggle. During
    // onboarding the rail is force-collapsed with no user toggle, so it stays a
    // static brand link.
    return (
      <div className="flex h-14 shrink-0 items-center justify-center border-b border-[var(--sidebar-section-border)] px-2.5">
        {isOnboarding ? (
          <Link
            href="/dashboard"
            aria-label="Oblixa — go to dashboard"
            className={`${BRAND_TILE_CLASS} transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_36%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]`}
          >
            <span aria-hidden>O</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapsed}
            data-testid={shellTestIds.sidebarCollapseToggle}
            className={`${BRAND_TILE_CLASS} group relative transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_40%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]`}
            aria-controls={DESKTOP_SIDEBAR_BODY_ID}
            aria-expanded={false}
            aria-label="Expand sidebar"
            title="Expand sidebar (⌘\\)"
          >
            {/* Brand mark by default; reveals an expand affordance on hover/focus. */}
            <span
              aria-hidden
              className="transition-opacity duration-[var(--ui-duration)] group-hover:opacity-0 group-focus-visible:opacity-0"
            >
              O
            </span>
            <PanelLeftOpen
              aria-hidden
              strokeWidth={1.85}
              className="absolute h-[18px] w-[18px] text-[var(--sidebar-fg)] opacity-0 transition-opacity duration-[var(--ui-duration)] group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--sidebar-section-border)] px-2.5">
      <Link
        href="/dashboard"
        className="group flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-1 transition-colors hover:bg-[color:var(--sidebar-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"
      >
        <span className={BRAND_TILE_CLASS} aria-hidden>
          O
        </span>
        <span className="block min-w-0 truncate text-[15px] font-bold tracking-tight text-[var(--sidebar-fg)]">
          Oblixa
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
      ) : (
        <button
          type="button"
          onClick={onToggleCollapsed}
          data-testid={shellTestIds.sidebarCollapseToggle}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--sidebar-muted)] transition-colors hover:bg-[color:var(--sidebar-hover)] hover:text-[var(--sidebar-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-focus)]"
          aria-controls={DESKTOP_SIDEBAR_BODY_ID}
          aria-expanded={true}
          aria-label="Collapse sidebar"
          title="Collapse sidebar (⌘\\)"
        >
          <PanelLeftClose size={18} strokeWidth={1.85} aria-hidden />
        </button>
      )}
    </div>
  );
}
