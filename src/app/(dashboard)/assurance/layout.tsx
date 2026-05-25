import type { ReactNode } from "react";
import { getAuthContext } from "@/lib/supabase/server";
import { incrementAssuranceQualityCounter, recordAssuranceHubVisitor } from "@/lib/assurance/telemetry";

/**
 * Counts authenticated renders under /assurance/* for adoption-style metrics (v6 success metrics).
 */
export default async function AssuranceSectionLayout({ children }: { children: ReactNode }) {
  const ctx = await getAuthContext();
  if (ctx?.orgId) {
    await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "assurance_hub_layout_renders_total", 1).catch(
      () => undefined
    );
    await recordAssuranceHubVisitor(ctx.admin, ctx.orgId, ctx.user.id).catch(() => undefined);
  }
  return <>{children}</>;
}
