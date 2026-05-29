import type { ReactNode } from "react";

export interface DashboardPageHeaderProps {
  icon: ReactNode;
  eyebrow: string;
  /** When true, eyebrow is suppressed (e.g., fallback "Workspace" placeholder).
   *  The icon + liveTick still render together as a context cluster. */
  suppressEyebrow?: boolean;
  title: string;
  /** Optional supporting copy. Omit (or pass empty string) to render header alone.
   *  Accepts a ReactNode so callers can embed inline links. */
  lead?: ReactNode;
  actions?: ReactNode;
  /** Optional 2-letter monogram derived from the workspace name. */
  monogram?: string;
  /** Optional live-tick badge content (e.g. "LIVE · 12s ago"). */
  liveTick?: string;
  /** Optional metadata strip rendered below the title (e.g., "12 contracts · Core plan"). */
  metaStrip?: ReactNode;
  /** When true, drops the accent dot before the eyebrow (use on sub-utility pages
   *  where the dot competes with a back-arrow or icon medallion). */
  noEyebrowDot?: boolean;
  /** "compact" tightens the medallion to 36px and the h1 to 1.375/1.5rem so the
   *  header reads as app chrome on dense operational pages. */
  density?: "compact" | "default";
  /** Optional inline suffix rendered immediately after the h1 text — used for
   *  scope chips (e.g., "Contracts: 5") that should attach visually to the
   *  page identity instead of floating below. */
  titleSuffix?: ReactNode;
}

function monogramColors(seed: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const PALETTE = [
    { bg: "oklch(0.55 0.08 258)", fg: "oklch(0.98 0.005 250)" },
    { bg: "oklch(0.5 0.06 220)", fg: "oklch(0.98 0.005 250)" },
    { bg: "oklch(0.52 0.07 280)", fg: "oklch(0.98 0.005 250)" },
    { bg: "oklch(0.55 0.05 195)", fg: "oklch(0.98 0.005 250)" },
    { bg: "oklch(0.48 0.04 260)", fg: "oklch(0.98 0.005 250)" },
    { bg: "oklch(0.58 0.06 240)", fg: "oklch(0.98 0.005 250)" },
  ];
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

export function DashboardPageHeader({
  icon,
  eyebrow,
  suppressEyebrow,
  title,
  lead,
  actions,
  monogram,
  liveTick,
  metaStrip,
  noEyebrowDot,
  density = "default",
  titleSuffix,
}: DashboardPageHeaderProps) {
  const monoColors = monogram ? monogramColors(monogram) : null;
  const isCompact = density === "compact";
  const tileSize = isCompact ? "h-8 w-8" : "h-10 w-10";
  // `rounded-md` (6px) reads as unambiguously square at the 32-40px tile
  // size; the canonical `rounded-xl` (12px) was perceived as too
  // soft/circular against the accent-tinted bg + soft border.
  const tileRadius = isCompact ? "rounded-md" : "rounded-md";
  const titleScale = isCompact
    ? "text-[1.25rem] sm:text-[1.375rem]"
    : "text-[1.75rem] sm:text-[2rem]";
  // When the title column is *only* an h1 (no eyebrow, no lead, no
  // metaStrip line above), `items-start` leaves the 40px medallion
  // visually unanchored with the h1's cap-line because the h1's mt-1
  // pushes the title down 4px while the medallion stays flush. In that
  // single-line case we switch to `items-center` so the medallion's
  // vertical center aligns with the h1's center.
  const showEyebrowRow = (!suppressEyebrow || liveTick) && true;
  const titleColumnIsSingleLine =
    !showEyebrowRow && !lead && !metaStrip;
  return (
    <header className="relative flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div
        className={`flex min-w-0 gap-3.5 ${titleColumnIsSingleLine ? "items-center" : "items-start"}`}
      >
        {/* §2.4 canonical icon tile — accent-tinted bg + border. Compact density
            shrinks 40px→36px and `rounded-xl`→`rounded-[10px]` for dense ops pages. */}
        {monogram && monoColors ? (
          <span
            aria-hidden
            className={`relative inline-flex ${tileSize} shrink-0 items-center justify-center ${tileRadius} ${isCompact ? "text-[12.5px]" : "text-[14px]"} font-semibold tracking-tight shadow-[var(--shadow-1)]`}
            style={{ background: monoColors.bg, color: monoColors.fg }}
          >
            {monogram}
          </span>
        ) : (
          <span
            aria-hidden
            className={`inline-flex ${tileSize} shrink-0 items-center justify-center ${tileRadius} border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]`}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {suppressEyebrow && !liveTick ? null : (
            <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              {suppressEyebrow ? null : (
                <span
                  className={`${noEyebrowDot ? "" : "landing-eyebrow-dot "}ui-caps-2 text-[var(--accent-strong)]`}
                >
                  {eyebrow}
                </span>
              )}
              {liveTick ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[color:color-mix(in_oklab,var(--success-soft)_60%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_22%,var(--surface-raised))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--success-ink)]">
                  <span
                    aria-hidden
                    className="relative inline-flex h-2 w-2 items-center justify-center"
                  >
                    <span
                      className="absolute inset-0 animate-pulse rounded-full"
                      style={{
                        background:
                          "color-mix(in oklab, var(--success-ink) 28%, transparent)",
                        animationDuration: "2.5s",
                      }}
                    />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-[var(--success-ink)]" />
                  </span>
                  {liveTick}
                </span>
              ) : null}
            </p>
          )}
          {/* §3 + §2.4 canonical h1 scale: text-[1.75rem] sm:text-[2rem]
              semibold leading-[1.1] tracking-tight. `mt-1` exists to
              breathe between the eyebrow and the title — drop it when
              the eyebrow row is suppressed so the h1 sits at its
              natural baseline. */}
          <h1
            className={`${titleScale} font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] ${showEyebrowRow ? "mt-1" : ""}`}
          >
            <span className="inline-flex flex-wrap items-baseline gap-x-2">
              <span>{title}</span>
              {titleSuffix ? (
                <span className="inline-flex items-baseline gap-1.5">
                  {titleSuffix}
                </span>
              ) : null}
            </span>
          </h1>
          {lead ? (
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-snug text-[var(--text-secondary)]">
              {lead}
            </p>
          ) : null}
        </div>
      </div>
      {/* §5.1 right-aligned dl meta strip + action cluster. */}
      <div className="flex shrink-0 flex-wrap items-start justify-end gap-x-3 gap-y-2">
        {metaStrip ? (
          <dl className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 self-center text-[11.5px] text-[var(--text-secondary)]">
            {metaStrip}
          </dl>
        ) : null}
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
