"use client";
// V7 exempt: client actions mounted only from assurance finding surfaces; post-mutation navigation stays in-family.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchJson } from "@/lib/http/client-json";
import { captureClientException } from "@/lib/observability/sentry";

export function FindingActions({ findingId }: { findingId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [signalFeedback, setSignalFeedback] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(action: "resolve" | "dismiss") {
    setPending(true);
    setErr(null);
    try {
      const result = await fetchJson(`/api/assurance/findings/${encodeURIComponent(findingId)}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          note: note || undefined,
          signalFeedback: signalFeedback || undefined,
        }),
      });
      if (!result.ok) {
        setErr(result.message);
        return;
      }
      router.push("/assurance/findings");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
      captureClientException(e, { extra: { surface: "FindingActions" } });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-[var(--border-subtle)] p-3 text-sm">
      <p className="text-xs font-semibold text-[var(--text-primary)]">Analyst note</p>
      <textarea
        className="mt-2 w-full rounded border border-[var(--border-subtle)] px-2 py-1 text-sm"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional resolution note"
      />
      <label className="mt-2 block text-xs text-[var(--text-secondary)]">
        Signal quality (optional — used for calibration and reporting)
        <select
          className="mt-1 block w-full max-w-md rounded border border-[var(--border-subtle)] px-2 py-1 text-sm"
          value={signalFeedback}
          onChange={(e) => setSignalFeedback(e.target.value)}
        >
          <option value="">No label</option>
          <option value="false_positive">False positive / noise</option>
          <option value="not_actionable">Not actionable</option>
          <option value="confirmed_true">Confirmed issue</option>
        </select>
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          onClick={() => void submit("resolve")}
        >
          {pending ? "Working…" : "Mark resolved"}
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-xs text-[var(--text-primary)] disabled:opacity-50"
          onClick={() => void submit("dismiss")}
        >
          Dismiss
        </button>
      </div>
      {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}
    </div>
  );
}
