import Link from "next/link";
import { LayoutDashboard, UploadCloud } from "lucide-react";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import {
  DASHBOARD_PRIMARY_CTA,
  DASHBOARD_SECONDARY_CTA,
  DASHBOARD_TITLE,
} from "@/lib/dashboard/spec-strings";

export function DashboardUpperHeader({
  workspaceName,
  hasWorkspaceName,
  planTier,
  totalContracts,
  pendingReview,
  showPersonaPresets,
}: {
  workspaceName: string;
  hasWorkspaceName: boolean;
  planTier?: string;
  totalContracts: number;
  pendingReview: number;
  showPersonaPresets: boolean;
}) {
  return (
    <DashboardPageHeader
      icon={<LayoutDashboard className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
      eyebrow={workspaceName}
      suppressEyebrow={!hasWorkspaceName}
      title={DASHBOARD_TITLE}
      monogram={hasWorkspaceName ? workspaceName.slice(0, 2).toUpperCase() : undefined}
      metaStrip={
        <DashboardUpperMetaStrip
          workspaceName={workspaceName}
          hasWorkspaceName={hasWorkspaceName}
          planTier={planTier}
          totalContracts={totalContracts}
        />
      }
      lead={null}
      actions={
        <DashboardUpperHeaderActions
          pendingReview={pendingReview}
          showPersonaPresets={showPersonaPresets}
        />
      }
    />
  );
}

function DashboardUpperMetaStrip({
  workspaceName,
  hasWorkspaceName,
  planTier,
  totalContracts,
}: {
  workspaceName: string;
  hasWorkspaceName: boolean;
  planTier?: string;
  totalContracts: number;
}) {
  const items: Array<{ label: string; value: string }> = [];
  if (hasWorkspaceName) items.push({ label: "Workspace", value: workspaceName });
  if (totalContracts > 0) items.push({ label: "Contracts", value: String(totalContracts) });
  if (planTier) {
    items.push({
      label: "Plan",
      value: `${planTier.charAt(0).toUpperCase()}${planTier.slice(1).toLowerCase()}`,
    });
  }
  if (items.length === 0) return null;
  return items.map((item, idx) => (
    <span key={item.label} className="inline-flex items-baseline gap-1.5">
      {idx > 0 ? (
        <span
          aria-hidden
          className="inline-block h-3 w-px self-center bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]"
        />
      ) : null}
      <dt className="ui-caps-3 text-[var(--text-tertiary)]">{item.label}</dt>
      <dd className="font-medium tabular-nums text-[var(--text-secondary)]">{item.value}</dd>
    </span>
  ));
}

function DashboardUpperHeaderActions({
  pendingReview,
  showPersonaPresets,
}: {
  pendingReview: number;
  showPersonaPresets: boolean;
}) {
  return (
    <>
      {showPersonaPresets ? (
        <Link href="/dashboard/persona" className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
          Persona studio
        </Link>
      ) : null}
      {pendingReview > 0 ? (
        <>
          <Link href="/contracts/review" className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold">
            Confirm details
          </Link>
          <Link href="/contracts/new" className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold">
            <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            {DASHBOARD_PRIMARY_CTA}
          </Link>
        </>
      ) : (
        <>
          <Link href="/contracts/new" className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold">
            <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            {DASHBOARD_PRIMARY_CTA}
          </Link>
          <Link href="/contracts/bulk" prefetch={false} className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold">
            {DASHBOARD_SECONDARY_CTA}
          </Link>
        </>
      )}
    </>
  );
}
