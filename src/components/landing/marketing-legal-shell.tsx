import type { ReactNode } from "react";
import { MarketingSiteFooter, MarketingSiteHeader } from "@/components/landing/marketing-site-chrome";

export function MarketingLegalShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <MarketingSiteHeader />
      {children}
      <MarketingSiteFooter />
    </div>
  );
}
