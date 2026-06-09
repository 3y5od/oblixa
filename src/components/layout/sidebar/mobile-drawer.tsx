import { Menu } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { shellTestIds } from "@/lib/qa/test-ids";

export function MobileNavigationTrigger({
  buttonRef,
  onOpen,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  onOpen: () => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onOpen}
      data-testid={shellTestIds.sidebarMobileOpen}
      className="fixed left-4 top-[max(0.625rem,env(safe-area-inset-top))] z-40 inline-flex h-[var(--shell-mobile-trigger)] w-[var(--shell-mobile-trigger)] items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] shadow-[var(--shadow-1)] transition-colors duration-[var(--ui-duration)] hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-strong))] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] lg:hidden"
      aria-label="Open navigation"
    >
      <Menu size={18} aria-hidden />
    </button>
  );
}

export function MobileDrawer({
  drawerRef,
  children,
  onClose,
}: {
  drawerRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      ref={drawerRef}
      className="fixed inset-0 z-50 flex lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation drawer"
      data-testid={shellTestIds.sidebarMobileDrawer}
    >
      <aside className="ui-sidebar-surface flex h-dvh max-h-dvh min-h-0 w-[var(--shell-drawer-w)] flex-col border-r border-[var(--sidebar-border)] pt-[env(safe-area-inset-top)]">
        {children}
      </aside>
      <button
        type="button"
        className="ui-overlay-scrim h-full flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        onClick={onClose}
        aria-label="Close navigation overlay"
      />
    </div>
  );
}
