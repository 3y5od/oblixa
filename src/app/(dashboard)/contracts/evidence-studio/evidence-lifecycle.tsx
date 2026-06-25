import { AlertTriangle, Check } from "lucide-react";
import type { EvidenceRow } from "@/lib/evidence/types";

type LifecycleState = "done" | "current" | "issue" | "next" | "future";

export function fileGapOpen(row: EvidenceRow): boolean {
  return row.requiresFile && row.attachedFilesCount === 0;
}

function lifecycleStages(row: EvidenceRow): { label: string; state: LifecycleState }[] {
  const fileMissing = fileGapOpen(row);
  switch (row.status) {
    case "accepted":
      return [
        { label: "Requested", state: "done" },
        { label: "Received", state: "done" },
        { label: "Accepted", state: "done" },
      ];
    case "received":
      return [
        { label: "Requested", state: "done" },
        { label: "Received", state: "done" },
        { label: "Review", state: "current" },
      ];
    case "rejected":
      return [
        { label: "Requested", state: "done" },
        { label: "Rejected", state: "issue" },
        { label: "Re-request", state: "next" },
      ];
    case "overdue":
      return fileMissing
        ? [
            { label: "Requested", state: "done" },
            { label: "Overdue", state: "issue" },
            { label: "Missing file", state: "issue" },
            { label: "Upload", state: "next" },
          ]
        : [
            { label: "Requested", state: "done" },
            { label: "Overdue", state: "issue" },
            { label: "Remind", state: "next" },
          ];
    case "requested":
    default:
      return [
        { label: "Requested", state: "current" },
        { label: fileMissing ? "Awaiting file" : "Awaiting reply", state: "future" },
        { label: "Review", state: "future" },
      ];
  }
}

function lifecycleInk(state: LifecycleState): string {
  switch (state) {
    case "done":
      return "var(--success-ink)";
    case "issue":
      return "var(--danger-ink)";
    case "current":
    case "next":
      return "var(--accent-strong)";
    default:
      return "color-mix(in oklab, var(--text-tertiary) 78%, transparent)";
  }
}

function activeStageIndex(stages: { state: LifecycleState }[]): number {
  const issue = stages.findIndex((stage) => stage.state === "issue");
  if (issue !== -1) return issue;
  const current = stages.findIndex((stage) => stage.state === "current");
  if (current !== -1) return current;
  const next = stages.findIndex((stage) => stage.state === "next");
  if (next !== -1) return next;
  return Math.max(stages.length - 1, 0);
}

function stageStatusWord(state: LifecycleState): string {
  switch (state) {
    case "done":
      return "complete";
    case "issue":
      return "at risk";
    case "current":
      return "in progress";
    case "next":
      return "next step";
    default:
      return "not started";
  }
}

export function EvidenceLifecycle({ row }: { row: EvidenceRow }) {
  const stages = lifecycleStages(row);
  const active = activeStageIndex(stages);
  const overall = `Evidence lifecycle: stage ${active + 1} of ${stages.length}, ${stages[active]?.label ?? ""}`;
  return (
    <ol className="flex min-w-0 items-start gap-0" aria-label={overall}>
      {stages.map((stage, index) => {
        const ink = lifecycleInk(stage.state);
        const filled = stage.state === "done" || stage.state === "issue";
        const isFirst = index === 0;
        const connectorReached = stage.state === "done" || stage.state === "issue" || stage.state === "current";
        const connectorInk = connectorReached
          ? ink
          : "color-mix(in oklab, var(--border-strong) 60%, transparent)";
        return (
          <li
            key={stage.label}
            className="flex min-w-0 flex-1 flex-col items-center"
            aria-label={`${stage.label} - ${stageStatusWord(stage.state)}`}
          >
            <div className="flex w-full items-center" aria-hidden>
              <span className="h-[1.5px] flex-1" style={{ background: isFirst ? "transparent" : connectorInk }} />
              <span
                className="relative inline-flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full"
                style={{
                  background: filled ? ink : "var(--surface-raised)",
                  border: `1.5px solid ${ink}`,
                  boxShadow:
                    stage.state === "current"
                      ? `0 0 0 3px color-mix(in oklab, ${ink} 18%, transparent)`
                      : "none",
                }}
              >
                {stage.state === "done" ? (
                  <Check className="h-2 w-2 text-[var(--surface-raised)]" strokeWidth={3.25} aria-hidden />
                ) : stage.state === "issue" ? (
                  <AlertTriangle className="h-2 w-2 text-[var(--surface-raised)]" strokeWidth={3} aria-hidden />
                ) : stage.state === "current" ? (
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: ink }} />
                ) : null}
              </span>
              <span
                className="h-[1.5px] flex-1"
                style={{
                  background:
                    index === stages.length - 1
                      ? "transparent"
                      : stages[index + 1]?.state === "done" ||
                          stages[index + 1]?.state === "issue" ||
                          stages[index + 1]?.state === "current"
                        ? lifecycleInk(stages[index + 1]!.state)
                        : "color-mix(in oklab, var(--border-strong) 60%, transparent)",
                }}
              />
            </div>
            <span
              className="mt-1 max-w-full truncate px-1 text-center text-[10.5px] leading-tight"
              style={{
                color: stage.state === "future" ? "var(--text-tertiary)" : ink,
                fontWeight: index === active ? 600 : 500,
              }}
            >
              {stage.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
