import Link from "next/link";
import { ArrowLeft, Building2, FilePlus2, UploadCloud } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { UploadForm } from "@/components/contracts/upload-form";
import {
  ContractUploadRail,
  type UploadRailRecovery,
} from "@/components/contracts/contract-upload-rail";
import type { RecentFileRow } from "@/components/contracts/recent-uploads";
import { loadOrgMemberProfileRows, orgMemberProfileLabel } from "@/lib/org-member-profiles";
import { CONTRACT_FILE_MAX_MB_LABEL } from "@/lib/constants/upload-limits";
import { canEditContracts } from "@/lib/permissions";
import { isPlanEnforcementEnabled, orgHasActivePlan } from "@/lib/plan";
import type { OrgRole } from "@/lib/types";

export const metadata = { title: "Upload contract" };

export default async function NewContractPage() {
  const ctx = await getAuthContext();

  if (!ctx) {
    return (
      <div className="mx-auto w-full max-w-[40rem]">
        <section className="ui-card-raised relative overflow-hidden rounded-2xl border p-6 text-center sm:p-8">
          <div className="mx-auto flex max-w-md flex-col items-center">
            <span
              aria-hidden
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--warning)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_30%,var(--surface-raised))] text-[var(--warning-ink)] shadow-[var(--shadow-1)]"
            >
              <Building2 className="h-5 w-5" strokeWidth={1.85} />
            </span>
            <p className="landing-eyebrow-dot ui-caps-2 mt-3 text-[var(--accent-strong)]">
              Workspace required
            </p>
            <h1 className="mt-1 text-[1.4rem] font-semibold tracking-tight text-[var(--text-primary)]">
              No workspace found
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
              We couldn&rsquo;t load a workspace for your account. Request access or
              sign back in to continue.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Link href="/request-access" className="ui-btn-primary rounded-full px-4 py-2 text-[13px]">
                Request access
              </Link>
              <Link href="/login" className="ui-btn-ghost rounded-full px-4 py-2 text-[13px]">
                Back to sign in
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const canEdit = canEditContracts(ctx.role as OrgRole);
  const hasPlan =
    !isPlanEnforcementEnabled() ||
    (await orgHasActivePlan(ctx.admin, ctx.orgId));

  let disabledReason: string | undefined;
  let recovery: UploadRailRecovery | undefined;
  if (!canEdit) {
    disabledReason =
      "Viewers cannot upload contracts. Ask an editor or admin to add this record.";
    recovery = {
      tone: "warning",
      title: "Read-only access",
      body: "Viewers can browse contracts but can't add them. Ask an editor or admin to upload this record.",
    };
  } else if (!hasPlan) {
    disabledReason =
      "An active subscription is required to create contracts. Open Billing to subscribe.";
    recovery = {
      tone: "warning",
      title: "Subscription required",
      body: "An active subscription is needed to create contracts.",
      action: { label: "Go to Billing", href: "/settings/billing" },
    };
  }

  const { data: recentRows } = await ctx.admin
    .from("contract_files")
    .select(
      "id, file_name, file_type, created_at, contract_id, contracts!inner(title, organization_id)"
    )
    .eq("contracts.organization_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(7);

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

  // Workspace members populate the upload form's owner picker.
  const memberRows = await loadOrgMemberProfileRows(ctx.admin, ctx.orgId);
  const members = memberRows.map((row) => ({
    value: row.user_id,
    label: orgMemberProfileLabel(row.profiles),
    email: row.profiles?.email ?? null,
  }));

  return (
    <div className="mx-auto w-full max-w-[72rem]">
      <div className="flex flex-col gap-4">
        <Link
          href="/contracts"
          className="ui-btn-ghost inline-flex max-w-max items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Back to contracts
        </Link>
        <DashboardPageHeader
          icon={<FilePlus2 className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
          eyebrow="New contract"
          title="Upload contract"
          lead="Upload a signed agreement, add known fields, then review source-backed suggestions."
          metaStrip={
            <div className="flex flex-wrap items-center gap-1.5">
              <KeyValueChip label="Accepts" value="PDF, DOCX" />
              <KeyValueChip label="Max" value={CONTRACT_FILE_MAX_MB_LABEL} />
              <KeyValueChip label="Review" value="required" />
            </div>
          }
          actions={
            <Link
              href="/contracts/bulk"
              className="ui-btn-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold"
            >
              <UploadCloud className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Import contracts
            </Link>
          }
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section className="min-w-0">
          <UploadForm
            organizationId={ctx.orgId}
            disabled={!!disabledReason}
            disabledReason={disabledReason}
            members={members}
          />
        </section>

        <aside className="lg:sticky lg:top-[calc(var(--shell-topbar-h)+1rem)] lg:self-start">
          <ContractUploadRail recentFiles={recentFiles} recovery={recovery} />
        </aside>
      </div>
    </div>
  );
}
