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
    "border border-[color:color-mix(in_oklab,var(--warning)_42%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning)_12%,var(--surface))] text-[var(--warning-ink)] hover:border-[var(--warning)] hover:bg-[color:color-mix(in_oklab,var(--warning)_16%,var(--surface))]",
  expired:
    "border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_65%,var(--canvas))]",
  terminated:
    "border border-[color:color-mix(in_oklab,var(--danger)_38%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger)_10%,var(--surface))] text-[var(--danger)] hover:border-[var(--danger)] hover:bg-[color:color-mix(in_oklab,var(--danger)_14%,var(--surface))]",
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
            "border border-[var(--border-subtle)] bg-surface text-[var(--text-primary)] hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,var(--canvas))]"
          }`}
        >
          {isPending ? "Updating..." : label}
        </button>
      ))}
    </div>
  );
}
