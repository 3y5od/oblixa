import Link from "next/link";
import { Suspense } from "react";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getAuthContext } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import { ReportsAdvancedContent } from "./reports-advanced-content";

function ReportsAdvancedFallback() {
  return (
    <div className="ui-page-stack" aria-hidden>
      <div className="ui-page-header space-y-3">
        <div className="ui-skeleton h-4 w-40 rounded" />
        <div className="ui-skeleton h-10 w-72 rounded" />
        <div className="ui-skeleton h-4 max-w-xl rounded" />
      </div>
      <div className="ui-skeleton h-40 rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="ui-skeleton h-36 rounded-2xl" />
        <div className="ui-skeleton h-36 rounded-2xl" />
        <div className="ui-skeleton h-36 rounded-2xl" />
      </div>
    </div>
  );
}

export default async function ReportsControlRoomPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const { admin, orgId, role } = ctx;
  const productSurface = await loadProductSurfaceContext(admin, orgId, role as WorkspaceRole);
  if (productSurface.mode === "core") {
    return (
      <div className="ui-page-stack">
        <header className="ui-page-header">
          <div>
            <p className="ui-eyebrow">Reports</p>
            <h1 className="ui-display-title mt-2">Operational reports</h1>
            <p className="ui-muted-tight mt-2 max-w-2xl">
              Standard report packs and execution summaries for the current workspace surface.
            </p>
          </div>
          <Link href="/contracts/reports" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
            Contract report packs
          </Link>
        </header>
      </div>
    );
  }

  return (
    <Suspense fallback={<ReportsAdvancedFallback />}>
      <ReportsAdvancedContent
        admin={admin}
        orgId={orgId}
        role={role as WorkspaceRole}
        productSurface={productSurface}
      />
    </Suspense>
  );
}
