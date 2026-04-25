"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateContractOwner, updateContractSecondaryOwner } from "@/actions/contracts";

interface MemberOption {
  userId: string;
  label: string;
}

interface OwnerAssignmentFormProps {
  contractId: string;
  currentOwnerId: string | null;
  currentSecondaryOwnerId: string | null;
  members: MemberOption[];
}

export function OwnerAssignmentForm({
  contractId,
  currentOwnerId,
  currentSecondaryOwnerId,
  members,
}: OwnerAssignmentFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onChange(userId: string) {
    if (!userId || userId === currentOwnerId) return;
    startTransition(async () => {
      const res = await updateContractOwner(contractId, userId);
      if (res && "success" in res && res.success) router.refresh();
    });
  }

  function onSecondaryChange(userId: string) {
    const normalized = userId || null;
    if (normalized === currentSecondaryOwnerId) return;
    startTransition(async () => {
      const res = await updateContractSecondaryOwner(contractId, normalized);
      if (res && "success" in res && res.success) router.refresh();
    });
  }

  return (
    <div className="mt-3">
      <label className="block text-xs font-medium text-[var(--text-tertiary)] mb-1">Reassign owner</label>
      <select
        defaultValue={currentOwnerId ?? ""}
        disabled={isPending || members.length === 0}
        onChange={(e) => onChange(e.target.value)}
        className="ui-input disabled:opacity-50"
      >
        <option value="">Select owner…</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.label}
          </option>
        ))}
      </select>
      <label className="mt-3 block text-xs font-medium text-[var(--text-tertiary)] mb-1">
        Secondary stakeholder
      </label>
      <select
        defaultValue={currentSecondaryOwnerId ?? ""}
        disabled={isPending || members.length === 0}
        onChange={(e) => onSecondaryChange(e.target.value)}
        className="ui-input disabled:opacity-50"
      >
        <option value="">None</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.label}
          </option>
        ))}
      </select>
      {isPending && (
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">Updating…</p>
      )}
    </div>
  );
}
