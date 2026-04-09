/**
 * Builds decision-ready renewal packet payloads from checkpoint + optional linked scenario.
 * Keeps server action and API route in sync.
 */

export type RenewalWorkspaceShape = {
  stakeholder_checklist: Array<{ role: string; item: string; done: boolean }>;
  scenario_comparison: Array<{ name: string; notes: string }>;
  commercial_notes: string;
  meeting_agenda: string[];
};

const DEFAULT_WORKSPACE: RenewalWorkspaceShape = {
  stakeholder_checklist: [],
  scenario_comparison: [],
  commercial_notes: "",
  meeting_agenda: [],
};

export function normalizeRenewalWorkspaceJson(raw: unknown): RenewalWorkspaceShape {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const checklistRaw = o.stakeholder_checklist;
  const scenarioRaw = o.scenario_comparison;
  const agendaRaw = o.meeting_agenda;
  let stakeholder_checklist = DEFAULT_WORKSPACE.stakeholder_checklist;
  if (Array.isArray(checklistRaw)) {
    stakeholder_checklist = checklistRaw.map((row) => {
      const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      return {
        role: String(r.role ?? ""),
        item: String(r.item ?? ""),
        done: Boolean(r.done),
      };
    });
  }
  let scenario_comparison = DEFAULT_WORKSPACE.scenario_comparison;
  if (Array.isArray(scenarioRaw)) {
    scenario_comparison = scenarioRaw.map((row) => {
      const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      return {
        name: String(r.name ?? ""),
        notes: String(r.notes ?? ""),
      };
    });
  }
  const commercial_notes =
    typeof o.commercial_notes === "string" ? o.commercial_notes : DEFAULT_WORKSPACE.commercial_notes;
  let meeting_agenda = DEFAULT_WORKSPACE.meeting_agenda;
  if (Array.isArray(agendaRaw)) {
    meeting_agenda = agendaRaw.map((x) => String(x));
  }
  return { stakeholder_checklist, scenario_comparison, commercial_notes, meeting_agenda };
}

export type RenewalPacketCheckpointInput = {
  label: string | null | undefined;
  due_date: string | null | undefined;
  status: string | null | undefined;
  renewal_state: string | null | undefined;
  workspace_json: unknown;
};

export type RenewalPacketScenarioRow = {
  id: string;
  scenario?: string | null;
  workspace_status?: string | null;
  target_decision_date?: string | null;
  decision_date?: string | null;
} | null;

export function buildRenewalDecisionPacketPayload(input: {
  checkpoint: RenewalPacketCheckpointInput;
  scenarioRow?: RenewalPacketScenarioRow;
  /** API may pass structured assumptions; merged into assumptions_json */
  assumptionsFromRequest?: Record<string, unknown> | null;
}): { packet_json: Record<string, unknown>; assumptions_json: Record<string, unknown> } {
  const workspace = normalizeRenewalWorkspaceJson(input.checkpoint.workspace_json);
  const packet_json: Record<string, unknown> = {
    snapshot_version: 1,
    checkpoint_label: input.checkpoint.label ?? null,
    checkpoint_due_date: input.checkpoint.due_date ?? null,
    checkpoint_status: input.checkpoint.status ?? null,
    renewal_state: input.checkpoint.renewal_state ?? null,
    workspace,
  };
  const scenario = input.scenarioRow;
  if (scenario) {
    packet_json.linked_renewal_scenario = {
      id: scenario.id,
      scenario: scenario.scenario ?? null,
      workspace_status: scenario.workspace_status ?? null,
      target_decision_date: scenario.target_decision_date ?? null,
      decision_date: scenario.decision_date ?? null,
    };
  }
  const assumptions_json: Record<string, unknown> = {
    ...(input.assumptionsFromRequest && typeof input.assumptionsFromRequest === "object"
      ? { ...input.assumptionsFromRequest }
      : {}),
  };
  if (workspace.commercial_notes.trim()) {
    assumptions_json.commercial_notes_from_workspace = workspace.commercial_notes;
  }
  return { packet_json, assumptions_json };
}
