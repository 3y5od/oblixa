import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { DashboardMetricCell } from "@/components/ui/dashboard-metric-cell";
import type { CoreDashboardSection, CoreDashboardTopCard } from "@/lib/dashboard/core-dashboard-model";
import {
  SECTION_COUNT_NOUN,
  SECTION_DESCRIPTION,
  SECTION_ICONS,
  TOP_CARD_DESCRIPTION,
  TOP_CARD_ICON,
  TOP_CARD_STATE,
  TOP_CARD_UNIT,
  TOP_CARD_ZERO_DESCRIPTION,
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
      description={TOP_CARD_DESCRIPTION[card.key]}
      unit={TOP_CARD_UNIT[card.key]}
      state={TOP_CARD_STATE[card.key]}
      zeroDescription={TOP_CARD_ZERO_DESCRIPTION[card.key]}
      value={card.count}
      tone={card.tone}
      icon={TOP_CARD_ICON[card.key]}
    />
  );
}

export function SectionShell({
  section,
  children,
}: {
  section: CoreDashboardSection;
  children: ReactNode;
}) {
  const ariaId = `${section.key.replace(/_/g, "-")}-h`;
  const footer =
    section.rows.length > 0 && section.count > section.rows.length ? (
      <p className="ui-caps-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)] px-4 py-2 text-[10px] tabular-nums text-[var(--text-tertiary)]">
        Showing {section.rows.length} of {section.count}
      </p>
    ) : null;

  // §13 register: the Review queue is the trust/source-confirmation pane, so it
  // reads on the cool inspection register (matching the full Review page) while
  // the operational queues keep warm chrome. The warm parchment source artifact
  // inside each review row then lifts off the cool pane (warm-source-on-cool-
  // inspection). The other four panels stay on the default warm `ui-card`.
  const surfaceClass = section.key === "review_queue" ? "ui-surface-inspection" : undefined;

  return (
    <DashboardPanel
      titleId={ariaId}
      icon={SECTION_ICONS[section.key]}
      title={section.title}
      description={SECTION_DESCRIPTION[section.key]}
      count={section.count}
      countUnit={SECTION_COUNT_NOUN[section.key]}
      action={section.actionLabel ? { label: section.actionLabel, href: section.href } : undefined}
      footer={footer}
      className={surfaceClass}
    >
      {children}
    </DashboardPanel>
  );
}
