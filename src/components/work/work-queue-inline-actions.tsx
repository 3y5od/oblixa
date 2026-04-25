"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateContractTaskStatus } from "@/actions/tasks";
import { updateContractApprovalStatus } from "@/actions/approvals";
import { updateContractObligation } from "@/actions/obligations";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import { PermissionEligibilityHint } from "@/components/ui/permission-eligibility-hint";

type WorkQueueInlineActionsProps =
  | {
      kind: "task";
      itemId: string;
      status: "open" | "in_progress" | "blocked" | "done";
      /** When false, hide mutations and show the shared eligibility hint (viewers / read-only). */
      mutationsEnabled?: boolean;
      blockerHref?: string;
      blockerLabel?: string;
    }
  | {
      kind: "approval";
      itemId: string;
      status: "pending" | "approved" | "rejected";
      mutationsEnabled?: boolean;
      blockerHref?: string;
      blockerLabel?: string;
    }
  | {
      kind: "obligation";
      itemId: string;
      status: "open" | "in_progress" | "done" | "waived";
      mutationsEnabled?: boolean;
      blockerHref?: string;
      blockerLabel?: string;
    };

type ActionButton = {
  id: string;
  label: string;
  tone: "primary" | "secondary";
  run: () => Promise<{ error: string } | { success: true; message: string }>;
};

function actionButtonClass(tone: ActionButton["tone"]) {
  return tone === "primary"
    ? "ui-btn-primary px-2.5 py-1 text-[11px] disabled:opacity-60"
    : "ui-btn-secondary px-2.5 py-1 text-[11px] disabled:opacity-60";
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function combineMessages(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function describeActionError(error: string) {
  const lower = error.toLowerCase();
  if (lower.includes("cannot transition")) {
    return `${error} Refresh the queue and try again.`;
  }
  const mapped = describeRecoverableMutationError(error);
  if (mapped !== error) return mapped;
  return /[.!?]$/.test(error) ? `${error} Retry when ready.` : `${error}. Retry when ready.`;
}

export function WorkQueueInlineActions(props: WorkQueueInlineActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [refreshQueued, setRefreshQueued] = useState(false);
  const refreshTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) window.clearTimeout(refreshTimeoutRef.current);
    };
  }, []);

  if (props.mutationsEnabled === false) {
    return (
      <div className="mt-2">
        <PermissionEligibilityHint
          variant="not_permitted"
          actionLabel="Workspace roles"
          actionHref="/settings"
        />
      </div>
    );
  }

  const actions: ActionButton[] =
    props.kind === "task"
      ? props.status === "open"
        ? [
            {
              id: "start",
              label: "Start",
              tone: "primary",
              run: async () => {
                const result = await updateContractTaskStatus(props.itemId, "in_progress");
                if ("error" in result && result.error) return { error: describeActionError(result.error) };
                return { success: true as const, message: "Task moved into progress." };
              },
            },
          ]
        : props.status === "in_progress"
          ? [
              {
                id: "complete",
                label: "Complete",
                tone: "primary",
                run: async () => {
                  const result = await updateContractTaskStatus(props.itemId, "done");
                  if ("error" in result && result.error) return { error: describeActionError(result.error) };
                  return {
                    success: true as const,
                    message: combineMessages([
                      "Task marked complete.",
                      (result.reopenedDependencyCount ?? 0) > 0
                        ? `${pluralize(result.reopenedDependencyCount ?? 0, "blocked dependent task")} reopened.`
                        : null,
                      result.generatedRecurringTask ? "Next recurring task created." : null,
                    ]),
                  };
                },
              },
            ]
          : props.status === "blocked"
            ? [
                {
                  id: "resume",
                  label: "Resume",
                  tone: "secondary",
                  run: async () => {
                    const result = await updateContractTaskStatus(props.itemId, "open");
                    if ("error" in result && result.error) return { error: describeActionError(result.error) };
                    return { success: true as const, message: "Task reopened for work." };
                  },
                },
              ]
            : []
      : props.kind === "approval"
        ? props.status === "pending"
          ? [
              {
                id: "approve",
                label: "Approve",
                tone: "primary",
                run: async () => {
                  const result = await updateContractApprovalStatus({
                    approvalId: props.itemId,
                    status: "approved",
                  });
                  if ("error" in result && result.error) return { error: describeActionError(result.error) };
                  return {
                    success: true as const,
                    message: combineMessages([
                      "Approval recorded.",
                      (result.reopenedTaskCount ?? 0) > 0
                        ? `${pluralize(result.reopenedTaskCount ?? 0, "blocked approval-linked task")} reopened.`
                        : null,
                    ]),
                  };
                },
              },
              {
                id: "reject",
                label: "Reject",
                tone: "secondary",
                run: async () => {
                  const result = await updateContractApprovalStatus({
                    approvalId: props.itemId,
                    status: "rejected",
                  });
                  if ("error" in result && result.error) return { error: describeActionError(result.error) };
                  return {
                    success: true as const,
                    message: combineMessages([
                      "Approval rejected.",
                      (result.reopenedTaskCount ?? 0) > 0
                        ? `${pluralize(result.reopenedTaskCount ?? 0, "blocked approval-linked task")} reopened for follow-up.`
                        : null,
                    ]),
                  };
                },
              },
            ]
          : []
        : props.status === "open"
          ? [
              {
                id: "start",
                label: "Start",
                tone: "primary",
                run: async () => {
                  const result = await updateContractObligation({
                    obligationId: props.itemId,
                    status: "in_progress",
                  });
                  if ("error" in result && result.error) return { error: describeActionError(result.error) };
                  return { success: true as const, message: "Obligation moved into progress." };
                },
              },
            ]
          : props.status === "in_progress"
            ? [
                {
                  id: "complete",
                  label: "Complete",
                  tone: "primary",
                  run: async () => {
                    const result = await updateContractObligation({
                      obligationId: props.itemId,
                      status: "done",
                    });
                    if ("error" in result && result.error) return { error: describeActionError(result.error) };
                    return {
                      success: true as const,
                      message: combineMessages([
                        "Obligation marked complete.",
                        result.generatedRecurringObligation ? "Next recurring obligation created." : null,
                      ]),
                    };
                  },
                },
              ]
            : [];

  if (actions.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={isPending || refreshQueued}
            className={actionButtonClass(action.tone)}
            onClick={() => {
              setMessage(null);
              setRefreshQueued(false);
              startTransition(async () => {
                const result = await action.run();
                if (result && "error" in result && result.error) {
                  setMessageTone("error");
                  setMessage(result.error);
                  return;
                }
                setMessageTone("success");
                if (!("success" in result) || !result.success) return;
                setMessage(result.message);
                setRefreshQueued(true);
                if (refreshTimeoutRef.current) window.clearTimeout(refreshTimeoutRef.current);
                refreshTimeoutRef.current = window.setTimeout(() => {
                  setRefreshQueued(false);
                  router.refresh();
                }, 900);
              });
            }}
          >
            {isPending ? "Saving..." : refreshQueued ? "Refreshing..." : action.label}
          </button>
        ))}
        {props.blockerHref ? (
          <Link
            href={props.blockerHref}
            className="ui-btn-secondary px-2.5 py-1 text-[11px]"
          >
            {props.blockerLabel ?? "Resolve blocker"}
          </Link>
        ) : null}
      </div>
      {message ? (
        <p
          className={`text-[11px] ${messageTone === "success" ? "text-emerald-700" : "text-rose-700"}`}
          role={messageTone === "success" ? "status" : "alert"}
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
