import Link from "next/link";
import { ArrowRightLeft, CheckCircle2, Inbox, ListOrdered } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { upsertContractIntakeRequestForm } from "@/actions/contracts";
import { loadOrgMemberProfileRows, orgMemberProfileLabel } from "@/lib/org-member-profiles";

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
  const [{ data: contracts }, { data: throughput }, membersData] = await Promise.all([
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
    loadOrgMemberProfileRows(admin, orgId),
  ]);

  const memberById = new Map<string, string>();
  for (const row of membersData ?? []) {
    memberById.set(row.user_id, orgMemberProfileLabel(row.profiles));
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
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Intake workflow</p>
          <h1 className="ui-display-title">Intake queue</h1>
          <p className="ui-page-lead mt-2">
            Track received contracts from review to operationally active with required next steps.
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Throughput</p>
          <h2 className="ui-page-title mt-2 text-[1.8rem]">Intake signals</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <OperationalSummaryCard
            eyebrow="Window"
            headline="Status transitions"
            tone="neutral"
            icon={ArrowRightLeft}
            primaryValue={transitions.length}
            primaryUnit={`last ${lookbackDays}d`}
            action={{ href: "/contracts/intake", label: "Refresh intake" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Outcome"
            headline="Activated"
            tone={activeTransitions > 0 ? "healthy" : "neutral"}
            icon={CheckCircle2}
            primaryValue={activeTransitions}
            primaryUnit="to active"
            action={{ href: "/contracts/intake", label: "Review intake queue" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Friction"
            headline="Clarification loops"
            tone={clarificationTransitions > 0 ? "attention" : "healthy"}
            icon={ListOrdered}
            primaryValue={clarificationTransitions}
            primaryUnit="to clarification"
            action={{ href: "/contracts/intake", label: "Triage clarifications" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Depth"
            headline="Sampled queue"
            tone="neutral"
            icon={Inbox}
            primaryValue={contracts?.length ?? 0}
            primaryUnit="contracts loaded"
            action={{ href: "/contracts", label: "Browse contracts" }}
            variant="compact"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {STATUS_ORDER.map((status) => {
          const rows = grouped.get(status) ?? [];
          return (
            <section key={status} className="ui-page-shell overflow-hidden">
              <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-5 py-3">
                <p className="ui-eyebrow">Stage</p>
                <h2 className="ui-section-title mt-1 text-base">
                  {status.replace(/_/g, " ")} ({rows.length})
                </h2>
              </div>
              {rows.length === 0 ? (
                <p className="px-5 py-4 text-sm text-[var(--text-tertiary)]">No contracts in this stage.</p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {rows.slice(0, 15).map((row) => (
                    <li key={String(row.id)} className="px-5 py-3">
                      <Link
                        href={`/contracts/${row.id}`}
                        className="block transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,var(--canvas))]/70"
                      >
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{String(row.title)}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {(row.counterparty as string | null) || "No counterparty"} · health{" "}
                          {(row.health_status as string) || "unknown"}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                          Next step: {(row.required_next_step as string | null) || "None"}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                          Intake owner:{" "}
                          {(row.intake_owner_id as string | null)
                            ? memberById.get(row.intake_owner_id as string) ?? "Member"
                            : "Unassigned"}{" "}
                          · source {(row.intake_source as string | null) || "manual"} · completeness{" "}
                          {typeof row.intake_completeness_score === "number"
                            ? `${Math.round(row.intake_completeness_score as number)}%`
                            : "n/a"}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
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
