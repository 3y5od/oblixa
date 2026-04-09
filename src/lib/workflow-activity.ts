export type WorkflowActivityDomain = "task" | "obligation" | "approval" | "renewal";

export type WorkflowActivity = {
  id: string;
  domain: WorkflowActivityDomain;
  label: string;
  createdAt: string;
};

type EventRow = { id: string; event_type: string; created_at: string };
type RenewalNoteRow = { id: string; pinned: boolean; created_at: string };

function normalizeEventLabel(eventType: string): string {
  return eventType.replace(/_/g, " ");
}

function toEpochMs(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

export function toWorkflowActivityFromEvents(
  domain: Extract<WorkflowActivityDomain, "task" | "obligation" | "approval">,
  events: EventRow[]
): WorkflowActivity[] {
  return events.map((evt) => ({
    id: `${domain}-${evt.id}`,
    domain,
    label: normalizeEventLabel(evt.event_type),
    createdAt: evt.created_at,
  }));
}

export function toWorkflowActivityFromRenewalNotes(notes: RenewalNoteRow[]): WorkflowActivity[] {
  return notes.map((note) => ({
    id: `renewal-note-${note.id}`,
    domain: "renewal",
    label: note.pinned ? "pinned note" : "note added",
    createdAt: note.created_at,
  }));
}

export function buildUnifiedWorkflowTimeline(
  input: {
    taskEvents: EventRow[];
    obligationEvents: EventRow[];
    approvalEvents: EventRow[];
    renewalNotes: RenewalNoteRow[];
  },
  maxItems = 14
): WorkflowActivity[] {
  return [
    ...toWorkflowActivityFromEvents("task", input.taskEvents),
    ...toWorkflowActivityFromEvents("obligation", input.obligationEvents),
    ...toWorkflowActivityFromEvents("approval", input.approvalEvents),
    ...toWorkflowActivityFromRenewalNotes(input.renewalNotes),
  ]
    .filter((row) => toEpochMs(row.createdAt) !== null)
    .sort((a, b) => {
      const bMs = toEpochMs(b.createdAt) ?? 0;
      const aMs = toEpochMs(a.createdAt) ?? 0;
      if (bMs !== aMs) return bMs - aMs;
      return a.id.localeCompare(b.id);
    })
    .slice(0, maxItems);
}
