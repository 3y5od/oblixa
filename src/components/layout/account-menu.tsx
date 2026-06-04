"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, LogOut, Settings, ShieldCheck } from "lucide-react";
import { signOut } from "@/actions/auth";

/**
 * Compact account-menu trigger for the dashboard topbar.
 *
 * The trigger collapses to an avatar + name; the email and account destinations
 * move into a portaled `role="menu"` panel so the topbar stays uncluttered and
 * the full email is never the loudest thing in the chrome. Built on the same
 * portal + keyboard approach as the canonical RoleDropdown / RenewalRowActionsMenu
 * (escape-clipping `position: fixed` panel, Arrow/Home/End roving, outside-click
 * and scroll/resize dismissal, focus restored to the trigger).
 */
export function AccountMenu({
  displayName,
  email,
  initial,
  showEmail,
}: {
  displayName: string;
  email?: string | null;
  initial: string;
  /** Only surface the email when we have a real name to pair it with — avoids
   *  "you@example.com / you@example.com" when the name falls back to the local
   *  part of the address. */
  showEmail: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; right: number; minWidth: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
        top: r.bottom + 8,
        right: Math.max(8, window.innerWidth - r.right),
        minWidth: Math.max(232, r.width),
      });
    };
    updateRect();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onWindowChange = () => setOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onWindowChange, true);
    window.addEventListener("resize", onWindowChange);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onWindowChange, true);
      window.removeEventListener("resize", onWindowChange);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => focusableItems()[0]?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const closeAndRefocus = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = focusableItems();
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndRefocus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
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
      // Menu is portaled to the end of <body>; close + restore focus so Tab
      // never drops to document.body.
      event.preventDefault();
      closeAndRefocus();
    }
  };

  const itemClass =
    "ui-chip-focus flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface))] hover:text-[var(--text-primary)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface))] focus-visible:text-[var(--text-primary)] focus-visible:outline-none";

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${displayName}`}
        className="ui-chip-focus group inline-flex max-w-[14rem] items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] py-1 pl-1 pr-2 text-[var(--text-secondary)] shadow-[var(--shadow-1)] transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-strong))] hover:text-[var(--text-primary)] aria-expanded:border-[color:color-mix(in_oklab,var(--accent)_34%,var(--border-strong))]"
      >
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold text-[var(--accent-fg)] shadow-[var(--shadow-1)] [background:linear-gradient(180deg,color-mix(in_oklab,var(--accent)_76%,var(--surface-raised)),var(--accent-strong))]"
          aria-hidden
        >
          {initial}
        </span>
        <span className="hidden min-w-0 truncate text-[12.5px] font-semibold tracking-tight text-[var(--text-primary)] sm:block">
          {displayName}
        </span>
        <ChevronDown
          className={`hidden h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform duration-[var(--ui-duration)] sm:block ${
            open ? "rotate-180" : ""
          }`}
          strokeWidth={2}
          aria-hidden
        />
      </button>
      {open && rect && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label="Account"
              onKeyDown={onMenuKeyDown}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('[role="menuitem"]')) setOpen(false);
              }}
              style={{ position: "fixed", top: rect.top, right: rect.right, minWidth: rect.minWidth }}
              className="z-[60] flex w-max max-w-[20rem] flex-col rounded-[0.875rem] border border-[color:color-mix(in_oklab,var(--accent)_8%,var(--border-subtle))] bg-[var(--surface-raised)] p-1.5 shadow-[var(--shadow-3)]"
            >
              <div className="flex items-center gap-2.5 px-2 py-2">
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-[var(--accent-fg)] shadow-[var(--shadow-1)] [background:linear-gradient(180deg,color-mix(in_oklab,var(--accent)_76%,var(--surface-raised)),var(--accent-strong))]"
                  aria-hidden
                >
                  {initial}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
                    {displayName}
                  </p>
                  {showEmail && email ? (
                    <p className="truncate font-mono text-[11px] text-[var(--text-tertiary)]">{email}</p>
                  ) : null}
                </div>
              </div>
              <span
                aria-hidden
                className="mx-1 my-1 block h-px bg-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)]"
              />
              <Link href="/settings" role="menuitem" prefetch={false} className={itemClass}>
                <Settings className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
                Settings
              </Link>
              <Link
                href="/settings/security"
                role="menuitem"
                prefetch={false}
                className={itemClass}
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
                Account security
              </Link>
              <span
                aria-hidden
                className="mx-1 my-1 block h-px bg-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)]"
              />
              <form action={signOut}>
                <button
                  type="submit"
                  role="menuitem"
                  className="ui-chip-focus flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--danger-ink)_14%,var(--surface))] hover:text-[var(--danger-ink)] focus-visible:bg-[color:color-mix(in_oklab,var(--danger-ink)_14%,var(--surface))] focus-visible:text-[var(--danger-ink)] focus-visible:outline-none"
                >
                  <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.85} aria-hidden />
                  Sign out
                </button>
              </form>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
