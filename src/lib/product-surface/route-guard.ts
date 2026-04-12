import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import { roleMayBypassProductRoute } from "@/lib/product-surface/nav-visibility";

function modeRank(mode: WorkspaceProductMode): number {
  if (mode === "assurance") return 2;
  if (mode === "advanced") return 1;
  return 0;
}

/**
 * Redirects to `/dashboard` when the org workspace mode is below `minMode`
 * (non-admin users). Admins may open gated routes for support/testing.
 */
export async function assertWorkspaceModeAtLeast(minMode: WorkspaceProductMode): Promise<void> {
  const ctx = await getAuthContext();
  if (!ctx) return;
  if (roleMayBypassProductRoute(ctx.role as WorkspaceRole)) return;

  const surface = await loadProductSurfaceContext(ctx.admin, ctx.orgId, ctx.role as WorkspaceRole);
  if (modeRank(surface.mode) >= modeRank(minMode)) return;
  notFound();
}

export async function assertAssuranceWorkspaceOrRedirect(): Promise<void> {
  const ctx = await getAuthContext();
  if (!ctx) return;
  if (roleMayBypassProductRoute(ctx.role as WorkspaceRole)) return;

  const surface = await loadProductSurfaceContext(ctx.admin, ctx.orgId, ctx.role as WorkspaceRole);
  const allow =
    surface.mode === "assurance" ||
    (surface.v6.assurance_nav_admin_testing === true && ctx.role === "admin");
  if (allow) return;
  redirect("/dashboard");
}

/**
 * §10.4 utility routes: Core orgs should reach these via Settings / More / contextual links only.
 * Non-admins in Core mode are redirected to the dashboard (admins may open for support).
 */
export async function assertCoreUtilitySurfaceOrRedirect(): Promise<void> {
  const ctx = await getAuthContext();
  if (!ctx) return;
  if (roleMayBypassProductRoute(ctx.role as WorkspaceRole)) return;

  const surface = await loadProductSurfaceContext(ctx.admin, ctx.orgId, ctx.role as WorkspaceRole);
  if (surface.mode !== "core") return;
  redirect("/dashboard");
}
