"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { DropdownMenu } from "@/components/ui/dropdown";

/**
 * Shared portaled row-overflow menu for the dense data surfaces (Work, Renewals,
 * Evidence, Reports). Dense list cards clip their rounded corners with
 * `overflow-hidden`, so a `position: absolute` popover gets cut off on the bottom
 * rows (§11.12). This renders into `document.body` with `position: fixed`
 * coordinates taken from the trigger, and layers on the full APG menu-button
 * keyboard contract (ArrowDown/Enter/Space open to first, ArrowUp opens to last;
 * Arrow/Home/End move; Space activates; Escape/Tab close and restore focus) plus
 * outside-click / scroll / resize dismissal that hands focus back to the trigger
 * when it lives inside the menu.
 *
 * Items are passed as `children` so server-action forms (Renewals) keep working
 * when portaled. For plain link/action items, compose <RowActionMenuItem>, which
 * carries the reserved-icon-slot styling so labels share one left edge whether or
 * not an action has an icon. Activating any [role="menuitem"] closes the menu.
 *
 * Replaces the three divergent implementations: the renewals portaled menu, the
 * inline Work menu, and Evidence's clip-prone native <details> menu.
 */

const TRIGGER_CLASS =
  "ui-chip-focus inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_70%,transparent)] hover:text-[var(--text-primary)] aria-expanded:bg-[color:color-mix(in_oklab,var(--surface-muted)_70%,transparent)] aria-expanded:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50";

export const rowActionMenuItemClass =
  "flex w-full items-center gap-2 rounded-[0.45rem] px-2.5 py-1.5 text-left text-[11.5px] font-medium leading-none outline-none transition-colors text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)] hover:text-[var(--text-primary)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)] focus-visible:text-[var(--text-primary)]";

export const rowActionMenuItemDestructiveClass =
  "flex w-full items-center gap-2 rounded-[0.45rem] px-2.5 py-1.5 text-left text-[11.5px] font-medium leading-none outline-none transition-colors text-[var(--danger-ink)] hover:bg-[color:color-mix(in_oklab,var(--danger-ink)_12%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--danger-ink)_12%,transparent)]";

/** Reserved 14px icon slot so item labels share one left edge whether or not the
 *  action has a mapped icon (§10.9). */
function IconSlot({ icon }: { icon?: ReactNode }) {
  return (
    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">{icon ?? null}</span>
  );
}

export interface RowActionMenuItemProps {
  children: ReactNode;
  icon?: ReactNode;
  destructive?: boolean;
  /** Link target; renders an <a role="menuitem">. */
  href?: string;
  /** Click handler; renders a <button role="menuitem">. Ignored when `href` set. */
  onSelect?: () => void;
  disabled?: boolean;
}

export function RowActionMenuItem({
  children,
  icon,
  destructive,
  href,
  onSelect,
  disabled,
}: RowActionMenuItemProps) {
  const cls = destructive ? rowActionMenuItemDestructiveClass : rowActionMenuItemClass;
  if (href) {
    return (
      <Link role="menuitem" href={href} className={cls}>
        <IconSlot icon={icon} />
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      disabled={disabled}
      className={`${cls} disabled:opacity-60`}
    >
      <IconSlot icon={icon} />
      {children}
    </button>
  );
}

export interface RowActionMenuProps {
  children: ReactNode;
  /** aria-label for the role="menu" container. */
  menuLabel?: string;
  /** sr-only label + trigger aria-label/title. */
  triggerLabel?: string;
  /** Override the default quiet trigger chrome. */
  triggerClassName?: string;
  disabled?: boolean;
}

export function RowActionMenu({
  children,
  menuLabel = "Row actions",
  triggerLabel = "More actions",
  triggerClassName,
  disabled = false,
}: RowActionMenuProps) {
  return (
    <DropdownMenu
      ariaLabel={menuLabel}
      align="end"
      collide
      zIndexClassName="z-[60]"
      widthClassName="w-max min-w-[12rem] max-w-[18rem]"
      trigger={(triggerProps) => (
        <button
          {...triggerProps}
          type="button"
          disabled={disabled}
          aria-label={triggerLabel}
          title={triggerLabel}
          className={triggerClassName ?? TRIGGER_CLASS}
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={1.85} aria-hidden />
          <span className="sr-only">{triggerLabel}</span>
        </button>
      )}
    >
      {children}
    </DropdownMenu>
  );
}
