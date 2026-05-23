import Link from "next/link";
import { redirect } from "next/navigation";
import { Copy, FileQuestion, Timer, UserRoundX, Users, Wrench } from "lucide-react";
import { ApiJsonLink } from "@/components/ui/api-json-link";
import { getAuthContext } from "@/lib/supabase/server";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { CampaignRollbackButton } from "@/components/v4/campaign-maintenance-actions";
import {
  archiveContractAsDuplicateForm,
  deleteOrphanFileRecordForm,
  logContractChangeEventForm,
  processContractChangeEventsForm,
  runCorrectionCampaignForm,
  runDateBackfillCampaignForm,
  reassignOwnerForm,
} from "@/actions/maintenance";
import { revalidatePath } from "next/cache";
import { loadOrgMemberProfileRows, orgMemberProfileLabel } from "@/lib/org-member-profiles";

export default async function MaintenancePage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  // v11 dashboard spec compliance Tier 18.8: /contracts/maintenance is an
  // admin-utility surface (data corrections, rollbacks, deletions). Gate
  // for admin role only to prevent Core members from reaching it directly.
  if (ctx.role !== "admin") redirect("/dashboard");
  const { admin, orgId } = ctx;

  const now = new Date();
  const { data: workflowSettings } = await admin
    .from("organization_workflow_settings")
    .select("stale_contract_days, stale_ownership_days")
    .eq("organization_id", orgId)
    .maybeSingle();
  const staleContractDays = Math.max(30, Number(workflowSettings?.stale_contract_days ?? 120));
  const staleOwnershipDays = Math.max(14, Number(workflowSettings?.stale_ownership_days ?? 90));
  const staleCutoff = new Date(now.getTime() - staleContractDays * 24 * 60 * 60 * 1000).toISOString();
  const staleOwnerCutoff = new Date(
    now.getTime() - staleOwnershipDays * 24 * 60 * 60 * 1000
  ).toISOString();
  const [staleContracts, missingOwner, duplicateCandidates, orphanFiles, staleOwnership, membersData, changeEvents, campaigns] =
    await Promise.all([
    admin
      .from("contracts")
      .select("id, title, updated_at, status")
      .eq("organization_id", orgId)
      .lt("updated_at", staleCutoff)
      .in("status", ["active", "pending_review"])
      .order("updated_at", { ascending: true })
      .limit(100)
      .then((r) => r.data ?? []),
    admin
      .from("contracts")
      .select("id, title, counterparty")
      .eq("organization_id", orgId)
      .is("owner_id", null)
      .limit(100)
      .then((r) => r.data ?? []),
    admin
      .from("contracts")
      .select("id, title, counterparty")
      .eq("organization_id", orgId)
      .limit(500)
      .then((r) => r.data ?? []),
    admin
      .from("contract_files")
      .select("id, file_name, contract_id, contracts(id, organization_id)")
      .limit(1000)
      .then((r) => r.data ?? []),
      admin
        .from("contracts")
        .select("id, title, owner_id, owner_assigned_at")
        .eq("organization_id", orgId)
        .not("owner_id", "is", null)
        .lt("owner_assigned_at", staleOwnerCutoff)
        .limit(100)
        .then((r) => r.data ?? []),
      loadOrgMemberProfileRows(admin, orgId),
      admin
        .from("contract_change_events")
        .select("id, contract_id, event_type, summary, impact_level, processed_at, created_at, contracts!inner(id, title, organization_id)")
        .eq("organization_id", orgId)
        .is("processed_at", null)
        .order("created_at", { ascending: false })
        .limit(50)
        .then((r) => r.data ?? []),
      admin
        .from("maintenance_campaigns")
        .select(
          "id, name, campaign_type, status, summary_json, preview_summary_json, last_preview_at, rolled_back_at, created_at, completed_at"
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(30)
        .then((r) => r.data ?? []),
    ]);

  async function createCampaignAction(formData: FormData) {
    "use server";
    const ctx = await getAuthContext();
    if (!ctx) return;
    const name = String(formData.get("name") ?? "").trim();
    const campaignType = String(formData.get("campaignType") ?? "").trim() || "data_remediation";
    const contractIds = String(formData.get("seedContractIds") ?? "")
      .split(/[\n,\s]+/)
      .map((id) => id.trim())
      .filter(Boolean);
    if (!name) return;
    await ctx.admin.from("maintenance_campaigns").insert({
      organization_id: ctx.orgId,
      name,
      campaign_type: campaignType,
      status: "draft",
      filter_json: {},
      created_by: ctx.user.id,
    }).select("id").single().then(async ({ data }) => {
      if (!data || contractIds.length === 0) return;
      await ctx.admin.from("maintenance_campaign_rows").insert(
        contractIds.map((contractId) => ({
          organization_id: ctx.orgId,
          campaign_id: data.id,
          contract_id: contractId,
          status: "pending",
        }))
      );
    });
    revalidatePath("/contracts/maintenance");
  }

  async function runCampaignAction(formData: FormData) {
    "use server";
    const ctx = await getAuthContext();
    if (!ctx) return;
    const campaignId = String(formData.get("campaignId") ?? "").trim();
    if (!campaignId) return;
    await ctx.admin
      .from("maintenance_campaigns")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("organization_id", ctx.orgId)
      .eq("id", campaignId);
    const { data: rows } = await ctx.admin
      .from("maintenance_campaign_rows")
      .select("id")
      .eq("organization_id", ctx.orgId)
      .eq("campaign_id", campaignId)
      .eq("status", "pending")
      .limit(1000);
    await ctx.admin
      .from("maintenance_campaign_rows")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("organization_id", ctx.orgId)
      .eq("campaign_id", campaignId)
      .eq("status", "pending");
    await ctx.admin
      .from("maintenance_campaigns")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        summary_json: { processed: rows?.length ?? 0 },
      })
      .eq("organization_id", ctx.orgId)
      .eq("id", campaignId);
    revalidatePath("/contracts/maintenance");
  }

  const normalized = new Map<string, Array<{ id: string; title: string }>>();
  for (const row of duplicateCandidates) {
    const key = `${row.title.trim().toLowerCase()}::${(row.counterparty ?? "").trim().toLowerCase()}`;
    const existing = normalized.get(key) ?? [];
    existing.push({ id: row.id, title: row.title });
    normalized.set(key, existing);
  }
  const duplicates = [...normalized.values()].filter((rows) => rows.length > 1);
  const members = (membersData ?? []).map((row) => {
    return {
      id: row.user_id,
      label: orgMemberProfileLabel(row.profiles),
    };
  });

  const orphaned = orphanFiles.filter((row) => {
    const rel = row.contracts as unknown;
    const contract = (Array.isArray(rel) ? rel[0] : rel) as
      | { id?: string; organization_id?: string }
      | null;
    return !contract?.id || contract.organization_id !== orgId;
  });

  return (
    <div className="ui-page-stack">
      <DashboardPageHeader
        icon={<Wrench className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Portfolio hygiene"
        title="Maintenance workspace"
        lead="Detect stale records, ownerless contracts, duplicate candidates, and orphaned files."
      />

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Signals</p>
          <h2 className="ui-page-title mt-2 text-[1.8rem]">Hygiene backlog</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <OperationalSummaryCard
            eyebrow="Freshness"
            headline="Stale records"
            tone={staleContracts.length > 0 ? "attention" : "healthy"}
            icon={Timer}
            primaryValue={staleContracts.length}
            primaryUnit={`>${staleContractDays}d idle`}
            action={{ href: "/contracts/maintenance", label: "Review list" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Ownership"
            headline="Ownerless"
            tone={missingOwner.length > 0 ? "risk" : "healthy"}
            icon={UserRoundX}
            primaryValue={missingOwner.length}
            primaryUnit="no owner_id"
            action={{ href: "/contracts/maintenance", label: "Assign owners" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Ownership"
            headline="Stale assignment"
            tone={staleOwnership.length > 0 ? "attention" : "healthy"}
            icon={Users}
            primaryValue={staleOwnership.length}
            primaryUnit={`>${staleOwnershipDays}d on owner`}
            action={{ href: "/contracts/maintenance", label: "Refresh owners" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Deduping"
            headline="Duplicate groups"
            tone={duplicates.length > 0 ? "attention" : "healthy"}
            icon={Copy}
            primaryValue={duplicates.length}
            primaryUnit="title + counterparty"
            action={{ href: "/contracts/maintenance", label: "Resolve duplicates" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Files"
            headline="Orphaned files"
            tone={orphaned.length > 0 ? "attention" : "healthy"}
            icon={FileQuestion}
            primaryValue={orphaned.length}
            primaryUnit="missing valid link"
            action={{ href: "/contracts/maintenance", label: "Clean files" }}
            variant="compact"
          />
        </div>
      </section>

      <section className="ui-page-shell overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-6 py-4">
          <h2 className="ui-section-title text-base">Maintenance campaigns</h2>
          <p className="ui-support-copy mt-1">Create and run remediation batches from the same surface used to inspect stale records and correction demand.</p>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-2">
          <form action={createCampaignAction} className="ui-card-quiet space-y-2 p-4">
            <p className="ui-label-caps">Create campaign</p>
            <input aria-label="Q2 owner backfill" name="name" className="ui-input w-full" placeholder="Q2 owner backfill" required />
            <select name="campaignType" className="ui-input w-full" defaultValue="data_remediation">
              <option value="data_remediation">data remediation</option>
              <option value="owner_reassignment">owner reassignment</option>
              <option value="policy_backfill">policy backfill</option>
            </select>
            <textarea
              name="seedContractIds"
              className="ui-input min-h-[72px] w-full"
              placeholder="Optional contract IDs (comma/newline separated)"
            />
            <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
              Create draft campaign
            </button>
          </form>
          <div className="ui-card-quiet p-4">
            <p className="ui-label-caps">Campaign history</p>
            <ul className="mt-2 space-y-2">
              {campaigns.length === 0 ? (
                <li className="text-sm text-[var(--text-tertiary)]">No campaigns created yet.</li>
              ) : (
                campaigns.map((campaign) => (
                  <li key={campaign.id} className="rounded border border-[var(--border-subtle)] px-3 py-2 text-sm">
                    <p className="font-medium text-[var(--text-primary)]">{campaign.name}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {campaign.campaign_type} · {campaign.status}
                      {campaign.rolled_back_at ? " · rolled back" : ""}
                    </p>
                    {campaign.last_preview_at ? (
                      <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                        Last preview: {new Date(campaign.last_preview_at).toLocaleString()}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ApiJsonLink
                        href={`/api/maintenance/campaigns/${campaign.id}/preview`}
                        className="ui-btn-secondary inline-block px-3 py-1.5 text-xs"
                      >
                        Preview row counts
                      </ApiJsonLink>
                      <CampaignRollbackButton campaignId={campaign.id} />
                    </div>
                    {campaign.status !== "completed" ? (
                      <form action={runCampaignAction} className="mt-2">
                        <input type="hidden" name="campaignId" value={campaign.id} />
                        <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                          Run campaign
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-6 py-4">
          <h2 className="ui-section-title text-base">Stale active/review records</h2>
        </div>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {staleContracts.length === 0 ? (
            <li className="px-6 py-4 text-sm text-[var(--text-tertiary)]">No stale records.</li>
          ) : (
            staleContracts.map((row) => (
              <li key={row.id} className="px-6 py-3">
                <Link href={`/contracts/${row.id}`} className="ui-link text-sm">
                  {row.title}
                </Link>
                <p className="text-xs text-[var(--text-tertiary)]">{new Date(row.updated_at).toISOString().slice(0, 10)}</p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-6 py-4">
          <h2 className="ui-section-title text-base">Ownerless contracts (reassign)</h2>
        </div>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {missingOwner.length === 0 ? (
            <li className="px-6 py-4 text-sm text-[var(--text-tertiary)]">No ownerless records.</li>
          ) : (
            missingOwner.slice(0, 20).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-6 py-3">
                <Link href={`/contracts/${row.id}`} className="ui-link text-sm">
                  {row.title}
                </Link>
                <form action={reassignOwnerForm} className="flex items-center gap-2">
                  <input type="hidden" name="contractId" value={row.id} />
                  <select name="ownerId" className="ui-input h-8 min-w-[12rem] text-xs">
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                    Assign
                  </button>
                </form>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-6 py-4">
          <h2 className="ui-section-title text-base">Duplicate review queue (archive)</h2>
        </div>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {duplicates.length === 0 ? (
            <li className="px-6 py-4 text-sm text-[var(--text-tertiary)]">No duplicate groups.</li>
          ) : (
            duplicates.slice(0, 10).map((group, idx) => (
              <li key={`dup-${idx}`} className="px-6 py-3">
                <p className="text-xs text-[var(--text-tertiary)]">Group {idx + 1}</p>
                <div className="mt-1 space-y-1">
                  {group.map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-3">
                      <Link href={`/contracts/${row.id}`} className="ui-link text-sm">
                        {row.title}
                      </Link>
                      <form action={archiveContractAsDuplicateForm as never}>
                        <input type="hidden" name="contractId" value={row.id} />
                        <input type="hidden" name="reason" value="duplicate candidate archived in maintenance" />
                        <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                          Archive duplicate
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-6 py-4">
          <h2 className="ui-section-title text-base">Orphaned file rows (cleanup)</h2>
        </div>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {orphaned.length === 0 ? (
            <li className="px-6 py-4 text-sm text-[var(--text-tertiary)]">No orphaned file rows detected.</li>
          ) : (
            orphaned.slice(0, 30).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-6 py-3">
                <span className="text-sm text-[var(--text-secondary)]">{row.file_name}</span>
                <form action={deleteOrphanFileRecordForm as never}>
                  <input type="hidden" name="fileId" value={row.id} />
                  <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                    Delete row
                  </button>
                </form>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-6 py-4">
          <h2 className="ui-section-title text-base">Correction campaigns</h2>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-2">
          <form action={runCorrectionCampaignForm as never} className="ui-card-quiet space-y-2 p-4">
            <p className="ui-label-caps">Normalization campaign</p>
            <select name="campaignType" className="ui-input w-full">
              <option value="normalize_counterparty">Normalize counterparty spacing</option>
              <option value="clear_stale_next_steps">Clear stale next steps on healthy contracts</option>
            </select>
            <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
              Run correction
            </button>
          </form>
          <form action={runDateBackfillCampaignForm as never} className="ui-card-quiet space-y-2 p-4">
            <p className="ui-label-caps">Date backfill campaign</p>
            <input aria-label="Contract type (optional)" name="contractType" placeholder="Contract type (optional)" className="ui-input w-full" />
            <select name="fieldName" className="ui-input w-full">
              <option value="renewal_date">renewal_date</option>
              <option value="end_date">end_date</option>
              <option value="notice_window">notice_window</option>
              <option value="effective_date">effective_date</option>
              <option value="start_date">start_date</option>
            </select>
            <input aria-label="Fallback date" name="fallbackDate" type="date" className="ui-input w-full" />
            <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
              Run backfill
            </button>
          </form>
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-6 py-4">
          <h2 className="ui-section-title text-base">Guided change-event maintenance</h2>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-2">
          <form action={logContractChangeEventForm as never} className="ui-card-quiet space-y-2 p-4">
            <p className="ui-label-caps">Log change event</p>
            <input aria-label="Contract UUID" name="contractId" required placeholder="Contract UUID" className="ui-input w-full" />
            <select name="eventType" defaultValue="amendment" className="ui-input w-full">
              <option value="amendment">amendment</option>
              <option value="pricing_update">pricing_update</option>
              <option value="ownership_change">ownership_change</option>
              <option value="other">other</option>
            </select>
            <select name="impactLevel" defaultValue="medium" className="ui-input w-full">
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
            <textarea name="summary" required placeholder="What changed and why follow-up is needed" className="ui-input min-h-[70px] w-full" />
            <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
              Log change event
            </button>
          </form>
          <form action={processContractChangeEventsForm as never} className="ui-card-quiet space-y-2 p-4">
            <p className="ui-label-caps">Create maintenance tasks from queue</p>
            <input aria-label="Max rows" name="maxRows" type="number" min={1} max={100} defaultValue={25} className="ui-input w-full" />
            <input aria-label="Team key" name="teamKey" defaultValue="ops" className="ui-input w-full" />
            <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
              Process change queue
            </button>
            <p className="text-xs text-[var(--text-tertiary)]">Creates follow-up tasks and marks queued events processed.</p>
          </form>
        </div>
        <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
          {changeEvents.length === 0 ? (
            <li className="px-6 py-4 text-sm text-[var(--text-tertiary)]">No pending change events.</li>
          ) : (
            changeEvents.map((evt) => {
              const rel = evt.contracts as unknown;
              const contract = (Array.isArray(rel) ? rel[0] : rel) as { id?: string; title?: string } | null;
              return (
                <li key={evt.id} className="px-6 py-3 text-sm">
                  <p className="font-medium text-[var(--text-primary)]">
                    {evt.event_type} · {evt.impact_level}
                    {contract?.id ? (
                      <>
                        {" · "}
                        <Link href={`/contracts/${contract.id}`} className="ui-link">
                          {contract.title ?? "Contract"}
                        </Link>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">{evt.summary}</p>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
