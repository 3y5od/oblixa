"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateContractOwner } from "@/actions/contracts";

interface MemberOption {
  userId: string;
  label: string;
}

interface OwnerAssignmentFormProps {
  contractId: string;
  currentOwnerId: string | null;
  members: MemberOption[];
}

export function OwnerAssignmentForm({
  contractId,
  currentOwnerId,
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

  return (
    <div className="mt-3">
      <label className="block text-xs font-medium text-zinc-500 mb-1">
        Reassign owner
      </label>
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
      {isPending && (
        <p className="mt-1 text-xs text-zinc-500">Updating…</p>
      )}
    </div>
  );
}
