import Link from "next/link";
import { Check, ChevronRight, type LucideIcon } from "lucide-react";

export type ContractSignalTone = "attention" | "danger" | "healthy" | "neutral" | "info";

/**
 * One cell of the Core contract action-summary strip. Anchors its figure with a
 * tone-tinted medallion (§11.17) and renders an affirmative zero state — a
 * cleared (healthy + 0) cell swaps the metric glyph for a Check and tints muted
 * success rather than greying out (§2.11 / §10.10). Hover/focus reveals the
 * structured action chip (§8.6).
 */
export function ContractSignalCell({
  label,
  value,
  unit,
  tone,
  href,
  actionLabel,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone: ContractSignalTone;
  href: string;
  actionLabel?: string;
  icon: LucideIcon;
}) {
  const isHealthyZero = tone === "healthy" && value === 0;
  const numberColor = isHealthyZero
    ? "color-mix(in oklab, var(--success-ink) 55%, var(--text-tertiary))"
    : tone === "danger"
      ? "var(--danger-ink)"
      : tone === "attention"
        ? "var(--warning-ink)"
        : "var(--text-primary)";
  const medallionInk =
    tone === "danger"
      ? "var(--danger-ink)"
      : tone === "attention"
        ? "var(--warning-ink)"
        : tone === "healthy"
          ? "var(--success-ink)"
          : tone === "info"
            ? "var(--accent-strong)"
            : "var(--text-tertiary)";
  const MedallionIcon = isHealthyZero ? Check : Icon;
  return (
    <Link
      href={href}
      className="group flex h-full min-w-0 flex-col border-t border-[var(--border-subtle)] px-5 py-4 transition-colors first:border-t-0 hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_32%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] lg:border-l lg:border-t-0 lg:first:border-l-0"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden
            className="inline-flex h-2 w-2 min-w-[0.625rem] shrink-0 items-center justify-center"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: isHealthyZero
                  ? "color-mix(in oklab, var(--success-ink) 60%, transparent)"
                  : tone === "danger"
                    ? "var(--danger-ink)"
                    : tone === "attention"
                      ? "var(--warning-ink)"
                      : tone === "healthy"
                        ? "var(--success-ink)"
                        : "var(--border-strong)",
                boxShadow: isHealthyZero
                  ? "none"
                  : `0 0 0 2.5px color-mix(in oklab, ${
                      tone === "danger"
                        ? "var(--danger-soft)"
                        : tone === "attention"
                          ? "var(--warning-soft)"
                          : tone === "healthy"
                            ? "var(--success-soft)"
                            : "var(--surface-muted)"
                    } 42%, transparent)`,
              }}
            />
          </span>
          <p className="ui-caps-2 text-[var(--text-tertiary)]">{label}</p>
        </div>
        {isHealthyZero || !actionLabel ? null : (
          <span className="inline-flex items-center gap-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--accent-strong)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {actionLabel}
            <ChevronRight className="h-2.5 w-2.5" strokeWidth={1.85} aria-hidden />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          aria-hidden
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center self-center rounded-md border"
          style={{
            borderColor: `color-mix(in oklab, ${medallionInk} 28%, var(--border-card))`,
            background: `color-mix(in oklab, ${medallionInk} 12%, var(--surface))`,
            color: medallionInk,
          }}
        >
          <MedallionIcon className="h-3.5 w-3.5" strokeWidth={2.1} />
        </span>
        <p
          className="text-[1.75rem] font-semibold leading-none tabular-nums tracking-[-0.02em]"
          style={{ color: numberColor }}
        >
          {value}
        </p>
        {unit ? (
          (() => {
            const isToned = tone === "danger" || tone === "attention";
            const toneInk =
              tone === "danger"
                ? "var(--danger-ink)"
                : tone === "attention"
                  ? "var(--warning-ink)"
                  : "var(--text-tertiary)";
            const toneSoft =
              tone === "danger"
                ? "var(--danger-soft)"
                : tone === "attention"
                  ? "var(--warning-soft)"
                  : "var(--surface-muted)";
            // §2.11: healthy/zero cells keep the unit chip — it switches to a
            // muted-success tint instead of being suppressed, so the cell
            // anatomy stays identical to its active siblings.
            const borderColor = isHealthyZero
              ? "color-mix(in oklab, var(--success-ink) 22%, var(--border-card))"
              : isToned
                ? `color-mix(in oklab, ${toneInk} 24%, var(--border-card))`
                : "var(--border-card)";
            const background = isHealthyZero
              ? "color-mix(in oklab, var(--success-soft) 30%, var(--surface-raised))"
              : isToned
                ? `color-mix(in oklab, ${toneSoft} 28%, var(--surface-raised))`
                : "transparent";
            const color = isHealthyZero
              ? "color-mix(in oklab, var(--success-ink) 68%, var(--text-tertiary))"
              : isToned
                ? toneInk
                : "var(--text-tertiary)";
            return (
              <span
                className="inline-flex h-4 items-center self-center rounded-md border px-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none"
                style={{ borderColor, background, color }}
              >
                {unit}
              </span>
            );
          })()
        ) : null}
      </div>
    </Link>
  );
}
