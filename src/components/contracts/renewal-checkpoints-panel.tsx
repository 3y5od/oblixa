"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { updateRenewalCheckpointStatus } from "@/actions/renewal-playbook";
import {
  generateRenewalDecisionPacketFormAction,
  updateRenewalCheckpointRenewalStateFormAction,
  updateRenewalCheckpointWorkspaceFormAction,
} from "@/actions/v4";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import type { ContractRenewalCheckpoint, RenewalCheckpointStatus } from "@/lib/types";

type CheckpointRow = Pick<
  ContractRenewalCheckpoint,
  | "id"
  | "label"
  | "offset_days"
  | "due_date"
  | "status"
  | "completed_at"
  | "renewal_state"
  | "workspace_json"
>;

type StakeholderItem = { role: string; item: string; done: boolean };
type ScenarioRow = { name: string; notes: string };

type WorkspaceShape = {
  stakeholder_checklist: StakeholderItem[];
  scenario_comparison: ScenarioRow[];
  commercial_notes: string;
  meeting_agenda: string[];
};

const DEFAULT_WORKSPACE: WorkspaceShape = {
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

const RENEWAL_STATE_OPTIONS = [
  { value: "not_started", label: "Not started" },
  { value: "gathering_inputs", label: "Gathering inputs" },
  { value: "under_review", label: "Under review" },
  { value: "decision_pending", label: "Decision pending" },
  { value: "approved_to_renew", label: "Approved to renew" },
  { value: "approved_to_amend", label: "Approved to amend" },
  { value: "approved_to_terminate", label: "Approved to terminate" },
  { value: "completed", label: "Completed" },
  { value: "slipped", label: "Slipped / overdue" },
] as const;

const STATUS_OPTIONS: { value: RenewalCheckpointStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "skipped", label: "Skipped" },
];

function statusTone(status: RenewalCheckpointStatus): string {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "skipped") return "border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] text-[var(--text-secondary)]";
  if (status === "in_progress") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

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

function StructuredWorkspaceForm({
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
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Stakeholder checklist</p>
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
              <input type="checkbox" checked={row.done} onChange={(e) => setChecklist(i, { done: e.target.checked })} />
              Done
            </label>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Scenario comparison</p>
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
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Commercial notes</p>
        <textarea
          className="ui-input mt-1 min-h-[60px] w-full text-[11px]"
          value={ws.commercial_notes}
          onChange={(e) => setWs((prev) => ({ ...prev, commercial_notes: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Meeting agenda</p>
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
      <details className="text-[10px] text-[var(--text-tertiary)]">
        <summary className="cursor-pointer text-[var(--text-secondary)]">Advanced JSON</summary>
        <pre className="mt-1 max-h-32 overflow-auto rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-2 font-mono">{JSON.stringify(ws, null, 2)}</pre>
      </details>
    </div>
  );
}

export function RenewalCheckpointsPanel({
  checkpoints,
  canEdit,
}: {
  checkpoints: CheckpointRow[];
  canEdit: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onStatusChange(checkpointId: string, status: RenewalCheckpointStatus) {
    if (!canEdit || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await updateRenewalCheckpointStatus({ checkpointId, status });
      if (res && "error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  if (checkpoints.length === 0) {
    return <p className="text-sm text-[var(--text-tertiary)]">No playbook checkpoints seeded yet.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <ul className="space-y-3">
        {checkpoints.map((cp) => (
          <li key={cp.id} className="rounded-xl border border-[var(--border-subtle)] bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{cp.label}</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Due {format(new Date(`${cp.due_date}T12:00:00`), "MMM d, yyyy")}
                  <span className="text-[var(--text-tertiary)]"> · </span>
                  {cp.offset_days}d before renewal
                </p>
                {cp.completed_at && (
                  <p className="mt-1 text-xs text-emerald-700">
                    Updated {format(new Date(cp.completed_at), "MMM d, yyyy")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusTone(cp.status)}`}>
                  {cp.status}
                </span>
                {canEdit && (
                  <select
                    value={cp.status}
                    disabled={isPending}
                    onChange={(e) => onStatusChange(cp.id, e.target.value as RenewalCheckpointStatus)}
                    className="ui-input min-w-[8.5rem] py-1.5 text-xs"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            {canEdit ? (
              <form action={updateRenewalCheckpointRenewalStateFormAction} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="checkpointId" value={cp.id} />
                <label className="text-[11px] text-[var(--text-secondary)]">Renewal state</label>
                <select
                  name="renewalState"
                  defaultValue={cp.renewal_state ?? "not_started"}
                  className="ui-input max-w-xs py-1.5 text-xs"
                >
                  {RENEWAL_STATE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button type="submit" className="ui-btn-secondary px-2 py-1 text-[11px]">
                  Update state
                </button>
              </form>
            ) : null}
            {canEdit ? (
              <StructuredWorkspaceForm
                checkpointId={cp.id}
                workspaceJson={
                  cp.workspace_json && Object.keys(cp.workspace_json as object).length > 0
                    ? cp.workspace_json
                    : DEFAULT_WORKSPACE
                }
              />
            ) : null}
            {canEdit ? (
              <form action={generateRenewalDecisionPacketFormAction} className="mt-4 space-y-2 border-t border-[var(--border-subtle)] pt-3">
                <input type="hidden" name="checkpointId" value={cp.id} />
                <p className="text-[11px] font-medium text-[var(--text-secondary)]">Decision packet</p>
                <input
                  name="packetSummary"
                  placeholder="Optional summary for the packet"
                  className="ui-input w-full max-w-md text-[11px]"
                />
                <button type="submit" className="ui-btn-primary px-3 py-1.5 text-xs">
                  Generate decision packet (draft)
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
