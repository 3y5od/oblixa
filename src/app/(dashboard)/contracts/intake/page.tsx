import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";
import { upsertContractIntakeRequestForm } from "@/actions/contracts";

const STATUS_ORDER = [
  "awaiting_review",
  "in_clarification",
  "active",
  "at_risk",
  "renewal_prep",
  "notice_decision",
  "archived",
] as const;

export default async function IntakeQueuePage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const { admin, orgId } = ctx;
  const now = new Date();
  const { data: workflowSettings } = await admin
    .from("organization_workflow_settings")
    .select("weekly_intake_lookback_days")
    .eq("organization_id", orgId)
    .maybeSingle();
  const lookbackDays = Math.max(
    1,
    Number(workflowSettings?.weekly_intake_lookback_days ?? 30)
  );
  const [{ data: contracts }, { data: throughput }, { data: membersData }] = await Promise.all([
    admin
      .from("contracts")
      .select(
        "id, title, counterparty, intake_status, health_status, required_next_step, owner_id, intake_owner_id, intake_source, intake_completeness_score, owner_assigned_at, received_at, reviewed_at, operationally_active_at, contract_files(id), contract_extraction_jobs(status, created_at)"
      )
      .eq("organization_id", orgId)
      .order("received_at", { ascending: false })
      .limit(150),
    admin
      .from("contract_intake_history")
      .select("id, to_status, created_at")
      .eq("organization_id", orgId)
      .gte(
        "created_at",
        new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000).toISOString()
      ),
    admin
      .from("organization_members")
      .select("user_id, profiles(full_name, email)")
      .eq("organization_id", orgId),
  ]);

  const memberById = new Map<string, string>();
  for (const row of membersData ?? []) {
    const profile = row.profiles as unknown as { full_name: string | null; email: string | null } | null;
    memberById.set(row.user_id, profile?.full_name || profile?.email || "Member");
  }

  const grouped = new Map<string, Array<Record<string, unknown>>>();
  for (const key of STATUS_ORDER) grouped.set(key, []);
  for (const row of contracts ?? []) {
    const key = (row.intake_status as string) || "awaiting_review";
    const bucket = grouped.get(key) ?? grouped.get("awaiting_review");
    bucket?.push(row as unknown as Record<string, unknown>);
  }

  const transitions = throughput ?? [];
  const activeTransitions = transitions.filter((t) => t.to_status === "active").length;
  const clarificationTransitions = transitions.filter((t) => t.to_status === "in_clarification").length;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-zinc-200/60 pb-8">
        <p className="ui-eyebrow">Intake workflow</p>
        <h1 className="ui-display-title">Intake queue</h1>
        <p className="max-w-2xl text-[15px] text-zinc-500">
          Track received contracts from review to operationally active with required next steps.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="ui-card p-5">
          <p className="ui-label-caps">Last 30d transitions</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{transitions.length}</p>
        </div>
        <div className="ui-card p-5">
          <p className="ui-label-caps">Activated</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{activeTransitions}</p>
        </div>
        <div className="ui-card p-5">
          <p className="ui-label-caps">Clarification loops</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">{clarificationTransitions}</p>
        </div>
        <div className="ui-card p-5">
          <p className="ui-label-caps">Queue size</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{contracts?.length ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {STATUS_ORDER.map((status) => {
          const rows = grouped.get(status) ?? [];
          return (
            <section key={status} className="ui-card overflow-hidden">
              <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
                <h2 className="text-sm font-semibold text-zinc-800">
                  {status.replace(/_/g, " ")} ({rows.length})
                </h2>
              </div>
              {rows.length === 0 ? (
                <p className="px-5 py-4 text-sm text-zinc-500">No contracts in this stage.</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {rows.slice(0, 15).map((row) => (
                    <li key={String(row.id)} className="px-5 py-3">
                      <Link
                        href={`/contracts/${row.id}`}
                        className="block transition-colors hover:bg-zinc-50/70"
                      >
                        <p className="text-sm font-semibold text-zinc-900">{String(row.title)}</p>
                        <p className="text-xs text-zinc-500">
                          {(row.counterparty as string | null) || "No counterparty"} · health{" "}
                          {(row.health_status as string) || "unknown"}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Next step: {(row.required_next_step as string | null) || "None"}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Intake owner:{" "}
                          {(row.intake_owner_id as string | null)
                            ? memberById.get(row.intake_owner_id as string) ?? "Member"
                            : "Unassigned"}{" "}
                          · source {(row.intake_source as string | null) || "manual"} · completeness{" "}
                          {typeof row.intake_completeness_score === "number"
                            ? `${Math.round(row.intake_completeness_score as number)}%`
                            : "n/a"}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Ingestion: {(((row.contract_files as unknown[]) ?? []).length > 0 ? "files_attached" : "metadata_only")} ·
                          extraction{" "}
                          {(() => {
                            const jobs = (row.contract_extraction_jobs as
                              | Array<{ status?: string }>
                              | undefined) ?? [];
                            if (jobs.length === 0) return "not_started";
                            return jobs[0]?.status ?? "unknown";
                          })()}
                        </p>
                      </Link>
                      <form
                        action={upsertContractIntakeRequestForm}
                        className="mt-2 flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="contractId" value={String(row.id)} />
                        <input
                          type="hidden"
                          name="source"
                          value={String((row.intake_source as string | null) || "manual")}
                        />
                        <select name="status" className="ui-input h-7 text-[11px]">
                          <option value="triage">triage</option>
                          <option value="review">review</option>
                          <option value="ready">ready</option>
                          <option value="rejected">rejected</option>
                        </select>
                        <input
                          name="completenessScore"
                          type="number"
                          min={0}
                          max={100}
                          placeholder="score"
                          className="ui-input h-7 w-20 text-[11px]"
                        />
                        <button type="submit" className="ui-btn-secondary px-2 py-1 text-[11px]">
                          Log intake update
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
