"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateRenewalCheckpointWorkspaceFormAction } from "@/actions/policy-operations";

type StakeholderItem = { role: string; item: string; done: boolean };
type ScenarioRow = { name: string; notes: string };

type WorkspaceShape = {
  stakeholder_checklist: StakeholderItem[];
  scenario_comparison: ScenarioRow[];
  commercial_notes: string;
  meeting_agenda: string[];
};

export const DEFAULT_WORKSPACE: WorkspaceShape = {
  stakeholder_checklist: [
    { role: "Legal", item: "Confirm renewal path", done: false },
    { role: "Finance", item: "Validate pricing impact", done: false },
  ],
  scenario_comparison: [
    { name: "Renew as-is", notes: "" },
    { name: "Amend terms", notes: "" },
    { name: "Non-renew", notes: "" },
  ],
  commercial_notes: "",
  meeting_agenda: ["Context", "Commercial review", "Decision"],
};

function normalizeWorkspace(raw: unknown): WorkspaceShape {
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

export function StructuredWorkspaceForm({
  checkpointId,
  workspaceJson,
}: {
  checkpointId: string;
  workspaceJson: unknown;
}) {
  const [ws, setWs] = useState(() => normalizeWorkspace(workspaceJson));
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submitWorkspace() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("checkpointId", checkpointId);
      fd.set("workspaceJson", JSON.stringify(ws));
      await updateRenewalCheckpointWorkspaceFormAction(fd);
      router.refresh();
    });
  }

  function setChecklist(i: number, patch: Partial<StakeholderItem>) {
    setWs((prev) => {
      const next = { ...prev, stakeholder_checklist: [...prev.stakeholder_checklist] };
      next.stakeholder_checklist[i] = { ...next.stakeholder_checklist[i], ...patch };
      return next;
    });
  }

  function setScenario(i: number, patch: Partial<ScenarioRow>) {
    setWs((prev) => {
      const next = { ...prev, scenario_comparison: [...prev.scenario_comparison] };
      next.scenario_comparison[i] = { ...next.scenario_comparison[i], ...patch };
      return next;
    });
  }

  function setAgenda(i: number, value: string) {
    setWs((prev) => {
      const next = [...prev.meeting_agenda];
      next[i] = value;
      return { ...prev, meeting_agenda: next };
    });
  }

  return (
    <div className="mt-3 space-y-4 border-t border-[var(--border-subtle)] pt-3">
      <p className="text-[11px] font-medium text-[var(--text-secondary)]">Renewal workspace (structured)</p>
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Stakeholder checklist</p>
        {ws.stakeholder_checklist.map((row, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded border border-[var(--border-subtle)] px-2 py-1.5">
            <input
              className="ui-input w-24 text-[11px]"
              value={row.role}
              onChange={(e) => setChecklist(i, { role: e.target.value })}
              aria-label={`Stakeholder role ${i + 1}`}
            />
            <input
              className="ui-input min-w-[12rem] flex-1 text-[11px]"
              value={row.item}
              onChange={(e) => setChecklist(i, { item: e.target.value })}
              aria-label={`Stakeholder item ${i + 1}`}
            />
            <label className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
              <input type="checkbox" className="ui-checkbox" checked={row.done} onChange={(e) => setChecklist(i, { done: e.target.checked })} />
              Done
            </label>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Scenario comparison</p>
        {ws.scenario_comparison.map((row, i) => (
          <div key={i} className="grid gap-1 sm:grid-cols-2">
            <input
              className="ui-input text-[11px]"
              value={row.name}
              onChange={(e) => setScenario(i, { name: e.target.value })}
              placeholder="Scenario name"
            />
            <input
              className="ui-input text-[11px]"
              value={row.notes}
              onChange={(e) => setScenario(i, { notes: e.target.value })}
              placeholder="Notes"
            />
          </div>
        ))}
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Commercial notes</p>
        <textarea
          className="ui-input mt-1 min-h-[60px] w-full text-[11px]"
          value={ws.commercial_notes}
          onChange={(e) => setWs((prev) => ({ ...prev, commercial_notes: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Meeting agenda</p>
        {ws.meeting_agenda.map((line, i) => (
          <input
            key={i}
            className="ui-input w-full text-[11px]"
            value={line}
            onChange={(e) => setAgenda(i, e.target.value)}
            placeholder={`Agenda item ${i + 1}`}
          />
        ))}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={submitWorkspace}
        className="ui-btn-secondary px-3 py-1.5 text-xs"
      >
        Save workspace
      </button>
      <details className="text-[11px] text-[var(--text-tertiary)]">
        <summary className="cursor-pointer text-[var(--text-secondary)]">Advanced JSON</summary>
        <pre className="mt-1 max-h-32 overflow-auto rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-2 font-mono">{JSON.stringify(ws, null, 2)}</pre>
      </details>
    </div>
  );
}
