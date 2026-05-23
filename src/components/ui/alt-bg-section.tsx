import type { ReactNode } from "react";

export interface AltBgSectionProps {
  children: ReactNode;
  /** When true, applies the subtle accent-tinted bg via `.section-bg-alt`. */
  alternate?: boolean;
  /** Optional extra class names merged into the wrapping div. */
  className?: string;
}

/**
 * Drop-in wrapper that applies the alternating section background tint
 * (`.section-bg-alt`) when `alternate` is true. Lets pages alternate adjacent
 * section bgs without boilerplate.
 *
 * The wrapper is a plain `<div>`, not a `<section>`, so it can compose with
 * existing `<section>` elements that already carry semantic landmarks.
 */
export function AltBgSection({ children, alternate = false, className }: AltBgSectionProps) {
  return (
    <div className={`${alternate ? "section-bg-alt" : ""} ${className ?? ""}`.trim()}>
      {children}
    </div>
  );
}
