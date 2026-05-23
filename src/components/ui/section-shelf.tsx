export interface SectionShelfProps {
  anchor?: "center" | "left" | "right";
  className?: string;
}

/**
 * 60%-width gradient hairline divider used between sections. Asymmetric
 * anchor variants alternate left/right across a page for rhythm.
 *
 * Pure decoration — `aria-hidden`.
 */
export function SectionShelf({ anchor = "center", className }: SectionShelfProps) {
  const variant =
    anchor === "left"
      ? "section-shelf--left"
      : anchor === "right"
        ? "section-shelf--right"
        : "";
  return <div aria-hidden className={`section-shelf ${variant} ${className ?? ""}`} />;
}
