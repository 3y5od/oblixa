import { Suspense } from "react";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardUpper } from "@/components/dashboard/dashboard-upper";
import { DashboardLower } from "@/components/dashboard/dashboard-lower";
import type { WorkspaceRole } from "@/lib/navigation";

function DashboardUpperFallback() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-40 animate-pulse rounded-2xl bg-zinc-100/80" />
      <div className="h-24 animate-pulse rounded-2xl bg-zinc-100/80" />
      <div className="h-32 animate-pulse rounded-2xl bg-zinc-100/80" />
    </div>
  );
}

function DashboardLowerFallback() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="h-64 animate-pulse rounded-2xl bg-zinc-100/80" />
        <div className="h-64 animate-pulse rounded-2xl bg-zinc-100/80" />
        <div className="h-64 animate-pulse rounded-2xl bg-zinc-100/80" />
      </div>
      <div className="h-48 animate-pulse rounded-2xl bg-zinc-100/80" />
    </div>
  );
}

export default async function DashboardPage(props: {
  searchParams: Promise<{ view?: string; qf?: string }>;
}) {
  const { view: rawView, qf: rawQuickFilter } = await props.searchParams;
  const view =
    rawView === "team" || rawView === "portfolio" || rawView === "personal"
      ? rawView
      : "personal";
  const quickFilter =
    rawQuickFilter === "approvals" ||
    rawQuickFilter === "deadlines" ||
    rawQuickFilter === "data_gaps"
      ? rawQuickFilter
      : "all";
  const ctx = await getAuthContext();
  if (!ctx) {
    return <WorkspaceRequiredState />;
  }

  const { orgId, user, role } = ctx;
  const workspaceRole = role as WorkspaceRole;

  return (
    <div className="space-y-7 md:space-y-8">
      <Suspense fallback={<DashboardUpperFallback />}>
        <DashboardUpper
          orgId={orgId}
          userId={user.id}
          role={workspaceRole}
          view={view}
          quickFilter={quickFilter}
        />
      </Suspense>
      <Suspense fallback={<DashboardLowerFallback />}>
        <DashboardLower
          orgId={orgId}
          userId={user.id}
          role={workspaceRole}
          view={view}
          quickFilter={quickFilter}
        />
      </Suspense>
    </div>
  );
}
