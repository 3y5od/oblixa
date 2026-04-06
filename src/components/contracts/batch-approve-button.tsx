"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListChecks } from "lucide-react";
import { batchApproveReadyFields } from "@/actions/contracts";

interface BatchApproveButtonProps {
  contractId: string;
  pendingCount: number;
  canEdit?: boolean;
}

export function BatchApproveButton({
  contractId,
  pendingCount,
  canEdit = true,
}: BatchApproveButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  if (!canEdit || pendingCount === 0) return null;

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const res = await batchApproveReadyFields(contractId);
      if (res && "error" in res && res.error) {
        setMessage(res.error);
        return;
      }
      if (res && "success" in res && res.success) {
        setMessage(
          `Approved ${res.approved} of ${res.pending_total} pending fields. Others need a source citation or manual edit.`
        );
        router.refresh();
      }
    });
  }

  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="ui-btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
      >
        <ListChecks size={16} className="text-green-600" />
        {isPending ? "Approving…" : "Approve all ready fields"}
      </button>
      {message && (
        <p className="text-sm text-zinc-600 sm:max-w-md sm:text-right">{message}</p>
      )}
    </div>
  );
}
