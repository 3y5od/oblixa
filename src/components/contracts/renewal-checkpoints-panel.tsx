"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { updateRenewalCheckpointStatus } from "@/actions/renewal-playbook";
import type { ContractRenewalCheckpoint, RenewalCheckpointStatus } from "@/lib/types";

type CheckpointRow = Pick<
  ContractRenewalCheckpoint,
  "id" | "label" | "offset_days" | "due_date" | "status" | "completed_at"
>;

const STATUS_OPTIONS: { value: RenewalCheckpointStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "skipped", label: "Skipped" },
];

function statusTone(status: RenewalCheckpointStatus): string {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "skipped") return "border-zinc-200 bg-zinc-100 text-zinc-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
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
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  if (checkpoints.length === 0) {
    return <p className="text-sm text-zinc-500">No playbook checkpoints seeded yet.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <ul className="space-y-3">
        {checkpoints.map((cp) => (
          <li key={cp.id} className="rounded-xl border border-zinc-200/80 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900">{cp.label}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Due {format(new Date(`${cp.due_date}T12:00:00`), "MMM d, yyyy")}
                  <span className="text-zinc-300"> · </span>
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
                    onChange={(e) =>
                      onStatusChange(cp.id, e.target.value as RenewalCheckpointStatus)
                    }
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
          </li>
        ))}
      </ul>
    </div>
  );
}
