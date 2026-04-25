"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";

type EvidenceSubmissionState =
  | {
      error?: string;
      success?: string;
    }
  | undefined;

function evidenceSubmissionAction() {
  return async (_prevState: EvidenceSubmissionState, formData: FormData): Promise<EvidenceSubmissionState> => {
    const mod = await import("@/actions/v4");
    return mod.submitEvidenceNoteAction(formData);
  };
}

export function EvidenceSubmissionForm({
  requirementId,
  status,
}: {
  requirementId: string;
  status: "required" | "rejected";
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [state, action, pending] = useActionState(evidenceSubmissionAction(), undefined);
  const isDirty = note.trim().length > 0;

  const label = status === "rejected" ? "Resubmission" : "Submission";
  const buttonLabel = status === "rejected" ? "Resubmit evidence" : "Submit evidence";
  const pendingLabel = status === "rejected" ? "Resubmitting..." : "Submitting...";
  const successTone = useMemo(() => (state?.success ? "text-emerald-700" : ""), [state]);
  const errorMessage = useMemo(
    () => (state?.error ? describeRecoverableMutationError(state.error) : null),
    [state]
  );

  useEffect(() => {
    if (!state?.success) return;
    // Defer to avoid synchronous setState in effect (react-hooks/set-state-in-effect).
    const id = window.setTimeout(() => {
      setNote("");
      router.refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [router, state?.success]);

  useEffect(() => {
    if (!isDirty || pending) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, pending]);

  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="requirementId" value={requirementId} />
      <div className="min-w-0 flex-1">
        <label htmlFor={`evidence-note-${requirementId}`} className="ui-label-caps">
          {label}
        </label>
        <textarea
          id={`evidence-note-${requirementId}`}
          name="note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What you are providing, where it lives, and any completion summary"
          className="ui-input min-w-[12rem] w-full text-xs"
          required
        />
      </div>
      <button type="submit" disabled={pending} className="ui-btn-secondary px-3 py-1.5 text-xs disabled:opacity-60">
        {pending ? pendingLabel : buttonLabel}
      </button>
      {isDirty && !pending ? (
        <p className="basis-full text-[12px] text-[var(--text-tertiary)]" role="status" aria-live="polite">
          Leaving this page now will discard the draft note.
        </p>
      ) : null}
      {errorMessage ? (
        <p className="basis-full text-[12px] text-rose-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {state?.success ? (
        <p className={`basis-full text-[12px] ${successTone}`} role="status" aria-live="polite">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
