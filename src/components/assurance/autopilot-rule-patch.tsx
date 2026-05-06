"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { mutateJson } from "@/lib/http/client-json";

export function AutopilotRulePatchForm({
  ruleId,
  initialAllowlist,
}: {
  ruleId: string;
  initialAllowlist: string[];
}) {
  const router = useRouter();
  const [text, setText] = useState(initialAllowlist.join("\n"));
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSave() {
    setPending(true);
    setErr(null);
    const allowlist = text
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const result = await mutateJson(`/api/autopilot/rules/${encodeURIComponent(ruleId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ allowlist }),
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
    <div className="mt-2 space-y-2 border-t border-[var(--border-subtle)] pt-2 text-xs">
      <p className="font-medium text-[var(--text-secondary)]">Allowlist (IDs, one per line)</p>
      <textarea
        className="w-full rounded border border-[var(--border-subtle)] px-2 py-1 font-mono text-[11px]"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <AsyncActionButton
        type="button"
        className="rounded bg-[var(--text-primary)] px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50"
        pending={pending}
        pendingLabel="Saving…"
        onClick={() => void onSave()}
      >
        Save allowlist
      </AsyncActionButton>
      <InlineMutationStatus message={err} variant="error" className="text-[11px]" />
    </div>
  );
}

export function AutopilotDisableButton({ ruleId }: { ruleId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onDisable() {
    setPending(true);
    setErr(null);
    try {
      const result = await mutateJson(`/api/autopilot/rules/${encodeURIComponent(ruleId)}`, { method: "DELETE" });
      if (!result.ok) {
        setErr(result.message || "Disable failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2 space-y-1">
      <ConfirmActionButton
        type="button"
        className="text-[11px] text-[var(--text-secondary)] underline disabled:opacity-50"
        pending={pending}
        pendingLabel="Disabling…"
        confirmMessage="Disable this autopilot rule override?"
        onConfirm={onDisable}
      >
        Disable (override)
      </ConfirmActionButton>
      <InlineMutationStatus message={err} variant="error" className="text-[11px]" />
    </div>
  );
}
