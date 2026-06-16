import type { ReactNode } from "react";

export interface IntakeActionBarState {
  /** Sentence-case state label (e.g. "Ready to upload", "Add a contract name"). */
  label: string;
  /** Tone for the leading status dot. "neutral" (default) = quiet rule color,
   *  "ready" = success, "warning" = source amber. Color is never the only
   *  signal — the label always states the condition (§16). */
  tone?: "neutral" | "ready" | "warning";
}

export interface IntakeActionBarProps {
  state: IntakeActionBarState;
  /** Why the primary action is unavailable, shown under the state label when the
   *  reason is not obvious (§15). Reserve the line height even when absent so the
   *  bar does not change height as state changes. */
  disabledReason?: string;
  primary: ReactNode;
  secondary?: ReactNode;
  className?: string;
}

function dotColor(tone: IntakeActionBarState["tone"]): string {
  switch (tone) {
    case "ready":
      return "var(--success-ink)";
    case "warning":
      return "var(--warning-ink)";
    default:
      return "var(--border-strong)";
  }
}

/**
 * The persistent footer action bar shared by both intake forms. A hairline top
 * rule and a quiet surface-muted band. The left side carries a small tone dot +
 * the current state label, with the disabled reason beneath it explaining the
 * missing condition; the right side holds the secondary then primary actions.
 * Sentence case, stable height — the reason line's space is reserved so the bar
 * never shifts as state changes (§2.2 no layout shift).
 */
export function IntakeActionBar({
  state,
  disabledReason,
  primary,
  secondary,
  className,
}: IntakeActionBarProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_60%,var(--surface-raised))] px-4 py-3 sm:px-5 ${className ?? ""}`.trim()}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          aria-hidden
          className="mt-[5px] inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: dotColor(state.tone) }}
        />
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium leading-snug text-[var(--text-primary)]">
            {state.label}
          </p>
          {/* Reserve the reason line so the bar height is stable across states. */}
          <p
            className="min-h-[1rem] text-[11.5px] leading-snug text-[var(--text-tertiary)]"
            aria-hidden={disabledReason ? undefined : true}
          >
            {disabledReason ?? " "}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {secondary ? <div className="shrink-0">{secondary}</div> : null}
        <div className="shrink-0">{primary}</div>
      </div>
    </div>
  );
}
