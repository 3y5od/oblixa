import type { ReactNode } from "react";
import { MarketingSiteFooter, MarketingSiteHeader } from "@/components/landing/marketing-site-chrome";

/** ISR for public legal/marketing HTML — safe to bump if copy is mostly static. */
export const revalidate = 86400;

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ui-public-shell flex min-h-full flex-col">
      <MarketingSiteHeader />
      <div className="flex-1">{children}</div>
      <MarketingSiteFooter />
    </div>
  );
}
