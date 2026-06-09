"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bell, Check, Plus, UploadCloud, X, type LucideIcon } from "lucide-react";
import { PermissionEligibilityHint } from "@/components/ui/permission-eligibility-hint";
import { RowActionMenu, RowActionMenuItem } from "@/components/ui/row-action-menu";
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

  function closePanels() {
    setUploadOpen(false);
    setRejectOpen(false);
    setConfirm(null);
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
      closePanels();
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
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      {/* The contextual primary action and the overflow read as one coherent
          pill group on a single line. Secondary actions live in the shared
          portaled RowActionMenu (no clip-prone native <details>), and the
          upload / reject / confirm forms open in a portaled dialog rather than
          growing the table cell — so rows stay one line tall. */}
      <div className="inline-flex flex-nowrap items-center gap-1.5">
        {primaryAction ? (
          <PrimaryActionControl
            action={primaryAction}
            rowHref={row.href}
            disabled={isPending}
            onMutate={() => handleAction(primaryAction)}
            // Status-aware verb: the chosen action already reflects the row's
            // state (Upload while requested/overdue, Accept once received, …).
            label={primaryVerb(primaryAction)}
            icon={ICON_BY_KEY[primaryAction.key]}
          />
        ) : null}

        {menuActions.length > 0 ? (
          <RowActionMenu menuLabel="Evidence actions" triggerLabel="More evidence actions">
            {menuActions.map((action) => {
              const Icon = ICON_BY_KEY[action.key];
              const icon = Icon ? (
                <Icon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              ) : undefined;
              return action.kind === "mutation" ? (
                <RowActionMenuItem
                  key={action.key}
                  icon={icon}
                  destructive={action.key === "reject"}
                  onSelect={() => handleAction(action)}
                >
                  {action.label}
                </RowActionMenuItem>
              ) : (
                <RowActionMenuItem key={action.key} icon={icon} href={action.href ?? row.href}>
                  {action.label}
                </RowActionMenuItem>
              );
            })}
          </RowActionMenu>
        ) : null}
      </div>

      {message ? (
        <span className="text-[11.5px] text-[var(--text-secondary)]" role="status">
          {message}
        </span>
      ) : null}

      {uploadOpen ? (
        <ActionDialog title="Upload evidence" onClose={closePanels}>
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
        </ActionDialog>
      ) : null}

      {rejectOpen ? (
        <ActionDialog title="Reject evidence" onClose={closePanels}>
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
        </ActionDialog>
      ) : null}

      {confirm ? (
        <ActionDialog
          title={confirm === "accept" ? "Accept evidence" : "Send reminder"}
          onClose={closePanels}
        >
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
              onClick={closePanels}
            >
              Cancel
            </button>
          </div>
        </ActionDialog>
      ) : null}
    </div>
  );
}

/**
 * Portaled centered dialog for the evidence action forms. Renders to
 * `document.body` so the upload / reject / confirm forms escape the table cell
 * (they used to grow the row and break the table rhythm). Backdrop click and
 * Escape close it; the caller owns the open state.
 */
function ActionDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[color:color-mix(in_oklab,var(--text-primary)_28%,transparent)]"
      />
      <div className="relative z-10 w-full max-w-md space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-3)]">
        <div className="flex items-center justify-between gap-3">
          <p className="ui-caps-2 text-[var(--text-tertiary)]">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ui-chip-focus inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_70%,transparent)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" strokeWidth={1.85} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

// Short, action-accurate verbs + a reserved icon slot per action. The verb
// matches what the action actually does (Accept approves in place, Upload opens
// the submission form) — we don't promise a "Close" the API can't perform.
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

// The row's contextual primary action — a compact bordered icon+verb chip that
// stays transparent at rest and only washes in on hover/focus, so a column of
// repeated actions stays calm on the right edge without ever hiding the control.
function PrimaryActionControl({
  action,
  rowHref,
  disabled,
  onMutate,
  label,
  icon: Icon,
}: {
  action: EvidenceActionCapability;
  rowHref: string;
  disabled: boolean;
  onMutate: () => void;
  label?: string;
  icon?: LucideIcon;
}) {
  const className =
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border-subtle)] bg-transparent px-2.5 py-1 text-[11.5px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus-visible:border-[var(--border-strong)] focus-visible:bg-[var(--surface-raised)] focus-visible:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60";
  const text = label ?? action.label;
  const content = (
    <>
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden /> : null}
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
