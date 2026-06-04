"use client";

import { useActionState, useState } from "react";
import { updateOrganization } from "@/actions/settings";

interface OrgFormProps {
  organizationId: string;
  name: string;
  isAdmin: boolean;
}

const READ_ONLY_TAG = "ui-caps-3 text-[10px] text-[var(--text-tertiary)]";

export function OrgForm({ organizationId, name, isAdmin }: OrgFormProps) {
  const [draftName, setDraftName] = useState(name);
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | undefined, formData: FormData) => {
      formData.set("organizationId", organizationId);
      return updateOrganization(formData);
    },
    undefined
  );

  if (!isAdmin) {
    // §7.2 read-only field — structured label/value, not a sentence between
    // label and input (§11.15). The READ-ONLY tag + muted field carry intent.
    return (
      <div className="min-w-0">
        <label className="ui-label flex items-baseline gap-2">
          Workspace name
          <span className={READ_ONLY_TAG}>Read-only</span>
        </label>
        <div className="ui-input flex min-h-11 w-full min-w-0 cursor-default items-center border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] text-[var(--text-tertiary)]">
          <span className="truncate">{name}</span>
        </div>
        <p className="mt-1.5 ui-caps-3 text-[10px] text-[var(--text-tertiary)]">
          Only admins can rename this workspace.
        </p>
      </div>
    );
  }

  const errId = "org-form-error";
  const trimmed = draftName.trim();
  const isDirty = trimmed !== name.trim();
  const isEmpty = trimmed.length === 0;
  const canSave = isDirty && !isEmpty && !pending;

  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error ? (
        <div id={errId} role="alert" className="ui-alert-error text-sm">
          {state.error}
        </div>
      ) : null}
      {state?.success ? (
        <div className="ui-alert-success text-sm">Organization updated.</div>
      ) : null}
      <div className="min-w-0">
        <label htmlFor="orgName" className="ui-label">
          Workspace name
        </label>
        <input
          id="orgName"
          name="name"
          type="text"
          defaultValue={name}
          required
          maxLength={80}
          className="ui-input w-full min-w-0"
          aria-invalid={state?.error ? true : undefined}
          aria-describedby={state?.error ? errId : undefined}
          onChange={(event) => setDraftName(event.currentTarget.value)}
        />
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] pt-4">
        {isDirty ? (
          <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">
            {isEmpty ? "Name required" : "Unsaved changes"}
          </span>
        ) : null}
        <button
          type="submit"
          disabled={!canSave}
          aria-disabled={!canSave}
          className={
            isDirty
              ? "ui-btn-primary disabled:pointer-events-none disabled:opacity-60"
              : "ui-btn-secondary disabled:pointer-events-none disabled:opacity-55"
          }
          aria-busy={pending}
        >
          {pending ? "Saving…" : "Save name"}
        </button>
      </div>
    </form>
  );
}
