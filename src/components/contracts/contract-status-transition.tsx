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
    { label: "Mark Terminated", target: "terminated" },
  ],
  expired: [{ label: "Reactivate", target: "active" }],
  terminated: [{ label: "Reactivate", target: "active" }],
};

const buttonStyles: Record<string, string> = {
  active:
    "border border-[color:color-mix(in_oklab,var(--success)_30%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_30%,var(--surface))] text-[var(--success-ink)] hover:border-[var(--success)] hover:bg-[color:color-mix(in_oklab,var(--success-soft)_70%,var(--surface))] hover:shadow-[var(--shadow-1)]",
  pending_review:
    "border border-[color:color-mix(in_oklab,var(--warning)_42%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning)_12%,var(--surface))] text-[var(--warning-ink)] hover:border-[var(--warning)] hover:bg-[color:color-mix(in_oklab,var(--warning)_28%,var(--surface))] hover:shadow-[var(--shadow-1)]",
  expired:
    "border border-[color:color-mix(in_oklab,var(--warning)_32%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_22%,var(--surface))] text-[var(--warning-ink)] hover:border-[var(--warning)] hover:bg-[color:color-mix(in_oklab,var(--warning-soft)_42%,var(--surface))] hover:shadow-[var(--shadow-1)]",
  terminated:
    "border border-[color:color-mix(in_oklab,var(--danger)_38%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger-soft)_22%,var(--surface))] text-[var(--danger-ink)] hover:border-[var(--danger)] hover:bg-[color:color-mix(in_oklab,var(--danger-soft)_42%,var(--surface))] hover:shadow-[var(--shadow-1)]",
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
      <p className="text-sm text-[var(--text-tertiary)]">
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
            "border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,var(--canvas))]"
          }`}
        >
          {isPending ? "Updating..." : label}
        </button>
      ))}
    </div>
  );
}
