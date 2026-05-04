"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runExtraction } from "@/actions/contracts";
import { ExceptionMutationPanels } from "@/components/contracts/exception-mutation-panels";
import { V10JobRetryButton } from "@/components/contracts/import-job-retry-button";
import { WorkQueueInlineActionsGate } from "@/components/work/work-queue-inline-actions-gate";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import type { V10ExceptionResolutionActionOption } from "@/lib/v10-approval-exception";
import { getV10JobRetryUrl } from "@/lib/v10-job-retry";
import type { SemanticStatus } from "@/components/ui/status-badge";

export type V10WorkInboxListItem = {
  key: string;
  v10WorkItemId: string;
  sourceId: string;
  sourceTable: string;
  type: string;
  title: string;
  status: string;
  statusLabel: string;
  statusTone: SemanticStatus;
  ownerUserId?: string | null;
  ownerLabel: string;
  ownerState: string | null;
  due?: string;
  meta?: string;
  href: string;
  contractId?: string | null;
  primaryAction?: string | null;
  nextActionLabel: string;
  nextActionHref: string;
  priorityLabel?: string | null;
  lastStateChangeAt?: string | null;
  secondaryActionsLabel?: string | null;
  compatibleActionGroup?: string | null;
};

export type OwnerOption = { id: string; label: string };

export function isBulkSelectable(item: V10WorkInboxListItem) {
  return Boolean(item.v10WorkItemId && item.compatibleActionGroup);
}

export function summarizeBulkOutcome(action: "assign" | "complete", outcomes: Array<{ outcome: string; reason?: string }>) {
  const success = outcomes.filter((item) => item.outcome === "success").length;
  const noAction = outcomes.filter((item) => item.outcome === "no_action").length;
  const blocked = outcomes.filter((item) => item.outcome === "validation_failed").length;
  const sentences = [
    action === "assign"
      ? success > 0
        ? `Assigned ${success} selected item${success === 1 ? "" : "s"}.`
        : "No selected work items were reassigned."
      : success > 0
        ? `Completed ${success} selected item${success === 1 ? "" : "s"}.`
        : "No selected work items were completed.",
  ];
  if (noAction > 0) sentences.push(action === "assign" ? `${noAction} already had that owner.` : `${noAction} were already complete.`);
  if (blocked > 0) sentences.push(`${blocked} need another bulk group or a refreshed queue.`);
  return sentences.join(" ");
}

function CompactExtractionRetryButton({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error">("success");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="ui-btn-secondary inline-flex px-2.5 py-1 text-[11px] disabled:opacity-60"
        disabled={isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await runExtraction(contractId);
            if ("error" in result && result.error) {
              setTone("error");
              setMessage(describeRecoverableMutationError(result.error));
              return;
            }
            setTone("success");
            setMessage("Extraction retry started.");
            router.refresh();
          });
        }}
      >
        {isPending ? "Retrying extraction..." : "Retry extraction"}
      </button>
      {message ? <span className={`text-[11px] ${tone === "error" ? "text-amber-700" : "text-emerald-700"}`} role="status">{message}</span> : null}
    </div>
  );
}

export function inlineActionsForItem(
  item: V10WorkInboxListItem,
  mutationsEnabled: boolean,
  ownerOptions: OwnerOption[],
  resolutionActionOptions?: V10ExceptionResolutionActionOption[]
) {
  const evidenceHref = item.contractId ? `/contracts/${item.contractId}?tab=overview#contract-evidence` : null;
  if (item.type === "contract_task" && ["open", "in_progress", "blocked", "done"].includes(item.status)) {
    return <><WorkQueueInlineActionsGate kind="task" itemId={item.sourceId} status={item.status as "open" | "in_progress" | "blocked" | "done"} mutationsEnabled={mutationsEnabled} blockerHref={item.status === "blocked" ? item.href : undefined} blockerLabel={item.status === "blocked" ? "Review blocker" : undefined} />{evidenceHref ? <div className="mt-2"><Link href={evidenceHref} className="ui-btn-secondary inline-flex px-2.5 py-1 text-[11px]">Request evidence</Link></div> : null}</>;
  }
  if (item.type === "approval" && ["pending", "approved", "rejected", "changes_requested"].includes(item.status)) {
    return <><WorkQueueInlineActionsGate kind="approval" itemId={item.sourceId} status={item.status as "pending" | "approved" | "rejected" | "changes_requested"} mutationsEnabled={mutationsEnabled} />{evidenceHref ? <div className="mt-2"><Link href={evidenceHref} className="ui-btn-secondary inline-flex px-2.5 py-1 text-[11px]">Request evidence</Link></div> : null}</>;
  }
  if (item.type === "obligation" && ["open", "in_progress", "done", "waived"].includes(item.status)) {
    return <><WorkQueueInlineActionsGate kind="obligation" itemId={item.sourceId} status={item.status as "open" | "in_progress" | "done" | "waived"} mutationsEnabled={mutationsEnabled} />{evidenceHref ? <div className="mt-2"><Link href={evidenceHref} className="ui-btn-secondary inline-flex px-2.5 py-1 text-[11px]">Request evidence</Link></div> : null}</>;
  }
  if (item.type === "exception") {
    return <ExceptionMutationPanels exceptionId={item.sourceId} ownerId={item.ownerUserId ?? null} dueDate={item.due ?? null} ownerOptions={ownerOptions} resolutionActionOptions={resolutionActionOptions} canAssign={mutationsEnabled && ["open", "in_progress"].includes(item.status)} canResolve={mutationsEnabled && ["open", "in_progress"].includes(item.status)} canReopen={mutationsEnabled && ["resolved", "closed"].includes(item.status)} />;
  }
  if (item.type === "import_failure") {
    return <div className="mt-2 flex flex-col gap-2">{mutationsEnabled && item.primaryAction === "retry_failed_job" ? <V10JobRetryButton url={getV10JobRetryUrl({ type: "import_failure", sourceId: item.sourceId })} label="Retry failed rows" successFallbackMessage="Retry started." testId="import-retry" /> : null}<div className="flex flex-wrap gap-2"><Link href="/settings/health#jobs" className="ui-btn-secondary inline-flex px-2.5 py-1 text-[11px]">Open diagnostics</Link>{item.contractId ? <Link href={`/contracts/${item.contractId}?tab=files#source-documents`} className="ui-btn-secondary inline-flex px-2.5 py-1 text-[11px]">Open contract files</Link> : null}</div></div>;
  }
  if (item.type === "extraction_failure") {
    return <div className="mt-2 flex flex-col gap-2">{mutationsEnabled && item.contractId ? <CompactExtractionRetryButton contractId={item.contractId} /> : null}<div className="flex flex-wrap gap-2">{item.contractId ? <Link href={`/contracts/${item.contractId}?tab=fields#extracted-fields`} className="ui-btn-secondary inline-flex px-2.5 py-1 text-[11px]">Open extraction review</Link> : null}<Link href="/settings/health#jobs" className="ui-btn-secondary inline-flex px-2.5 py-1 text-[11px]">Open diagnostics</Link></div></div>;
  }
  if (item.type === "export_failure" || item.type === "report_failure") {
    return <div className="mt-2 flex flex-col gap-2">{mutationsEnabled && item.primaryAction === "retry_failed_job" ? <V10JobRetryButton url={getV10JobRetryUrl({ type: item.type, sourceId: item.sourceId })} label={item.type === "report_failure" ? "Retry report" : "Retry export"} successFallbackMessage={item.type === "report_failure" ? "Report retry completed." : "Export retry queued."} testId={item.type === "report_failure" ? "report-retry" : "export-retry"} /> : null}<div className="flex flex-wrap gap-2"><Link href={item.type === "report_failure" ? "/reports" : "/settings/health#exports"} className="ui-btn-secondary inline-flex px-2.5 py-1 text-[11px]">{item.type === "report_failure" ? "Open reports" : "Open export diagnostics"}</Link><Link href="/settings/health#jobs" className="ui-btn-secondary inline-flex px-2.5 py-1 text-[11px]">Open diagnostics</Link></div></div>;
  }
  return null;
}