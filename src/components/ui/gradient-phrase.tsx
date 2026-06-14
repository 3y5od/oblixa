import type { ReactNode } from "react";

export interface GradientPhraseProps {
  children: ReactNode;
}

/**
 * v46: gradient text is retired with the editorial system — the emphasized
 * wedge of a heading renders in solid cobalt ink. The component name and
 * call sites stay; only the treatment flattened.
 */
export function GradientPhrase({ children }: GradientPhraseProps) {
  return <span style={{ color: "var(--accent-strong)" }}>{children}</span>;
}
