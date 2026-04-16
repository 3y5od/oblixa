import type { ReactNode } from "react";
import { MarketingSiteFooter, MarketingSiteHeader } from "@/components/landing/marketing-site-chrome";

/** ISR for public legal/marketing HTML — safe to bump if copy is mostly static. */
export const revalidate = 86400;

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-[radial-gradient(circle_at_top,var(--canvas-glow),transparent_28%),linear-gradient(180deg,color-mix(in_oklab,var(--canvas)_94%,white),var(--canvas-strong))]">
      <MarketingSiteHeader />
      <div className="flex-1">{children}</div>
      <MarketingSiteFooter />
    </div>
  );
}
