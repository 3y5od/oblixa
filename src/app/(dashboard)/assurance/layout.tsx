import type { ReactNode } from "react";
import { getAuthContext } from "@/lib/supabase/server";
import { incrementV6QualityCounter, recordAssuranceHubVisitor } from "@/lib/v6/telemetry";
import { assertAssuranceWorkspaceOrRedirect } from "@/lib/product-surface/route-guard";

/**
 * Counts authenticated renders under /assurance/* for adoption-style metrics (v6 success metrics).
 */
export default async function AssuranceSectionLayout({ children }: { children: ReactNode }) {
  await assertAssuranceWorkspaceOrRedirect();
  const ctx = await getAuthContext();
  if (ctx?.orgId) {
    await incrementV6QualityCounter(ctx.admin, ctx.orgId, "assurance_hub_layout_renders_total", 1).catch(
      () => undefined
    );
    await recordAssuranceHubVisitor(ctx.admin, ctx.orgId, ctx.user.id).catch(() => undefined);
  }
  return <>{children}</>;
}
