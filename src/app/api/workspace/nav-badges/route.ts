import { NextResponse } from "next/server";
import { jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { fetchNavBadgeCounts } from "@/lib/dashboard-data";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import {
  filterNavBadgesForSurface,
  toNavSurfaceInput,
} from "@/lib/product-surface/nav-visibility";
import { getAuthContext } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";

const ROUTE = "/api/workspace/nav-badges";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return jsonUnauthorized(ROUTE);
  }

  try {
    const role = ctx.role as WorkspaceRole;
    const [rawNavBadges, surface] = await Promise.all([
      fetchNavBadgeCounts(ctx.orgId, ctx.user.id),
      loadProductSurfaceContext(ctx.admin, ctx.orgId, role),
    ]);
    const navSurface = toNavSurfaceInput(surface);
    return NextResponse.json(
      { navBadges: filterNavBadgesForSurface(rawNavBadges, navSurface) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error(
      "[workspace/nav-badges] failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    return jsonProblem(500, {
      error: "Could not load nav badges",
      code: "nav_badges_load_failed",
      diagnostic_id: "nav_badges_load_failed",
      route: ROUTE,
    });
  }
}
