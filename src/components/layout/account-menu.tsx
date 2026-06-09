"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Settings, ShieldCheck } from "lucide-react";
import { signOut } from "@/actions/auth";
import { DropdownMenu } from "@/components/ui/dropdown";

/**
 * Compact account-menu trigger for the dashboard topbar.
 *
 * The trigger collapses to an avatar + name; the email and account destinations
 * live in a portaled `role="menu"` panel (the shared DropdownMenu) so the topbar
 * stays uncluttered. DropdownMenu owns portal/position/roving-keyboard/dismissal;
 * this file owns only the trigger chrome and the menu's contents.
 */

const itemClass =
  "ui-chip-focus flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface))] hover:text-[var(--text-primary)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface))] focus-visible:text-[var(--text-primary)] focus-visible:outline-none";

export function AccountMenu({
  displayName,
  email,
  initial,
  title,
  role,
}: {
  /** Chrome-safe label: a real profile name, or "Account" — never an email
   *  local-part masquerading as a name (the dropdown body carries the email). */
  displayName: string;
  email?: string | null;
  initial: string;
  /** Full real name / email for the trigger tooltip; falls back to displayName. */
  title?: string;
  /** Subtle workspace-role context (Owner / Admin / Member / Viewer). This is the
   *  member's role, NOT the workspace mode — chrome must never surface mode (§10.3). */
  role?: string | null;
}) {
  const roleLabel = role?.trim() ? role.trim() : null;
  // Avoid "Account menu for Account" when there is no real profile name.
  const ariaLabel = displayName && displayName !== "Account" ? `Account menu for ${displayName}` : "Account menu";
  return (
    <DropdownMenu
      ariaLabel="Account"
      align="end"
      zIndexClassName="z-[60]"
      widthClassName="w-[var(--shell-account-menu-w)]"
      trigger={(triggerProps) => (
        <button
          {...triggerProps}
          type="button"
          aria-label={ariaLabel}
          title={title ?? displayName}
          className="ui-account-trigger ui-chip-focus group"
        >
          <span
            className="ui-avatar-tile h-[var(--shell-avatar-size)] w-[var(--shell-avatar-size)] rounded-[0.6rem] text-[12px] font-semibold"
            aria-hidden
          >
            {initial}
          </span>
          <span className="hidden min-w-0 max-w-[8.5rem] truncate text-[12.5px] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:block">
            {displayName}
          </span>
          <ChevronDown
            className="hidden h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform duration-[var(--ui-duration)] group-aria-expanded:rotate-180 sm:block"
            strokeWidth={2}
            aria-hidden
          />
        </button>
      )}
    >
      <div className="flex items-start gap-2.5 px-2 py-2">
        <span className="ui-avatar-tile h-9 w-9 rounded-[0.7rem] text-[13px] font-semibold" aria-hidden>
          {initial}
        </span>
        <div className="min-w-0">
          <p className="ui-text-compact-wrap text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
            {displayName}
          </p>
          {email ? (
            <p className="ui-entity-text font-mono text-[11px] leading-snug tracking-[0.02em] text-[var(--text-tertiary)]">{email}</p>
          ) : null}
          {roleLabel ? (
            <span className="mt-1.5 inline-flex max-w-max items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
              {roleLabel}
            </span>
          ) : null}
        </div>
      </div>
      <span
        aria-hidden
        className="mx-1 my-1 block h-px bg-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)]"
      />
      <p className="ui-caps-2 px-2.5 pb-0.5 pt-1 text-[10px] text-[var(--text-tertiary)]">Account</p>
      <Link href="/settings" role="menuitem" prefetch={false} className={itemClass}>
        <Settings className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
        Settings
      </Link>
      <Link href="/settings/security" role="menuitem" prefetch={false} className={itemClass}>
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
          className="ui-chip-focus flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--danger-ink)_12%,var(--surface))] hover:text-[var(--danger-ink)] focus-visible:bg-[color:color-mix(in_oklab,var(--danger-ink)_12%,var(--surface))] focus-visible:text-[var(--danger-ink)] focus-visible:outline-none"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.85} aria-hidden />
          Sign out
        </button>
      </form>
    </DropdownMenu>
  );
}
