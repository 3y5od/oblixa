import type { ReactNode } from "react";

export interface MarketingPageWrapperProps {
  children: ReactNode;
}

/**
 * Page-level atmospheric envelope: a single fixed-position backdrop that
 * paints consistent subtle gradient color across every viewport position
 * as the user scrolls. Replaces the random per-section background
 * alternation with one coherent ambient layer.
 *
 * Sections sit on top of this layer with `position: relative` and (mostly)
 * transparent backgrounds, so the page-level atmosphere shows through
 * everywhere. Hero + Closing CTA keep their rich `landing-luminous`
 * treatments as bookend showpieces.
 */
export function MarketingPageWrapper({ children }: MarketingPageWrapperProps) {
  return (
    <div className="relative">
      <div aria-hidden className="marketing-page-atmosphere" />
      <div className="relative" style={{ zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
