"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { seedRenewalPlaybook } from "@/actions/renewal-playbook";
import { createCheckpointClarificationTask } from "@/actions/tasks";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";

type Props = {
  contractId: string;
  /** When null, show seed checklist only */
  pendingCheckpointId: string | null;
  checkpointTotal: number;
  playbookRecommendation: string;
  checkpointCompleted: number;
};

export function RenewalRowChecklistActions(props: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [refreshQueued, setRefreshQueued] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error">("success");
  const [clarificationNote, setClarificationNote] = useState("");
  const refreshTimeoutRef = useRef<number | null>(null);

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

  function runSeed() {
    setMessage(null);
    startTransition(async () => {
      const res = await seedRenewalPlaybook(props.contractId);
      if ("error" in res && res.error) {
        setTone("error");
        setMessage(describeRecoverableMutationError(res.error));
        return;
      }
      setTone("success");
      setMessage("Checklist seeded. Work items may appear for pending checkpoints.");
      scheduleRefresh();
    });
  }

  function runClarification() {
    const checkpointId = props.pendingCheckpointId;
    if (!checkpointId) return;
    setMessage(null);
    startTransition(async () => {
      const res = await createCheckpointClarificationTask({
        contractId: props.contractId,
        checkpointId,
        requesterNote: clarificationNote,
      });
      if ("error" in res && res.error) {
        setTone("error");
        setMessage(describeRecoverableMutationError(res.error));
        return;
      }
      setClarificationNote("");
      setTone("success");
      setMessage(
        "Clarification task created and linked to this checkpoint. Assign it from Work if needed."
      );
      scheduleRefresh();
    });
  }

  const busy = isPending || refreshQueued;

  if (props.checkpointTotal > 0) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="ui-metric-chip">
            <span className="ui-metric-label">Progress</span>
            <span className="font-semibold tabular-nums text-[var(--text-primary)]">
              {props.checkpointCompleted}/{props.checkpointTotal}
            </span>
          </span>
          <span className="text-xs font-medium text-[var(--text-secondary)]">complete</span>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">{props.playbookRecommendation}</p>
        {props.pendingCheckpointId ? (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_42%,transparent)] p-3">
            <label className="sr-only" htmlFor={`clarify-${props.contractId}`}>
              Clarification request for renewal checkpoint
            </label>
            <textarea
              id={`clarify-${props.contractId}`}
              value={clarificationNote}
              onChange={(e) => setClarificationNote(e.target.value)}
              placeholder="Clarification request"
              rows={2}
              disabled={busy}
              className="ui-input min-h-[64px] w-full resize-y text-xs"
            />
            <button
              type="button"
              disabled={busy || !clarificationNote.trim()}
              onClick={runClarification}
              className="ui-btn-secondary mt-2 px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {busy ? "Working…" : "Create clarification task"}
            </button>
          </div>
        ) : (
          <p className="rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_48%,transparent)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
            No pending checkpoint
          </p>
        )}
        {message ? (
          <p
            className={
              tone === "error"
                ? "rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
                : "rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
            }
            role={tone === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-secondary)]">
        No renewal checklist has been seeded for this contract yet.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={runSeed}
        className="ui-btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
      >
        {busy ? "Seeding…" : "Seed checklist"}
      </button>
      {message ? (
        <p
          className={
            tone === "error"
              ? "rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
              : "rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
          }
          role={tone === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
