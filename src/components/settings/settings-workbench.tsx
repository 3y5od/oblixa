import type { ReactNode } from "react";
import { SettingsRail, type SettingsRailActive } from "./settings-rail";

const SKIP_LINK_CLASS =
  "ui-skip-link sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-[var(--surface-raised)] focus:px-3 focus:py-2 focus:text-[var(--text-primary)]";

export interface SettingsWorkbenchProps {
  /** Marks the active rail section, or "overview" for the `/settings` index. */
  active: SettingsRailActive;
  /** Caps category label above the page title. */
  eyebrow: string;
  /** Page title — the one obvious primary heading. */
  title: string;
  /** Precise supporting copy under the title. */
  lead?: ReactNode;
  /** Compact ledger-style state strip rendered on a hairline below the header. */
  stateStrip?: ReactNode;
  /** Optional right-aligned header action cluster. */
  actions?: ReactNode;
  /** First focusable skip link (target id + visible label). */
  skipLink?: { href: string; label: string };
  children: ReactNode;
}

/**
 * Shared customer settings workbench: a persistent left rail, a precise page
 * header with no floating icon tile, an optional ledger state strip, and the
 * record area. One frame so Security, Billing, and Notifications share the same
 * legal-operations rhythm instead of reading as isolated settings cards. The
 * total field is capped and centered so wide viewports keep symmetric margins
 * rather than an empty right band.
 */
export function SettingsWorkbench({
  active,
  eyebrow,
  title,
  lead,
  stateStrip,
  actions,
  skipLink,
  children,
}: SettingsWorkbenchProps) {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      {skipLink ? (
        <a href={skipLink.href} className={SKIP_LINK_CLASS}>
          {skipLink.label}
        </a>
      ) : null}
      <div className="grid gap-x-8 gap-y-4 lg:grid-cols-[13.5rem_minmax(0,1fr)] xl:grid-cols-[14.5rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <SettingsRail active={active} />
        </aside>
        <div className="ui-page-stack min-w-0 gap-5">
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <div className="min-w-0">
                <p className="ui-caps-2 text-[var(--accent-strong)]">{eyebrow}</p>
                <h1 className="mt-1 text-[1.6rem] font-semibold leading-[1.12] tracking-tight text-[var(--text-primary)] sm:text-[1.75rem]">
                  {title}
                </h1>
                {lead ? (
                  <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                    {lead}
                  </p>
                ) : null}
              </div>
              {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>
            {stateStrip ? (
              <div className="border-t border-[var(--border-subtle)] pt-3">{stateStrip}</div>
            ) : null}
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}

export type SettingsStateTone = "healthy" | "warning" | "neutral";

export type SettingsStateItem = {
  /** Caps metadata label (e.g. "Account protection"). */
  label: string;
  /** Value — plain text, a status phrase, or a link. */
  value: ReactNode;
  /** Optional reinforcing dot; state meaning still lives in the text, never
   *  color alone. */
  tone?: SettingsStateTone;
};

const TONE_DOT: Record<SettingsStateTone, string> = {
  healthy: "var(--success-ink)",
  warning: "var(--warning-ink)",
  neutral: "var(--text-tertiary)",
};

/**
 * Ledger-style state strip for the workbench header. Replaces the old pill row:
 * quiet caps labels paired with precise values, separated by space, so the strip
 * reads as record metadata rather than decorative chips.
 */
export function SettingsStateStrip({ items }: { items: SettingsStateItem[] }) {
  return (
    <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 items-center gap-2">
          <dt className="ui-caps-3 text-[var(--text-tertiary)]">{item.label}</dt>
          <dd className="inline-flex min-w-0 items-center gap-1.5 text-[12.5px] text-[var(--text-secondary)]">
            {item.tone ? (
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: TONE_DOT[item.tone] }}
              />
            ) : null}
            <span className="min-w-0 truncate">{item.value}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
