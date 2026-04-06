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
        <p className="text-sm text-gray-500">No organization found.</p>
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

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Upload Contract
        </h1>
        <p className="text-sm text-gray-500">
          Drag in files or browse. After saving, you can run AI extraction from the
          contract page.
        </p>
      </div>

      <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        <p className="font-medium text-sky-900">From email</p>
        <p className="mt-1 text-sky-900/90">
          Save PDF or DOCX attachments from your inbox to your computer, then upload them
          here. There is no inbox integration in this version — this keeps the trust loop
          simple and under your control.
        </p>
      </div>

      <RecentUploads files={recentFiles} />

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <UploadForm
          organizationId={ctx.orgId}
          disabled={!!disabledReason}
          disabledReason={disabledReason}
        />
        {!hasPlan && canEdit && isPlanEnforcementEnabled() && (
          <p className="mt-4 text-center text-sm">
            <Link
              href="/settings/billing"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Go to Billing
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
