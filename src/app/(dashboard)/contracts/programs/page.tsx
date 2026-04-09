import { getAuthContext } from "@/lib/supabase/server";
import {
  applyProgramAction,
  createProgramAction,
  publishProgramAction,
  saveProgramVersionDefinitionAction,
  updateProgramRoutingAction,
} from "@/actions/v4";
import { ProgramImpactPreviewButton } from "@/components/v4/program-impact-preview-button";

const PROGRAM_DEFINITION_PLACEHOLDER = `{
  "taskBundles": [
    { "title": "Kickoff checklist", "dueOffsetDays": 3, "priority": "medium", "teamKey": "ops" }
  ],
  "obligationBundles": [
    { "title": "Quarterly compliance attestation", "cadence": "quarterly", "dueOffsetDays": 14 }
  ],
  "approvalSequences": [
    { "approvalType": "renewal_decision", "dueHours": 72, "notes": "Legal sign-off" }
  ],
  "renewalCheckpoints": [
    { "label": "90d renewal prep", "dueOffsetDays": 90 }
  ],
  "slas": [
    { "approvalType": "renewal_decision", "slaHours": 48 }
  ],
  "evidenceTemplateIds": []
}`;

export default async function ContractProgramsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  // Wall clock for rolling apply windows; acceptable in async server component request scope.
  // eslint-disable-next-line react-hooks/purity -- snapshot time for analytics cutoffs
  const now = Date.now();
  const cutoff30Iso = new Date(now - 30 * 86400000).toISOString();
  const cutoff90Iso = new Date(now - 90 * 86400000).toISOString();

  const [
    { data: programs },
    { data: versions },
    { data: assignments },
    { count: portfolioContractCount },
    { data: programApplyEvents },
  ] = await Promise.all([
    ctx.admin
      .from("contract_programs")
      .select(
        "id, name, description, state, current_version_id, auto_assignment_rules, default_routing_json, created_at, updated_at"
      )
      .eq("organization_id", ctx.orgId)
      .order("updated_at", { ascending: false }),
    ctx.admin
      .from("contract_program_versions")
      .select("id, program_id, version_number, state, published_at, definition_json")
      .eq("organization_id", ctx.orgId)
      .order("version_number", { ascending: false })
      .limit(500),
    ctx.admin
      .from("contract_program_assignments")
      .select("id, program_id, status, contract_id")
      .eq("organization_id", ctx.orgId),
    ctx.admin
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.orgId),
    ctx.admin
      .from("operational_casefile_events")
      .select("entity_id, occurred_at")
      .eq("organization_id", ctx.orgId)
      .eq("event_type", "program.applied")
      .not("entity_id", "is", null)
      .order("occurred_at", { ascending: false })
      .limit(8000),
  ]);

  type ApplyStats = { d30: number; d90: number; all: number };
  const applyStatsByProgram = new Map<string, ApplyStats>();
  let orgApplies30 = 0;
  let orgApplies90 = 0;
  let orgAppliesAll = 0;
  for (const row of programApplyEvents ?? []) {
    const pid = String(row.entity_id ?? "");
    if (!pid) continue;
    const at = String(row.occurred_at ?? "");
    orgAppliesAll++;
    if (at >= cutoff30Iso) orgApplies30++;
    if (at >= cutoff90Iso) orgApplies90++;
    const cur = applyStatsByProgram.get(pid) ?? { d30: 0, d90: 0, all: 0 };
    cur.all++;
    if (at >= cutoff30Iso) cur.d30++;
    if (at >= cutoff90Iso) cur.d90++;
    applyStatsByProgram.set(pid, cur);
  }

  const usageByProgram = new Map<string, number>();
  const contractsWithAnyProgram = new Set<string>();
  for (const row of assignments ?? []) {
    if (row.status !== "active") continue;
    usageByProgram.set(row.program_id, (usageByProgram.get(row.program_id) ?? 0) + 1);
    if (row.contract_id) contractsWithAnyProgram.add(String(row.contract_id));
  }

  const latestVersionByProgram = new Map<
    string,
    {
      version_number: number;
      definition_json: unknown;
      state: string;
      published_at: string | null;
    }
  >();
  for (const v of versions ?? []) {
    const cur = latestVersionByProgram.get(v.program_id);
    if (!cur || v.version_number > cur.version_number) {
      latestVersionByProgram.set(v.program_id, {
        version_number: v.version_number,
        definition_json: v.definition_json,
        state: v.state,
        published_at: v.published_at,
      });
    }
  }

  async function createProgramFormAction(formData: FormData) {
    "use server";
    const result = await createProgramAction(formData);
    if (result && "error" in result && result.error) {
      console.error("[v4] createProgramAction", result.error);
    }
  }

  async function publishProgramFormAction(formData: FormData) {
    "use server";
    const programId = String(formData.get("programId") ?? "").trim();
    if (!programId) return;
    await publishProgramAction(programId);
  }

  async function applyProgramFormAction(formData: FormData) {
    "use server";
    await applyProgramAction(formData);
  }

  async function saveVersionFormAction(formData: FormData) {
    "use server";
    await saveProgramVersionDefinitionAction(formData);
  }

  async function saveRoutingFormAction(formData: FormData) {
    "use server";
    await updateProgramRoutingAction(formData);
  }

  return (
    <div className="space-y-8">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Programs</p>
          <h1 className="ui-display-title mt-2">Contract Programs</h1>
          <p className="ui-muted mt-3">
            Reusable execution blueprints that generate tasks, obligations, approvals, and checkpoints.
          </p>
        </div>
      </header>

      <section className="ui-card p-5">
        <p className="ui-label-caps">Create program</p>
        <form action={createProgramFormAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <input name="name" required placeholder="Customer MSA Program" className="ui-input" />
          <input name="description" placeholder="Quarterly attestations + renewal prep" className="ui-input" />
          <button type="submit" className="ui-btn-primary px-4 py-2 text-[13px] md:col-span-2">
            Create program draft
          </button>
        </form>
      </section>

      <section className="ui-card p-5">
        <p className="ui-label-caps">Program analytics</p>
        <p className="mt-1 text-xs text-zinc-500">
          Apply counts come from casefile events <code className="text-[10px]">program.applied</code> (manual apply +
          auto-attach), rolling windows by event time.
        </p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2">
            <dt className="text-xs text-zinc-500">Programs</dt>
            <dd className="text-lg font-semibold text-zinc-900">{programs?.length ?? 0}</dd>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2">
            <dt className="text-xs text-zinc-500">Active assignments</dt>
            <dd className="text-lg font-semibold text-zinc-900">{assignments?.filter((a) => a.status === "active").length ?? 0}</dd>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2">
            <dt className="text-xs text-zinc-500">Contracts with a program</dt>
            <dd className="text-lg font-semibold text-zinc-900">{contractsWithAnyProgram.size}</dd>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2">
            <dt className="text-xs text-zinc-500">Program applies (30d)</dt>
            <dd className="text-lg font-semibold text-zinc-900">{orgApplies30}</dd>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2">
            <dt className="text-xs text-zinc-500">Program applies (90d)</dt>
            <dd className="text-lg font-semibold text-zinc-900">{orgApplies90}</dd>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2">
            <dt className="text-xs text-zinc-500">Program applies (all time, capped)</dt>
            <dd className="text-lg font-semibold text-zinc-900">{orgAppliesAll}</dd>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 sm:col-span-3">
            <dt className="text-xs text-zinc-500">Portfolio contracts (for coverage)</dt>
            <dd className="text-lg font-semibold text-zinc-900">{portfolioContractCount ?? 0}</dd>
          </div>
        </dl>
      </section>

      <section className="ui-card p-5">
        <div className="flex items-center justify-between">
          <p className="ui-label-caps">Program catalog</p>
          <p className="text-xs text-zinc-500">Usage + version visibility</p>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {(programs ?? []).length === 0 ? (
            <li className="text-zinc-500">No programs yet.</li>
          ) : (
            (programs ?? []).map((program) => {
              const latest = latestVersionByProgram.get(program.id);
              const progRow = program as {
                id: string;
                name: string;
                auto_assignment_rules: unknown;
                default_routing_json: Record<string, unknown> | null;
              };
              const applies = applyStatsByProgram.get(program.id);
              return (
                <li key={program.id} className="rounded-lg border border-zinc-200 px-3 py-2">
                  <p className="font-medium text-zinc-900">
                    {program.name} <span className="text-xs text-zinc-500">({program.state})</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    v{latest?.version_number ?? 1} · active assignments {usageByProgram.get(program.id) ?? 0}
                    {applies ? (
                      <>
                        {" "}
                        · applies 30d/90d/all: {applies.d30}/{applies.d90}/{applies.all}
                      </>
                    ) : (
                      <> · applies 30d/90d/all: 0/0/0</>
                    )}
                  </p>
                  {program.description ? (
                    <p className="mt-1 text-xs text-zinc-600">{program.description}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ProgramImpactPreviewButton programId={program.id} />
                    <form action={publishProgramFormAction}>
                      <input type="hidden" name="programId" value={program.id} />
                      <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                        Publish
                      </button>
                    </form>
                  </div>
                  <details className="mt-3 rounded border border-zinc-200 bg-zinc-50/50 p-2 text-xs">
                    <summary className="cursor-pointer font-medium text-zinc-700">
                      Version definition (JSON) + changelog
                    </summary>
                    <form action={saveVersionFormAction} className="mt-2 space-y-2">
                      <input type="hidden" name="programId" value={program.id} />
                      <textarea
                        name="definitionJson"
                        required
                        rows={14}
                        defaultValue={
                          latest?.definition_json
                            ? JSON.stringify(latest.definition_json as Record<string, unknown>, null, 2)
                            : PROGRAM_DEFINITION_PLACEHOLDER
                        }
                        className="ui-input font-mono text-[11px]"
                      />
                      <input name="changelog" placeholder="Changelog (optional)" className="ui-input text-xs" />
                      <button type="submit" className="ui-btn-primary px-3 py-1.5 text-xs">
                        Save new draft version
                      </button>
                    </form>
                  </details>
                  <details className="mt-2 rounded border border-zinc-200 bg-zinc-50/50 p-2 text-xs">
                    <summary className="cursor-pointer font-medium text-zinc-700">
                      Auto-assignment & default routing (JSON)
                    </summary>
                    <form action={saveRoutingFormAction} className="mt-2 space-y-2">
                      <input type="hidden" name="programId" value={program.id} />
                      <label className="block text-[11px] font-medium text-zinc-600">autoAssignmentRulesJson</label>
                      <textarea
                        name="autoAssignmentRulesJson"
                        rows={5}
                        defaultValue={JSON.stringify(progRow.auto_assignment_rules ?? [], null, 2)}
                        className="ui-input font-mono text-[11px]"
                      />
                      <label className="block text-[11px] font-medium text-zinc-600">defaultRoutingJson</label>
                      <p className="text-[10px] text-zinc-500">
                        Optional{" "}
                        <code className="rounded bg-zinc-100 px-0.5">auto_attach_rules</code>: array of{" "}
                        <code className="rounded bg-zinc-100 px-0.5">{`{ "match": { "contract_type", "source_system", "intake_source", "region", "counterparty_contains" }, "priority"?: number }`}</code>
                        . Empty <code className="rounded bg-zinc-100 px-0.5">match</code> matches any contract. When the program is{" "}
                        <strong>published</strong>, matching contracts get work on create/import (and via reconcile cron).
                      </p>
                      <textarea
                        name="defaultRoutingJson"
                        rows={4}
                        defaultValue={JSON.stringify(progRow.default_routing_json ?? {}, null, 2)}
                        className="ui-input font-mono text-[11px]"
                      />
                      <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                        Save routing
                      </button>
                    </form>
                  </details>
                  <details className="mt-3 rounded border border-zinc-200 bg-zinc-50/50 p-2 text-xs">
                    <summary className="cursor-pointer font-medium text-zinc-700">
                      Apply program to contracts
                    </summary>
                    <form action={applyProgramFormAction} className="mt-2 space-y-2">
                      <input type="hidden" name="programId" value={program.id} />
                      <textarea
                        name="contractIds"
                        required
                        className="ui-input min-h-[72px] text-xs"
                        placeholder="Paste contract IDs separated by comma, space, or newline"
                      />
                      <button type="submit" className="ui-btn-primary px-3 py-1.5 text-xs">
                        Apply and generate execution work
                      </button>
                    </form>
                  </details>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
