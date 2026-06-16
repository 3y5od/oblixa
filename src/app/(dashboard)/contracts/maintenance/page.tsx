import Link from "next/link";
import { redirect } from "next/navigation";
import { Wrench } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { UiSelect } from "@/components/ui/ui-select";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import {
  archiveContractAsDuplicateForm,
  deleteOrphanFileRecordForm,
  logContractChangeEventForm,
  processContractChangeEventsForm,
  runCorrectionCampaignForm,
  runDateBackfillCampaignForm,
} from "@/actions/maintenance";
import { loadOrgMemberProfileRows, orgMemberProfileLabel } from "@/lib/org-member-profiles";
import {
  MaintenanceCampaignsSection,
  MaintenanceHygieneBacklog,
  OwnerlessContractsSection,
  StaleContractsSection,
} from "./maintenance-page-sections";

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

      <MaintenanceHygieneBacklog
        staleContractsCount={staleContracts.length}
        staleContractDays={staleContractDays}
        missingOwnerCount={missingOwner.length}
        staleOwnershipCount={staleOwnership.length}
        staleOwnershipDays={staleOwnershipDays}
        duplicateGroupCount={duplicates.length}
        orphanedCount={orphaned.length}
      />

      <MaintenanceCampaignsSection campaigns={campaigns} />

      <StaleContractsSection rows={staleContracts} />
      <OwnerlessContractsSection rows={missingOwner} members={members} />

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
            <UiSelect
              name="campaignType"
              defaultValue="normalize_counterparty"
              ariaLabel="Correction campaign type"
              options={[
                { value: "normalize_counterparty", label: "Normalize counterparty spacing" },
                { value: "clear_stale_next_steps", label: "Clear stale next steps on healthy contracts" },
              ]}
              variant="compact"
              portal
              className="w-full"
              buttonClassName="w-full !min-h-11"
            />
            <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
              Run correction
            </button>
          </form>
          <form action={runDateBackfillCampaignForm as never} className="ui-card-quiet space-y-2 p-4">
            <p className="ui-label-caps">Date backfill campaign</p>
            <input aria-label="Contract type (optional)" name="contractType" placeholder="Contract type (optional)" className="ui-input w-full" />
            <UiSelect
              name="fieldName"
              defaultValue="renewal_date"
              ariaLabel="Date field to backfill"
              options={[
                { value: "renewal_date", label: "renewal_date" },
                { value: "end_date", label: "end_date" },
                { value: "notice_window", label: "notice_window" },
                { value: "effective_date", label: "effective_date" },
                { value: "start_date", label: "start_date" },
              ]}
              variant="compact"
              portal
              className="w-full"
              buttonClassName="w-full !min-h-11"
            />
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
            <UiSelect
              name="eventType"
              defaultValue="amendment"
              ariaLabel="Change event type"
              options={[
                { value: "amendment", label: "amendment" },
                { value: "pricing_update", label: "pricing_update" },
                { value: "ownership_change", label: "ownership_change" },
                { value: "other", label: "other" },
              ]}
              variant="compact"
              portal
              className="w-full"
              buttonClassName="w-full !min-h-11"
            />
            <UiSelect
              name="impactLevel"
              defaultValue="medium"
              ariaLabel="Change impact level"
              options={[
                { value: "low", label: "low" },
                { value: "medium", label: "medium" },
                { value: "high", label: "high" },
              ]}
              variant="compact"
              portal
              className="w-full"
              buttonClassName="w-full !min-h-11"
            />
            <textarea name="summary" required placeholder="What changed and why follow-up is needed" aria-label="Change summary" className="ui-input min-h-[70px] w-full" />
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
