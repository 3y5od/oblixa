"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { revokeOrgInvite, resendOrgInvite } from "@/actions/settings";

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
    <div className="ui-page-shell mt-6 p-4">
      <p className="ui-eyebrow">Access</p>
      <h4 className="ui-section-title mt-1 text-base">Pending invites</h4>
      <p className="ui-support-copy mt-1">
        Invites that have not been accepted yet. Resend to refresh the email; revoke to cancel.
      </p>
      <ul className="mt-3 divide-y divide-[var(--border-subtle)]/90">
        {invites.map((inv) => (
          <li
            key={inv.id}
            className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">{inv.email}</p>
              <p className="ui-support-copy text-xs">
                {roleLabels[inv.role] || inv.role} · expires{" "}
                {format(new Date(inv.expires_at), "MMM d, yyyy")}
              </p>
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
                className="rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_72%,var(--canvas))] disabled:opacity-50"
              >
                Resend
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
                className="ui-btn-danger min-h-0 px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Revoke
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
