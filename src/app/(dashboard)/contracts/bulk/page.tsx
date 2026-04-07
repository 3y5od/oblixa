import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";
import { BulkUploadForm } from "@/components/contracts/bulk-upload-form";
import { canEditContracts } from "@/lib/permissions";
import { isPlanEnforcementEnabled, orgHasActivePlan } from "@/lib/plan";
import type { OrgRole } from "@/lib/types";

export default async function BulkImportPage() {
  const ctx = await getAuthContext();

  if (!ctx) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-zinc-500">No organization found.</p>
      </div>
    );
  }

  const canEdit = canEditContracts(ctx.role as OrgRole);
  const { data: recentJobs } = await ctx.admin
    .from("contract_import_jobs")
    .select("id, status, total_rows, inserted_rows, error_rows, created_at")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(5);

  const hasPlan =
    !isPlanEnforcementEnabled() ||
    (await orgHasActivePlan(ctx.admin, ctx.orgId));

  let disabledReason: string | undefined;
  if (!canEdit) {
    disabledReason =
      "Viewers cannot import contracts. Ask an editor or admin to import files.";
  } else if (!hasPlan) {
    disabledReason =
      "An active subscription is required. Open Billing to subscribe.";
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center gap-4">
        <Link
          href="/contracts"
          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
        >
          ← Back
        </Link>
      </div>
      <div>
        <h1 className="mb-2 text-2xl font-bold text-zinc-900">Bulk import</h1>
        <p className="text-sm text-zinc-500">
          Upload many PDF or DOCX files at once. Each file becomes a separate contract for
          review and extraction.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <BulkUploadForm
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
        {(recentJobs?.length ?? 0) > 0 && (
          <div className="mt-6 border-t border-zinc-100 pt-4">
            <p className="ui-label-caps">Recent import jobs (CSV and files)</p>
            <ul className="mt-2 space-y-1.5 text-xs text-zinc-600">
              {recentJobs?.map((job) => (
                <li key={job.id}>
                  {job.status} · rows {job.inserted_rows}/{job.total_rows}
                  {job.error_rows ? ` · errors ${job.error_rows}` : ""}
                  {" · "}
                  <a className="ui-link" href={`/api/import/contracts/${job.id}`}>
                    details
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
