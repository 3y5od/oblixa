"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowDownUp,
  ArrowLeft,
  Bell,
  Building2,
  CreditCard,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Stable section keys for the customer settings rail. Operator-only surfaces
 *  (health, product, policy) are intentionally absent — they are Internal per
 *  the release contract and must not appear in customer navigation. */
export type SettingsRailKey =
  | "profile"
  | "workspace"
  | "team"
  | "billing"
  | "security"
  | "notifications"
  | "imports_exports";

/** Workbench-level active marker. "overview" is the `/settings` index itself —
 *  it hosts the Profile / Workspace / Team sections, so no single rail item is
 *  marked; the top "Settings" entry reads as the current page instead. */
export type SettingsRailActive = SettingsRailKey | "overview";

type RailItem = {
  key: SettingsRailKey;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Quiet role note shown when the destination is admin-shaped. */
  note?: string;
};

// Destinations are real, reachable Core surfaces only. Profile / Workspace /
// Team are inline editor sections on `/settings` (deep-linked by anchor);
// Billing, Security, Notifications are dedicated routes; Imports and exports
// resolves to the canonical contract-import surface.
const RAIL_ITEMS: RailItem[] = [
  { key: "profile", label: "Profile", href: "/settings#profile", icon: UserRound },
  { key: "workspace", label: "Workspace", href: "/settings#workspace-identity", icon: Building2 },
  { key: "team", label: "Team", href: "/settings#team-access", icon: Users },
  { key: "billing", label: "Billing", href: "/settings/billing", icon: CreditCard, note: "Admin" },
  { key: "security", label: "Security", href: "/settings/security", icon: ShieldCheck },
  { key: "notifications", label: "Notifications", href: "/settings/operations", icon: Bell },
  {
    key: "imports_exports",
    label: "Imports and exports",
    href: "/contracts/bulk",
    icon: ArrowDownUp,
  },
];

/**
 * The persistent settings rail. A quiet, workmanlike index of the customer
 * settings sections with the active section marked by a thin left rule + an
 * understated fill (never a large active card). On mobile it collapses to a
 * horizontally scrollable strip with the same active treatment. The "Settings"
 * link doubles as the back-to-overview utility without being the only
 * orientation device.
 */
export function SettingsRail({ active }: { active?: SettingsRailActive }) {
  const pathname = usePathname();
  const onOverview = active === "overview";

  function isActive(item: RailItem): boolean {
    if (active) return active !== "overview" && item.key === active;
    const base = item.href.split("#")[0];
    return pathname === base;
  }

  return (
    <nav aria-label="Settings sections" className="billing-no-print flex flex-col gap-2.5">
      {onOverview ? (
        // On the overview itself "Settings" is the current page, not a way back —
        // a quiet heading, not a back-link.
        <p
          aria-current="page"
          className="inline-flex max-w-max items-center px-1.5 py-1 text-[12px] font-semibold text-[var(--text-primary)]"
        >
          Settings
        </p>
      ) : (
        <Link
          href="/settings"
          className="ui-chip-focus inline-flex max-w-max items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Settings
        </Link>
      )}
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
        {RAIL_ITEMS.map((item) => {
          const Icon = item.icon;
          const activeState = isActive(item);
          return (
            <li key={item.key} className="shrink-0 lg:shrink">
              <Link
                href={item.href}
                aria-current={activeState ? "page" : undefined}
                className={`group flex items-center gap-2.5 whitespace-nowrap border-l-2 py-2 pl-2.5 pr-3 text-[13px] transition-colors lg:whitespace-normal ${
                  activeState
                    ? "border-l-[var(--accent-strong)] bg-[color:color-mix(in_oklab,var(--accent-soft)_24%,var(--surface-raised))] font-semibold text-[var(--text-primary)]"
                    : "border-l-transparent font-medium text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--surface-raised)_60%,transparent)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${activeState ? "text-[var(--accent-strong)]" : "text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]"}`}
                  strokeWidth={1.85}
                  aria-hidden
                />
                <span className="min-w-0 truncate">{item.label}</span>
                {item.note ? (
                  <span className="ui-caps-3 ml-auto hidden text-[9.5px] text-[var(--text-tertiary)] lg:inline">
                    {item.note}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
