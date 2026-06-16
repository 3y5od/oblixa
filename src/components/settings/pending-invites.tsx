"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { revokeOrgInvite, resendOrgInvite } from "@/actions/settings";
import { TimeChip } from "@/components/ui/time-chip";
import { CountChip } from "@/components/ui/count-chip";

export interface PendingInviteRow {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

// Canonical release roles (§24) — the stored `editor` value presents as
// "Member"; the internal term is never shown.
const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Member",
  member: "Member",
  viewer: "Viewer",
};

const ROLE_CHIP =
  "ui-caps-2 inline-flex items-center whitespace-nowrap rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]";
const GHOST_CHIP =
  "ui-chip-focus inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-strong))] hover:text-[var(--accent-strong)] disabled:pointer-events-none disabled:opacity-50";
// Resting revoke is a danger-OUTLINE chip; it only becomes a solid danger
// button once the inline "Revoke?" confirmation is showing (spec / §11.* — no
// window.confirm).
const DANGER_OUTLINE_CHIP =
  "ui-chip-focus inline-flex items-center rounded-full border border-[color:color-mix(in_oklab,var(--danger)_30%,var(--border-subtle))] bg-[var(--surface-raised)] px-3 py-1.5 text-xs font-medium text-[var(--danger-ink)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--danger-soft)_24%,var(--surface-raised))] disabled:pointer-events-none disabled:opacity-50";
const DANGER_SOLID_CHIP =
  "ui-btn-danger min-h-0 rounded-full px-3 py-1.5 text-xs disabled:pointer-events-none disabled:opacity-50";

export function PendingInvitesList({ invites }: { invites: PendingInviteRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (invites.length === 0) return null;

  function run(act: () => Promise<{ error?: string; success?: boolean }>) {
    setError(null);
    startTransition(async () => {
      const r = await act();
      if (r && "error" in r && r.error) {
        setError(r.error);
        return;
      }
      setConfirmingId(null);
      router.refresh();
    });
  }

  return (
    // §10.5 — flat hairline section, not a nested card inside the Team access card.
    <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-5">
      <div className="flex items-center gap-2">
        <h4 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
          Pending invites
        </h4>
        <CountChip value={invites.length} tone="warning" emphasis="strong" />
      </div>
      <p className="mt-1 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
        Not accepted yet. Resend to refresh the email, or revoke to cancel.
      </p>
      {/* Reserved error slot — inline recoverable alert instead of window.alert. */}
      <div aria-live="assertive" className="mt-2 min-h-[1.125rem] text-[11.5px] leading-snug">
        {error ? (
          <p role="alert" className="inline-flex items-center gap-1.5 font-medium text-[var(--danger-ink)]">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
            <span className="min-w-0">{error}</span>
          </p>
        ) : null}
      </div>
      <ul role="list" className="mt-1 divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
        {invites.map((inv) => {
          const confirming = confirmingId === inv.id;
          return (
            <li
              key={inv.id}
              className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p title={inv.email} className="truncate font-mono text-[12.5px] text-[var(--text-secondary)]">
                  {inv.email}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={ROLE_CHIP}>{roleLabels[inv.role] || inv.role}</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Expires</span>
                    <TimeChip date={inv.expires_at} format="calendar" bordered />
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {confirming ? (
                  <>
                    <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Revoke?</span>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => run(() => revokeOrgInvite(inv.id))}
                      className={DANGER_SOLID_CHIP}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setConfirmingId(null)}
                      className={GHOST_CHIP}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => run(() => resendOrgInvite(inv.id))}
                      className={GHOST_CHIP}
                    >
                      Resend invite
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setError(null);
                        setConfirmingId(inv.id);
                      }}
                      className={DANGER_OUTLINE_CHIP}
                    >
                      Revoke invite
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
