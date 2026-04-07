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
  | "due_date"
  | "status"
  | "owner_id"
  | "evidence_notes"
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
}: {
  contractId: string;
  obligations: ObligationRow[];
  members: MemberOption[];
  canEdit: boolean;
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
                  </div>
                  {ob.evidence_notes && (
                    <p className="mt-2 text-xs text-zinc-500">Evidence: {ob.evidence_notes}</p>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
