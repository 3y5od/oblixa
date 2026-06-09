import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** `neutral` = informational guidance (accent), not alarming. Reserve `warning`
 *  for genuinely failed/expired/revoked states; `success` for completions. */
export type AuthStateTone = "success" | "warning" | "neutral";

function toneTokens(tone: AuthStateTone): { mix: string; ink: string } {
  if (tone === "success") return { mix: "success", ink: "var(--success-ink)" };
  if (tone === "warning") return { mix: "warning", ink: "var(--warning-ink)" };
  return { mix: "accent", ink: "var(--accent-strong)" };
}

/**
 * Centered recovery / success card body shared by every non-form auth state
 * (forgot success, reset complete, reset invalid, signup grant recovery).
 */
export function AuthStateCard({
  tone,
  icon: Icon,
  chip,
  heading,
  body,
  children,
}: {
  tone: AuthStateTone;
  icon: LucideIcon;
  /** Optional compact status token shown above the heading (e.g. "LINK EXPIRED"). */
  chip?: string;
  heading: string;
  body: string;
  /** Action row (links/buttons). */
  children: ReactNode;
}) {
  const { mix, ink } = toneTokens(tone);
  return (
    <div className="flex flex-col items-center gap-4 py-3 text-center">
      <span
        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border"
        style={{
          borderColor: `color-mix(in oklab, var(--${mix}) 26%, var(--border-subtle))`,
          background: `color-mix(in oklab, var(--${mix}-soft) 30%, var(--surface-raised))`,
          color: ink,
        }}
        aria-hidden
      >
        <Icon className="h-5 w-5" strokeWidth={1.85} />
      </span>
      <div>
        {chip ? (
          <p className="mb-2.5">
            <span
              className="ui-caps-2 inline-flex items-center rounded-full border px-2.5 py-1 text-[10.5px]"
              style={{
                borderColor: `color-mix(in oklab, var(--${mix}) 32%, var(--border-subtle))`,
                background: `color-mix(in oklab, var(--${mix}-soft) 26%, var(--surface-raised))`,
                color: ink,
              }}
            >
              {chip}
            </span>
          </p>
        ) : null}
        <h2 className="text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">{heading}</h2>
        <p className="mx-auto mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-[var(--text-secondary)]">{body}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">{children}</div>
    </div>
  );
}
