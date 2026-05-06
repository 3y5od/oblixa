"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignException, reopenException, resolveException } from "@/actions/exceptions";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import {
  getV10ExceptionResolutionActionOptions,
  type V10ExceptionResolutionAction,
  type V10ExceptionResolutionActionOption,
} from "@/lib/v10-approval-exception";

type OwnerOption = {
  id: string;
  label: string;
};

type ExceptionMutationPanelsProps = {
  exceptionId: string;
  ownerId: string | null;
  dueDate: string | null;
  ownerOptions: OwnerOption[];
  resolutionActionOptions?: V10ExceptionResolutionActionOption[];
  canAssign: boolean;
  canResolve: boolean;
  canReopen: boolean;
};

export function ExceptionMutationPanels(props: ExceptionMutationPanelsProps) {
  const resolutionActionOptions = props.resolutionActionOptions ?? getV10ExceptionResolutionActionOptions();
  const syncKey = `${props.exceptionId}:${props.ownerId ?? ""}:${props.dueDate ?? ""}:${resolutionActionOptions.map((option) => option.value).join(",")}`;
  return <ExceptionMutationPanelsInner key={syncKey} {...props} />;
}

function ExceptionMutationPanelsInner(props: ExceptionMutationPanelsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [refreshQueued, setRefreshQueued] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const refreshTimeoutRef = useRef<number | null>(null);

  const [ownerId, setOwnerId] = useState(props.ownerId ?? "");
  const [dueDate, setDueDate] = useState(props.dueDate ?? "");
  const resolutionActionOptions = props.resolutionActionOptions ?? getV10ExceptionResolutionActionOptions();
  const [resolutionAction, setResolutionAction] = useState<V10ExceptionResolutionAction>(
    resolutionActionOptions[0]?.value ?? "fixed"
  );
  const [resolutionNote, setResolutionNote] = useState("");

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) window.clearTimeout(refreshTimeoutRef.current);
    };
  }, []);

  function scheduleRefresh() {
    setRefreshQueued(true);
    if (refreshTimeoutRef.current) window.clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = window.setTimeout(() => {
      setRefreshQueued(false);
      router.refresh();
    }, 900);
  }

  return (
    <div className="mt-3 grid gap-2 md:grid-cols-3">
      {props.canAssign ? (
        <div className="space-y-2 rounded border border-[var(--border-subtle)] p-2">
          <p className="ui-label-caps">Assign</p>
          <select
            value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)}
            className="ui-input text-xs"
            required
            disabled={isPending || refreshQueued}
          >
            <option value="" disabled>
              Select owner
            </option>
            {props.ownerOptions.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="ui-input text-xs"
            disabled={isPending || refreshQueued}
          />
          <button
            type="button"
            disabled={isPending || refreshQueued}
            className="ui-btn-secondary px-3 py-1.5 text-xs disabled:opacity-60"
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const result = await assignException({
                  exceptionId: props.exceptionId,
                  ownerId,
                  dueDate: dueDate || null,
                });
                if ("error" in result && result.error) {
                  setMessageTone("error");
                  setMessage(describeRecoverableMutationError(result.error));
                  return;
                }
                setMessageTone("success");
                setMessage(result.message ?? "Exception updated.");
                scheduleRefresh();
              });
            }}
          >
            {isPending ? "Saving..." : refreshQueued ? "Refreshing..." : "Save owner and due date"}
          </button>
        </div>
      ) : null}

      {props.canResolve ? (
        <div className="space-y-2 rounded border border-[var(--border-subtle)] p-2">
          <p className="ui-label-caps">Resolve</p>
          <select
            value={resolutionAction}
            onChange={(event) => setResolutionAction(event.target.value as V10ExceptionResolutionAction)}
            className="ui-input text-xs"
            disabled={isPending || refreshQueued}
          >
            {resolutionActionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <textarea
            value={resolutionNote}
            onChange={(event) => setResolutionNote(event.target.value)}
            className="ui-input min-h-[52px] text-xs"
            placeholder="Resolution note (required for high-risk exceptions)"
            disabled={isPending || refreshQueued}
          />
          {resolutionNote.trim().length > 0 && !isPending ? (
            <p className="text-[11px] text-[var(--text-tertiary)]" role="status" aria-live="polite">
              The resolution note stays local until you save it.
            </p>
          ) : null}
          <button
            type="button"
            disabled={isPending || refreshQueued}
            className="ui-btn-secondary px-3 py-1.5 text-xs disabled:opacity-60"
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const result = await resolveException({
                  exceptionId: props.exceptionId,
                  resolutionAction,
                  resolutionNote,
                });
                if ("error" in result && result.error) {
                  setMessageTone("error");
                  setMessage(describeRecoverableMutationError(result.error));
                  return;
                }
                setMessageTone("success");
                setMessage(result.message ?? "Exception updated.");
                scheduleRefresh();
              });
            }}
          >
            {isPending ? "Saving..." : refreshQueued ? "Refreshing..." : "Mark resolved"}
          </button>
        </div>
      ) : null}

      {props.canReopen ? (
        <div className="space-y-2 rounded border border-[var(--border-subtle)] p-2">
          <p className="ui-label-caps">Reopen</p>
          <button
            type="button"
            disabled={isPending || refreshQueued}
            className="ui-btn-secondary px-3 py-1.5 text-xs disabled:opacity-60"
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const result = await reopenException({ exceptionId: props.exceptionId });
                if ("error" in result && result.error) {
                  setMessageTone("error");
                  setMessage(describeRecoverableMutationError(result.error));
                  return;
                }
                setMessageTone("success");
                setMessage(result.message ?? "Exception updated.");
                scheduleRefresh();
              });
            }}
          >
            {isPending ? "Saving..." : refreshQueued ? "Refreshing..." : "Reopen exception"}
          </button>
        </div>
      ) : null}

      {message ? (
        <p
          className={`text-[12px] md:col-span-3 ${messageTone === "success" ? "ui-alert-success" : "ui-alert-error"}`}
          role={messageTone === "success" ? "status" : "alert"}
          aria-live={messageTone === "success" ? "polite" : "assertive"}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
