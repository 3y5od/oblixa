import Link from "next/link";
import { Workflow } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import type { WorkspaceRole } from "@/lib/navigation";
import {
  isAssuranceModuleHidden,
  loadProductSurfaceContext,
} from "@/lib/product-surface/context";
import {
  applyProgramAction,
  createProgramAction,
  publishProgramAction,
  saveProgramVersionDefinitionAction,
  updateProgramRoutingAction,
} from "@/actions/policy-operations";
import { ProgramImpactPreviewButton } from "@/components/program-impact-preview-button";
import { collectSupabaseRangePages } from "@/lib/supabase/range-pagination";
import { formatUnknownForServerLog } from "@/lib/observability/log-redaction";

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

  const productSurface = await loadProductSurfaceContext(
    ctx.admin,
    ctx.orgId,
    ctx.role as WorkspaceRole
  );
  const showProgramEvolutionCta =
    productSurface.mode === "assurance" &&
    productSurface.seesAssuranceNav &&
    !isAssuranceModuleHidden(productSurface, "program_evolution");

  // Wall clock for rolling apply windows; acceptable in async server component request scope.
  const now = new Date();
  const cutoff30Iso = new Date(now.getTime() - 30 * 86400000).toISOString();
  const cutoff90Iso = new Date(now.getTime() - 90 * 86400000).toISOString();

  const [
    { data: programs },
    { data: versions },
    { data: assignments },
    { count: portfolioContractCount },
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
  ]);

  type ProgramApplyEventRow = { entity_id: string | null; occurred_at: string | null };
  const { rows: programApplyEvents, truncated: programApplyEventsTruncated } =
    await collectSupabaseRangePages<ProgramApplyEventRow>(
      (from, to) =>
        ctx.admin
          .from("operational_casefile_events")
          .select("entity_id, occurred_at")
          .eq("organization_id", ctx.orgId)
          .eq("event_type", "program.applied")
          .not("entity_id", "is", null)
          .order("occurred_at", { ascending: false })
          .range(from, to),
      { pageSize: 1000, maxRows: 150_000 }
    );

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
      console.error("[v4] createProgramAction", formatUnknownForServerLog(result.error));
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
    <div className="ui-page-stack">
      <DashboardPageHeader
        icon={<Workflow className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Programs"
        title="Contract programs"
        lead="Reusable execution blueprints that generate tasks, obligations, approvals, and checkpoints."
      />
      {showProgramEvolutionCta ? (
        <p className="text-[12.5px] text-[var(--text-secondary)]">
          <Link href="/assurance/program-evolution" prefetch={false} className="ui-link font-medium">
            Open program evolution
          </Link>{" "}
          to compare blueprint drift and adoption in Assurance.
        </p>
      ) : null}

      <section className="ui-page-shell">
        <p className="ui-label-caps">Create program</p>
        <p className="ui-support-copy mt-1">Start a reusable execution blueprint here, then publish versions and route them into the right contracts.</p>
        <form action={createProgramFormAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <input aria-label="Customer MSA Program" name="name" required placeholder="Customer MSA Program" className="ui-input" />
          <input aria-label="Quarterly attestations + renewal prep" name="description" placeholder="Quarterly attestations + renewal prep" className="ui-input" />
          <button type="submit" className="ui-btn-primary px-4 py-2 text-[12.5px] md:col-span-2">
            Create program draft
          </button>
        </form>
      </section>

      <section className="ui-page-shell">
        <p className="ui-label-caps">Program analytics</p>
        <p className="ui-support-copy mt-1">
          Apply counts come from casefile events <code className="text-[11px]">program.applied</code> (manual apply +
          auto-attach), rolling windows by event time.
        </p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div className="ui-card-quiet px-3 py-2">
            <dt className="text-xs text-[var(--text-tertiary)]">Programs</dt>
            <dd className="text-lg font-semibold text-[var(--text-primary)]">{programs?.length ?? 0}</dd>
          </div>
          <div className="ui-card-quiet px-3 py-2">
            <dt className="text-xs text-[var(--text-tertiary)]">Active assignments</dt>
            <dd className="text-lg font-semibold text-[var(--text-primary)]">{assignments?.filter((a) => a.status === "active").length ?? 0}</dd>
          </div>
          <div className="ui-card-quiet px-3 py-2">
            <dt className="text-xs text-[var(--text-tertiary)]">Contracts with a program</dt>
            <dd className="text-lg font-semibold text-[var(--text-primary)]">{contractsWithAnyProgram.size}</dd>
          </div>
          <div className="ui-card-quiet px-3 py-2">
            <dt className="text-xs text-[var(--text-tertiary)]">Program applies (30d)</dt>
            <dd className="text-lg font-semibold text-[var(--text-primary)]">{orgApplies30}</dd>
          </div>
          <div className="ui-card-quiet px-3 py-2">
            <dt className="text-xs text-[var(--text-tertiary)]">Program applies (90d)</dt>
            <dd className="text-lg font-semibold text-[var(--text-primary)]">{orgApplies90}</dd>
          </div>
          <div className="ui-card-quiet px-3 py-2">
            <dt className="text-xs text-[var(--text-tertiary)]">
              Program applies (all time{programApplyEventsTruncated ? ", truncated at fetch cap" : ""})
            </dt>
            <dd className="text-lg font-semibold text-[var(--text-primary)]">{orgAppliesAll}</dd>
          </div>
          <div className="ui-card-quiet px-3 py-2 sm:col-span-3">
            <dt className="text-xs text-[var(--text-tertiary)]">Portfolio contracts (for coverage)</dt>
            <dd className="text-lg font-semibold text-[var(--text-primary)]">{portfolioContractCount ?? 0}</dd>
          </div>
        </dl>
      </section>

      <section className="ui-page-shell">
        <div className="flex items-center justify-between">
          <p className="ui-label-caps">Program catalog</p>
          <p className="text-xs text-[var(--text-tertiary)]">Usage + version visibility</p>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {(programs ?? []).length === 0 ? (
            <li className="text-[var(--text-tertiary)]">No programs yet.</li>
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
                <li key={program.id} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                  <p className="font-medium text-[var(--text-primary)]">
                    {program.name} <span className="text-xs text-[var(--text-tertiary)]">({program.state})</span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
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
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{program.description}</p>
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
                  <details className="mt-3 rounded border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-2 text-xs">
                    <summary className="cursor-pointer font-medium text-[var(--text-secondary)]">
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
                      <input aria-label="Changelog (optional)" name="changelog" placeholder="Changelog (optional)" className="ui-input text-xs" />
                      <button type="submit" className="ui-btn-primary px-3 py-1.5 text-xs">
                        Save new draft version
                      </button>
                    </form>
                  </details>
                  <details className="mt-2 rounded border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-2 text-xs">
                    <summary className="cursor-pointer font-medium text-[var(--text-secondary)]">
                      Auto-assignment & default routing (JSON)
                    </summary>
                    <form action={saveRoutingFormAction} className="mt-2 space-y-2">
                      <input type="hidden" name="programId" value={program.id} />
                      <label className="block text-[11px] font-medium text-[var(--text-secondary)]">autoAssignmentRulesJson</label>
                      <textarea
                        name="autoAssignmentRulesJson"
                        rows={5}
                        defaultValue={JSON.stringify(progRow.auto_assignment_rules ?? [], null, 2)}
                        className="ui-input font-mono text-[11px]"
                      />
                      <label className="block text-[11px] font-medium text-[var(--text-secondary)]">defaultRoutingJson</label>
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        Optional{" "}
                        <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-0.5">auto_attach_rules</code>: array of{" "}
                        <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-0.5">{`{ "match": { "contract_type", "source_system", "intake_source", "region", "counterparty_contains" }, "priority"?: number }`}</code>
                        . Empty <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-0.5">match</code> matches any contract. When the program is{" "}
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
                  <details className="mt-3 rounded border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-2 text-xs">
                    <summary className="cursor-pointer font-medium text-[var(--text-secondary)]">
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
