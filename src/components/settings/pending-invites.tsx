"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
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

const roleLabels: Record<string, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export function PendingInvitesList({ invites }: { invites: PendingInviteRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (invites.length === 0) return null;

  return (
    // §10.5 — flat hairline section, not a nested ui-page-shell card inside the
    // Team access card. Matches the invite form's separator vocabulary.
    <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-5">
      <div className="flex items-center gap-2">
        <h4 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
          Pending invites
        </h4>
        <CountChip value={invites.length} />
      </div>
      <p className="mt-1 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
        Not accepted yet. Resend to refresh the email, or revoke to cancel.
      </p>
      <ul role="list" className="mt-3 divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
        {invites.map((inv) => (
          <li
            key={inv.id}
            className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-mono text-[12.5px] text-[var(--text-secondary)]">{inv.email}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="ui-caps-2 inline-flex items-center whitespace-nowrap rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                  {roleLabels[inv.role] || inv.role}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Expires</span>
                  <TimeChip date={inv.expires_at} format="calendar" bordered />
                </span>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const r = await resendOrgInvite(inv.id);
                    if ("error" in r && r.error) {
                      window.alert(r.error);
                      return;
                    }
                    router.refresh();
                  });
                }}
                className="ui-chip-focus inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-strong))] hover:text-[var(--accent-strong)] disabled:pointer-events-none disabled:opacity-50"
              >
                Resend invite
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (!window.confirm(`Revoke invite to ${inv.email}?`)) return;
                  startTransition(async () => {
                    const r = await revokeOrgInvite(inv.id);
                    if ("error" in r && r.error) {
                      window.alert(r.error);
                      return;
                    }
                    router.refresh();
                  });
                }}
                className="ui-btn-danger min-h-0 rounded-full px-3 py-1.5 text-xs disabled:pointer-events-none disabled:opacity-50"
              >
                Revoke invite
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
