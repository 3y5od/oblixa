export interface SectionLocatorProps {
  /** 1-indexed section number; zero-padded to 2 digits on render. */
  index: number;
  /** Total section count for the page. */
  total: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Left-margin section locator displayed at xl+ only. Pure decoration — the
 * "01 / 06" marker provides ambient orientation without scroll-spy logic.
 *
 * Below xl the locator is hidden; mobile users get the inline locator
 * pattern via the section eyebrow (Tier 13.4).
 */
export function SectionLocator({ index, total }: SectionLocatorProps) {
  return (
    <span
      aria-hidden
      className="hidden xl:block pointer-events-none absolute left-6 top-12 select-none text-[10.5px] font-bold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
      style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
    >
      {pad(index)}
      <span className="text-[var(--text-tertiary)]"> / {pad(total)}</span>
    </span>
  );
}
