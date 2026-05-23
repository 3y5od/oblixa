import type { StatTone } from "@/components/ui/stat-cell";

export interface ToneDotProps {
  tone: StatTone;
  size?: "xs" | "sm" | "md";
  pulse?: boolean;
  className?: string;
}

function toneInk(tone: StatTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  return "color-mix(in oklab, var(--border-strong) 70%, var(--text-tertiary))";
}

const SIZES: Record<NonNullable<ToneDotProps["size"]>, string> = {
  xs: "h-1.5 w-1.5",
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
};

/**
 * Tone-tinted indicator dot. Used wherever a single-color status signal
 * needs a stand-alone visual anchor (Pulse rows, activity status, etc).
 */
export function ToneDot({
  tone,
  size = "xs",
  pulse = false,
  className,
}: ToneDotProps) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full ${SIZES[size]} ${pulse ? "animate-pulse" : ""} ${className ?? ""}`.trim()}
      style={{
        background: toneInk(tone),
        animationDuration: pulse ? "2.5s" : undefined,
      }}
    />
  );
}
