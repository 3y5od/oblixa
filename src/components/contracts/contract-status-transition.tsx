"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
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
  /** When set, the transition to "active" is disabled and this reason is
   *  surfaced — used to hold activation until required suggested fields are
   *  reviewed (release-state AI trust boundary). */
  blockActivateReason?: string | null;
}

export function ContractStatusTransition({
  contractId,
  currentStatus,
  canEdit = true,
  blockActivateReason = null,
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {available.map(({ label, target }) => {
          const activateBlocked = target === "active" && Boolean(blockActivateReason);
          // Activation waiting on required input renders as an explicit chip +
          // a reason line instead of a dashed, opacity-washed disabled button —
          // the state reads as "locked, here's why", not "greyed out".
          if (activateBlocked) {
            return (
              <span
                key={target}
                className="inline-flex items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--warning)_30%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_26%,var(--surface-raised))] px-3 py-1.5 text-[12px] font-semibold text-[var(--warning-ink)]"
              >
                <Lock className="h-3 w-3" strokeWidth={2} aria-hidden />
                {label} needs input
              </span>
            );
          }
          return (
            <button
              type="button"
              key={target}
              onClick={() => handleTransition(target)}
              disabled={isPending}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                buttonStyles[target] ||
                "border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,var(--canvas))]"
              }`}
            >
              {isPending ? "Updating..." : label}
            </button>
          );
        })}
      </div>
      {blockActivateReason && available.some(({ target }) => target === "active") ? (
        <p className="text-[11.5px] leading-snug text-[var(--warning-ink)]">{blockActivateReason}</p>
      ) : null}
    </div>
  );
}
