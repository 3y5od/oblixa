import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { DashboardFocusCard } from "./dashboard-upper-focus-cards";

export function DashboardUpperTopCards({ cards }: { cards: DashboardFocusCard[] }) {
  return (
    <>
      <h2 id="dashboard-status-h" className="sr-only">
        {dashboardStatusSummary(cards)}
      </h2>
      <section aria-label="Top cards" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.slice(0, 6).map((card) => (
          <DashboardUpperTopCard key={card.id} card={card} />
        ))}
      </section>
    </>
  );
}

function dashboardStatusSummary(cards: DashboardFocusCard[]) {
  const active = cards.slice(0, 6).filter((card) => card.count > 0);
  if (active.length === 0) return "All clear \u2014 nothing needs attention";
  const total = active.reduce((sum, card) => sum + card.count, 0);
  return `${total} ${total === 1 ? "item" : "items"} need attention: ${active
    .map((card) => `${card.count} ${card.title.toLowerCase()}`)
    .join(", ")}`;
}

function DashboardUpperTopCard({ card }: { card: DashboardFocusCard }) {
  const tone: "neutral" | "success" | "warning" | "danger" =
    card.tone === "risk" ? "danger" : card.tone === "attention" ? "warning" : card.tone === "healthy" ? "success" : "neutral";
  const isZero = card.count === 0;
  const ink = isZero
    ? "color-mix(in oklab, var(--success-ink) 55%, var(--text-tertiary))"
    : tone === "danger"
      ? "var(--danger-ink)"
      : tone === "warning"
        ? "var(--warning-ink)"
        : "var(--text-primary)";
  const Icon = card.icon;

  return (
    <Link
      href={card.href}
      aria-label={`${card.title}: ${card.count}. ${card.actionLabel}.`}
      className="group relative flex flex-col gap-2 overflow-hidden rounded-xl border bg-[var(--surface-raised)] px-3.5 py-3 transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-strong))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--accent)_45%,transparent)]"
      style={{
        borderColor: isZero
          ? "color-mix(in oklab, var(--success-ink) 14%, var(--border-card))"
          : tone !== "neutral"
            ? `color-mix(in oklab, ${ink} 18%, var(--border-card))`
            : "var(--border-card)",
        background: isZero
          ? "var(--surface-raised)"
          : tone !== "neutral"
            ? `color-mix(in oklab, ${ink} 3%, var(--surface-raised))`
            : "var(--surface-raised)",
      }}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden style={{ color: ink }} />
        <span className="ui-caps-3 truncate text-[var(--text-tertiary)]" style={{ color: isZero ? "var(--text-tertiary)" : ink }}>
          {card.title}
        </span>
      </div>
      <p className="text-[1.625rem] font-semibold leading-none tabular-nums tracking-[-0.02em]" style={{ color: ink }}>
        {card.count}
      </p>
      <p className="mt-auto inline-flex items-center justify-between gap-1.5 text-[11.5px] font-medium leading-none text-[var(--text-tertiary)]">
        <span className="truncate">{card.actionLabel}</span>
        <ArrowRight className="h-3 w-3 shrink-0 transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden style={{ color: isZero ? "var(--text-tertiary)" : "var(--accent-strong)" }} />
      </p>
    </Link>
  );
}
