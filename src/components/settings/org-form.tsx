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
      <div>
        <label className="block text-sm font-medium text-zinc-700">Organization name</label>
        <p className="mt-1 text-sm text-zinc-900">{name}</p>
      </div>
    );
  }

  const errId = "org-form-error";

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <div id={errId} role="alert" className="rounded-lg border border-red-200/70 bg-red-50/80 p-3 text-sm text-red-800">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/80 p-3 text-sm text-emerald-900">
          Organization updated.
        </div>
      )}
      <div>
        <label htmlFor="orgName" className="block text-sm font-medium text-zinc-700">
          Organization name
        </label>
        <input
          id="orgName"
          name="name"
          type="text"
          defaultValue={name}
          required
          className="ui-input mt-1 max-w-sm"
          aria-invalid={state?.error ? true : undefined}
          aria-describedby={state?.error ? errId : undefined}
        />
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="ui-btn-primary disabled:opacity-50"
          aria-busy={pending}
        >
          {pending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
