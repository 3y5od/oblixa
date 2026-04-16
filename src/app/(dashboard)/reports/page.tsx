import Link from "next/link";
import { Suspense } from "react";
import { BarChart3, ClipboardList, Sparkles } from "lucide-react";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getAuthContext } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import { ReportsAdvancedContent } from "./reports-advanced-content";
import { OperationalSurfaceLinkCard } from "@/components/ui/operational-summary-card";

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
              Standard report packs, execution summaries, and workspace-safe reporting entry points.
            </p>
          </div>
          <Link href="/contracts/reports" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
            Contract report packs
          </Link>
        </header>
        <section className="ui-page-shell space-y-4">
          <div>
            <p className="ui-eyebrow">Collections</p>
            <h2 className="ui-section-title mt-2 text-xl">Report families</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <OperationalSurfaceLinkCard
              href="/contracts/reports"
              eyebrow="Pack"
              title="Contract report packs"
              hint="Portfolio packs, trend views, and operational exports."
              actionLabel="Open report packs"
              icon={ClipboardList}
              tone="neutral"
            />
            <OperationalSurfaceLinkCard
              href="/contracts/review-cadence"
              eyebrow="Ritual"
              title="Review cadence"
              hint="Weekly and monthly review ritual workspace."
              actionLabel="Open cadence workspace"
              icon={BarChart3}
              tone="neutral"
            />
            <OperationalSurfaceLinkCard
              href="/more"
              eyebrow="Tools"
              title="Reporting-adjacent tools"
              hint="Utilities, diagnostics, and governed jump points."
              actionLabel="Browse tools"
              icon={Sparkles}
              tone="neutral"
            />
          </div>
        </section>
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
