"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReviewBoardCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [boardType, setBoardType] = useState("weekly_portfolio_health");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErr(null);
    try {
      const res = await fetch("/api/review-boards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, boardType }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Create failed");
        return;
      }
      setName("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-3 space-y-2 rounded-lg border border-[var(--border-subtle)] p-3 text-sm">
      <p className="text-xs font-semibold text-[var(--text-secondary)]">Create board</p>
      <input
        className="w-full rounded border border-[var(--border-subtle)] px-2 py-1 text-sm"
        placeholder="Board name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <select
        className="w-full rounded border border-[var(--border-subtle)] px-2 py-1 text-sm"
        value={boardType}
        onChange={(e) => setBoardType(e.target.value)}
      >
        <option value="weekly_portfolio_health">Weekly portfolio health</option>
        <option value="monthly_control_effectiveness">Monthly control effectiveness</option>
        <option value="renewal_readiness">Renewal readiness</option>
        <option value="evidence_compliance">Evidence compliance</option>
        <option value="campaign_effectiveness">Campaign effectiveness</option>
        <option value="counterparty_risk">Counterparty risk</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Create"}
      </button>
      {err ? <p className="text-xs text-red-600">{err}</p> : null}
    </form>
  );
}

export function ReviewBoardRunLifecycle({
  runId,
  status,
  packetJson,
}: {
  runId: string;
  status: string;
  packetJson: Record<string, unknown> | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionType, setDecisionType] = useState("board_decision");

  async function patch(body: Record<string, unknown>) {
    setPending(true);
    setErr(null);
    try {
      const res = await fetch(`/api/review-boards/runs/${encodeURIComponent(runId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Update failed");
        return;
      }
      setActionNote("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  function downloadPacket() {
    if (!packetJson || Object.keys(packetJson).length === 0) return;
    const blob = new Blob([JSON.stringify(packetJson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `review-board-run-${runId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canLifecycle = status === "generated" || status === "reviewed";

  return (
    <div className="mt-2 space-y-2 border-t border-[var(--border-subtle)] pt-2">
      <div className="flex flex-wrap gap-2">
        {status === "generated" ? (
          <button
            type="button"
            disabled={pending}
            className="rounded border border-[var(--border-strong)] px-2 py-1 text-xs text-[var(--text-primary)] disabled:opacity-50"
            onClick={() => void patch({ status: "reviewed" })}
          >
            {pending ? "Saving…" : "Mark reviewed"}
          </button>
        ) : null}
        {canLifecycle ? (
          <button
            type="button"
            disabled={pending}
            className="rounded border border-[var(--border-strong)] px-2 py-1 text-xs text-[var(--text-primary)] disabled:opacity-50"
            onClick={() => void patch({ status: "closed" })}
          >
            Close run
          </button>
        ) : null}
        <button
          type="button"
          disabled={!packetJson || Object.keys(packetJson).length === 0}
          className="rounded border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] disabled:opacity-50"
          onClick={() => downloadPacket()}
        >
          Download packet (JSON)
        </button>
        <a
          className="inline-flex items-center rounded border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)]"
          href={`/api/review-boards/runs/${encodeURIComponent(runId)}?format=json`}
        >
          Export full run (JSON)
        </a>
        <a
          className="inline-flex items-center rounded border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)]"
          href={`/api/review-boards/runs/${encodeURIComponent(runId)}?format=csv`}
        >
          Export summary (CSV)
        </a>
      </div>
      {canLifecycle ? (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-[var(--text-secondary)]">
            Log an action (appends to action capture)
            <input
              className="mt-0.5 w-full rounded border border-[var(--border-subtle)] px-2 py-1 text-xs"
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="e.g. Follow up with owner on finding F-12"
            />
          </label>
          <button
            type="button"
            disabled={pending || !actionNote.trim()}
            className="self-start rounded bg-[var(--text-primary)] px-2 py-1 text-[11px] text-[var(--text-inverse)] disabled:opacity-50"
            onClick={() => void patch({ actionCapture: { note: actionNote.trim() } })}
          >
            Append action
          </button>
        </div>
      ) : null}
      {canLifecycle ? (
        <div className="flex flex-col gap-1 border-t border-[var(--border-subtle)] pt-2">
          <label className="text-[11px] font-medium text-[var(--text-secondary)]">
            Log a board decision (appends to decision log)
            <input
              className="mt-0.5 w-full rounded border border-[var(--border-subtle)] px-2 py-1 text-xs"
              value={decisionType}
              onChange={(e) => setDecisionType(e.target.value)}
              placeholder="decision type"
            />
            <textarea
              className="mt-1 w-full rounded border border-[var(--border-subtle)] px-2 py-1 text-xs"
              rows={2}
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder="e.g. Approved remediation plan for campaign C-12"
            />
          </label>
          <button
            type="button"
            disabled={pending || !decisionNote.trim()}
            className="self-start rounded border border-[var(--text-primary)] px-2 py-1 text-[11px] text-[var(--text-primary)] disabled:opacity-50"
            onClick={() =>
              void patch({
                decisionLog: { decision_type: decisionType.trim() || "board_decision", summary: decisionNote.trim() },
              })
            }
          >
            Append decision
          </button>
        </div>
      ) : null}
      {err ? <p className="text-xs text-red-600">{err}</p> : null}
    </div>
  );
}

export function ReviewBoardPatchPanel({
  boardId,
  initialSubscriptions,
  initialAgendaTemplate,
  initialCadence,
  initialActive,
}: {
  boardId: string;
  initialSubscriptions: unknown;
  initialAgendaTemplate: unknown;
  initialCadence: string;
  initialActive: boolean;
}) {
  const router = useRouter();
  const [subsJson, setSubsJson] = useState(JSON.stringify(initialSubscriptions ?? [], null, 2));
  const [agendaJson, setAgendaJson] = useState(JSON.stringify(initialAgendaTemplate ?? {}, null, 2));
  const [cadence, setCadence] = useState(initialCadence);
  const [active, setActive] = useState(initialActive);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErr(null);
    let subscriptions: unknown[] = [];
    let agendaTemplate: Record<string, unknown> = {};
    try {
      const s = JSON.parse(subsJson) as unknown;
      if (!Array.isArray(s)) {
        setErr(
          'Subscriptions must be a JSON array. Examples: [{"email":"a@b.com","channel":"email"}] or [{"channel":"slack","webhookUrl":"https://hooks.slack.com/services/.../.../..."}].'
        );
        setPending(false);
        return;
      }
      subscriptions = s;
    } catch {
      setErr("Subscriptions JSON is invalid.");
      setPending(false);
      return;
    }
    try {
      const a = JSON.parse(agendaJson) as unknown;
      agendaTemplate = a && typeof a === "object" && !Array.isArray(a) ? (a as Record<string, unknown>) : {};
    } catch {
      setErr("Agenda template JSON is invalid.");
      setPending(false);
      return;
    }
    try {
      const res = await fetch(`/api/review-boards/${encodeURIComponent(boardId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscriptions, agendaTemplate, cadence, active }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Save failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSave(e)}
      className="mt-3 space-y-2 rounded-lg border border-dashed border-[var(--border-subtle)] bg-surface/90 p-3 text-xs"
    >
      <p className="font-semibold text-[var(--text-primary)]">Board settings (subscriptions and agenda)</p>
      <p className="text-[11px] text-[var(--text-tertiary)]">
        When a packet run is generated, email and Slack inbound webhooks listed here receive a short summary.
        Exports still use the full run payload in the app.
      </p>
      <label className="block">
        <span className="text-[11px] font-medium text-[var(--text-secondary)]">Subscriptions JSON (array)</span>
        <span className="mt-0.5 block text-[10px] text-[var(--text-tertiary)]">
          Email:{" "}
          <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-0.5">{`{"email":"ops@example.com","channel":"email"}`}</code>
          {" · "}
          Slack:{" "}
          <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-0.5">{`{"channel":"slack","webhookUrl":"https://hooks.slack.com/..."}`}</code>
        </span>
        <textarea
          className="mt-0.5 w-full rounded border border-[var(--border-subtle)] px-2 py-1 font-mono text-[11px]"
          rows={4}
          value={subsJson}
          onChange={(e) => setSubsJson(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-[var(--text-secondary)]">Agenda template JSON (object)</span>
        <textarea
          className="mt-0.5 w-full rounded border border-[var(--border-subtle)] px-2 py-1 font-mono text-[11px]"
          rows={3}
          value={agendaJson}
          onChange={(e) => setAgendaJson(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1 text-[11px]">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
        <label className="flex items-center gap-1 text-[11px]">
          Cadence
          <select
            className="rounded border border-[var(--border-subtle)] px-1 py-0.5"
            value={cadence}
            onChange={(e) => setCadence(e.target.value)}
          >
            <option value="weekly">weekly</option>
            <option value="biweekly">biweekly</option>
            <option value="monthly">monthly</option>
            <option value="quarterly">quarterly</option>
          </select>
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-[var(--text-primary)] px-2 py-1 text-[11px] text-[var(--text-inverse)] disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save board settings"}
      </button>
      {err ? <p className="text-[11px] text-red-600">{err}</p> : null}
    </form>
  );
}

export function ReviewBoardGenerateButton({ boardId }: { boardId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onGen() {
    setPending(true);
    setErr(null);
    try {
      const res = await fetch(`/api/review-boards/${encodeURIComponent(boardId)}/generate-run`, {
        method: "POST",
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Generate failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={pending}
        className="rounded border border-[var(--border-strong)] px-2 py-1 text-xs text-[var(--text-primary)] disabled:opacity-50"
        onClick={() => void onGen()}
      >
        {pending ? "Generating…" : "Generate run"}
      </button>
      {err ? <p className="mt-1 text-xs text-red-600">{err}</p> : null}
    </div>
  );
}
