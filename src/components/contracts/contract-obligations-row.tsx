import { format } from "date-fns";
import { ExternalLink } from "@/components/ui/external-link";
import { UiSelect } from "@/components/ui/ui-select";
import { formatBusinessDateAtNoon } from "@/lib/business-dates";
import { graphLinksForEntity } from "@/lib/contract-operations/graph-edge-labels";
import type { ContractObligationStatus } from "@/lib/types";
import {
  ESCALATION_OPTIONS,
  RECURRENCE_OPTIONS,
  STATUS_OPTIONS,
  statusTone,
} from "@/components/contracts/contract-obligations-panel-options";
import type {
  MemberOption,
  ObligationEvent,
  ObligationExecutionGraphEdges,
  ObligationRow,
  ObligationRowHandlers,
} from "@/components/contracts/contract-obligations-panel-types";

export function ContractObligationListItem({
  obligation,
  members,
  canEdit,
  isPending,
  labelByUserId,
  obligationEvents,
  executionGraphEdges,
  onStatusChange,
  onOwnerChange,
  onDelete,
  onOperationalUpdate,
}: {
  obligation: ObligationRow;
  members: MemberOption[];
  canEdit: boolean;
  isPending: boolean;
  labelByUserId: Map<string, string>;
  obligationEvents: ObligationEvent[];
  executionGraphEdges: ObligationExecutionGraphEdges;
} & ObligationRowHandlers) {
  const events = obligationEvents.filter((event) => event.obligation_id === obligation.id);

  return (
    <li className="rounded-xl border border-[var(--border-subtle)] bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <ObligationBody
            obligation={obligation}
            labelByUserId={labelByUserId}
            executionGraphEdges={executionGraphEdges}
            events={events}
          />
        </div>
        {canEdit ? (
          <ObligationControls
            obligation={obligation}
            members={members}
            isPending={isPending}
            onDelete={onDelete}
            onOwnerChange={onOwnerChange}
            onStatusChange={onStatusChange}
          />
        ) : null}
      </div>
      {canEdit ? (
        <ObligationOperationalForm
          obligation={obligation}
          onOperationalUpdate={onOperationalUpdate}
        />
      ) : null}
    </li>
  );
}

function ObligationBody({
  obligation,
  labelByUserId,
  executionGraphEdges,
  events,
}: {
  obligation: ObligationRow;
  labelByUserId: Map<string, string>;
  executionGraphEdges: ObligationExecutionGraphEdges;
  events: ObligationEvent[];
}) {
  return (
    <>
      <p className="text-sm font-semibold text-[var(--text-primary)]">{obligation.title}</p>
      {obligation.details ? (
        <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
          {obligation.details}
        </p>
      ) : null}
      <ObligationBadges obligation={obligation} labelByUserId={labelByUserId} />
      {obligation.evidence_notes ? (
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">Evidence: {obligation.evidence_notes}</p>
      ) : null}
      {obligation.evidence_url ? (
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          Evidence link:{" "}
          <ExternalLink href={obligation.evidence_url} className="ui-link">
            open
          </ExternalLink>
        </p>
      ) : null}
      <ExecutionGraphBadges obligation={obligation} executionGraphEdges={executionGraphEdges} />
      <ObligationEvents events={events} />
    </>
  );
}

function ObligationBadges({
  obligation,
  labelByUserId,
}: {
  obligation: ObligationRow;
  labelByUserId: Map<string, string>;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className={`rounded-full border px-2 py-0.5 font-medium ${statusTone(obligation.status)}`}>
        {obligation.status.replace("_", " ")}
      </span>
      <span className="rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] px-2 py-0.5 text-[var(--text-secondary)]">
        {obligation.obligation_type}
      </span>
      {obligation.cadence ? <span className="text-[var(--text-tertiary)]">Cadence: {obligation.cadence}</span> : null}
      {obligation.recurrence_type && obligation.recurrence_type !== "none" ? (
        <span className="text-[var(--text-tertiary)]">
          Recurs: {obligation.recurrence_type}
          {obligation.recurrence_type === "custom_days" && obligation.recurrence_interval_days
            ? ` (${obligation.recurrence_interval_days}d)`
            : ""}
        </span>
      ) : null}
      {obligation.owner_id ? (
        <span className="text-[var(--text-tertiary)]">
          Owner: {labelByUserId.get(obligation.owner_id) ?? "Member"}
        </span>
      ) : null}
      {obligation.due_date ? (
        <span className="text-[var(--text-tertiary)]">
          Due {formatBusinessDateAtNoon(obligation.due_date)}
        </span>
      ) : null}
      {obligation.completed_at ? (
        <span className="text-[var(--success-ink)]">
          Completed {format(new Date(obligation.completed_at), "MMM d, yyyy")}
        </span>
      ) : null}
      {obligation.next_due_date ? (
        <span className="text-[var(--text-tertiary)]">
          Next due {formatBusinessDateAtNoon(obligation.next_due_date)}
        </span>
      ) : null}
      {obligation.escalation_due_at ? (
        <span className="font-medium text-[var(--danger)]">
          Escalates {format(new Date(obligation.escalation_due_at), "MMM d, yyyy")}
        </span>
      ) : null}
    </div>
  );
}

function ExecutionGraphBadges({
  obligation,
  executionGraphEdges,
}: {
  obligation: ObligationRow;
  executionGraphEdges: ObligationExecutionGraphEdges;
}) {
  const { blockedBy, unblocks } = graphLinksForEntity(executionGraphEdges, "obligation", obligation.id);
  if (blockedBy.length === 0 && unblocks.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {blockedBy.map((label) => (
        <span
          key={`b-${obligation.id}-${label}`}
          className="rounded border border-[color:color-mix(in_oklab,var(--warning)_42%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning)_12%,var(--surface))] px-2 py-0.5 text-[11px] text-[var(--warning-ink)]"
        >
          Input needed: {label}
        </span>
      ))}
      {unblocks.map((label) => (
        <span
          key={`u-${obligation.id}-${label}`}
          className="rounded border border-sky-200 bg-sky-50/80 px-2 py-0.5 text-[11px] text-sky-900"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function ObligationEvents({ events }: { events: ObligationEvent[] }) {
  if (events.length === 0) return null;

  return (
    <ul className="mt-2 space-y-1">
      {events.slice(0, 4).map((event) => (
        <li key={event.id} className="text-[11px] text-[var(--text-tertiary)]">
          {event.event_type.replace(/_/g, " ")} · {format(new Date(event.created_at), "MMM d, h:mm a")}
        </li>
      ))}
    </ul>
  );
}

function ObligationControls({
  obligation,
  members,
  isPending,
  onStatusChange,
  onOwnerChange,
  onDelete,
}: {
  obligation: ObligationRow;
  members: MemberOption[];
  isPending: boolean;
  onStatusChange: (id: string, status: ContractObligationStatus) => void;
  onOwnerChange: (id: string, ownerId: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <UiSelect
        value={obligation.status}
        onChange={(v) => onStatusChange(obligation.id, v as ContractObligationStatus)}
        disabled={isPending}
        ariaLabel="Requirement status"
        options={STATUS_OPTIONS}
        variant="compact"
        portal
        className="min-w-[8.5rem]"
        buttonClassName="w-full !min-h-11 text-xs"
      />
      <UiSelect
        value={obligation.owner_id ?? ""}
        onChange={(v) => onOwnerChange(obligation.id, v)}
        disabled={isPending}
        ariaLabel="Requirement owner"
        options={[
          { value: "", label: "Unassigned" },
          ...members.map((m) => ({ value: m.userId, label: m.label })),
        ]}
        variant="compact"
        portal
        searchThreshold={8}
        className="min-w-[9rem]"
        buttonClassName="w-full !min-h-11 text-xs"
      />
      <button
        type="button"
        onClick={() => onDelete(obligation.id)}
        disabled={isPending}
        className="ui-btn-secondary px-3 py-1.5 text-xs"
      >
        Remove
      </button>
    </div>
  );
}

function ObligationOperationalForm({
  obligation,
  onOperationalUpdate,
}: {
  obligation: ObligationRow;
  onOperationalUpdate: (id: string, formData: FormData) => void;
}) {
  return (
    <form action={onOperationalUpdate.bind(null, obligation.id)} className="mt-3 grid gap-2 sm:grid-cols-5">
      <UiSelect
        name="recurrenceType"
        defaultValue={obligation.recurrence_type ?? "none"}
        ariaLabel="Recurrence"
        options={RECURRENCE_OPTIONS}
        variant="compact"
        portal
        className="w-full"
        buttonClassName="w-full !min-h-11 text-xs"
      />
      <input
        aria-label="interval"
        name="recurrenceIntervalDays"
        type="number"
        min={1}
        max={3650}
        defaultValue={obligation.recurrence_interval_days ?? ""}
        placeholder="interval"
        className="ui-input py-1.5 text-xs"
      />
      <UiSelect
        name="escalationStatus"
        defaultValue={obligation.escalation_status ?? "none"}
        ariaLabel="Escalation status"
        options={ESCALATION_OPTIONS}
        variant="compact"
        portal
        className="w-full"
        buttonClassName="w-full !min-h-11 text-xs"
      />
      <input
        aria-label="Escalation due at"
        name="escalationDueAt"
        type="datetime-local"
        defaultValue={
          obligation.escalation_due_at
            ? new Date(obligation.escalation_due_at).toISOString().slice(0, 16)
            : ""
        }
        className="ui-input py-1.5 text-xs"
      />
      <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
        Save ops fields
      </button>
      <input
        aria-label="Evidence URL"
        name="evidenceUrl"
        type="url"
        defaultValue={obligation.evidence_url ?? ""}
        placeholder="Evidence URL"
        className="ui-input py-1.5 text-xs sm:col-span-2"
      />
      <input
        aria-label="Evidence notes"
        name="evidenceNotes"
        defaultValue={obligation.evidence_notes ?? ""}
        placeholder="Evidence notes"
        className="ui-input py-1.5 text-xs sm:col-span-3"
      />
    </form>
  );
}
