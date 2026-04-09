import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";
import {
  archiveContractAsDuplicateForm,
  deleteOrphanFileRecordForm,
  logContractChangeEventForm,
  processContractChangeEventsForm,
  runCorrectionCampaignForm,
  runDateBackfillCampaignForm,
  reassignOwnerForm,
} from "@/actions/maintenance";

export default async function MaintenancePage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
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
  const [staleContracts, missingOwner, duplicateCandidates, orphanFiles, staleOwnership, membersData, changeEvents] =
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
      admin
        .from("organization_members")
        .select("user_id, profiles(full_name, email)")
        .eq("organization_id", orgId)
        .then((r) => r.data ?? []),
      admin
        .from("contract_change_events")
        .select("id, contract_id, event_type, summary, impact_level, processed_at, created_at, contracts!inner(id, title, organization_id)")
        .eq("organization_id", orgId)
        .is("processed_at", null)
        .order("created_at", { ascending: false })
        .limit(50)
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
    const profile = row.profiles as unknown as { full_name: string | null; email: string | null } | null;
    return {
      id: row.user_id,
      label: profile?.full_name || profile?.email || "Member",
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
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-zinc-200/60 pb-8">
        <p className="ui-eyebrow">Portfolio hygiene</p>
        <h1 className="ui-display-title">Maintenance workspace</h1>
        <p className="max-w-2xl text-[15px] text-zinc-500">
          Detect stale records, ownerless contracts, duplicate candidates, and orphaned files.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="ui-card p-5">
          <p className="ui-label-caps">Stale records</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{staleContracts.length}</p>
        </div>
        <div className="ui-card p-5">
          <p className="ui-label-caps">Ownerless</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{missingOwner.length}</p>
        </div>
        <div className="ui-card p-5">
          <p className="ui-label-caps">Stale ownership</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{staleOwnership.length}</p>
        </div>
        <div className="ui-card p-5">
          <p className="ui-label-caps">Duplicate candidates</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{duplicates.length}</p>
        </div>
        <div className="ui-card p-5">
          <p className="ui-label-caps">Orphaned files</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{orphaned.length}</p>
        </div>
      </div>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Stale active/review records</h2>
        </div>
        <ul className="divide-y divide-zinc-100">
          {staleContracts.length === 0 ? (
            <li className="px-6 py-4 text-sm text-zinc-500">No stale records.</li>
          ) : (
            staleContracts.map((row) => (
              <li key={row.id} className="px-6 py-3">
                <Link href={`/contracts/${row.id}`} className="ui-link text-sm">
                  {row.title}
                </Link>
                <p className="text-xs text-zinc-500">{new Date(row.updated_at).toISOString().slice(0, 10)}</p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Ownerless contracts (reassign)</h2>
        </div>
        <ul className="divide-y divide-zinc-100">
          {missingOwner.length === 0 ? (
            <li className="px-6 py-4 text-sm text-zinc-500">No ownerless records.</li>
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
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Duplicate candidates (archive)</h2>
        </div>
        <ul className="divide-y divide-zinc-100">
          {duplicates.length === 0 ? (
            <li className="px-6 py-4 text-sm text-zinc-500">No duplicate groups.</li>
          ) : (
            duplicates.slice(0, 10).map((group, idx) => (
              <li key={`dup-${idx}`} className="px-6 py-3">
                <p className="text-xs text-zinc-500">Group {idx + 1}</p>
                <div className="mt-1 space-y-1">
                  {group.map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-3">
                      <Link href={`/contracts/${row.id}`} className="ui-link text-sm">
                        {row.title}
                      </Link>
                      <form action={archiveContractAsDuplicateForm}>
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
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Orphaned file rows (cleanup)</h2>
        </div>
        <ul className="divide-y divide-zinc-100">
          {orphaned.length === 0 ? (
            <li className="px-6 py-4 text-sm text-zinc-500">No orphaned file rows detected.</li>
          ) : (
            orphaned.slice(0, 30).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-6 py-3">
                <span className="text-sm text-zinc-700">{row.file_name}</span>
                <form action={deleteOrphanFileRecordForm}>
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
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Correction campaigns</h2>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-2">
          <form action={runCorrectionCampaignForm} className="space-y-2 rounded-lg border border-zinc-200 p-4">
            <p className="ui-label-caps">Normalization campaign</p>
            <select name="campaignType" className="ui-input w-full">
              <option value="normalize_counterparty">Normalize counterparty spacing</option>
              <option value="clear_stale_next_steps">Clear stale next steps on healthy contracts</option>
            </select>
            <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
              Run correction
            </button>
          </form>
          <form action={runDateBackfillCampaignForm} className="space-y-2 rounded-lg border border-zinc-200 p-4">
            <p className="ui-label-caps">Date backfill campaign</p>
            <input name="contractType" placeholder="Contract type (optional)" className="ui-input w-full" />
            <select name="fieldName" className="ui-input w-full">
              <option value="renewal_date">renewal_date</option>
              <option value="end_date">end_date</option>
              <option value="notice_window">notice_window</option>
              <option value="effective_date">effective_date</option>
              <option value="start_date">start_date</option>
            </select>
            <input name="fallbackDate" type="date" className="ui-input w-full" />
            <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
              Run backfill
            </button>
          </form>
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <h2 className="ui-section-title text-base">Guided change-event maintenance</h2>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-2">
          <form action={logContractChangeEventForm} className="space-y-2 rounded-lg border border-zinc-200 p-4">
            <p className="ui-label-caps">Log change event</p>
            <input name="contractId" required placeholder="Contract UUID" className="ui-input w-full" />
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
          <form action={processContractChangeEventsForm} className="space-y-2 rounded-lg border border-zinc-200 p-4">
            <p className="ui-label-caps">Create maintenance tasks from queue</p>
            <input name="maxRows" type="number" min={1} max={100} defaultValue={25} className="ui-input w-full" />
            <input name="teamKey" defaultValue="ops" className="ui-input w-full" />
            <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
              Process change queue
            </button>
            <p className="text-xs text-zinc-500">Creates follow-up tasks and marks queued events processed.</p>
          </form>
        </div>
        <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
          {changeEvents.length === 0 ? (
            <li className="px-6 py-4 text-sm text-zinc-500">No pending change events.</li>
          ) : (
            changeEvents.map((evt) => {
              const rel = evt.contracts as unknown;
              const contract = (Array.isArray(rel) ? rel[0] : rel) as { id?: string; title?: string } | null;
              return (
                <li key={evt.id} className="px-6 py-3 text-sm">
                  <p className="font-medium text-zinc-900">
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
                  <p className="mt-1 text-xs text-zinc-500">{evt.summary}</p>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
