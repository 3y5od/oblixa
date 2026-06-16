"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DecisionWorkspaceDetails } from "@/components/decisions/decision-workspace-details";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { UiSelect } from "@/components/ui/ui-select";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { mutateJson } from "@/lib/http/client-json";
import {
  isValidPacketType,
  PACKET_TYPES,
  PACKET_TYPE_LABELS,
  type PacketType,
} from "@/lib/decision-intelligence/packet-types";

type Props = {
  decisionId: string;
  decisionType: string;
  status: string;
  ownerUserId: string | null;
  dueAt: string | null;
  rationaleMarkdown: string | null;
  requiredInputsJson: unknown;
  approvalPathJson: unknown;
  /** Preselect packet export type (e.g. from /decisions/review "Manager packet" link). */
  initialExportPacketType?: string;
};

async function postJson(url: string, body?: Record<string, unknown>) {
  const result = await mutateJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!result.ok) throw new Error(result.message || "Request failed");
  return result.data;
}

async function patchJson(url: string, body: Record<string, unknown>) {
  const result = await mutateJson(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!result.ok) throw new Error(result.message || "Request failed");
  return result.data;
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
  const [recText, setRecText] = useState("");
  const [stakeholderId, setStakeholderId] = useState("");
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
      <InlineMutationStatus message={error} variant="error" className="mt-2 text-sm" />

      <div className="mt-4 space-y-4">
        <DecisionWorkspaceDetails
          initialDecisionType={initialDecisionType}
          status={status}
          ownerUserId={ownerUserId}
          dueAt={dueAt}
          rationaleMarkdown={rationaleMarkdown}
          requiredInputsJson={requiredInputsJson}
          approvalPathJson={approvalPathJson}
          closed={closed}
          busy={busy}
          onRun={run}
          onPatchDecision={(body) => patchJson(`/api/decisions/${decisionId}`, body)}
        />

        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)]">Add recommendation</p>
          <textarea
            className="ui-input-compact mt-2 min-h-[72px] w-full"
            placeholder="Recommendation text (required)"
            value={recText}
            onChange={(e) => setRecText(e.target.value)}
            disabled={closed || busy !== null}
          />
          <AsyncActionButton
            type="button"
            className="ui-btn-secondary mt-2 px-3 py-2 text-xs"
            disabled={closed || busy !== null || !recText.trim()}
            pending={busy === "rec"}
            pendingLabel="Saving..."
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
            Save recommendation
          </AsyncActionButton>
        </div>

        <div className="border-t border-[var(--border-subtle)] pt-4">
          <p className="text-xs font-semibold text-[var(--text-secondary)]">Add stakeholder (user id)</p>
          <input aria-label="UUID of workspace member" className="ui-input-compact mt-2 w-full"
            placeholder="UUID of workspace member"
            value={stakeholderId}
            onChange={(e) => setStakeholderId(e.target.value)}
            disabled={closed || busy !== null}
          />
          <AsyncActionButton
            type="button"
            className="ui-btn-secondary mt-2 px-3 py-2 text-xs"
            disabled={closed || busy !== null || !stakeholderId.trim()}
            pending={busy === "stake"}
            pendingLabel="Adding..."
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
            Add stakeholder
          </AsyncActionButton>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-4">
          <AsyncActionButton
            type="button"
            className="ui-btn-secondary px-3 py-2 text-xs"
            disabled={
              closed || busy !== null || status === "approved" || !["open", "in_review"].includes(status)
            }
            pending={busy === "approve"}
            pendingLabel="Saving..."
            onClick={() =>
              run("approve", () =>
                postJson(`/api/decisions/${decisionId}/approve`, { note: "Approved via workspace panel" })
              )
            }
          >
            Mark approved
          </AsyncActionButton>
          <ConfirmActionButton
            type="button"
            className="ui-btn-secondary px-3 py-2 text-xs"
            disabled={closed || busy !== null}
            pending={busy === "close"}
            pendingLabel="Closing..."
            confirmMessage="Close this decision?"
            onConfirm={() =>
              run("close", () =>
                postJson(`/api/decisions/${decisionId}/close`, {
                  finalDisposition: { outcome: "closed_via_ui" },
                  postActions: [],
                })
              )
            }
          >
            Close decision
          </ConfirmActionButton>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span className="whitespace-nowrap">Packet type</span>
              <UiSelect
                value={exportPacketType}
                disabled={closed || busy !== null}
                onChange={(v) => {
                  if (isValidPacketType(v)) setExportPacketType(v);
                }}
                ariaLabel="Packet type"
                options={PACKET_TYPES.map((pt) => ({ value: pt, label: PACKET_TYPE_LABELS[pt] }))}
                variant="compact"
                portal
                searchThreshold={8}
                buttonClassName="text-xs"
              />
            </label>
            <AsyncActionButton
              type="button"
              className="ui-btn-secondary px-3 py-2 text-xs"
              disabled={closed || busy !== null}
              pending={busy === "packet"}
              pendingLabel="Exporting..."
              onClick={() =>
                run("packet", () =>
                  postJson(`/api/decisions/${decisionId}/packet`, {
                    packetType: exportPacketType,
                  })
                )
              }
            >
              Export decision packet
            </AsyncActionButton>
          </div>
        </div>
      </div>
    </section>
  );
}
