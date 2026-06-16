import Link from "next/link";
import {
  ArrowDownUp,
  ArrowRight,
  AlertTriangle,
  Bell,
  Building2,
  CreditCard,
  Download,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { ExternalLink } from "@/components/ui/external-link";
import { SETTINGS_PAGE_STRINGS } from "@/lib/settings/spec-strings";
import type {
  SettingsDestination,
  SettingsDestinationGroup,
  SettingsSectionKey,
  SettingsStatusSummary,
} from "@/lib/workspace-settings-model";
import { SettingsAnchorLink } from "./settings-anchor-link";

// §2.6 structured action chip — accent-tinted but QUIET at rest (no filled
// accent bg) so the row's title stays the dominant element (§10.7). The parent
// row (`.group`) brightens the border + nudges the arrow on hover so the whole
// row reads as one affordance.
const ACTION_CHIP_CLASS =
  "ui-chip-focus inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[var(--surface-raised)] px-2.5 py-1 text-[12px] font-semibold text-[var(--accent-strong)] transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_40%,var(--border-subtle))] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] group-hover:border-[color:color-mix(in_oklab,var(--accent)_32%,var(--border-subtle))]";

// Same chip, but its `::before` stretches over the whole `.relative` row so the
// entire row is one click target (the chip stays the visible affordance). Only
// applied to navigable rows — read-only rows render a quiet, non-clickable state.
const ROW_ACTION_CLASS = `${ACTION_CHIP_CLASS} before:absolute before:inset-0 before:rounded-xl before:content-['']`;

const QUIET_STATE_CLASS = "ui-caps-2 shrink-0 text-[10.5px] text-[var(--text-tertiary)]";

export const CARD_HEADER_BORDER =
  "border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)]";
const HAIRLINE = "border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]";
export const ROW_HOVER = "hover:bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)]";

// Per-destination glyph so the directory reads as icon-led rows, not a wall of
// text (§5.4). Keyed by destination so every row carries a consistent identity.
const DESTINATION_ICON: Partial<Record<SettingsSectionKey, LucideIcon>> = {
  security: ShieldCheck,
  billing: CreditCard,
  notifications: Bell,
  imports_exports: ArrowDownUp,
  data_export: Download,
  profile: UserRound,
  workspace: Building2,
  team: Users,
};

const ATTENTION_ICON: Record<string, LucideIcon> = {
  invites: Users,
  plan: CreditCard,
};

// Quiet 32px glyph tile — neutral surface + hairline border, ink-tertiary
// glyph, no accent tint and no shadow. Blue is reserved for the row's primary
// action and focus states (design §15/§32); the icon is a subdued orientation
// mark, secondary to the row title (§9/§48). Shared by the directory rows and
// the editor-card headers so the page reads as one quiet ledger, not a wall of
// blue tiles.
export function IconTile({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_70%,var(--surface-raised))] text-[var(--text-tertiary)]"
    >
      {children}
    </span>
  );
}

function ActionArrow() {
  return (
    <ArrowRight
      className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
      strokeWidth={2}
      aria-hidden
    />
  );
}

// Visible label is the full action ("Open security settings", "Edit
// notification settings", "Export contract data") so a row action names its
// object before activation (§7 / design §15). `Open` alone is not acceptable.
function DestinationAction({ destination }: { destination: SettingsDestination }) {
  if (destination.state === "read_only") {
    return <span className={QUIET_STATE_CLASS}>Read-only</span>;
  }
  if (destination.state === "unavailable") {
    const label = destination.fallbackActionLabel ?? destination.actionLabel;
    const href = destination.fallbackHref ?? destination.href;
    if (!destination.fallbackHref && !href.startsWith("#")) {
      return <span className={QUIET_STATE_CLASS}>{label}</span>;
    }
    if (href.startsWith("#")) {
      return (
        <SettingsAnchorLink href={href as `#${string}`} className={ROW_ACTION_CLASS} aria-label={label}>
          {label}
          <ActionArrow />
        </SettingsAnchorLink>
      );
    }
    return (
      <Link href={href} className={ROW_ACTION_CLASS} aria-label={label}>
        {label}
        <ActionArrow />
      </Link>
    );
  }
  if (destination.href.startsWith("/api/")) {
    return (
      <ExternalLink href={destination.href} className={ROW_ACTION_CLASS} aria-label={destination.actionLabel}>
        {destination.actionLabel}
      </ExternalLink>
    );
  }
  if (destination.href.startsWith("#")) {
    return (
      <SettingsAnchorLink href={destination.href as `#${string}`} className={ROW_ACTION_CLASS} aria-label={destination.actionLabel}>
        {destination.actionLabel}
        <ActionArrow />
      </SettingsAnchorLink>
    );
  }
  return (
    <Link href={destination.href} className={ROW_ACTION_CLASS} aria-label={destination.actionLabel}>
      {destination.actionLabel}
      <ActionArrow />
    </Link>
  );
}

function SettingsActionLink({ href, children, className }: { href: string; children: ReactNode; className: string }) {
  if (href.startsWith("#")) {
    return <SettingsAnchorLink href={href as `#${string}`} className={className}>{children}</SettingsAnchorLink>;
  }
  return <Link href={href} className={className}>{children}</Link>;
}

// Normalized directory row state tag. Sentence case (not caps) so the full
// label stays readable inside the reserved column instead of clipping to
// "ACCOUNT SECURI…" (§6/§31). Neutral tags recede to a quiet, fill-less pill so
// they stay secondary to the row title; only real attention/healthy state
// earns a tint.
function DirectoryTag({ label, tone }: { label: string; tone?: SettingsDestination["statusTone"] }) {
  const toneClass =
    tone === "attention"
      ? "border-[color:color-mix(in_oklab,var(--warning)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_24%,var(--surface-raised))] text-[var(--warning-ink)]"
      : tone === "healthy"
        ? "border-[color:color-mix(in_oklab,var(--success)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_24%,var(--surface-raised))] text-[var(--success-ink)]"
        : "border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)]";
  return (
    <span
      title={label}
      className={`inline-flex max-w-full items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none ${toneClass}`}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

export function SettingsDirectory({ groups }: { groups: SettingsDestinationGroup[] }) {
  return (
    <section aria-labelledby="settings-directory-title">
      {/* §10.6 — the directory is a compact index, not the page's focal surface.
          A modest h2 + lead orient the reader; the bare total-count chip is
          dropped (§3 — a naked "5" never names its object). */}
      <header className="mb-3 flex flex-col gap-1">
        <h2
          id="settings-directory-title"
          className="text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]"
        >
          {SETTINGS_PAGE_STRINGS.directoryTitle}
        </h2>
        <p className="text-[12.5px] leading-snug text-[var(--text-secondary)]">
          {SETTINGS_PAGE_STRINGS.directoryLead}
        </p>
      </header>
      <div className="space-y-4">
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`settings-group-${group.key}`}>
            {/* Sentence-case group heading on a hairline, then rows. No bare
                count chip (§4/§5 — a count must name its object or be dropped). */}
            <header className={`mb-1 border-b ${HAIRLINE} pb-2`}>
              <h3
                id={`settings-group-${group.key}`}
                className="text-[11.5px] font-semibold tracking-tight text-[var(--text-tertiary)]"
              >
                {group.title}
              </h3>
            </header>
            <ul className="flex flex-col">
              {group.destinations.map((destination) => {
                const Icon = DESTINATION_ICON[destination.key] ?? SlidersHorizontal;
                return (
                  <li
                    key={destination.key}
                    className={`group relative grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b ${HAIRLINE} py-2.5 transition-colors last:border-b-0 sm:min-h-[3.25rem] sm:grid-cols-[2rem_minmax(0,1fr)_9.5rem_auto] sm:gap-x-4 ${ROW_HOVER} focus-within:bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)]`}
                  >
                    <IconTile>
                      <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.85} />
                    </IconTile>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
                          {destination.title}
                        </p>
                        {/* Mobile: tag sits inline under the title (no reserved
                            column at narrow widths). */}
                        {destination.currentStateLabel ? (
                          <span className="sm:hidden">
                            <DirectoryTag label={destination.currentStateLabel} tone={destination.statusTone} />
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-secondary)]">
                        {destination.noteLabel ?? destination.unavailableReason ?? destination.description}
                      </p>
                    </div>
                    {/* sm+: reserved, right-aligned status slot so every tag lands
                        in the same column regardless of title length. */}
                    <div className="hidden sm:flex sm:justify-end">
                      {destination.currentStateLabel ? (
                        <DirectoryTag label={destination.currentStateLabel} tone={destination.statusTone} />
                      ) : null}
                    </div>
                    {/* No `relative` here — the chip's stretched ::before must
                        anchor to the `.relative` <li> to cover the whole row. */}
                    <div className="justify-self-end">
                      <DestinationAction destination={destination} />
                    </div>
                  </li>
                );
              })}
            </ul>
            {group.description ? (
              <p className="mt-2 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
                {group.description}
              </p>
            ) : null}
          </section>
        ))}
      </div>
    </section>
  );
}

export function SettingsAttentionSummary({ summary }: { summary: SettingsStatusSummary }) {
  if (summary.items.length === 0) return null;
  // §10.2 / spec — a compact status strip, NOT a full amber box. Each item earns
  // its own warning rail + icon + value + action; routine metadata never tints
  // the whole section.
  return (
    <section aria-label="Workspace settings attention" className="flex flex-col gap-2">
      {summary.items.map((item) => {
        const Icon = ATTENTION_ICON[item.key] ?? AlertTriangle;
        return (
          <div
            key={item.key}
            className="group flex items-center gap-3 rounded-xl border border-[color:color-mix(in_oklab,var(--warning)_18%,var(--border-subtle))] border-l-2 border-l-[var(--warning-ink)] bg-[color:color-mix(in_oklab,var(--warning-soft)_14%,var(--surface-raised))] px-3 py-2.5"
          >
            <span
              aria-hidden
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--warning)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_28%,var(--surface-raised))] text-[var(--warning-ink)]"
            >
              <Icon className="h-4 w-4" strokeWidth={1.85} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] font-semibold text-[var(--text-primary)]">
                {item.label}
                <span className="inline-flex items-center rounded-full border border-[color:color-mix(in_oklab,var(--warning)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_24%,var(--surface-raised))] px-1.5 py-0.5 text-[10.5px] font-semibold leading-none tabular-nums text-[var(--warning-ink)]">
                  {item.value}
                </span>
              </p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-secondary)]">{item.impact}</p>
            </div>
            <SettingsActionLink href={item.href} className={`${ACTION_CHIP_CLASS} shrink-0`}>
              {item.actionLabel}
              <ActionArrow />
            </SettingsActionLink>
          </div>
        );
      })}
    </section>
  );
}
