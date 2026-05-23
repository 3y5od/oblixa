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

  const errId = "profile-form-error";

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state?.error ? (
        <div id={errId} role="alert" className="ui-alert-error text-sm">
          {state.error}
        </div>
      ) : null}
      {state?.success ? (
        <div className="ui-alert-success text-sm">Profile updated.</div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="fullName" className="ui-label">
            Full name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            defaultValue={fullName || ""}
            className="ui-input w-full min-w-0"
            aria-invalid={state?.error ? true : undefined}
            aria-describedby={state?.error ? errId : undefined}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="profile-email-readonly" className="ui-label flex items-baseline gap-2">
            Email
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              Read-only
            </span>
          </label>
          <input
            id="profile-email-readonly"
            type="email"
            readOnly
            value={email}
            autoComplete="email"
            aria-readonly="true"
            className="ui-input w-full min-w-0 cursor-default border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] font-mono text-[12.5px] text-[var(--text-tertiary)]"
          />
        </div>
      </div>
      <div className="flex justify-end border-t border-[var(--border-subtle)] pt-3">
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
