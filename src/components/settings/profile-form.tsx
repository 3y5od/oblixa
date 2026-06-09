"use client";

import { useActionState, useState } from "react";
import { Mail, UserRound } from "lucide-react";
import { updateProfile } from "@/actions/settings";
import { SaveFooter } from "./editor-save-footer";

interface ProfileFormProps {
  fullName: string | null;
  email: string;
}

const READ_ONLY_TAG = "ui-caps-3 text-[10px] text-[var(--text-tertiary)]";

export function ProfileForm({ fullName, email }: ProfileFormProps) {
  const initialName = fullName || "";
  const [draftName, setDraftName] = useState(initialName);
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | undefined, formData: FormData) => {
      return updateProfile(formData);
    },
    undefined
  );

  const errId = "profile-form-error";
  const isDirty = draftName.trim() !== initialName.trim();

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="fullName" className="ui-label">
            Full name
          </label>
          <div className="relative">
            <span
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]"
              aria-hidden
            >
              <UserRound className="h-3.5 w-3.5" strokeWidth={1.85} />
            </span>
            <input
              id="fullName"
              name="fullName"
              type="text"
              value={draftName}
              maxLength={120}
              onChange={(event) => setDraftName(event.currentTarget.value)}
              placeholder="Add your name"
              className="ui-input w-full min-w-0 pl-9"
              aria-invalid={state?.error ? true : undefined}
              aria-describedby={state?.error ? errId : undefined}
            />
          </div>
        </div>
        <div className="min-w-0">
          {/* §7.2 read-only field — rendered as a value row (not an <input>) so a
              long mono email truncates with the full value in `title`, not a
              horizontally-scrolling text field. Mail icon matches the member ledger. */}
          <label htmlFor="profile-email-readonly" className="ui-label flex items-baseline gap-2">
            Email
            <span className={READ_ONLY_TAG}>Read-only</span>
          </label>
          <div className="relative">
            <span
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]"
              aria-hidden
            >
              <Mail className="h-3.5 w-3.5" strokeWidth={1.85} />
            </span>
            <div
              id="profile-email-readonly"
              title={email}
              aria-readonly="true"
              className="ui-input flex min-h-11 w-full min-w-0 cursor-default items-center border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] pl-9 font-mono text-[12.5px] text-[var(--text-tertiary)]"
            >
              <span className="truncate">{email}</span>
            </div>
          </div>
        </div>
      </div>
      <SaveFooter
        isDirty={isDirty}
        pending={pending}
        error={state?.error}
        success={state?.success}
        errId={errId}
        onDiscard={() => setDraftName(initialName)}
        saveLabel="Save changes"
      />
    </form>
  );
}
