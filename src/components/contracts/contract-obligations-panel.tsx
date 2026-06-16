"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createContractObligation,
  deleteContractObligation,
  updateContractObligation,
} from "@/actions/obligations";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import type { ContractObligationStatus } from "@/lib/types";
import { ContractObligationCreateTools } from "@/components/contracts/contract-obligations-create-form";
import { ContractObligationListItem } from "@/components/contracts/contract-obligations-row";
import type {
  MemberOption,
  ObligationEvent,
  ObligationRow,
} from "@/components/contracts/contract-obligations-panel-types";
import type { ExecutionGraphEdgeRow } from "@/lib/contract-operations/graph-edge-labels";

type RecurrenceType = "none" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom_days";

export function ContractObligationsPanel({
  contractId,
  obligations,
  members,
  canEdit,
  obligationEvents,
  executionGraphEdges,
}: {
  contractId: string;
  obligations: ObligationRow[];
  members: MemberOption[];
  canEdit: boolean;
  executionGraphEdges?: ExecutionGraphEdgeRow[];
  obligationEvents: ObligationEvent[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const labelByUserId = useMemo(
    () => new Map(members.map((m) => [m.userId, m.label])),
    [members]
  );

  function onCreate(formData: FormData) {
    if (!canEdit || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await createContractObligation({
        contractId,
        title: String(formData.get("title") ?? ""),
        details: String(formData.get("details") ?? ""),
        obligationType: String(formData.get("obligationType") ?? ""),
        cadence: String(formData.get("cadence") ?? ""),
        recurrenceType: String(formData.get("recurrenceType") ?? "none") as RecurrenceType,
        recurrenceIntervalDays: Number(
          String(formData.get("recurrenceIntervalDays") ?? "").trim() || "0"
        ),
        escalationDueAt: String(formData.get("escalationDueAt") ?? ""),
        evidenceUrl: String(formData.get("evidenceUrl") ?? ""),
        dueDate: String(formData.get("dueDate") ?? ""),
        ownerId: String(formData.get("ownerId") ?? ""),
      });
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onStatusChange(id: string, status: ContractObligationStatus) {
    if (!canEdit || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await updateContractObligation({ obligationId: id, status });
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onDelete(id: string) {
    if (!canEdit || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteContractObligation(id);
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onOwnerChange(id: string, ownerId: string) {
    if (!canEdit || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await updateContractObligation({
        obligationId: id,
        ownerId: ownerId || null,
      });
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  function onOperationalUpdate(id: string, formData: FormData) {
    if (!canEdit || isPending) return;
    setError(null);
    startTransition(async () => {
      const recurrenceType = String(formData.get("recurrenceType") ?? "").trim();
      const recurrenceIntervalDaysRaw = String(formData.get("recurrenceIntervalDays") ?? "").trim();
      const escalationDueAt = String(formData.get("escalationDueAt") ?? "").trim();
      const escalationStatus = String(formData.get("escalationStatus") ?? "").trim();
      const evidenceUrl = String(formData.get("evidenceUrl") ?? "").trim();
      const evidenceNotes = String(formData.get("evidenceNotes") ?? "").trim();
      const recurrenceIntervalDays = recurrenceIntervalDaysRaw
        ? Number(recurrenceIntervalDaysRaw)
        : null;
      const res = await updateContractObligation({
        obligationId: id,
        recurrenceType: (recurrenceType as RecurrenceType) || undefined,
        recurrenceIntervalDays:
          recurrenceIntervalDays != null && Number.isFinite(recurrenceIntervalDays)
            ? recurrenceIntervalDays
            : null,
        escalationDueAt: escalationDueAt || null,
        escalationStatus:
          (escalationStatus as "none" | "pending" | "sent" | "acked") || undefined,
        evidenceUrl: evidenceUrl || null,
        evidenceNotes: evidenceNotes || null,
      });
      if ("error" in res && res.error) {
        setError(describeRecoverableMutationError(res.error));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <ContractObligationCreateTools
          contractId={contractId}
          members={members}
          isPending={isPending}
          onCreate={onCreate}
        />
      ) : null}
      {error ? (
        <p className="ui-alert-error text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {obligations.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)]">No requirements recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {obligations.map((ob) => (
            <ContractObligationListItem
              key={ob.id}
              obligation={ob}
              members={members}
              canEdit={canEdit}
              isPending={isPending}
              labelByUserId={labelByUserId}
              obligationEvents={obligationEvents}
              executionGraphEdges={executionGraphEdges}
              onDelete={onDelete}
              onOwnerChange={onOwnerChange}
              onOperationalUpdate={onOperationalUpdate}
              onStatusChange={onStatusChange}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
