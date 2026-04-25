"use client";

import { useActionState } from "react";
import { updateOrganization } from "@/actions/settings";

interface OrgFormProps {
  organizationId: string;
  name: string;
  isAdmin: boolean;
}

export function OrgForm({ organizationId, name, isAdmin }: OrgFormProps) {
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | undefined, formData: FormData) => {
      formData.set("organizationId", organizationId);
      return updateOrganization(formData);
    },
    undefined
  );

  if (!isAdmin) {
    return (
      <div className="min-w-0">
        <label className="ui-label mb-0">Organization name</label>
        <p className="ui-support-copy mb-2 mt-1 text-xs">This workspace-wide label is managed by admins.</p>
        <p className="mt-1 w-full text-sm text-[var(--text-primary)]">{name}</p>
      </div>
    );
  }

  const errId = "org-form-error";

  return (
    <form action={action} className="flex flex-col gap-6">
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
          Organization name
        </label>
        <p className="ui-support-copy mb-2 mt-1 text-xs">Appears across navigation, invites, exports, and billing context.</p>
        <input
          id="orgName"
          name="name"
          type="text"
          defaultValue={name}
          required
          className="ui-input mt-1 w-full min-w-0"
          aria-invalid={state?.error ? true : undefined}
          aria-describedby={state?.error ? errId : undefined}
        />
      </div>
      <div className="flex justify-end border-t border-[var(--border-subtle)] pt-4">
        <button
          type="submit"
          disabled={pending}
          className="ui-btn-primary disabled:pointer-events-none disabled:opacity-45"
          aria-busy={pending}
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
