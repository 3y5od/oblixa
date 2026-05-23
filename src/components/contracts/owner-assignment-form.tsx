"use client";

import { useId, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateContractOwner, updateContractSecondaryOwner } from "@/actions/contracts";
import { UiSelect, type UiSelectOption } from "@/components/ui/ui-select";

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
  const ownerLabelId = useId();
  const secondaryLabelId = useId();

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

  const ownerOptions: UiSelectOption[] = members.map((m) => ({
    value: m.userId,
    label: m.label,
  }));
  const secondaryOptions: UiSelectOption[] = [
    { value: "", label: "None" },
    ...members.map((m) => ({ value: m.userId, label: m.label })),
  ];
  const disabled = isPending || members.length === 0;

  return (
    <div className="mt-3 space-y-3">
      <div>
        <p
          id={ownerLabelId}
          className="mb-1 block text-xs font-medium text-[var(--text-tertiary)]"
        >
          Reassign owner
        </p>
        <UiSelect
          className="block w-full"
          buttonClassName="w-full"
          value={currentOwnerId ?? ""}
          onChange={onChange}
          options={ownerOptions}
          placeholder="Select owner…"
          disabled={disabled}
          ariaLabel="Reassign owner"
        />
      </div>
      <div>
        <p
          id={secondaryLabelId}
          className="mb-1 block text-xs font-medium text-[var(--text-tertiary)]"
        >
          Secondary stakeholder
        </p>
        <UiSelect
          className="block w-full"
          buttonClassName="w-full"
          value={currentSecondaryOwnerId ?? ""}
          onChange={onSecondaryChange}
          options={secondaryOptions}
          placeholder="None"
          disabled={disabled}
          ariaLabel="Secondary stakeholder"
        />
      </div>
      {isPending && (
        <p className="text-xs text-[var(--text-tertiary)]">Updating…</p>
      )}
    </div>
  );
}
