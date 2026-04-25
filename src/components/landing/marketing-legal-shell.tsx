import type { ReactNode } from "react";

export function MarketingLegalShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="ui-public-minimal-shell flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col py-10 sm:py-12">{children}</div>
    </div>
  );
}
