"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ContractRow = {
  id: string;
  contract_id: string;
  segment_key: string | null;
  assigned_team: string | null;
  status: string;
  updated_at: string;
};

export function CampaignAssignmentPanel({
  campaignId,
  initialAssignment,
  contracts,
  canEdit,
}: {
  campaignId: string;
  initialAssignment: Record<string, unknown>;
  contracts: ContractRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [jsonText, setJsonText] = useState(JSON.stringify(initialAssignment ?? {}, null, 2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function saveAssignmentJson() {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText) as unknown;
      } catch {
        throw new Error("assignment JSON is not valid JSON");
      }
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentJson: parsed }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setSaved("Assignment rules saved.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ui-card p-5">
      <p className="ui-eyebrow">Routing</p>
      <h2 className="ui-section-title mt-1 text-base">Assignment rules</h2>
      <p className="ui-muted-tight mt-2">
        <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">defaultTeamKey</code> and optional{" "}
        <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">bySegment</code> set task routing when the campaign starts.
        Per-row overrides below win over these defaults.
      </p>
      <pre className="mt-2 overflow-x-auto rounded-xl bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-3 text-[11px] text-[var(--text-secondary)]">
        {`{
  "defaultTeamKey": "legal",
  "defaultAssigneeId": "optional-uuid",
  "bySegment": {
    "segment-a": { "teamKey": "ops", "assigneeId": "optional-uuid" }
  }
}`}
      </pre>
      {canEdit ? (
        <>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={8}
            className="ui-input mt-3 w-full font-mono text-xs"
            spellCheck={false}
          />
          {error ? (
            <p className="mt-2 text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
          {saved ? <p className="mt-2 text-sm text-emerald-700">{saved}</p> : null}
          <button
            type="button"
            className="ui-btn-secondary mt-3 px-3 py-2 text-xs"
            disabled={busy}
            onClick={() => void saveAssignmentJson()}
          >
            {busy ? "Saving…" : "Save assignment rules"}
          </button>
        </>
      ) : (
        <pre className="mt-3 overflow-x-auto rounded-xl bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-3 text-xs text-[var(--text-secondary)]">
          {jsonText}
        </pre>
      )}

      <div className="mt-6 border-t border-[var(--border-subtle)] pt-4">
        <p className="ui-eyebrow">Overrides</p>
        <h3 className="ui-section-title mt-1 text-base">Per-contract row routing</h3>
        <p className="ui-muted-tight mt-1">
          Edit segment and team labels for each linked contract. Run preview again to refresh segment backfill from
          eligibility when needed.
        </p>
        <ul className="mt-3 space-y-3">
          {contracts.length === 0 ? (
            <li className="text-sm text-[var(--text-tertiary)]">No contract rows yet.</li>
          ) : (
            contracts.map((row) => (
              <CampaignContractRowForm
                key={`${row.id}-${row.updated_at}`}
                campaignId={campaignId}
                row={row}
                canEdit={canEdit}
                onSaved={() => router.refresh()}
              />
            ))
          )}
        </ul>
      </div>
    </section>
  );
}

function CampaignContractRowForm({
  campaignId,
  row,
  canEdit,
  onSaved,
}: {
  campaignId: string;
  row: ContractRow;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [segment, setSegment] = useState(row.segment_key ?? "");
  const [team, setTeam] = useState(row.assigned_team ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveRow() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/contracts/${row.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmentKey: segment.trim() || null,
          assignedTeam: team.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-[var(--border-subtle)] px-3 py-3 text-sm">
      <p className="font-medium text-[var(--text-primary)]">
        <Link href={`/contracts/${row.contract_id}`} className="ui-link">
          Contract {row.contract_id}
        </Link>{" "}
        · {row.status}
      </p>
      {canEdit ? (
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={`campaign-segment-${row.id}`} className="ui-label-caps">
              Segment key
            </label>
            <input
              id={`campaign-segment-${row.id}`}
              className="ui-input w-40 text-xs"
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`campaign-team-${row.id}`} className="ui-label-caps">
              Assigned team
            </label>
            <input
              id={`campaign-team-${row.id}`}
              className="ui-input w-40 text-xs"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="ui-btn-secondary px-2 py-1.5 text-[11px]"
            disabled={busy}
            onClick={() => void saveRow()}
          >
            {busy ? "…" : "Save row"}
          </button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          Team: {row.assigned_team || "—"} · Segment: {row.segment_key || "—"}
        </p>
      )}
      {error ? (
        <p className="mt-1 text-xs text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
