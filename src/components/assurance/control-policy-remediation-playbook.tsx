"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type PlaybookRow = { id: string; name: string };

export function ControlPolicyRemediationPlaybookPanel(props: {
  policyId: string;
  currentRemediationPlaybookId: string | null;
}) {
  const router = useRouter();
  const [playbooks, setPlaybooks] = useState<PlaybookRow[]>([]);
  const [selected, setSelected] = useState(props.currentRemediationPlaybookId ?? "");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setSelected(props.currentRemediationPlaybookId ?? "");
  }, [props.currentRemediationPlaybookId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/playbooks");
      const j = (await res.json().catch(() => ({}))) as { playbooks?: PlaybookRow[] };
      if (!cancelled && res.ok && Array.isArray(j.playbooks)) {
        setPlaybooks(j.playbooks);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setPending(true);
    setErr(null);
    try {
      const res = await fetch(`/api/control-policies/${encodeURIComponent(props.policyId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          remediationPlaybookId: selected === "" ? null : selected,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Update failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-[var(--border-subtle)] p-3 text-sm">
      <p className="text-xs font-semibold text-[var(--text-secondary)]">Remediation playbook (control policies)</p>
      <p className="mt-1 text-xs text-[var(--text-tertiary)]">
        Linked playbooks appear on new policy breach findings as the recommended intervention.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          className="w-full rounded border border-[var(--border-subtle)] px-2 py-1.5 text-sm sm:max-w-md"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">None</option>
          {playbooks.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending}
          className="rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          onClick={() => void save()}
        >
          {pending ? "Saving…" : "Save link"}
        </button>
      </div>
      {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}
    </div>
  );
}
