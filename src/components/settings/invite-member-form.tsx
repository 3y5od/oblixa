"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { inviteOrgMember } from "@/actions/settings";
import { UiSelect } from "@/components/ui/ui-select";

interface InviteMemberFormProps {
  organizationId: string;
}

// Canonical release roles (§19/§24). The stored value `editor` maps to the
// presentation label "Member" — the DB/role model keeps `editor` for
// compatibility while the UI never shows the internal term.
const ROLES = [
  { value: "editor", label: "Member", description: "Confirm details, manage tasks and evidence, edit operational data." },
  { value: "admin", label: "Admin", description: "Manage members, billing, and workspace settings." },
  { value: "viewer", label: "Viewer", description: "Read-only access to workspace data." },
] as const;

type RoleValue = (typeof ROLES)[number]["value"];

const FIELD_LABEL = "mb-1.5 block ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]";

export function InviteMemberForm({ organizationId }: InviteMemberFormProps) {
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<RoleValue>("editor");
  const [email, setEmail] = useState("");
  const trimmedEmail = email.trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const showInvalid = trimmedEmail.length > 0 && !emailValid;
  const ready = emailValid && !isPending;

  return (
    <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-5">
      <h3 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
        Invite a member
      </h3>
      {/* Compact composer: labels above each control, the three controls share
          one min-h-11 baseline via `items-end` so they read as one row. */}
      <form
        className="mt-3 grid grid-cols-1 gap-x-2 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end"
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
            setEmail("");
            setRole("editor");
          });
        }}
      >
        <div className="min-w-0">
          <label htmlFor="invite-email" className={FIELD_LABEL}>
            Work email
          </label>
          <div className="relative min-w-0">
            <span
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]"
              aria-hidden
            >
              <Mail className="h-3.5 w-3.5" />
            </span>
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              placeholder="colleague@company.com"
              aria-invalid={showInvalid || undefined}
              aria-describedby={showInvalid ? "invite-status" : undefined}
              className="ui-input w-full pl-9 font-mono text-[12.5px] placeholder:font-mono"
            />
          </div>
        </div>
        <div className="min-w-0">
          <span className={FIELD_LABEL} aria-hidden>
            Workspace role
          </span>
          {/* Shared role picker uses the restored UiSelect option contract. */}
          <UiSelect
            name="role"
            variant="pill"
            value={role}
            onChange={(next) => setRole(next as RoleValue)}
            ariaLabel="Workspace role"
            options={ROLES.map((r) => ({
              value: r.value,
              label: r.label,
            }))}
            portal
            className="w-full sm:w-auto"
            buttonClassName="min-h-11 w-full sm:w-40"
          />
        </div>
        {/* Until the email is valid the action reads as a neutral (secondary)
            control, not a low-opacity primary CTA (§7.1 + spec). */}
        <button
          type="submit"
          disabled={!ready}
          aria-disabled={!ready}
          aria-busy={isPending}
          className={`min-h-11 w-full whitespace-nowrap text-[12.5px] sm:w-auto ${
            emailValid
              ? "ui-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
              : "ui-btn-secondary cursor-not-allowed text-[var(--text-tertiary)]"
          }`}
        >
          {isPending ? "Inviting…" : "Invite member"}
        </button>
      </form>
      {/* §18 — workspace-scope + expiry trust note at the point of risk. */}
      <p className="mt-2 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
        Invites give access to this workspace only and expire after 14 days.
      </p>
      {/* Reserved status slot — invalid hint + server message share one
          fixed-height region so neither shifts the composer. */}
      <div
        id="invite-status"
        aria-live="polite"
        className="mt-2 min-h-[1.125rem] text-[11.5px] leading-snug"
      >
        {showInvalid ? (
          <p className="font-medium text-[var(--danger-ink)]">Enter a valid email address.</p>
        ) : message ? (
          <p
            className={`font-medium ${message.type === "ok" ? "text-[var(--success-ink)]" : "text-[var(--danger-ink)]"}`}
            role={message.type === "ok" ? "status" : "alert"}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
