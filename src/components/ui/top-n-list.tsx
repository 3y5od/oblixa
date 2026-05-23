import Link from "next/link";
import type { StatTone } from "@/components/ui/stat-cell";

export interface TopNItem {
  label: string;
  value: number;
  tone?: StatTone;
  href?: string;
  meta?: string;
}

export interface TopNListProps {
  items: TopNItem[];
  unit?: string;
  className?: string;
  emptyLabel?: string;
  ariaLabel?: string;
}

function toneColor(tone?: StatTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  return "var(--accent-strong)";
}

export function TopNList({
  items,
  unit,
  className,
  emptyLabel = "No data yet",
  ariaLabel,
}: TopNListProps) {
  if (items.length === 0) {
    return (
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        {emptyLabel.toUpperCase()}
      </p>
    );
  }
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <ul aria-label={ariaLabel} className={`space-y-2 ${className ?? ""}`.trim()}>
      {items.map((item) => {
        const pct = Math.max(2, Math.round((item.value / max) * 100));
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)]">
                {item.label}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none tabular-nums text-[var(--text-secondary)]">
                <span>{item.value}</span>
                {unit ? <span className="text-[var(--text-tertiary)]">{unit.toUpperCase()}</span> : null}
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--border-subtle)_50%,transparent)]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: toneColor(item.tone),
                }}
              />
            </div>
            {item.meta ? (
              <span
                className="mt-1 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none"
                style={{
                  color: toneColor(item.tone),
                  background: `color-mix(in oklab, ${toneColor(item.tone)} 10%, transparent)`,
                }}
              >
                {item.meta.toUpperCase()}
              </span>
            ) : null}
          </>
        );
        return (
          <li key={item.label}>
            {item.href ? (
              <Link
                href={item.href}
                className="block rounded-md px-1 py-1 transition-colors hover:bg-[var(--surface-tint-soft)] focus-visible:bg-[var(--surface-tint-soft)] focus-visible:outline-none"
              >
                {inner}
              </Link>
            ) : (
              <div className="px-1 py-1">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
