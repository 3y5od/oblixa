"use client";

import type { ReactNode } from "react";
import { RowActionMenu } from "@/components/ui/row-action-menu";

/**
 * Renewals row overflow menu. Thin wrapper over the shared {@link RowActionMenu}
 * so the renewals server-action menu items (passed as `children`) keep working
 * when portaled, while the portal/positioning/keyboard/dismissal logic stays in
 * one shared primitive across Work, Renewals, Evidence, and Reports.
 */
export function RenewalRowActionsMenu({
  children,
  contractTitle,
}: {
  children: ReactNode;
  contractTitle?: string;
}) {
  return (
    <RowActionMenu
      menuLabel={contractTitle ? `Renewal actions for ${contractTitle}` : "Renewal actions"}
      triggerLabel={contractTitle ? `More renewal actions for ${contractTitle}` : "More actions"}
    >
      {children}
    </RowActionMenu>
  );
}
