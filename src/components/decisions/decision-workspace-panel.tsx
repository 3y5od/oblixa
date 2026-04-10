"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  DECISION_TYPES,
  DECISION_TYPE_LABELS,
  type DecisionType,
} from "@/lib/v5/decision-types";
import {
  isValidPacketType,
  PACKET_TYPES,
  PACKET_TYPE_LABELS,
  type PacketType,
} from "@/lib/v5/packet-types";

type Props = {
  decisionId: string;
  decisionType: string;
  status: string;
  ownerUserId: string | null;
  dueAt: string | null;
  rationaleMarkdown: string | null;
  requiredInputsJson: unknown;
  approvalPathJson: unknown;
  /** Preselect packet export type (e.g. from /decisions/review “Manager packet” link). */
  initialExportPacketType?: string;
};

async function postJson(url: string, body?: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function patchJson(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export function DecisionWorkspacePanel({
  decisionId,
  decisionType: initialDecisionType,
  status,
  ownerUserId,
  dueAt,
  rationaleMarkdown,
  requiredInputsJson,
  approvalPathJson,
  initialExportPacketType,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decisionType, setDecisionType] = useState(() =>
    DECISION_TYPES.includes(initialDecisionType as DecisionType)
      ? (initialDecisionType as DecisionType)
      : "renewal"
  );
  useEffect(() => {
    if (DECISION_TYPES.includes(initialDecisionType as DecisionType)) {
      setDecisionType(initialDecisionType as DecisionType);
    }
  }, [initialDecisionType]);
  const [recText, setRecText] = useState("");
  const [stakeholderId, setStakeholderId] = useState("");
  const [ownerId, setOwnerId] = useState(ownerUserId ?? "");
  const [dueLocal, setDueLocal] = useState(() => (dueAt ? dueAt.slice(0, 16) : ""));
  const [rationale, setRationale] = useState(rationaleMarkdown ?? "");
  const [requiredJson, setRequiredJson] = useState(() =>
    JSON.stringify(requiredInputsJson && typeof requiredInputsJson === "object" ? requiredInputsJson : {}, null, 2)
  );
  const [approvalJson, setApprovalJson] = useState(() =>
    JSON.stringify(Array.isArray(approvalPathJson) ? approvalPathJson : [], null, 2)
  );
  const [exportPacketType, setExportPacketType] = useState<PacketType>(() =>
    initialExportPacketType && isValidPacketType(initialExportPacketType)
      ? (initialExportPacketType as PacketType)
      : "renewal_packet"
  );
  useEffect(() => {
    if (initialExportPacketType && isValidPacketType(initialExportPacketType)) {
      setExportPacketType(initialExportPacketType as PacketType);
    }
  }, [initialExportPacketType]);
  const closed = status === "closed";

  const dueForApi = useMemo(() => {
    if (!dueLocal.trim()) return null;
    const d = new Date(dueLocal);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }, [dueLocal]);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="ui-card p-5">
      <p className="ui-eyebrow">Decision</p>
      <h2 className="ui-section-title mt-1 text-base">Workspace actions</h2>
      {error && (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 space-y-4">
        <div className="border-b border-zinc-100 pb-4">
          <p className="text-xs font-semibold text-zinc-600">Workspace details</p>
          <label className="mt-2 block text-[11px] font-medium text-zinc-500">
            Decision type
            <select
              className="ui-input-compact mt-1 w-full text-xs"
              value={decisionType}
              onChange={(e) => setDecisionType(e.target.value as DecisionType)}
              disabled={closed || busy !== null}
            >
              {DECISION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DECISION_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-2 block text-[11px] font-medium text-zinc-500">
            Owner user id
            <input
              className="ui-input-compact mt-1 w-full font-mono text-xs"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              disabled={closed || busy !== null}
            />
          </label>
          <label className="mt-2 block text-[11px] font-medium text-zinc-500">
            Due date
            <input
              type="datetime-local"
              className="ui-input-compact mt-1 w-full text-xs"
              value={dueLocal}
              onChange={(e) => setDueLocal(e.target.value)}
              disabled={closed || busy !== null}
            />
          </label>
          <label className="mt-2 block text-[11px] font-medium text-zinc-500">
            Rationale (markdown)
            <textarea
              className="ui-input-compact mt-1 min-h-[64px] w-full text-xs"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              disabled={closed || busy !== null}
            />
          </label>
          <label className="mt-2 block text-[11px] font-medium text-zinc-500">
            Required inputs (JSON object)
            <textarea
              className="ui-input-compact mt-1 min-h-[56px] w-full font-mono text-[11px]"
              value={requiredJson}
              onChange={(e) => setRequiredJson(e.target.value)}
              disabled={closed || busy !== null}
            />
          </label>
          <label className="mt-2 block text-[11px] font-medium text-zinc-500">
            Approval path (JSON array)
            <textarea
              className="ui-input-compact mt-1 min-h-[56px] w-full font-mono text-[11px]"
              value={approvalJson}
              onChange={(e) => setApprovalJson(e.target.value)}
              disabled={closed || busy !== null}
            />
          </label>
          <button
            type="button"
            className="ui-btn-secondary mt-2 px-3 py-2 text-xs"
            disabled={closed || busy !== null}
            onClick={() =>
              run("patch", () => {
                let requiredInputs: Record<string, unknown> = {};
                let approvalPath: unknown[] = [];
                try {
                  requiredInputs = JSON.parse(requiredJson) as Record<string, unknown>;
                  if (typeof requiredInputs !== "object" || requiredInputs === null) {
                    throw new Error("required inputs must be a JSON object");
                  }
                } catch {
                  throw new Error("Invalid JSON for required inputs");
                }
                try {
                  const ap = JSON.parse(approvalJson);
                  if (!Array.isArray(ap)) throw new Error("approval path must be a JSON array");
                  approvalPath = ap;
                } catch (e) {
                  throw e instanceof Error ? e : new Error("Invalid JSON for approval path");
                }
                return patchJson(`/api/decisions/${decisionId}`, {
                  decisionType,
                  ownerUserId: ownerId.trim() || null,
                  dueAt: dueForApi,
                  rationaleMarkdown: rationale,
                  requiredInputs,
                  approvalPath,
                });
              })
            }
          >
            {busy === "patch" ? "Saving…" : "Save workspace details"}
          </button>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="ui-btn-ghost px-2 py-1.5 text-[11px]"
              disabled={closed || busy !== null || status === "in_review"}
              onClick={() => run("review", () => patchJson(`/api/decisions/${decisionId}`, { status: "in_review" }))}
            >
              Move to in review
            </button>
            <button
              type="button"
              className="ui-btn-ghost px-2 py-1.5 text-[11px]"
              disabled={closed || busy !== null || status === "open"}
              onClick={() => run("open", () => patchJson(`/api/decisions/${decisionId}`, { status: "open" }))}
            >
              Set to open
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-zinc-600">Add recommendation</p>
          <textarea
            className="ui-input-compact mt-2 min-h-[72px] w-full"
            placeholder="Recommendation text (required)"
            value={recText}
            onChange={(e) => setRecText(e.target.value)}
            disabled={closed || busy !== null}
          />
          <button
            type="button"
            className="ui-btn-secondary mt-2 px-3 py-2 text-xs"
            disabled={closed || busy !== null || !recText.trim()}
            onClick={() =>
              run("rec", () =>
                postJson(`/api/decisions/${decisionId}/recommend`, {
                  recommendationText: recText.trim(),
                  reasons: [{ signal: "manual", value: "user_entered" }],
                  sourceObjectRefs: [{ type: "decision_workspace", id: decisionId }],
                }).then(() => {
                  setRecText("");
                })
              )
            }
          >
            {busy === "rec" ? "Saving…" : "Save recommendation"}
          </button>
        </div>

        <div className="border-t border-zinc-100 pt-4">
          <p className="text-xs font-semibold text-zinc-600">Add stakeholder (user id)</p>
          <input
            className="ui-input-compact mt-2 w-full"
            placeholder="UUID of workspace member"
            value={stakeholderId}
            onChange={(e) => setStakeholderId(e.target.value)}
            disabled={closed || busy !== null}
          />
          <button
            type="button"
            className="ui-btn-secondary mt-2 px-3 py-2 text-xs"
            disabled={closed || busy !== null || !stakeholderId.trim()}
            onClick={() =>
              run("stake", () =>
                postJson(`/api/decisions/${decisionId}/stakeholders`, {
                  stakeholderUserId: stakeholderId.trim(),
                  stakeholderRole: "reviewer",
                }).then(() => {
                  setStakeholderId("");
                })
              )
            }
          >
            {busy === "stake" ? "Adding…" : "Add stakeholder"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
          <button
            type="button"
            className="ui-btn-secondary px-3 py-2 text-xs"
            disabled={
              closed || busy !== null || status === "approved" || !["open", "in_review"].includes(status)
            }
            onClick={() =>
              run("approve", () =>
                postJson(`/api/decisions/${decisionId}/approve`, { note: "Approved via workspace panel" })
              )
            }
          >
            {busy === "approve" ? "…" : "Mark approved"}
          </button>
          <button
            type="button"
            className="ui-btn-secondary px-3 py-2 text-xs"
            disabled={closed || busy !== null}
            onClick={() =>
              run("close", () =>
                postJson(`/api/decisions/${decisionId}/close`, {
                  finalDisposition: { outcome: "closed_via_ui" },
                  postActions: [],
                })
              )
            }
          >
            {busy === "close" ? "…" : "Close decision"}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              <span className="whitespace-nowrap">Packet type</span>
              <select
                className="rounded-lg border border-zinc-200 bg-surface px-2 py-1.5 text-zinc-800"
                value={exportPacketType}
                disabled={closed || busy !== null}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isValidPacketType(v)) setExportPacketType(v);
                }}
              >
                {PACKET_TYPES.map((pt) => (
                  <option key={pt} value={pt}>
                    {PACKET_TYPE_LABELS[pt]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="ui-btn-secondary px-3 py-2 text-xs"
              disabled={closed || busy !== null}
              onClick={() =>
                run("packet", () =>
                  postJson(`/api/decisions/${decisionId}/packet`, {
                    packetType: exportPacketType,
                  })
                )
              }
            >
              {busy === "packet" ? "…" : "Export decision packet"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
