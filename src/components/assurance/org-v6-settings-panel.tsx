"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  initialAutopilotAllowExecution: boolean | null;
  initialEmails: string[];
  canManage: boolean;
};

export function OrgV6SettingsPanel({
  initialAutopilotAllowExecution,
  initialEmails,
  canManage,
}: Props) {
  const router = useRouter();
  const [autopilotOn, setAutopilotOn] = useState(
    initialAutopilotAllowExecution !== false
  );
  const [emails, setEmails] = useState(initialEmails.join(", "));
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setErr(null);
    setOk(null);
    try {
      const list = emails
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/workspace/v6-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          autopilotAllowExecution: autopilotOn,
          reviewBoardNotificationEmails: list,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Save failed");
        return;
      }
      setOk("Saved.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!canManage) {
    return (
      <p className="text-xs text-zinc-500">
        Org V6 settings are visible to operators; only workspace settings managers can edit.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-zinc-100 p-3 text-sm">
      <p className="text-xs font-semibold text-zinc-800">Organization V6 settings</p>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
        <input
          type="checkbox"
          checked={autopilotOn}
          onChange={(e) => setAutopilotOn(e.target.checked)}
        />
        Allow mutating autopilot actions for this org (still requires global env flag)
      </label>
      <div>
        <label className="text-[11px] font-medium text-zinc-600">
          Review board notification emails (stored for future digests)
          <textarea
            className="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs"
            rows={2}
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="ops@company.com, legal@company.com"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        onClick={() => void save()}
      >
        {pending ? "Saving…" : "Save org settings"}
      </button>
      {err ? <p className="text-xs text-red-600">{err}</p> : null}
      {ok ? <p className="text-xs text-emerald-700">{ok}</p> : null}
    </div>
  );
}
