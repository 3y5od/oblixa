"use client";

import { useState, useTransition } from "react";
import { inviteOrgMember } from "@/actions/settings";

interface InviteMemberFormProps {
  organizationId: string;
}

export function InviteMemberForm({ organizationId }: InviteMemberFormProps) {
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4">
      <h3 className="text-sm font-semibold text-zinc-900">Invite teammate</h3>
      <p className="mt-1 text-xs text-zinc-600">
        Sends a secure email invite. They join this workspace after signing up or signing in
        with the same email. Invites expire after seven days.
      </p>
      <form
        className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(null);
          const fd = new FormData(e.currentTarget);
          fd.set("organizationId", organizationId);
          startTransition(async () => {
            const result = await inviteOrgMember(fd);
            if (result && "error" in result && result.error) {
              setMessage({ type: "err", text: result.error });
              return;
            }
            setMessage({ type: "ok", text: "Invitation sent." });
            (e.target as HTMLFormElement).reset();
          });
        }}
      >
        <div className="flex-1">
          <label htmlFor="invite-email" className="sr-only">
            Email
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="colleague@company.com"
            className="ui-input"
          />
        </div>
        <div>
          <label htmlFor="invite-role" className="sr-only">
            Role
          </label>
          <select
            id="invite-role"
            name="role"
            defaultValue="editor"
            className="ui-input sm:w-36"
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="ui-btn-primary disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Send invite"}
        </button>
      </form>
      {message && (
        <p
          className={`mt-2 text-xs ${message.type === "ok" ? "text-green-700" : "text-red-600"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
