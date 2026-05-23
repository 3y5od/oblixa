"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { PermissionEligibilityHint } from "@/components/ui/permission-eligibility-hint";
import { mutateV10 } from "@/lib/v10-api-client";
import type { EvidenceActionCapability, EvidenceRow } from "@/lib/evidence/types";

export function EvidenceReleaseActions({
  row,
  mutationsEnabled,
}: {
  row: EvidenceRow;
  mutationsEnabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState("");
  const [fileTypes, setFileTypes] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  if (!mutationsEnabled) {
    return (
      <div className="max-w-[15rem] text-[11.5px]">
        <PermissionEligibilityHint
          variant="not_permitted"
          actionLabel="Workspace roles"
          actionHref="/settings"
        />
      </div>
    );
  }

  function runMutation(action: EvidenceActionCapability, payload?: Record<string, unknown>) {
    if (action.kind !== "mutation" || !action.mutation) return;
    setMessage(null);
    startTransition(async () => {
      const result = await mutateV10({
        url: urlForMutation(action),
        body: payload,
      });
      if (!result.ok) {
        setMessage(result.userMessage);
        return;
      }
      setMessage(result.response.user_visible_message);
      setUploadOpen(false);
      setRejectOpen(false);
      setNote("");
      setFileTypes("");
      setRejectReason("");
      router.refresh();
    });
  }

  const primaryAction = pickPrimaryAction(row.actions);

  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      {primaryAction ? (
        <ActionControl
          action={primaryAction}
          rowHref={row.href}
          disabled={isPending}
          onMutate={() => {
            if (primaryAction.mutation === "upload_evidence") {
              setUploadOpen((value) => !value);
              setRejectOpen(false);
              return;
            }
            if (primaryAction.mutation === "reject") {
              setRejectOpen((value) => !value);
              setUploadOpen(false);
              return;
            }
            runMutation(primaryAction);
          }}
          variant="primary"
        />
      ) : null}

      <details className="group relative min-w-0">
        <summary className="ui-btn-ghost inline-flex cursor-pointer list-none items-center gap-1 px-2.5 py-1 text-[11.5px] [&::-webkit-details-marker]:hidden">
          Actions
          <ChevronDown
            className="h-3 w-3 transition-transform group-open:rotate-180"
            strokeWidth={1.85}
            aria-hidden
          />
        </summary>
        <div className="absolute right-0 top-full z-20 mt-1.5 grid min-w-[12rem] gap-1 rounded-[0.625rem] border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[var(--surface-raised)] p-1.5 shadow-[var(--shadow-2)]">
          {row.actions.map((action) => (
            <ActionControl
              key={action.key}
              action={action}
              rowHref={row.href}
              disabled={isPending}
              onMutate={() => {
                if (action.mutation === "upload_evidence") {
                  setUploadOpen((value) => !value);
                  setRejectOpen(false);
                  return;
                }
                if (action.mutation === "reject") {
                  setRejectOpen((value) => !value);
                  setUploadOpen(false);
                  return;
                }
                runMutation(action);
              }}
              variant="menu"
            />
          ))}
        </div>
      </details>

      {uploadOpen ? (
        <div className="w-full min-w-[15rem] space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,transparent)] p-3">
          <label className="ui-label-caps" htmlFor={`evidence-upload-note-${row.id}`}>
            Submission note
          </label>
          <textarea
            id={`evidence-upload-note-${row.id}`}
            className="ui-input min-h-20 w-full text-[12.5px]"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Summarize the evidence being attached."
          />
          <label className="ui-label-caps" htmlFor={`evidence-upload-files-${row.id}`}>
            File types
          </label>
          <input
            id={`evidence-upload-files-${row.id}`}
            className="ui-input w-full text-[12.5px]"
            value={fileTypes}
            onChange={(event) => setFileTypes(event.target.value)}
            placeholder="pdf, docx"
          />
          <button
            type="button"
            className="ui-btn-primary px-3 py-1.5 text-[12.5px] disabled:opacity-60"
            disabled={isPending}
            onClick={() =>
              runMutation(
                row.actions.find((action) => action.mutation === "upload_evidence") ?? row.actions[0]!,
                {
                  requirementId: row.requirementId,
                  payload: {
                    note: note.trim() || undefined,
                    fileTypes: splitTokens(fileTypes),
                  },
                }
              )
            }
          >
            Upload evidence
          </button>
        </div>
      ) : null}

      {rejectOpen ? (
        <div className="w-full min-w-[15rem] space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,transparent)] p-3">
          <label className="ui-label-caps" htmlFor={`evidence-reject-note-${row.id}`}>
            Rejection reason
          </label>
          <textarea
            id={`evidence-reject-note-${row.id}`}
            className="ui-input min-h-20 w-full text-[12.5px]"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Explain what needs correction."
          />
          <button
            type="button"
            className="ui-btn-secondary px-3 py-1.5 text-[12.5px] disabled:opacity-60"
            disabled={isPending}
            onClick={() => {
              const action = row.actions.find((item) => item.mutation === "reject");
              if (action) runMutation(action, { reason: rejectReason.trim() || undefined });
            }}
          >
            Reject
          </button>
        </div>
      ) : null}

      {message ? (
        <span className="basis-full text-[11.5px] text-[var(--text-secondary)]" role="status">
          {message}
        </span>
      ) : null}
    </div>
  );
}

function pickPrimaryAction(actions: EvidenceActionCapability[]) {
  return (
    actions.find((action) => action.key === "accept" && action.kind === "mutation") ??
    actions.find((action) => action.key === "upload_evidence" && action.kind === "mutation") ??
    actions.find((action) => action.key === "send_reminder" && action.kind === "mutation") ??
    actions.find((action) => action.key === "request_evidence") ??
    actions[0] ??
    null
  );
}

function urlForMutation(action: EvidenceActionCapability) {
  if (action.mutation === "accept") return `/api/evidence/${action.submissionId}/approve`;
  if (action.mutation === "reject") return `/api/evidence/${action.submissionId}/reject`;
  if (action.mutation === "send_reminder") return `/api/evidence/requests/${action.requirementId}/remind`;
  return "/api/evidence/submit";
}

function splitTokens(value: string) {
  return value
    .split(/[,\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function ActionControl({
  action,
  rowHref,
  disabled,
  onMutate,
  variant,
}: {
  action: EvidenceActionCapability;
  rowHref: string;
  disabled: boolean;
  onMutate: () => void;
  variant: "primary" | "menu";
}) {
  const className =
    variant === "primary"
      ? "ui-btn-secondary px-3 py-1.5 text-[11.5px] disabled:opacity-60"
      : "rounded-[0.45rem] px-2.5 py-1.5 text-left text-[11.5px] font-medium text-[var(--text-secondary)] transition hover:bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] hover:text-[var(--text-primary)] disabled:opacity-60";

  if (action.kind === "mutation") {
    return (
      <button type="button" className={className} disabled={disabled} onClick={onMutate}>
        {action.label}
      </button>
    );
  }

  return (
    <Link href={action.href ?? rowHref} className={className}>
      {action.label}
    </Link>
  );
}
