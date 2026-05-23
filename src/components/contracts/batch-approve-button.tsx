"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListChecks } from "lucide-react";
import { batchApproveReadyFields } from "@/actions/contracts";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";

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
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const router = useRouter();

  if (!canEdit || pendingCount === 0) return null;

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const res = await batchApproveReadyFields(contractId);
      if (res && "error" in res && res.error) {
        setMessage({ text: describeRecoverableMutationError(res.error), tone: "error" });
        return;
      }
      if (res && "success" in res && res.success) {
        setMessage({
          text: `Approved ${res.approved} of ${res.pending_total} pending fields. Others need a source citation or manual edit.`,
          tone: "success",
        });
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="ui-btn-secondary inline-flex w-full items-center gap-1.5 px-3 py-2 text-xs disabled:opacity-50 sm:w-auto"
      >
        <ListChecks size={16} className="text-[var(--success-ink)]" />
        {isPending ? "Approving…" : "Approve all ready fields"}
      </button>
      {message && (
        <p
          className={`max-w-xl rounded-lg px-3 py-2 text-xs leading-relaxed sm:text-right ${
            message.tone === "error" ? "ui-alert-error" : "ui-alert-success"
          }`}
          role={message.tone === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
