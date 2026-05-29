import Link from "next/link";
import { ArrowLeft, FilePlus2 } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { ActionChip } from "@/components/ui/action-chip";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { UploadForm } from "@/components/contracts/upload-form";
import { RecentUploads, type RecentFileRow } from "@/components/contracts/recent-uploads";
import { canEditContracts } from "@/lib/permissions";
import { isPlanEnforcementEnabled, orgHasActivePlan } from "@/lib/plan";
import type { OrgRole } from "@/lib/types";

export const metadata = { title: "Upload contract" };

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

  const nextSteps = [
    "Review extracted fields",
    "Assign ownership",
    "Track dates and follow-up",
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <Link
        href="/contracts"
        className="inline-flex max-w-max items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={2} aria-hidden />
        Back to contracts
      </Link>
      <DashboardPageHeader
        icon={<FilePlus2 className="h-4 w-4" strokeWidth={1.85} />}
        eyebrow="New record"
        title="Upload contract"
        lead={null}
        density="compact"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
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

        <aside className="overflow-hidden rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)] divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)]">
          <section className="px-4 py-4">
            <p className="ui-eyebrow">After creation</p>
            <ol className="mt-2.5 space-y-2">
              {nextSteps.map((label, index) => (
                <li key={label} className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] font-mono text-[10px] font-semibold tabular-nums text-[var(--text-secondary)]"
                  >
                    {index + 1}
                  </span>
                  <p className="min-w-0 text-[12.5px] text-[var(--text-secondary)]">
                    {label}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section className="px-4 py-4">
            <p className="ui-eyebrow">Migrate a spreadsheet</p>
            <ActionChip
              verb="Import CSV"
              href="/contracts/bulk"
              className="mt-2"
            />
          </section>

          <section className="px-4 py-4">
            <RecentUploads files={recentFiles} />
          </section>
        </aside>
      </div>
    </div>
  );
}
