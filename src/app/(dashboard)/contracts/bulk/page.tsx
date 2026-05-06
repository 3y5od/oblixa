import Link from "next/link";
import { History, Megaphone, Upload } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { BulkUploadForm } from "@/components/contracts/bulk-upload-form";
import {
  OperationalSurfaceLinkCard,
  OperationalSummaryCard,
} from "@/components/ui/operational-summary-card";
import { ImportJobRetryButton } from "@/components/contracts/import-job-retry-button";
import { canEditContracts } from "@/lib/permissions";
import {
  getImportJobDetail,
  getImportJobHeadline,
  getImportJobTone,
  importJobCanRetry,
} from "@/lib/import-job-visibility";
import { isPlanEnforcementEnabled, orgHasActivePlan } from "@/lib/plan";
import type { OrgRole } from "@/lib/types";
import type { WorkspaceRole } from "@/lib/navigation";
import { isAdvancedModuleHidden, loadProductSurfaceContext } from "@/lib/product-surface";

export default async function BulkImportPage() {
  const ctx = await getAuthContext();

  if (!ctx) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-[var(--text-tertiary)]">No organization found.</p>
      </div>
    );
  }

  const canEdit = canEditContracts(ctx.role as OrgRole);

  const productSurface = await loadProductSurfaceContext(
    ctx.admin,
    ctx.orgId,
    ctx.role as WorkspaceRole
  );
  const showCampaignCta =
    (productSurface.mode === "advanced" || productSurface.mode === "assurance") &&
    !isAdvancedModuleHidden(productSurface, "campaigns");
  const showMaintenanceSurfaces =
    productSurface.mode !== "core" || ctx.role === "admin";

  const { data: recentJobs } = await ctx.admin
    .from("contract_import_jobs")
    .select(
      "id, status, total_rows, inserted_rows, error_rows, failure_reason, retry_of_job_id, superseded_by_job_id, created_at, updated_at, completed_at"
    )
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(5);

  /** §4.4 — plan/subscription gate for import only; not used for IA or workspace mode. */
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

  const recentCount = recentJobs?.length ?? 0;
  const lastStatus = recentJobs?.[0]?.status ?? null;
  const latestJobTone = recentJobs?.[0] ? getImportJobTone(recentJobs[0]) : "healthy";

  return (
    <div className="ui-page-stack mx-auto max-w-2xl">
      <div className="flex items-center gap-4">
        <Link
          href="/contracts"
          className="rounded-lg p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_72%,var(--canvas))] hover:text-[var(--text-secondary)]"
        >
          ← Back
        </Link>
      </div>
      <header className="border-b border-[var(--border-subtle)] pb-8">
        <div>
          <p className="ui-eyebrow">Scale ingest</p>
          <h1 className="ui-display-title mt-2">Bulk import</h1>
          <p className="ui-page-lead mt-3 max-w-2xl">
            Upload many PDF or DOCX files at once. Each file becomes a separate contract for review and extraction.
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <OperationalSummaryCard
          eyebrow="History"
          headline="Recent import posture"
          tone={recentCount > 0 ? latestJobTone : "healthy"}
          icon={History}
          primaryValue={recentCount}
          primaryUnit="last 5 in workspace"
          breakdown={
            lastStatus
              ? [
                  { label: "Latest status", value: String(lastStatus) },
                  {
                    label: "Latest outcome",
                    value: recentJobs?.[0] ? getImportJobHeadline(recentJobs[0]) : String(lastStatus),
                  },
                ]
              : []
          }
          action={{ href: "/contracts/bulk", label: "Refresh" }}
          variant="compact"
        />
        {showMaintenanceSurfaces ? (
          <OperationalSurfaceLinkCard
            href="/contracts/maintenance"
            eyebrow="Hygiene"
            title="Backfill & correction"
            hint="Normalization campaigns and date backfills from the maintenance workspace."
            actionLabel="Review maintenance"
            icon={Upload}
            tone="neutral"
          />
        ) : null}
        {showCampaignCta ? (
          <OperationalSurfaceLinkCard
            href="/campaigns"
            eyebrow="Remediation"
            title="Coordinated campaigns"
            hint="After import, run structured outreach or follow-up as a campaign."
            actionLabel="Review campaigns"
            icon={Megaphone}
            tone="neutral"
          />
        ) : null}
      </div>

      <div className="ui-page-shell p-6">
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
          <div id="recent-imports" className="mt-6 border-t border-[var(--border-subtle)] pt-4">
            <p className="ui-eyebrow">Imports</p>
            <p className="ui-section-title mt-1 text-base">Recent import jobs</p>
            <p className="ui-support-copy mt-1">Use recent jobs as the recovery surface for failed imports, retries, and handoff into the contracts list.</p>
            <ul className="mt-3 space-y-3 text-xs text-[var(--text-secondary)]">
              {recentJobs?.map((job) => (
                <li key={job.id} className="rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))]/70 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                        {getImportJobHeadline(job)}
                      </p>
                      <p className="text-[12px] text-[var(--text-secondary)]">{getImportJobDetail(job)}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        Created {new Date(job.created_at).toISOString()}
                        {job.retry_of_job_id ? " · retry attempt" : ""}
                        {job.completed_at ? ` · completed ${new Date(job.completed_at).toISOString()}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <a className="ui-link text-[11px]" href={`/api/import/contracts/${job.id}`}>
                        Job details JSON
                      </a>
                      {importJobCanRetry(job) ? <ImportJobRetryButton jobId={job.id} /> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="ui-muted-tight mt-3 text-[13px]">
              After import, open{" "}
              <Link href="/contracts" className="ui-link">
                Contracts
              </Link>{" "}
              to review new rows.
            </p>
          </div>
        )}
        {showMaintenanceSurfaces ? (
          <div className="mt-6 border-t border-[var(--border-subtle)] pt-4">
            <p className="ui-eyebrow">Remediation</p>
            <p className="ui-section-title mt-1 text-base">Bulk correction and backfill</p>
            <p className="ui-support-copy mt-1 text-[13px]">
              Run normalization campaigns and date backfills from the maintenance workspace.
            </p>
            <Link href="/contracts/maintenance" className="ui-link mt-2 inline-block text-xs">
              Open maintenance campaigns
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
