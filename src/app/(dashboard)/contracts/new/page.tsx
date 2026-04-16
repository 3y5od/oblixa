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
    <div className="ui-page-stack mx-auto max-w-6xl">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">New record</p>
          <h1 className="ui-display-title mt-2">Upload contract</h1>
          <p className="ui-muted-tight mt-3 max-w-2xl">
            Start a new operational record with files and core metadata. After saving, run AI extraction from
            the contract detail page and move into review.
          </p>
        </div>
        <div className="ui-page-actions">
          <Link href="/contracts" className="ui-btn-secondary px-5 py-2.5 text-[13px]">
            Back to contracts
          </Link>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_minmax(0,0.9fr)]">
        <section className="space-y-6">
          <div className="ui-card-hero p-6 sm:p-8">
            <p className="ui-eyebrow">Input workflow</p>
            <h2 className="mt-3 text-[1.55rem] font-semibold tracking-tight text-[var(--text-primary)]">
              Create a reliable operational record from the start
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                "Upload signed PDFs or DOCX files",
                "Capture counterparty and type metadata",
                "Run extraction and review from the detail view",
              ].map((item, index) => (
                <div key={item} className="ui-card-quiet p-4">
                  <p className="ui-kicker">Step {index + 1}</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="ui-card p-6 md:p-8">
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
          </div>
        </section>

        <aside className="space-y-6">
          <div className="ui-card p-5">
            <p className="ui-eyebrow">From email</p>
            <h2 className="ui-section-title mt-2 text-xl">Bring in signed files deliberately</h2>
            <p className="ui-muted-tight mt-2">
              Save PDF or DOCX attachments locally, then upload here. No inbox integration in this version, which
              keeps the trust loop explicit and review-friendly.
            </p>
          </div>

          <RecentUploads files={recentFiles} />
        </aside>
      </div>
    </div>
  );
}
