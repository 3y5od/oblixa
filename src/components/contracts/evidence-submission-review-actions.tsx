"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mutateV10 } from "@/lib/api-client";

// mutateV10 centralizes interpretHttpMutationFailure for HTTP, rate-limit, and network copy.
export function EvidenceSubmissionReviewActions({
  submissionId,
}: {
  submissionId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [messageRole, setMessageRole] = useState<"status" | "alert">("status");

  function runReviewAction(action: "approve" | "reject", reason?: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await mutateV10({
        url: `/api/evidence/${submissionId}/${action}`,
        body: action === "reject" ? { reason: reason?.trim() || undefined } : undefined,
      });
      if (!result.ok) {
        setMessageTone("error");
        setMessageRole(result.status === 429 ? "status" : "alert");
        setMessage(result.userMessage);
        return;
      }
      setMessageTone("success");
      setMessageRole("status");
      setMessage(result.response.user_visible_message || (action === "approve" ? "Evidence approved." : "Evidence rejected with feedback."));
      setShowReject(false);
      setRejectReason("");
      router.refresh();
    });
  }

  return (
    <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))]/70 px-3 py-3">
      <p className="ui-label-caps">Reviewer decision</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
        Approve when the submission is sufficient, or reject with a short correction note so the provider knows what to fix.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          className="ui-btn-primary px-3 py-1.5 text-xs disabled:opacity-60"
          onClick={() => runReviewAction("approve")}
        >
          {isPending ? "Saving..." : "Approve evidence"}
        </button>
        <button
          type="button"
          disabled={isPending}
          className="ui-btn-secondary px-3 py-1.5 text-xs disabled:opacity-60"
          onClick={() => setShowReject((value) => !value)}
        >
          {showReject ? "Hide rejection note" : "Reject evidence"}
        </button>
      </div>
      {showReject ? (
        <div className="mt-3 space-y-2">
          <label htmlFor={`reject-evidence-${submissionId}`} className="ui-label-caps">
            Correction needed
          </label>
          <textarea
            id={`reject-evidence-${submissionId}`}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            rows={3}
            placeholder="Explain what is missing or what should be corrected."
            className="ui-input w-full text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              className="ui-btn-secondary px-3 py-1.5 text-xs disabled:opacity-60"
              onClick={() => runReviewAction("reject", rejectReason)}
            >
              {isPending ? "Saving..." : "Confirm rejection"}
            </button>
          </div>
        </div>
      ) : null}
      {message ? (
        <p
          className={`mt-2 text-[12.5px] ${messageTone === "success" ? "ui-alert-success" : "ui-alert-error"}`}
          role={messageRole}
          aria-live={messageRole === "status" ? "polite" : "assertive"}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
