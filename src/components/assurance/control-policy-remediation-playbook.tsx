"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { fetchJson, mutateJson } from "@/lib/http/client-json";

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
      const result = await fetchJson("/api/playbooks");
      if (!cancelled && result.ok) {
        const data = result.data as { playbooks?: PlaybookRow[] };
        if (Array.isArray(data.playbooks)) setPlaybooks(data.playbooks);
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
      const result = await mutateJson(`/api/control-policies/${encodeURIComponent(props.policyId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          remediationPlaybookId: selected === "" ? null : selected,
        }),
      });
      if (!result.ok) {
        setErr(result.message || "Update failed");
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
          className="ui-input-compact w-full sm:max-w-md"
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
        <AsyncActionButton
          type="button"
          className="rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          pending={pending}
          pendingLabel="Saving…"
          onClick={() => void save()}
        >
          Save link
        </AsyncActionButton>
      </div>
      <InlineMutationStatus message={err} variant="error" className="mt-2 text-xs" />
    </div>
  );
}
