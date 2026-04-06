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
  active: "bg-green-600 hover:bg-green-700 text-white",
  pending_review: "bg-amber-600 hover:bg-amber-700 text-white",
  expired: "bg-gray-600 hover:bg-gray-700 text-white",
  terminated: "bg-red-600 hover:bg-red-700 text-white",
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
      <p className="text-sm text-gray-500">
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
          key={target}
          onClick={() => handleTransition(target)}
          disabled={isPending}
          className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
            buttonStyles[target] || "bg-gray-600 hover:bg-gray-700 text-white"
          }`}
        >
          {isPending ? "Updating..." : label}
        </button>
      ))}
    </div>
  );
}
