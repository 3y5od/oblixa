import Link from "next/link";
import { ClipboardList, Scale, UserCircle, Wallet } from "lucide-react";
import { OperationalSurfaceLinkCard } from "@/components/ui/operational-summary-card";

export function DashboardPersonaPresets() {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
            <span className="landing-eyebrow-dot" aria-hidden />
            Personas
          </p>
          <h2 className="ui-section-title mt-2 text-xl">Preset views</h2>
          <p className="ui-muted-tight mt-1 text-[12.5px]">Role-shaped dashboards for recurring operating cadences.</p>
        </div>
        <Link href="/dashboard/persona" className="ui-link inline-flex items-center gap-1 text-xs">
          Full persona dashboard
          <span aria-hidden>→</span>
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OperationalSurfaceLinkCard
          href="/dashboard/persona?persona=ops"
          eyebrow="Ops"
          title="Ops daily"
          icon={ClipboardList}
          tone="neutral"
          actionLabel="Switch to ops view"
        />
        <OperationalSurfaceLinkCard
          href="/dashboard/persona?persona=legal"
          eyebrow="Legal"
          title="Legal approvals"
          icon={Scale}
          tone="neutral"
          actionLabel="Switch to legal view"
        />
        <OperationalSurfaceLinkCard
          href="/dashboard/persona?persona=finance"
          eyebrow="Finance"
          title="Finance renewals"
          icon={Wallet}
          tone="neutral"
          actionLabel="Switch to finance view"
        />
        <OperationalSurfaceLinkCard
          href="/dashboard/persona?persona=manager"
          eyebrow="Manager"
          title="Manager weekly"
          icon={UserCircle}
          tone="neutral"
          actionLabel="Switch to manager view"
        />
      </div>
    </section>
  );
}
