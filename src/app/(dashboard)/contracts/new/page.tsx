import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";
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
        <p className="text-sm text-zinc-500">No organization found.</p>
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

  return (
    <div className="mx-auto max-w-2xl space-y-6 md:space-y-8">
      <header className="border-b border-zinc-200/60 pb-8">
        <div>
          <p className="ui-eyebrow">New record</p>
          <h1 className="ui-display-title mt-2">Upload contract</h1>
          <p className="ui-muted-tight mt-3 max-w-xl">
            Add files and metadata. After saving, run AI extraction from the contract
            detail page.
          </p>
        </div>
      </header>

      <div className="rounded-2xl border border-indigo-200/55 bg-gradient-to-br from-indigo-50/50 to-white p-5 text-[13px] leading-relaxed text-zinc-700 sm:p-6">
        <p className="font-semibold text-zinc-900">From email</p>
        <p className="mt-2 text-zinc-600">
          Save PDF or DOCX attachments locally, then upload here. No inbox integration
          in this version — keeping the trust loop explicit.
        </p>
      </div>

      <RecentUploads files={recentFiles} />

      <div className="ui-card p-6 md:p-8">
        <UploadForm
          organizationId={ctx.orgId}
          disabled={!!disabledReason}
          disabledReason={disabledReason}
        />
        {!hasPlan && canEdit && isPlanEnforcementEnabled() && (
          <p className="mt-4 text-center text-sm">
            <Link
              href="/settings/billing"
              className="ui-link"
            >
              Go to Billing
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
