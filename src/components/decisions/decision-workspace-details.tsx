"use client";

import { useMemo, useState } from "react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { UiSelect } from "@/components/ui/ui-select";
import {
  DECISION_TYPES,
  DECISION_TYPE_LABELS,
  type DecisionType,
} from "@/lib/decision-intelligence/decision-types";

type DecisionWorkspaceDetailsProps = {
  initialDecisionType: string;
  status: string;
  ownerUserId: string | null;
  dueAt: string | null;
  rationaleMarkdown: string | null;
  requiredInputsJson: unknown;
  approvalPathJson: unknown;
  closed: boolean;
  busy: string | null;
  onRun: (key: string, fn: () => Promise<unknown>) => Promise<void>;
  onPatchDecision: (body: Record<string, unknown>) => Promise<unknown>;
};

function parseRequiredInputs(json: string): Record<string, unknown> {
  try {
    const requiredInputs = JSON.parse(json) as Record<string, unknown>;
    if (typeof requiredInputs !== "object" || requiredInputs === null) {
      throw new Error("required inputs must be a JSON object");
    }
    return requiredInputs;
  } catch {
    throw new Error("Invalid JSON for required inputs");
  }
}

function parseApprovalPath(json: string): unknown[] {
  try {
    const approvalPath = JSON.parse(json);
    if (!Array.isArray(approvalPath)) throw new Error("approval path must be a JSON array");
    return approvalPath;
  } catch (e) {
    throw e instanceof Error ? e : new Error("Invalid JSON for approval path");
  }
}

function normalizeDecisionType(decisionType: string): DecisionType {
  return DECISION_TYPES.includes(decisionType as DecisionType)
    ? (decisionType as DecisionType)
    : "renewal";
}

export function DecisionWorkspaceDetails({
  initialDecisionType,
  status,
  ownerUserId,
  dueAt,
  rationaleMarkdown,
  requiredInputsJson,
  approvalPathJson,
  closed,
  busy,
  onRun,
  onPatchDecision,
}: DecisionWorkspaceDetailsProps) {
  const [decisionType, setDecisionType] = useState(() => normalizeDecisionType(initialDecisionType));
  const [ownerId, setOwnerId] = useState(ownerUserId ?? "");
  const [dueLocal, setDueLocal] = useState(() => (dueAt ? dueAt.slice(0, 16) : ""));
  const [rationale, setRationale] = useState(rationaleMarkdown ?? "");
  const [requiredJson, setRequiredJson] = useState(() =>
    JSON.stringify(requiredInputsJson && typeof requiredInputsJson === "object" ? requiredInputsJson : {}, null, 2)
  );
  const [approvalJson, setApprovalJson] = useState(() =>
    JSON.stringify(Array.isArray(approvalPathJson) ? approvalPathJson : [], null, 2)
  );

  const dueForApi = useMemo(() => {
    if (!dueLocal.trim()) return null;
    const d = new Date(dueLocal);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }, [dueLocal]);

  return (
    <div className="border-b border-[var(--border-subtle)] pb-4">
      <p className="text-xs font-semibold text-[var(--text-secondary)]">Workspace details</p>
      <label className="mt-2 block text-[11px] font-medium text-[var(--text-tertiary)]">
        Decision type
        <UiSelect
          value={decisionType}
          onChange={(v) => setDecisionType(v as DecisionType)}
          disabled={closed || busy !== null}
          ariaLabel="Decision type"
          options={DECISION_TYPES.map((t) => ({ value: t, label: DECISION_TYPE_LABELS[t] }))}
          variant="compact"
          portal
          searchThreshold={8}
          className="mt-1 w-full"
          buttonClassName="w-full text-xs"
        />
      </label>
      <label className="mt-2 block text-[11px] font-medium text-[var(--text-tertiary)]">
        Owner user id
        <input
          className="ui-input-compact mt-1 w-full font-mono text-xs"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          disabled={closed || busy !== null}
        />
      </label>
      <label className="mt-2 block text-[11px] font-medium text-[var(--text-tertiary)]">
        Due date
        <input
          type="datetime-local"
          className="ui-input-compact mt-1 w-full text-xs"
          value={dueLocal}
          onChange={(e) => setDueLocal(e.target.value)}
          disabled={closed || busy !== null}
        />
      </label>
      <label className="mt-2 block text-[11px] font-medium text-[var(--text-tertiary)]">
        Rationale (markdown)
        <textarea
          className="ui-input-compact mt-1 min-h-[64px] w-full text-xs"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          disabled={closed || busy !== null}
        />
      </label>
      <label className="mt-2 block text-[11px] font-medium text-[var(--text-tertiary)]">
        Required inputs (JSON object)
        <textarea
          className="ui-input-compact mt-1 min-h-[56px] w-full font-mono text-[11px]"
          value={requiredJson}
          onChange={(e) => setRequiredJson(e.target.value)}
          disabled={closed || busy !== null}
        />
      </label>
      <label className="mt-2 block text-[11px] font-medium text-[var(--text-tertiary)]">
        Approval path (JSON array)
        <textarea
          className="ui-input-compact mt-1 min-h-[56px] w-full font-mono text-[11px]"
          value={approvalJson}
          onChange={(e) => setApprovalJson(e.target.value)}
          disabled={closed || busy !== null}
        />
      </label>
      <AsyncActionButton
        type="button"
        className="ui-btn-secondary mt-2 px-3 py-2 text-xs"
        disabled={closed || busy !== null}
        pending={busy === "patch"}
        pendingLabel="Saving..."
        onClick={() =>
          onRun("patch", () =>
            onPatchDecision({
              decisionType,
              ownerUserId: ownerId.trim() || null,
              dueAt: dueForApi,
              rationaleMarkdown: rationale,
              requiredInputs: parseRequiredInputs(requiredJson),
              approvalPath: parseApprovalPath(approvalJson),
            })
          )
        }
      >
        Save workspace details
      </AsyncActionButton>
      <div className="mt-2 flex flex-wrap gap-2">
        <AsyncActionButton
          type="button"
          className="ui-btn-ghost px-2 py-1.5 text-[11px]"
          disabled={closed || busy !== null || status === "in_review"}
          pending={busy === "review"}
          pendingLabel="Saving..."
          onClick={() => onRun("review", () => onPatchDecision({ status: "in_review" }))}
        >
          Move to in review
        </AsyncActionButton>
        <AsyncActionButton
          type="button"
          className="ui-btn-ghost px-2 py-1.5 text-[11px]"
          disabled={closed || busy !== null || status === "open"}
          pending={busy === "open"}
          pendingLabel="Saving..."
          onClick={() => onRun("open", () => onPatchDecision({ status: "open" }))}
        >
          Set to open
        </AsyncActionButton>
      </div>
    </div>
  );
}
