import type { ReactNode } from "react";

/** ISR for public legal/marketing HTML — safe to bump if copy is mostly static. */
export const revalidate = 86400;

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return children;
}
