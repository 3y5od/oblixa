import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { ActionChip } from "@/components/ui/action-chip";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { DashboardMetricCell } from "@/components/ui/dashboard-metric-cell";
import type { CoreDashboardSection, CoreDashboardTopCard } from "@/lib/dashboard/core-dashboard-model";
import {
  SECTION_COUNT_NOUN,
  SECTION_ICONS,
  TOP_CARD_ICON,
  TOP_CARD_NOTE,
  TOP_CARD_STATE,
  TOP_CARD_STATEMENT,
  TOP_CARD_UNIT,
  TOP_CARD_ZERO_DESCRIPTION,
  TOP_CARD_ZERO_STATEMENT,
} from "./core-dashboard-config";

export function EmptySectionRow({ children }: { children: string }) {
  return (
    <div
      className="relative flex min-h-[4.5rem] items-center gap-3 overflow-hidden rounded-xl px-4 py-3"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--success-soft) 14%, transparent) 0%, color-mix(in oklab, var(--success-soft) 6%, transparent) 100%)",
        boxShadow: "inset 0 1px 0 0 color-mix(in oklab, var(--success-ink) 10%, transparent)",
      }}
    >
      <span
        aria-hidden
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
        style={{
          borderColor: "color-mix(in oklab, var(--success-ink) 26%, var(--border-card))",
          background: "color-mix(in oklab, var(--success-soft) 32%, var(--surface-raised))",
          color: "color-mix(in oklab, var(--success-ink) 80%, var(--text-secondary))",
        }}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
      </span>
      <span className="min-w-0 flex-1 text-[13px] leading-snug text-[var(--text-secondary)]">
        {children}
      </span>
    </div>
  );
}

export function TopSignal({ card }: { card: CoreDashboardTopCard }) {
  return (
    <DashboardMetricCell
      href={card.href}
      label={card.label}
      description={TOP_CARD_NOTE[card.key]}
      unit={TOP_CARD_UNIT[card.key]}
      state={TOP_CARD_STATE[card.key]}
      statement={TOP_CARD_STATEMENT[card.key](card.count)}
      zeroStatement={TOP_CARD_ZERO_STATEMENT[card.key]}
      zeroDescription={TOP_CARD_ZERO_DESCRIPTION[card.key]}
      value={card.count}
      tone={card.tone}
      icon={TOP_CARD_ICON[card.key]}
    />
  );
}

export function SectionShell({
  section,
  variant = "main",
  children,
}: {
  section: CoreDashboardSection;
  /** "main" = dominant work column; "rail" = compact right context panel. */
  variant?: "main" | "rail";
  children: ReactNode;
}) {
  const ariaId = `${section.key.replace(/_/g, "-")}-h`;
  const Icon = SECTION_ICONS[section.key];
  const title = section.title;
  const footer =
    section.rows.length > 0 && section.count > section.rows.length ? (
      <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] tabular-nums text-[var(--text-tertiary)]">
        Showing {section.rows.length} of {section.count}
      </p>
    ) : null;

  // Details to Confirm (release-state section name): a light section header over
  // the source-backed confirmation surface, which carries its own chrome — no
  // second panel wrapper around it.
  if (section.key === "review_queue" && variant === "main") {
    return (
      <section aria-labelledby={ariaId} className="min-w-0">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 id={ariaId} className="inline-flex items-center gap-2 text-[15px] font-bold tracking-tight text-[var(--text-primary)]">
            <span className="h-4 w-[3px] shrink-0 rounded-full bg-[var(--accent-strong)]" aria-hidden />
            <span>{title}</span>
            {section.count > 0 ? (
              <span className="text-[12.5px] font-medium tabular-nums text-[var(--text-tertiary)]">
                <span aria-hidden className="mr-1.5 text-[color:color-mix(in_oklab,var(--text-tertiary)_55%,transparent)]">&middot;</span>
                {section.count} {section.count === 1 ? "detail" : "details"}
              </span>
            ) : null}
          </h2>
          {section.actionLabel ? (
            <ActionChip verb={section.actionLabel} href={section.href} quiet />
          ) : null}
        </div>
        {children}
        {footer}
      </section>
    );
  }

  // RAIL: a borderless subsection. The right-hand <aside> groups these into one
  // cohesive, grounded context panel with dividers, so each reads as a subsection
  // of "context" rather than a separate bolted-on widget (§8 cohesive rail).
  if (variant === "rail") {
    // Rail count noun — quiet right-aligned metadata ("5 dates", "2 items",
    // "3 changes"), not a number stuck to the title (§ counts as metadata).
    const railNoun =
      section.key === "data_gaps" ? "items" : SECTION_COUNT_NOUN[section.key];
    return (
      <section aria-labelledby={ariaId} className="min-w-0">
        <div className="flex items-baseline justify-between gap-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-3.5 pb-2 pt-3.5">
          <h3 id={ariaId} className="min-w-0 truncate text-[13px] font-bold tracking-tight text-[var(--text-primary)]">
            {title}
          </h3>
          {section.count > 0 ? (
            <span className="shrink-0 text-[11px] font-medium tabular-nums text-[var(--text-tertiary)]">
              {section.count} {section.count === 1 ? railNoun.replace(/s$/, "") : railNoun}
            </span>
          ) : null}
        </div>
        <div className={section.key === "data_gaps" ? "pt-1" : "px-2 py-1.5"}>{children}</div>
        {footer}
      </section>
    );
  }

  // MAIN work surface (work queue; review-queue empty fallback). One flat material
  // system: a white plane defined by a firm border, not a floating shadow, so it
  // matches the ledger and review surfaces (§13 single material).
  const surfaceClass =
    section.key === "review_queue"
      ? "ui-surface-inspection"
      : "rounded-[8px] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

  return (
    <DashboardPanel
      titleId={ariaId}
      icon={Icon}
      title={title}
      count={section.count}
      countUnit={SECTION_COUNT_NOUN[section.key]}
      action={
        section.actionLabel && section.key !== "data_gaps"
          ? { label: section.actionLabel, href: section.href, quiet: true }
          : undefined
      }
      footer={footer}
      className={surfaceClass}
      bodyClassName={section.key === "data_gaps" ? "p-0" : "p-2"}
    >
      {children}
    </DashboardPanel>
  );
}
