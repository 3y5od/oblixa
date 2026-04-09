"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  applyObligationTemplatesToContractForm,
  createContractObligation,
  deleteContractObligation,
  updateContractObligation,
} from "@/actions/obligations";
import type { ContractObligation, ContractObligationStatus } from "@/lib/types";

type MemberOption = { userId: string; label: string };
type ObligationRow = Pick<
  ContractObligation,
  | "id"
  | "title"
  | "details"
  | "obligation_type"
  | "cadence"
  | "recurrence_type"
  | "recurrence_interval_days"
  | "next_due_date"
  | "escalation_due_at"
  | "escalation_status"
  | "due_date"
  | "status"
  | "owner_id"
  | "evidence_notes"
  | "evidence_url"
  | "completed_at"
>;

const STATUS_OPTIONS: { value: ContractObligationStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "waived", label: "Waived" },
];

function statusTone(status: ContractObligationStatus): string {
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "waived") return "border-zinc-200 bg-zinc-100 text-zinc-700";
  if (status === "in_progress") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export function ContractObligationsPanel({
  contractId,
  obligations,
  members,
  canEdit,
  obligationEvents,
}: {
  contractId: string;
  obligations: ObligationRow[];
  members: MemberOption[];
  canEdit: boolean;
  obligationEvents: Array<{
    id: string;
    obligation_id: string;
    event_type: string;
    details: Record<string, unknown> | null;
    created_at: string;
  }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const labelByUserId = useMemo(
    () => new Map(members.map((m) => [m.userId, m.label])),
    [members]
  );

  function onCreate(formData: FormData) {
    if (!canEdit || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await createContractObligation({
        contractId,
        title: String(formData.get("title") ?? ""),
        details: String(formData.get("details") ?? ""),
        obligationType: String(formData.get("obligationType") ?? ""),
        cadence: String(formData.get("cadence") ?? ""),
        recurrenceType:
          (String(formData.get("recurrenceType") ?? "none") as
            | "none"
            | "daily"
            | "weekly"
            | "monthly"
            | "quarterly"
            | "yearly"
            | "custom_days"),
        recurrenceIntervalDays: Number(
          String(formData.get("recurrenceIntervalDays") ?? "").trim() || "0"
        ),
        escalationDueAt: String(formData.get("escalationDueAt") ?? ""),
        evidenceUrl: String(formData.get("evidenceUrl") ?? ""),
        dueDate: String(formData.get("dueDate") ?? ""),
        ownerId: String(formData.get("ownerId") ?? ""),
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function onStatusChange(id: string, status: ContractObligationStatus) {
    if (!canEdit || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await updateContractObligation({ obligationId: id, status });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function onDelete(id: string) {
    if (!canEdit || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteContractObligation(id);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function onOwnerChange(id: string, ownerId: string) {
    if (!canEdit || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await updateContractObligation({
        obligationId: id,
        ownerId: ownerId || null,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function onOperationalUpdate(id: string, formData: FormData) {
    if (!canEdit || isPending) return;
    setError(null);
    startTransition(async () => {
      const recurrenceType = String(formData.get("recurrenceType") ?? "").trim();
      const recurrenceIntervalDaysRaw = String(
        formData.get("recurrenceIntervalDays") ?? ""
      ).trim();
      const escalationDueAt = String(formData.get("escalationDueAt") ?? "").trim();
      const escalationStatus = String(formData.get("escalationStatus") ?? "").trim();
      const evidenceUrl = String(formData.get("evidenceUrl") ?? "").trim();
      const evidenceNotes = String(formData.get("evidenceNotes") ?? "").trim();
      const recurrenceIntervalDays = recurrenceIntervalDaysRaw
        ? Number(recurrenceIntervalDaysRaw)
        : null;
      const res = await updateContractObligation({
        obligationId: id,
        recurrenceType:
          (recurrenceType as
            | "none"
            | "daily"
            | "weekly"
            | "monthly"
            | "quarterly"
            | "yearly"
            | "custom_days") || undefined,
        recurrenceIntervalDays:
          recurrenceIntervalDays != null && Number.isFinite(recurrenceIntervalDays)
            ? recurrenceIntervalDays
            : null,
        escalationDueAt: escalationDueAt || null,
        escalationStatus:
          (escalationStatus as "none" | "pending" | "sent" | "acked") || undefined,
        evidenceUrl: evidenceUrl || null,
        evidenceNotes: evidenceNotes || null,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <form action={onCreate} className="grid gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="ui-label-caps">Obligation</label>
              <input
                name="title"
                required
                maxLength={240}
                placeholder="Deliver quarterly compliance report"
                className="ui-input w-full"
              />
            </div>
            <div>
              <label className="ui-label-caps">Type</label>
              <input
                name="obligationType"
                maxLength={80}
                placeholder="reporting"
                className="ui-input w-full"
              />
            </div>
            <div>
              <label className="ui-label-caps">Cadence</label>
              <input
                name="cadence"
                maxLength={120}
                placeholder="monthly / quarterly / annual"
                className="ui-input w-full"
              />
            </div>
            <div>
              <label className="ui-label-caps">Recurrence</label>
              <select name="recurrenceType" defaultValue="none" className="ui-input w-full">
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="custom_days">Custom (days)</option>
              </select>
            </div>
            <div>
              <label className="ui-label-caps">Recurrence interval days</label>
              <input
                name="recurrenceIntervalDays"
                type="number"
                min={1}
                max={3650}
                placeholder="e.g. 30"
                className="ui-input w-full"
              />
            </div>
            <div>
              <label className="ui-label-caps">Owner</label>
              <select name="ownerId" defaultValue="" className="ui-input w-full">
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ui-label-caps">Due date</label>
              <input name="dueDate" type="date" className="ui-input w-full" />
            </div>
            <div>
              <label className="ui-label-caps">Escalation due at</label>
              <input name="escalationDueAt" type="datetime-local" className="ui-input w-full" />
            </div>
            <div className="sm:col-span-2">
              <label className="ui-label-caps">Details (optional)</label>
              <textarea
                name="details"
                rows={2}
                maxLength={4000}
                placeholder="Capture criteria, source clause, and evidence expectations."
                className="ui-input w-full resize-y"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="ui-label-caps">Evidence URL (optional)</label>
              <input
                name="evidenceUrl"
                type="url"
                placeholder="https://..."
                className="ui-input w-full"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">Obligations track non-date commitments tied to this contract.</p>
            <button type="submit" disabled={isPending} className="ui-btn-primary px-4 py-2 text-[13px]">
              {isPending ? "Saving..." : "Add obligation"}
            </button>
          </div>
        </form>
      )}
      {canEdit && (
        <form action={applyObligationTemplatesToContractForm.bind(null, contractId)}>
          <button type="submit" disabled={isPending} className="ui-btn-secondary px-4 py-2 text-[13px]">
            Apply templates for this contract type
          </button>
        </form>
      )}

      {error && <p className="text-sm text-rose-700">{error}</p>}

      {obligations.length === 0 ? (
        <p className="text-sm text-zinc-500">No obligations recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {obligations.map((ob) => (
            <li key={ob.id} className="rounded-xl border border-zinc-200/80 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{ob.title}</p>
                  {ob.details && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{ob.details}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full border px-2 py-0.5 font-medium ${statusTone(ob.status)}`}>
                      {ob.status.replace("_", " ")}
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-zinc-700">
                      {ob.obligation_type}
                    </span>
                    {ob.cadence && <span className="text-zinc-500">Cadence: {ob.cadence}</span>}
                    {ob.recurrence_type && ob.recurrence_type !== "none" && (
                      <span className="text-zinc-500">
                        Recurs: {ob.recurrence_type}
                        {ob.recurrence_type === "custom_days" && ob.recurrence_interval_days
                          ? ` (${ob.recurrence_interval_days}d)`
                          : ""}
                      </span>
                    )}
                    {ob.owner_id && (
                      <span className="text-zinc-500">
                        Owner: {labelByUserId.get(ob.owner_id) ?? "Member"}
                      </span>
                    )}
                    {ob.due_date && (
                      <span className="text-zinc-500">
                        Due {format(new Date(`${ob.due_date}T12:00:00`), "MMM d, yyyy")}
                      </span>
                    )}
                    {ob.completed_at && (
                      <span className="text-emerald-700">
                        Completed {format(new Date(ob.completed_at), "MMM d, yyyy")}
                      </span>
                    )}
                    {ob.next_due_date && (
                      <span className="text-zinc-500">
                        Next due {format(new Date(`${ob.next_due_date}T12:00:00`), "MMM d, yyyy")}
                      </span>
                    )}
                    {ob.escalation_due_at && (
                      <span className="text-rose-700">
                        Escalates {format(new Date(ob.escalation_due_at), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                  {ob.evidence_notes && (
                    <p className="mt-2 text-xs text-zinc-500">Evidence: {ob.evidence_notes}</p>
                  )}
                  {ob.evidence_url && (
                    <p className="mt-1 text-xs text-zinc-500">
                      Evidence link:{" "}
                      <a
                        href={ob.evidence_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ui-link"
                      >
                        open
                      </a>
                    </p>
                  )}
                  {obligationEvents.filter((event) => event.obligation_id === ob.id).length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {obligationEvents
                        .filter((event) => event.obligation_id === ob.id)
                        .slice(0, 4)
                        .map((event) => (
                          <li key={event.id} className="text-[11px] text-zinc-500">
                            {event.event_type.replace(/_/g, " ")} ·{" "}
                            {format(new Date(event.created_at), "MMM d, h:mm a")}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canEdit && (
                    <>
                      <select
                        value={ob.status}
                        onChange={(e) =>
                          onStatusChange(ob.id, e.target.value as ContractObligationStatus)
                        }
                        disabled={isPending}
                        className="ui-input min-w-[8.5rem] py-1.5 text-xs"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={ob.owner_id ?? ""}
                        onChange={(e) => onOwnerChange(ob.id, e.target.value)}
                        disabled={isPending}
                        className="ui-input min-w-[9rem] py-1.5 text-xs"
                      >
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => onDelete(ob.id)}
                        disabled={isPending}
                        className="ui-btn-secondary px-3 py-1.5 text-xs"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
              {canEdit && (
                <form action={onOperationalUpdate.bind(null, ob.id)} className="mt-3 grid gap-2 sm:grid-cols-5">
                  <select
                    name="recurrenceType"
                    defaultValue={ob.recurrence_type ?? "none"}
                    className="ui-input py-1.5 text-xs"
                  >
                    <option value="none">none</option>
                    <option value="daily">daily</option>
                    <option value="weekly">weekly</option>
                    <option value="monthly">monthly</option>
                    <option value="quarterly">quarterly</option>
                    <option value="yearly">yearly</option>
                    <option value="custom_days">custom_days</option>
                  </select>
                  <input
                    name="recurrenceIntervalDays"
                    type="number"
                    min={1}
                    max={3650}
                    defaultValue={ob.recurrence_interval_days ?? ""}
                    placeholder="interval"
                    className="ui-input py-1.5 text-xs"
                  />
                  <select
                    name="escalationStatus"
                    defaultValue={ob.escalation_status ?? "none"}
                    className="ui-input py-1.5 text-xs"
                  >
                    <option value="none">esc:none</option>
                    <option value="pending">esc:pending</option>
                    <option value="sent">esc:sent</option>
                    <option value="acked">esc:acked</option>
                  </select>
                  <input
                    name="escalationDueAt"
                    type="datetime-local"
                    defaultValue={
                      ob.escalation_due_at
                        ? new Date(ob.escalation_due_at).toISOString().slice(0, 16)
                        : ""
                    }
                    className="ui-input py-1.5 text-xs"
                  />
                  <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                    Save ops fields
                  </button>
                  <input
                    name="evidenceUrl"
                    type="url"
                    defaultValue={ob.evidence_url ?? ""}
                    placeholder="Evidence URL"
                    className="ui-input py-1.5 text-xs sm:col-span-2"
                  />
                  <input
                    name="evidenceNotes"
                    defaultValue={ob.evidence_notes ?? ""}
                    placeholder="Evidence notes"
                    className="ui-input py-1.5 text-xs sm:col-span-3"
                  />
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
