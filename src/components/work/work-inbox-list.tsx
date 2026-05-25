"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkAssignCompatibleV10WorkItems, bulkCompleteCompatibleV10WorkItems } from "@/actions/bulk-compatible-work";
import { QueueItemCard } from "@/components/ui/queue-item-card";
import { DiagnosticDisclosure } from "@/components/ui/operational-summary-card";
import { PermissionEligibilityHint } from "@/components/ui/permission-eligibility-hint";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import type { V10ExceptionResolutionActionOption } from "@/lib/approval-exception";
import {
  inlineActionsForItem,
  isBulkSelectable,
  summarizeBulkOutcome,
  type OwnerOption,
  type V10WorkInboxListItem,
} from "./work-inbox-list-helpers";

export type { V10WorkInboxListItem } from "./work-inbox-list-helpers";

export function V10WorkInboxList({
  items,
  ownerOptions,
  resolutionActionOptions,
  mutationsEnabled,
}: {
  items: V10WorkInboxListItem[];
  ownerOptions: OwnerOption[];
  resolutionActionOptions?: V10ExceptionResolutionActionOption[];
  mutationsEnabled: boolean;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ownerUserId, setOwnerUserId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [isPending, startTransition] = useTransition();

  const selectableItems = useMemo(() => items.filter(isBulkSelectable), [items]);
  const selectedItems = useMemo(() => {
    const ids = new Set(selectedIds);
      return selectableItems.filter((item) => ids.has(item.v10WorkItemId));
  }, [selectableItems, selectedIds]);
  const activeGroup = selectedItems[0]?.compatibleActionGroup ?? null;
  const activeType = selectedItems[0]?.type ?? null;

  function toggleSelected(item: V10WorkInboxListItem) {
    if (!isBulkSelectable(item)) return;
    if ((activeGroup && item.compatibleActionGroup !== activeGroup) || (activeType && item.type !== activeType)) return;
    setSelectedIds((current) =>
      current.includes(item.v10WorkItemId)
        ? current.filter((id) => id !== item.v10WorkItemId)
        : [...current, item.v10WorkItemId]
    );
  }

  async function runBulkAction(action: "assign" | "complete") {
    if (!activeGroup || selectedItems.length === 0) return;
    setMessage(null);
    startTransition(async () => {
      const mutationId = globalThis.crypto?.randomUUID?.() ?? `bulk-${Date.now()}`;
      const result =
        action === "assign"
          ? await bulkAssignCompatibleV10WorkItems({
              v10WorkItemIds: selectedItems.map((item) => item.v10WorkItemId),
              ownerUserId,
              expectedCompatibleActionGroup: activeGroup,
              idempotencyKey: mutationId,
              clientRequestId: mutationId,
            })
          : await bulkCompleteCompatibleV10WorkItems({
              v10WorkItemIds: selectedItems.map((item) => item.v10WorkItemId),
              expectedCompatibleActionGroup: activeGroup,
              idempotencyKey: mutationId,
              clientRequestId: mutationId,
            });

      if (!result.ok || result.error) {
        setMessageTone("error");
        setMessage(describeRecoverableMutationError(result.error ?? "Bulk work action failed."));
        return;
      }

      setMessageTone("success");
      setMessage(summarizeBulkOutcome(action, result.outcomes ?? []));
      setSelectedIds([]);
      if (action === "assign") setOwnerUserId("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {selectableItems.length > 0 ? (
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="ui-eyebrow">Bulk work actions</p>
              <h3 className="mt-1 text-sm font-semibold text-[var(--text-primary)]">Assign or complete compatible work</h3>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Select rows that share the same bulk group and work type to reassign ownership or mark them done.
              </p>
            </div>
            {!mutationsEnabled ? (
              <PermissionEligibilityHint variant="not_permitted" actionLabel="Workspace roles" actionHref="/settings" />
            ) : null}
          </div>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
            <select
              aria-label="Assign selected work to owner"
              className="ui-input text-sm md:max-w-xs"
              value={ownerUserId}
              onChange={(event) => setOwnerUserId(event.target.value)}
              disabled={!mutationsEnabled || isPending || selectedItems.length === 0}
            >
              <option value="">Assign selected work…</option>
              {ownerOptions.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="ui-btn-secondary px-3 py-2 text-xs disabled:opacity-60"
              disabled={!mutationsEnabled || isPending || !ownerUserId || selectedItems.length === 0 || !activeGroup}
              onClick={() => void runBulkAction("assign")}
            >
              Assign selected work
            </button>
            <button
              type="button"
              className="ui-btn-primary px-3 py-2 text-xs disabled:opacity-60"
              disabled={!mutationsEnabled || isPending || selectedItems.length === 0 || !activeGroup}
              onClick={() => void runBulkAction("complete")}
            >
              Complete selected work
            </button>
            <button
              type="button"
              className="ui-link text-xs"
              disabled={isPending || selectedItems.length === 0}
              onClick={() => setSelectedIds([])}
            >
              Clear selection
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--text-secondary)]" aria-live="polite">
            {selectedItems.length > 0
              ? `${selectedItems.length} ${String(activeType ?? "work item").replace(/_/g, " ")}${selectedItems.length === 1 ? "" : "s"} selected in ${String(activeGroup).replace(/_/g, " ")}.`
              : `${selectableItems.length} row${selectableItems.length === 1 ? " is" : "s are"} eligible for bulk actions in this lens.`}
          </p>
          {message ? (
            <p
              className={`mt-2 text-xs ${messageTone === "error" ? "ui-alert-error" : "ui-alert-success"}`}
              role={messageTone === "error" ? "alert" : "status"}
              aria-live={messageTone === "error" ? "assertive" : "polite"}
            >
              {message}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {items.map((item) => {
          const bulkSelectable = isBulkSelectable(item);
          const selectionLocked = (Boolean(activeGroup) && item.compatibleActionGroup !== activeGroup) || (Boolean(activeType) && item.type !== activeType);
          return (
            <div key={item.key} className="space-y-2">
              {bulkSelectable ? (
                <label className={`flex items-center gap-2 text-xs text-[var(--text-secondary)] ${selectionLocked ? "opacity-60" : ""}`}>
                  <input
                    type="checkbox"
                    className="ui-checkbox"
                    aria-label={`Select ${item.title} for bulk actions`}
                    checked={selectedIds.includes(item.v10WorkItemId)}
                    disabled={!mutationsEnabled || isPending || selectionLocked}
                    onChange={() => toggleSelected(item)}
                  />
                  Select for bulk work actions
                </label>
              ) : null}
              <QueueItemCard
                objectType={String(item.type).replace(/_/g, " ")}
                title={item.title}
                href={item.href}
                statusLabel={item.statusLabel}
                statusTone={item.statusTone}
                owner={item.ownerLabel}
                due={item.due}
                meta={item.meta}
                nextAction={{ label: item.nextActionLabel, href: item.nextActionHref }}
                continuityContractId={item.contractId ?? undefined}
                continuityOmit={["work"]}
                actions={inlineActionsForItem(item, mutationsEnabled, ownerOptions, resolutionActionOptions)}
              />
              <DiagnosticDisclosure title="Work item diagnostics">
                Priority: {item.priorityLabel ?? "normal"}
                {" · "}Last state change: {item.lastStateChangeAt ? new Date(item.lastStateChangeAt).toLocaleString() : "not recorded"}
                {" · "}Secondary actions: {item.secondaryActionsLabel ?? "no additional action available"}
                {item.compatibleActionGroup ? ` · Bulk-compatible group: ${String(item.compatibleActionGroup)}` : ""}
              </DiagnosticDisclosure>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { V10WorkInboxList as WorkInboxList };
export type { V10WorkInboxListItem as WorkInboxListItem } from "./work-inbox-list-helpers";
// End version-name compatibility aliases.
