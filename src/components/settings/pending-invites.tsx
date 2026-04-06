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
    <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-zinc-900">Pending invites</h4>
      <p className="mt-1 text-xs text-zinc-600">
        Invites that have not been accepted yet. Resend to refresh the email; revoke to cancel.
      </p>
      <ul className="mt-3 divide-y divide-zinc-200/90">
        {invites.map((inv) => (
          <li
            key={inv.id}
            className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium text-zinc-900">{inv.email}</p>
              <p className="text-xs text-zinc-500">
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
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:opacity-50"
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
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-900 transition-colors hover:bg-red-100 disabled:opacity-50"
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
