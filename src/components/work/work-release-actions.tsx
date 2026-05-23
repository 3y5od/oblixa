"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { completeWorkItem } from "@/actions/tasks";
import { updateContractObligation } from "@/actions/obligations";
import { PermissionEligibilityHint } from "@/components/ui/permission-eligibility-hint";
import type { WorkActionCapability, WorkItemRow } from "@/lib/work/types";

export function WorkReleaseActions({
  row,
  mutationsEnabled,
}: {
  row: WorkItemRow;
  mutationsEnabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

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

  function runMutation(action: WorkActionCapability) {
    if (action.kind !== "mutation") return;
    setMessage(null);
    startTransition(async () => {
      const result =
        action.mutation === "complete_task"
          ? await completeWorkItem({ taskId: row.sourceId, idempotencyKey: null })
          : await updateContractObligation({ obligationId: row.sourceId, status: "done" });
      if ("error" in result && result.error) {
        setMessage(result.error);
        return;
      }
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
          onMutate={runMutation}
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
        <div className="absolute right-0 top-full z-20 mt-1.5 grid min-w-[11rem] gap-1 rounded-[0.625rem] border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[var(--surface-raised)] p-1.5 shadow-[var(--shadow-2)]">
          {row.actions.map((action) => (
            <ActionControl
              key={action.key}
              action={action}
              rowHref={row.href}
              disabled={isPending}
              onMutate={runMutation}
              variant="menu"
            />
          ))}
        </div>
      </details>
      {message ? (
        <span className="basis-full text-[11.5px] text-[var(--danger-ink)]" role="status">
          {message}
        </span>
      ) : null}
    </div>
  );
}

function pickPrimaryAction(actions: WorkActionCapability[]) {
  return (
    actions.find((action) => action.key === "complete" && action.kind === "mutation") ??
    actions.find((action) => action.key === "complete") ??
    actions[0] ??
    null
  );
}

function ActionControl({
  action,
  rowHref,
  disabled,
  onMutate,
  variant,
}: {
  action: WorkActionCapability;
  rowHref: string;
  disabled: boolean;
  onMutate: (action: WorkActionCapability) => void;
  variant: "primary" | "menu";
}) {
  const className =
    variant === "primary"
      ? "ui-btn-secondary px-3 py-1.5 text-[11.5px] disabled:opacity-60"
      : "rounded-[0.45rem] px-2.5 py-1.5 text-left text-[11.5px] font-medium text-[var(--text-secondary)] transition hover:bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] hover:text-[var(--text-primary)] disabled:opacity-60";

  if (action.kind === "mutation") {
    return (
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => onMutate(action)}
      >
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
