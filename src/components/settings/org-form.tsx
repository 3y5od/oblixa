"use client";

import { useActionState, useState } from "react";
import { Building2 } from "lucide-react";
import { updateOrganization } from "@/actions/settings";
import { SaveFooter } from "./editor-save-footer";

interface OrgFormProps {
  organizationId: string;
  name: string;
  isAdmin: boolean;
}

const READ_ONLY_TAG = "ui-caps-3 text-[10px] text-[var(--text-tertiary)]";

function FieldIcon() {
  return (
    <span
      className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]"
      aria-hidden
    >
      <Building2 className="h-3.5 w-3.5" strokeWidth={1.85} />
    </span>
  );
}

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
    // §7.2 read-only field — structured label/value with the same leading icon
    // as the editable control, not a sentence between label and input (§11.15).
    return (
      <div className="min-w-0">
        <label className="ui-label flex items-baseline gap-2">
          Workspace name
          <span className={READ_ONLY_TAG}>Read-only</span>
        </label>
        <div className="relative">
          <FieldIcon />
          <div className="ui-input flex min-h-11 w-full min-w-0 cursor-default items-center border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] pl-9 text-[var(--text-tertiary)]">
            <span className="truncate">{name}</span>
          </div>
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

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="min-w-0">
        <label htmlFor="orgName" className="ui-label">
          Workspace name
        </label>
        <div className="relative">
          <FieldIcon />
          <input
            id="orgName"
            name="name"
            type="text"
            value={draftName}
            required
            maxLength={80}
            className="ui-input w-full min-w-0 pl-9"
            aria-invalid={state?.error ? true : undefined}
            aria-describedby={state?.error ? errId : undefined}
            onChange={(event) => setDraftName(event.currentTarget.value)}
          />
        </div>
      </div>
      <SaveFooter
        isDirty={isDirty}
        isEmpty={isEmpty}
        pending={pending}
        error={state?.error}
        success={state?.success}
        errId={errId}
        onDiscard={() => setDraftName(name)}
        saveLabel="Save name"
        emptyLabel="Name required"
      />
    </form>
  );
}
