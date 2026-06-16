"use client";

import { useState, useTransition } from "react";
import { UserMinus } from "lucide-react";
import { removeOrgMember, updateOrgMemberRole } from "@/actions/settings";
import { UiConfirmDialog } from "@/components/ui/ui-confirm-dialog";
import { UiSelect } from "@/components/ui/ui-select";

// Canonical assignable roles (Owner is not assignable here — it is the
// organizations.owner_user_id relation, changed only via ownership transfer).
// Stored `editor` presents as "Member" per the surface vocabulary.
const ASSIGNABLE_ROLES = [
  { value: "editor", label: "Member" },
  { value: "admin", label: "Admin" },
  { value: "viewer", label: "Viewer" },
] as const;

type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]["value"];

/** Map a stored membership role (incl. legacy aliases) to an assignable select value. */
function toAssignable(role: string): AssignableRole {
  const r = role.trim().toLowerCase();
  if (r === "admin") return "admin";
  if (r === "viewer" || r === "read_only" || r === "readonly") return "viewer";
  return "editor";
}

export function MemberRoleControl({
  organizationId,
  targetUserId,
  role,
  memberLabel,
  canRemove = false,
}: {
  organizationId: string;
  targetUserId: string;
  role: string;
  /** Member name/email, for an accessible control name and announcements. */
  memberLabel: string;
  /** When true, a destructive remove control is offered (Owner/Admin viewer,
   *  non-owner non-self target). */
  canRemove?: boolean;
}) {
  const [value, setValue] = useState<AssignableRole>(() => toAssignable(role));
  const [status, setStatus] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onChange = (next: string) => {
    const nextRole = next as AssignableRole;
    const previous = value;
    if (nextRole === previous) return;
    setValue(nextRole);
    setStatus(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("organizationId", organizationId);
      fd.set("targetUserId", targetUserId);
      fd.set("role", nextRole);
      const result = await updateOrgMemberRole(fd);
      if (result && "error" in result && result.error) {
        setValue(previous); // revert the optimistic change
        setStatus({ type: "err", text: result.error });
        return;
      }
      const label = ASSIGNABLE_ROLES.find((r) => r.value === nextRole)?.label ?? nextRole;
      setStatus({ type: "ok", text: `Role updated to ${label}.` });
    });
  };

  const onConfirmRemove = async () => {
    setStatus(null);
    const fd = new FormData();
    fd.set("organizationId", organizationId);
    fd.set("targetUserId", targetUserId);
    const result = await removeOrgMember(fd);
    setConfirmOpen(false);
    if (result && "error" in result && result.error) {
      setStatus({ type: "err", text: result.error });
      return;
    }
    // On success the server revalidates /settings and the row disappears; the
    // status is announced for AT before the re-render.
    setStatus({ type: "ok", text: `${memberLabel} removed.` });
  };

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span className="inline-flex items-center gap-1.5">
        <UiSelect
          value={value}
          onChange={onChange}
          variant="pill"
          ariaLabel={`Workspace role for ${memberLabel}`}
          disabled={isPending}
          options={ASSIGNABLE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
          portal
          buttonClassName="min-h-8"
        />
        {canRemove ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={isPending}
            aria-label={`Remove ${memberLabel} from this workspace`}
            className="ui-chip-focus inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-[color:color-mix(in_oklab,var(--danger-soft)_46%,var(--border-subtle))] text-[var(--danger-ink)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--danger-soft)_30%,transparent)] disabled:opacity-50"
          >
            <UserMinus className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
          </button>
        ) : null}
      </span>
      <span aria-live="polite" className="min-h-[0.9rem] text-[10.5px] leading-none">
        {status ? (
          <span
            role={status.type === "ok" ? "status" : "alert"}
            className={status.type === "ok" ? "text-[var(--success-ink)]" : "text-[var(--danger-ink)]"}
          >
            {status.text}
          </span>
        ) : null}
      </span>
      {canRemove ? (
        <UiConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={onConfirmRemove}
          destructive
          title={`Remove ${memberLabel}?`}
          description="They lose access to this workspace immediately. Their past activity, uploads, and reviews are kept. You can invite them again later."
          confirmLabel="Remove member"
        />
      ) : null}
    </span>
  );
}
