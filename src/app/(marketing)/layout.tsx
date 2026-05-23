import type { ReactNode } from "react";
import { MarketingSiteFooter, MarketingSiteHeader } from "@/components/landing/marketing-site-chrome";
import { MarketingPageWrapper } from "@/components/ui/marketing-page-wrapper";

/** ISR for public legal/marketing HTML — safe to bump if copy is mostly static. */
export const revalidate = 86400;

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="landing-root relative flex min-h-full flex-col bg-canvas">
      <div aria-hidden className="landing-header-backdrop" />
      <MarketingSiteHeader />
      <MarketingPageWrapper>
        <div className="flex-1">{children}</div>
      </MarketingPageWrapper>
      <MarketingSiteFooter />
    </div>
  );
}
