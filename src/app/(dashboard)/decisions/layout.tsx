import type { ReactNode } from "react";
import { assertWorkspaceModeAtLeast } from "@/lib/product-surface/route-guard";

export default async function DecisionsSectionLayout({ children }: { children: ReactNode }) {
  await assertWorkspaceModeAtLeast("advanced");
  return <>{children}</>;
}
