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
        <label className="block text-sm font-medium text-gray-700">Organization name</label>
        <p className="mt-1 text-sm text-gray-900">{name}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</div>
      )}
      {state?.success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">Organization updated.</div>
      )}
      <div>
        <label htmlFor="orgName" className="block text-sm font-medium text-gray-700">
          Organization name
        </label>
        <input
          id="orgName"
          name="name"
          type="text"
          defaultValue={name}
          required
          className="mt-1 block w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
