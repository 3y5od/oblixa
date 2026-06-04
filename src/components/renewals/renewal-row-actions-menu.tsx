"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

/**
 * Portaled overflow menu for a renewals row.
 *
 * The renewals list card clips its rounded corners with `overflow-hidden`, so a
 * `position: absolute` popover gets cut off on the bottom rows (§11.12). This
 * renders the menu into `document.body` with `position: fixed` coordinates taken
 * from the trigger, and layers on keyboard semantics (Escape, Arrow/Home/End,
 * Tab-to-close-and-restore-focus) and outside-click / scroll / resize dismissal,
 * following the same portal + keyboard approach as the canonical RoleDropdown in
 * invite-member-form (natively-focusable menuitems instead of a roving listbox).
 *
 * `children` are the server-rendered action items (mutation forms + links), so
 * the bound server actions keep working when portaled.
 */
export function RenewalRowActionsMenu({
  children,
  contractTitle,
}: {
  children: ReactNode;
  contractTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; right: number; minWidth: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuLabel = contractTitle ? `Renewal actions for ${contractTitle}` : "Renewal actions";

  const focusableItems = () =>
    menuRef.current
      ? Array.from(menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'))
      : [];

  useEffect(() => {
    if (!open) return;
    const updateRect = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      setRect({
        top: r.bottom + 6,
        right: Math.max(8, window.innerWidth - r.right),
        minWidth: 208,
      });
    };
    updateRect();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onWindowChange = () => setOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onWindowChange, true);
    window.addEventListener("resize", onWindowChange);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onWindowChange, true);
      window.removeEventListener("resize", onWindowChange);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Focus the first item once the portaled menu has mounted.
    const id = window.requestAnimationFrame(() => focusableItems()[0]?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = focusableItems();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!items.length) return;
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next =
        event.key === "ArrowDown"
          ? (current + 1) % items.length
          : (current - 1 + items.length) % items.length;
      items[next]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === "Tab") {
      // Close and return focus to the trigger so focus never falls to <body>
      // (the menu is portaled to the end of document.body, outside the row).
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          // Match the canonical dropdown: Arrow keys open the menu (the open
          // effect then focuses the first item); Enter/Space use native click.
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={contractTitle ? `More renewal actions for ${contractTitle}` : "More actions"}
        title="More actions"
        className="ui-chip-focus inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_70%,transparent)] hover:text-[var(--text-primary)] aria-expanded:bg-[color:color-mix(in_oklab,var(--surface-muted)_70%,transparent)] aria-expanded:text-[var(--text-primary)]"
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.85} aria-hidden />
      </button>
      {open && rect && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={menuLabel}
              onKeyDown={onMenuKeyDown}
              onClick={(event) => {
                // Activating an item navigates/submits; close so the menu does
                // not linger over the re-rendered row.
                if ((event.target as HTMLElement).closest('[role="menuitem"]')) setOpen(false);
              }}
              style={{ position: "fixed", top: rect.top, right: rect.right, minWidth: rect.minWidth }}
              className="z-[60] flex w-max max-w-[18rem] flex-col gap-1 rounded-[0.625rem] border border-[color:color-mix(in_oklab,var(--accent)_8%,var(--border-subtle))] bg-[var(--surface-raised)] p-1.5 shadow-[var(--shadow-3)]"
            >
              {children}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
