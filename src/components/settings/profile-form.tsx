"use client";

import { useActionState } from "react";
import { updateProfile } from "@/actions/settings";

interface ProfileFormProps {
  fullName: string | null;
  email: string;
}

export function ProfileForm({ fullName, email }: ProfileFormProps) {
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | undefined, formData: FormData) => {
      return updateProfile(formData);
    },
    undefined
  );

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <div className="rounded-lg border border-red-200/70 bg-red-50/80 p-3 text-sm text-red-800">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/80 p-3 text-sm text-emerald-900">
          Profile updated.
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-zinc-700">
            Full name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            defaultValue={fullName || ""}
            className="ui-input mt-1"
          />
        </div>
        <div>
          <label htmlFor="profile-email-readonly" className="block text-sm font-medium text-zinc-700">
            Email
          </label>
          <input
            id="profile-email-readonly"
            type="email"
            readOnly
            value={email}
            autoComplete="email"
            aria-readonly="true"
            className="ui-input mt-1 cursor-default border-zinc-200 bg-zinc-50 text-zinc-500"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="ui-btn-primary disabled:opacity-50"
          aria-busy={pending}
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
