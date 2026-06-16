export const PROGRAM_DEFINITION_PLACEHOLDER = `{
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

export type ProgramApplyEventRow = { entity_id: string | null; occurred_at: string | null };
export type ApplyStats = { d30: number; d90: number; all: number };

export function summarizeProgramApplyEvents(
  rows: ProgramApplyEventRow[] | null | undefined,
  cutoff30Iso: string,
  cutoff90Iso: string
) {
  const applyStatsByProgram = new Map<string, ApplyStats>();
  let orgApplies30 = 0;
  let orgApplies90 = 0;
  let orgAppliesAll = 0;
  for (const row of rows ?? []) {
    const programId = String(row.entity_id ?? "");
    if (!programId) continue;
    const occurredAt = String(row.occurred_at ?? "");
    orgAppliesAll++;
    if (occurredAt >= cutoff30Iso) orgApplies30++;
    if (occurredAt >= cutoff90Iso) orgApplies90++;
    const current = applyStatsByProgram.get(programId) ?? { d30: 0, d90: 0, all: 0 };
    current.all++;
    if (occurredAt >= cutoff30Iso) current.d30++;
    if (occurredAt >= cutoff90Iso) current.d90++;
    applyStatsByProgram.set(programId, current);
  }
  return { applyStatsByProgram, orgApplies30, orgApplies90, orgAppliesAll };
}

export function summarizeProgramAssignments(
  rows: ReadonlyArray<{ status: string | null; program_id: string; contract_id: string | null }> | null | undefined
) {
  const usageByProgram = new Map<string, number>();
  const contractsWithAnyProgram = new Set<string>();
  for (const row of rows ?? []) {
    if (row.status !== "active") continue;
    usageByProgram.set(row.program_id, (usageByProgram.get(row.program_id) ?? 0) + 1);
    if (row.contract_id) contractsWithAnyProgram.add(String(row.contract_id));
  }
  return { usageByProgram, contractsWithAnyProgram };
}

export type ProgramVersionSummary = {
  version_number: number;
  definition_json: unknown;
  state: string;
  published_at: string | null;
};

export function indexLatestProgramVersions(
  rows:
    | ReadonlyArray<{
        program_id: string;
        version_number: number;
        definition_json: unknown;
        state: string;
        published_at: string | null;
      }>
    | null
    | undefined
) {
  const latestVersionByProgram = new Map<string, ProgramVersionSummary>();
  for (const row of rows ?? []) {
    const current = latestVersionByProgram.get(row.program_id);
    if (!current || row.version_number > current.version_number) {
      latestVersionByProgram.set(row.program_id, {
        version_number: row.version_number,
        definition_json: row.definition_json,
        state: row.state,
        published_at: row.published_at,
      });
    }
  }
  return latestVersionByProgram;
}
