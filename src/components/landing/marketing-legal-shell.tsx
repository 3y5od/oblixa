import type { ReactNode } from "react";

export function MarketingLegalShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">{children}</div>
  );
}
