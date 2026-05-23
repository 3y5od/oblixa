import Link from "next/link";
import {
  CalendarClock,
  ClipboardCheck,
  FileCheck2,
  FilePlus2,
  UploadCloud,
} from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { UploadForm } from "@/components/contracts/upload-form";
import { RecentUploads, type RecentFileRow } from "@/components/contracts/recent-uploads";
import { canEditContracts } from "@/lib/permissions";
import { isPlanEnforcementEnabled, orgHasActivePlan } from "@/lib/plan";
import type { OrgRole } from "@/lib/types";

export default async function NewContractPage() {
  const ctx = await getAuthContext();

  if (!ctx) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-[var(--text-tertiary)]">No organization found.</p>
      </div>
    );
  }

  const canEdit = canEditContracts(ctx.role as OrgRole);
  /** §4.4 — subscription gate for uploads; not used for workspace mode or navigation. */
  const hasPlan =
    !isPlanEnforcementEnabled() ||
    (await orgHasActivePlan(ctx.admin, ctx.orgId));

  let disabledReason: string | undefined;
  if (!canEdit) {
    disabledReason =
      "Viewers cannot upload contracts. Ask an editor or admin to add this record.";
  } else if (!hasPlan) {
    disabledReason =
      "An active subscription is required to create contracts. Open Billing to subscribe.";
  }

  const { data: recentRows } = await ctx.admin
    .from("contract_files")
    .select(
      "id, file_name, file_type, created_at, contract_id, contracts!inner(title, organization_id)"
    )
    .eq("contracts.organization_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(10);

  const recentFiles: RecentFileRow[] = (recentRows ?? []).map((row) => {
    const c = row.contracts as unknown as { title: string };
    return {
      id: row.id as string,
      file_name: row.file_name as string,
      file_type: row.file_type as string,
      created_at: row.created_at as string,
      contract_id: row.contract_id as string,
      contract_title: c.title,
    };
  });
  // v23 aesthetic pass: dropped per-step description prose (§10.7 +
  // §10.4) — the numbered step label is enough; the multi-sentence
  // explainer added noise without information.
  const nextSteps = [
    { label: "Review extracted fields", icon: ClipboardCheck },
    { label: "Assign ownership", icon: FileCheck2 },
    { label: "Track dates and follow-up", icon: CalendarClock },
  ];

  return (
    <div className="ui-page-stack mx-auto max-w-7xl">
      <DashboardPageHeader
        icon={<FilePlus2 className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="New record"
        title="Upload contract"
        // v23: dropped the long page lead. The h1 + eyebrow + the form
        // chrome below carry sufficient context; the prose sentence
        // duplicated the form's section h2 + lead and pushed the form
        // ~80px down the page (§10.4 + §10.7).
        lead={null}
        actions={
          <Link
            href="/contracts"
            className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
          >
            Back to contracts
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section className="min-w-0">
          <UploadForm
            organizationId={ctx.orgId}
            disabled={!!disabledReason}
            disabledReason={disabledReason}
          />
          {!hasPlan && canEdit && isPlanEnforcementEnabled() && (
            <p className="mt-4 text-center text-sm">
              <Link href="/settings/billing" className="ui-link">
                Go to Billing
              </Link>
            </p>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <section className="ui-card p-5">
            <p className="ui-eyebrow">Next steps</p>
            <h2 className="ui-section-title mt-2 text-[1.05rem]">After creation</h2>
            <ol className="mt-4 space-y-2.5">
              {nextSteps.map((step, index) => {
                const StepIcon = step.icon;
                return (
                  <li key={step.label} className="flex items-center gap-3">
                    <span className="ui-icon-tile-compact shrink-0" aria-hidden>
                      <StepIcon className="h-4 w-4" strokeWidth={1.85} />
                    </span>
                    <p className="min-w-0 text-[13px] font-medium text-[var(--text-primary)]">
                      <span className="mr-1.5 tabular-nums text-[var(--text-tertiary)]">
                        {index + 1}
                      </span>
                      {step.label}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="ui-card p-5">
            <p className="ui-eyebrow">Bulk import</p>
            <h2 className="ui-section-title mt-2 text-[1.05rem]">Migrate a spreadsheet</h2>
            <Link
              href="/contracts/bulk"
              className="ui-btn-ghost mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
            >
              <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              Import CSV
            </Link>
          </section>

          <RecentUploads files={recentFiles} />
        </aside>
      </div>
    </div>
  );
}
