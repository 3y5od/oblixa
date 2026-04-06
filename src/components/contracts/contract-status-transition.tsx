"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateContractStatus } from "@/actions/contracts";
import type { ContractStatus } from "@/lib/types";

const transitions: Record<ContractStatus, { label: string; target: ContractStatus }[]> = {
  draft: [{ label: "Submit for Review", target: "pending_review" }],
  pending_review: [{ label: "Mark as Active", target: "active" }],
  active: [
    { label: "Mark Expired", target: "expired" },
    { label: "Terminate", target: "terminated" },
  ],
  expired: [{ label: "Reactivate", target: "active" }],
  terminated: [{ label: "Reactivate", target: "active" }],
};

const buttonStyles: Record<string, string> = {
  active:
    "border border-emerald-200/80 bg-emerald-50 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100/70",
  pending_review:
    "border border-amber-200/80 bg-amber-50 text-amber-900 hover:border-amber-300 hover:bg-amber-100/70",
  expired:
    "border border-zinc-200 bg-zinc-50 text-zinc-800 hover:border-zinc-300 hover:bg-zinc-100/80",
  terminated:
    "border border-red-200/80 bg-red-50 text-red-900 hover:border-red-300 hover:bg-red-100/70",
};

interface ContractStatusTransitionProps {
  contractId: string;
  currentStatus: ContractStatus;
  canEdit?: boolean;
}

export function ContractStatusTransition({
  contractId,
  currentStatus,
  canEdit = true,
}: ContractStatusTransitionProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const available = transitions[currentStatus] ?? [];
  if (available.length === 0) return null;

  if (!canEdit) {
    return (
      <p className="text-sm text-zinc-500">
        Only editors and admins can change contract status.
      </p>
    );
  }

  function handleTransition(target: ContractStatus) {
    startTransition(async () => {
      const result = await updateContractStatus(contractId, target);
      if (result && "success" in result && result.success) {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {available.map(({ label, target }) => (
        <button
          type="button"
          key={target}
          onClick={() => handleTransition(target)}
          disabled={isPending}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            buttonStyles[target] ||
            "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
          }`}
        >
          {isPending ? "Updating..." : label}
        </button>
      ))}
    </div>
  );
}
