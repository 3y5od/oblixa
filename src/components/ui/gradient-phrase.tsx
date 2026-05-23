import type { ReactNode } from "react";

export interface GradientPhraseProps {
  children: ReactNode;
}

/**
 * Applies an accent → accent-strong → violet gradient to a wedge of h1/h2
 * text via `bg-clip-text text-transparent`. Use to draw the eye to the
 * subject of a section heading.
 *
 * Includes a `@supports`-style fallback via inline color so browsers
 * without `background-clip: text` still render the phrase legibly.
 *
 * Decorative — the wrapped text remains semantic.
 */
export function GradientPhrase({ children }: GradientPhraseProps) {
  return (
    <span
      className="bg-clip-text text-transparent"
      style={{
        color: "var(--accent-strong)",
        backgroundImage:
          "linear-gradient(100deg, var(--accent) 0%, var(--accent-strong) 38%, color-mix(in oklab, var(--accent-strong) 60%, oklch(0.55 0.18 290)) 78%, color-mix(in oklab, var(--accent-strong) 30%, oklch(0.65 0.18 290)) 100%)",
      }}
    >
      {children}
    </span>
  );
}
