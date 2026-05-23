export interface HairlineDividerProps {
  orientation?: "horizontal" | "vertical";
  tone?: "subtle" | "strong";
  className?: string;
}

/**
 * Visual breath between adjacent chips / rows / sections. Use sparingly —
 * the v7 default for chip separation is whitespace + weight gradation, not
 * dividers.
 */
export function HairlineDivider({
  orientation = "horizontal",
  tone = "subtle",
  className,
}: HairlineDividerProps) {
  const opacity = tone === "strong" ? 70 : 40;
  const color = `color-mix(in oklab, var(--border-subtle) ${opacity}%, transparent)`;
  if (orientation === "vertical") {
    return (
      <span
        aria-hidden
        className={`inline-block h-3 w-px self-center ${className ?? ""}`.trim()}
        style={{ background: color }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`block h-px w-full ${className ?? ""}`.trim()}
      style={{ background: color }}
    />
  );
}
