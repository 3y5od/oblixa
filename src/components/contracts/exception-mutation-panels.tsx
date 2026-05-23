"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, RotateCcw, Save, ShieldCheck, UserRound } from "lucide-react";
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
    <div className="rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_28%,var(--surface-raised))] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
        Update issue
      </p>

      <div className="mt-3 space-y-5">
        {props.canAssign ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] sm:items-start">
              <div className="space-y-2">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  <UserRound className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                  Owner
                </p>
                {props.ownerOptions.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {props.ownerOptions.map((owner) => {
                      const selected = ownerId === owner.id;
                      return (
                        <button
                          key={owner.id}
                          type="button"
                          disabled={isPending || refreshQueued}
                          onClick={() => setOwnerId(owner.id)}
                          className={`inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-60 ${
                            selected
                              ? "border-[color:color-mix(in_oklab,var(--accent)_50%,var(--border-strong))] bg-[color:color-mix(in_oklab,var(--accent-soft)_32%,var(--surface-raised))] text-[var(--accent-strong)]"
                              : "border-[color:color-mix(in_oklab,var(--border-subtle)_92%,transparent)] bg-[color:color-mix(in_oklab,var(--surface)_88%,white)] text-[var(--text-secondary)] hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-subtle))] hover:text-[var(--text-primary)]"
                          }`}
                          aria-pressed={selected}
                        >
                          {owner.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12.5px] italic text-[var(--text-tertiary)]">
                    No assignable members yet — invite teammates from settings.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label
                  htmlFor={`exception-target-${props.exceptionId}`}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                >
                  <CalendarClock className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                  Target date
                </label>
                <div className="relative">
                  <span
                    className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]"
                    aria-hidden
                  >
                    <CalendarClock className="h-4 w-4" strokeWidth={1.85} />
                  </span>
                  <input aria-label="YYYY-MM-DD" id={`exception-target-${props.exceptionId}`}
                    type="text"
                    inputMode="numeric"
                    pattern="\d{4}-\d{2}-\d{2}"
                    placeholder="YYYY-MM-DD"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="ui-input pl-10 font-mono text-[12.5px]"
                    disabled={isPending || refreshQueued}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                disabled={isPending || refreshQueued}
                className="ui-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] disabled:opacity-60"
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
                <Save className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                {isPending ? "Saving..." : refreshQueued ? "Refreshing..." : "Save owner and date"}
              </button>
            </div>
          </div>
        ) : null}

        {props.canResolve ? (
          <div className="space-y-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-4">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                <ShieldCheck className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                Resolution
              </p>
              <div className="flex flex-wrap gap-1.5">
                {resolutionActionOptions.map((option) => {
                  const selected = resolutionAction === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={isPending || refreshQueued}
                      onClick={() => setResolutionAction(option.value)}
                      className={`inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-60 ${
                        selected
                          ? "border-[color:color-mix(in_oklab,var(--accent)_50%,var(--border-strong))] bg-[color:color-mix(in_oklab,var(--accent-soft)_32%,var(--surface-raised))] text-[var(--accent-strong)]"
                          : "border-[color:color-mix(in_oklab,var(--border-subtle)_92%,transparent)] bg-[color:color-mix(in_oklab,var(--surface)_88%,white)] text-[var(--text-secondary)] hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-subtle))] hover:text-[var(--text-primary)]"
                      }`}
                      aria-pressed={selected}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <label
                htmlFor={`exception-note-${props.exceptionId}`}
                className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
              >
                Note
              </label>
              <textarea
                id={`exception-note-${props.exceptionId}`}
                value={resolutionNote}
                onChange={(event) => setResolutionNote(event.target.value)}
                className="ui-input min-h-[4rem] text-[12.5px] leading-relaxed"
                placeholder="Resolution note"
                disabled={isPending || refreshQueued}
              />
              <p className="text-[11px] text-[var(--text-tertiary)]">
                The resolution note stays local until you save it.
              </p>
            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                disabled={isPending || refreshQueued}
                className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px] disabled:opacity-60"
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
                <ShieldCheck className="h-4 w-4" strokeWidth={1.85} aria-hidden />
                {isPending ? "Saving..." : refreshQueued ? "Refreshing..." : "Mark resolved"}
              </button>
            </div>
          </div>
        ) : null}

        {props.canReopen ? (
          <div className="flex items-center justify-end border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-4">
            <button
              type="button"
              disabled={isPending || refreshQueued}
              className="ui-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] disabled:opacity-60"
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
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              {isPending ? "Saving..." : refreshQueued ? "Refreshing..." : "Reopen exception"}
            </button>
          </div>
        ) : null}
      </div>

      {message ? (
        <p
          className={`mt-3 text-[12.5px] ${messageTone === "success" ? "ui-alert-success" : "ui-alert-error"}`}
          role={messageTone === "success" ? "status" : "alert"}
          aria-live={messageTone === "success" ? "polite" : "assertive"}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
