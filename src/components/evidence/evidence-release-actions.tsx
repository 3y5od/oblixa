"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell, Check, MoreHorizontal, Plus, UploadCloud, X, type LucideIcon } from "lucide-react";
import { PermissionEligibilityHint } from "@/components/ui/permission-eligibility-hint";
import { mutateV10 } from "@/lib/api-client";
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
  // Reminders and accept/close are consequential, so they confirm inline before
  // firing instead of mutating on the first click.
  const [confirm, setConfirm] = useState<null | "accept" | "send_reminder">(null);

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
      setConfirm(null);
      setNote("");
      setFileTypes("");
      setRejectReason("");
      router.refresh();
    });
  }

  const primaryAction = pickPrimaryAction(row.actions, row.status);
  // The overflow lists the remaining evidence verbs (Accept / Reject / Send
  // reminder / Request evidence) without repeating the contextual primary —
  // so #13's "required actions" are named, not hidden behind a generic label.
  const menuActions = primaryAction
    ? row.actions.filter((action) => action.key !== primaryAction.key)
    : row.actions;

  function handleAction(action: EvidenceActionCapability) {
    if (action.mutation === "upload_evidence") {
      setUploadOpen((value) => !value);
      setRejectOpen(false);
      setConfirm(null);
      return;
    }
    if (action.mutation === "reject") {
      setRejectOpen((value) => !value);
      setUploadOpen(false);
      setConfirm(null);
      return;
    }
    if (action.mutation === "accept" || action.mutation === "send_reminder") {
      // Toggle an inline confirm step before the consequential mutation fires.
      // Capture the narrowed value so it stays typed inside the setState closure.
      const pending = action.mutation;
      setConfirm((value) => (value === pending ? null : pending));
      setUploadOpen(false);
      setRejectOpen(false);
      return;
    }
    runMutation(action);
  }

  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      {/* The contextual primary action and the overflow read as one coherent
          pill group on a single line — never stacked, so rows stay compact. */}
      <div className="inline-flex flex-nowrap items-center gap-1.5">
        {primaryAction ? (
          <ActionControl
            action={primaryAction}
            rowHref={row.href}
            disabled={isPending}
            onMutate={() => handleAction(primaryAction)}
            variant="primary"
            // Status-aware verb: the chosen action already reflects the row's
            // state (Upload while requested/overdue, Accept once received, …),
            // so the primary button surfaces a short, accurate verb.
            label={primaryVerb(primaryAction)}
            icon={ICON_BY_KEY[primaryAction.key]}
          />
        ) : null}

        {menuActions.length > 0 ? (
          <details className="group relative min-w-0">
            {/* Compact icon trigger instead of a vague "More" word — native
                <summary> keeps Enter/Space keyboard semantics; the accessible
                name comes from aria-label. */}
            <summary
              aria-label="More actions"
              title="More actions"
              className="ui-btn-ghost inline-flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full p-0 [&::-webkit-details-marker]:hidden"
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={1.85} aria-hidden />
            </summary>
            <div className="absolute right-0 top-full z-20 mt-1.5 grid min-w-[12rem] gap-1 rounded-[0.625rem] border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[var(--surface-raised)] p-1.5 shadow-[var(--shadow-2)]">
              {menuActions.map((action) => (
                <ActionControl
                  key={action.key}
                  action={action}
                  rowHref={row.href}
                  disabled={isPending}
                  onMutate={() => handleAction(action)}
                  variant="menu"
                  icon={ICON_BY_KEY[action.key]}
                  destructive={action.key === "reject"}
                />
              ))}
            </div>
          </details>
        ) : null}
      </div>

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
            {isPending ? "Uploading…" : "Upload evidence"}
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
            {isPending ? "Rejecting…" : "Reject"}
          </button>
        </div>
      ) : null}

      {confirm ? (
        <div className="w-full min-w-[15rem] space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,transparent)] p-3">
          <p className="text-[12.5px] text-[var(--text-secondary)]">
            {confirm === "accept"
              ? "Accept this evidence and close the request?"
              : "Send a reminder to the responder?"}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="ui-btn-primary px-3 py-1.5 text-[12.5px] disabled:opacity-60"
              disabled={isPending}
              onClick={() => {
                const action = row.actions.find(
                  (item) => item.kind === "mutation" && item.mutation === confirm
                );
                if (action) runMutation(action);
              }}
            >
              {isPending ? "Working…" : confirm === "accept" ? "Accept evidence" : "Send reminder"}
            </button>
            <button
              type="button"
              className="ui-btn-ghost px-3 py-1.5 text-[12.5px]"
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
          </div>
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

// Short, action-accurate verbs for the contextual primary control. The verb
// matches what the action actually does (Accept approves in place, Upload opens
// the submission panel) — we don't promise a "Close" the API can't perform.
// Reserved icon slot per action so menu rows align and read at a glance.
const ICON_BY_KEY: Record<string, LucideIcon> = {
  upload_evidence: UploadCloud,
  send_reminder: Bell,
  request_evidence: Plus,
  accept: Check,
  reject: X,
};

const PRIMARY_VERB_BY_KEY: Record<string, string> = {
  upload_evidence: "Upload file",
  accept: "Accept",
  reject: "Reject",
  send_reminder: "Remind",
  request_evidence: "Request",
};

function primaryVerb(action: EvidenceActionCapability): string {
  return PRIMARY_VERB_BY_KEY[action.key] ?? action.label;
}

// The contextual primary maps to the row's state: upload while a request is
// open, remind once it's overdue, accept once evidence has arrived. Accepted
// rows are done, so they expose no primary — everything lives in the menu.
function pickPrimaryAction(
  actions: EvidenceActionCapability[],
  status: EvidenceRow["status"]
) {
  const mutation = (key: NonNullable<EvidenceActionCapability["mutation"]>) =>
    actions.find((action) => action.kind === "mutation" && action.mutation === key) ?? null;
  if (status === "received") return mutation("accept");
  if (status === "overdue") return mutation("send_reminder") ?? mutation("upload_evidence");
  if (status === "requested" || status === "rejected")
    return mutation("upload_evidence") ?? mutation("send_reminder");
  return null;
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
  label,
  icon: Icon,
  destructive = false,
}: {
  action: EvidenceActionCapability;
  rowHref: string;
  disabled: boolean;
  onMutate: () => void;
  variant: "primary" | "menu";
  /** Optional display override (the primary control shows a short verb). */
  label?: string;
  icon?: LucideIcon;
  destructive?: boolean;
}) {
  // Always a legible affordance: a compact bordered icon+verb chip so the row's
  // next action is unmistakable at rest. The fill stays transparent at idle and
  // only washes in on hover/focus — that keeps a column of repeated actions calm
  // on the right edge without ever hiding the control (the icon + verb + outline
  // read as a button even before the pointer arrives).
  const primaryClass =
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border-subtle)] bg-transparent px-2.5 py-1 text-[11.5px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus-visible:border-[var(--border-strong)] focus-visible:bg-[var(--surface-raised)] focus-visible:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60";
  const menuClass = `flex w-full items-center gap-2 rounded-[0.45rem] px-2.5 py-1.5 text-left text-[11.5px] font-medium transition disabled:opacity-60 ${
    destructive
      ? "text-[var(--danger-ink)] hover:bg-[color:color-mix(in_oklab,var(--danger-ink)_12%,transparent)]"
      : "text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] hover:text-[var(--text-primary)]"
  }`;
  const className = variant === "primary" ? primaryClass : menuClass;
  const text = label ?? action.label;
  // Primary shows its status-aware icon when one is supplied; the menu variant
  // reserves a fixed icon slot even when empty so its rows stay left-aligned.
  const content = (
    <>
      {Icon ? (
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden />
      ) : variant === "menu" ? (
        <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : null}
      <span>{text}</span>
    </>
  );

  if (action.kind === "mutation") {
    return (
      <button type="button" className={className} disabled={disabled} onClick={onMutate}>
        {content}
      </button>
    );
  }

  return (
    <Link href={action.href ?? rowHref} className={className}>
      {content}
    </Link>
  );
}
