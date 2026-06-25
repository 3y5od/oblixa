import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  MessageSquareText,
  Paperclip,
  XCircle,
} from "lucide-react";
import type { EvidenceRow } from "@/lib/evidence/types";
import { fileGapOpen } from "./evidence-lifecycle";

export { EvidenceLifecycle, fileGapOpen } from "./evidence-lifecycle";

export function StatusIcon({ status }: { status: EvidenceRow["status"] }) {
  const cls = "h-3 w-3 shrink-0";
  switch (status) {
    case "overdue":
      return <AlertTriangle className={cls} strokeWidth={2} aria-hidden />;
    case "accepted":
      return <CheckCircle2 className={cls} strokeWidth={2} aria-hidden />;
    case "rejected":
      return <XCircle className={cls} strokeWidth={2} aria-hidden />;
    case "received":
      return <Inbox className={cls} strokeWidth={2} aria-hidden />;
    case "requested":
    default:
      return <Clock className={cls} strokeWidth={2} aria-hidden />;
  }
}

export function FilesChip({ count, attention = false }: { count: number; attention?: boolean }) {
  if (count === 0 && !attention) {
    // Routine "no file yet" is quiet inline text, not a chip — chips are reserved
    // for the critical missing-file state (attention) below (§16 chip discipline).
    return (
      <span
        className="inline-flex items-center gap-1 text-[11.5px] leading-snug text-[var(--text-tertiary)]"
        aria-label="No file uploaded"
      >
        <Paperclip className="h-3 w-3 shrink-0" strokeWidth={1.65} aria-hidden />
        <span>No file uploaded</span>
      </span>
    );
  }
  if (attention) {
    // Critical state keeps a filled chip — "Missing file" in sentence case, oxblood.
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-0.5 text-[11px] font-semibold leading-none"
        style={{
          borderColor: "color-mix(in oklab, var(--danger-ink) 42%, var(--border-card))",
          background: "color-mix(in oklab, var(--danger-soft) 30%, var(--surface-raised))",
          color: "var(--danger-ink)",
        }}
        aria-label="No file attached - request is overdue"
      >
        <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
        <span>Missing file</span>
      </span>
    );
  }
  // A present, attached file count reads as quiet confirmed inline text — the
  // record materiality is in the lifecycle rail, not a second blue chip.
  return (
    <span
      className="inline-flex items-center gap-1 text-[11.5px] leading-snug text-[var(--text-secondary)]"
      aria-label={`${count} ${count === 1 ? "file" : "files"} attached`}
    >
      <Paperclip className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
      <span className="tabular-nums">{count}</span>
      <span>{count === 1 ? "file attached" : "files attached"}</span>
    </span>
  );
}

/**
 * The Status-column file affordance, now that the lifecycle rail carries the
 * Overdue / Missing-file stages as nodes. To avoid a second redundant alarm chip
 * in the same row (§16 — reserve chips for CRITICAL states), the missing-file gap
 * is shown as quiet inline text here when the rail already flags it; only a real
 * attached-file count keeps its quiet line. Non-file requests keep their "Response
 * required" affordance, since the rail never names it.
 *
 * `lifecycleCoversFileState` is true when this row's lifecycle rail renders an
 * issue node that already says "Missing file" — the desktop request cell passes
 * it so the demotion only happens where the rail is visible.
 */
export function EvidenceFileState({
  row,
  lifecycleCoversFileState = false,
}: {
  row: EvidenceRow;
  lifecycleCoversFileState?: boolean;
}) {
  if (row.requiresFile) {
    const missing = row.attachedFilesCount === 0;
    if (missing) {
      // The rail already inks a "Missing file" node; here it's quiet text, not a
      // second filled chip. Where the rail is absent (an on-track request), the
      // toned chip still carries the gap.
      if (lifecycleCoversFileState) {
        return (
          <span className="inline-flex items-center gap-1 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
            <Paperclip className="h-3 w-3 shrink-0" strokeWidth={1.65} aria-hidden />
            <span>No file uploaded</span>
          </span>
        );
      }
      return <FilesChip count={0} attention={row.status === "overdue"} />;
    }
    return <FilesChip count={row.attachedFilesCount} />;
  }
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <ResponseModeChip />
      {row.attachedFilesCount > 0 ? <FilesChip count={row.attachedFilesCount} /> : null}
    </span>
  );
}

function ResponseModeChip() {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] leading-snug text-[var(--text-secondary)]"
      aria-label="Response required - this request asks for a written response, not a file"
    >
      <MessageSquareText className="h-3 w-3 shrink-0" strokeWidth={1.65} aria-hidden />
      <span>Response required</span>
    </span>
  );
}

export function dueDescriptor(dueInDays: number | null, status: EvidenceRow["status"]): string | null {
  if (dueInDays == null) return null;
  if (status === "overdue") return `Overdue ${Math.abs(dueInDays)}d`;
  if (dueInDays < 0) return null;
  if (dueInDays === 0) return "Due today";
  if (dueInDays === 1) return "Due tomorrow";
  if (dueInDays <= 60) return `In ${dueInDays}d`;
  return null;
}

export type EvidenceConsequence = {
  /** The operational stake, stated as what is at risk or true right now. */
  label: string;
  tone: "danger" | "warning" | "neutral" | "success";
} | null;

/**
 * The operational consequence of a request's current state — what staying in this
 * state costs the workspace — so the record answers "why does this matter?" beside
 * the action, not just "what is it?" (§4 comprehension #5; §18.5 status copy
 * answers what-is-true and what-is-needed). Overdue evidence keeps the linked
 * contract requirement OPEN; that is the headline stake the product owner asked to
 * surface. Returns null for terminal/calm rows that carry no live consequence.
 */
export function evidenceConsequence(row: EvidenceRow): EvidenceConsequence {
  const hasRequirement = Boolean(row.linkedObligationId);
  // The requirement this proof closes, named where known so the stake reads
  // against a real object rather than a generic noun.
  const target = hasRequirement ? `"${row.linkedObligationTitle}"` : "the linked requirement";
  // Overdue is the headline stake and always carries a consequence — overdue
  // proof keeps the requirement (or the request) open.
  if (row.status === "overdue") {
    const subject = hasRequirement ? target : "the request";
    return fileGapOpen(row)
      ? { label: `No proof on file - keeps ${subject} open.`, tone: "danger" }
      : { label: `Past due - keeps ${subject} open.`, tone: "danger" };
  }
  if (row.status === "rejected") {
    return {
      label: hasRequirement
        ? `Rejected - ${target} stays open until a corrected submission is accepted.`
        : "Rejected - a corrected submission is needed before this can close.",
      tone: "warning",
    };
  }
  if (row.status === "received") {
    return {
      label: hasRequirement ? `Submitted - accept or reject to close ${target}.` : "Submitted - accept or reject to close it.",
      tone: "warning",
    };
  }
  // Calm states (requested-on-track, accepted) only carry a consequence line when
  // a requirement is actually linked - otherwise the lifecycle + status already
  // say enough, and a generic line would just add noise (§16 color discipline).
  if (!hasRequirement) return null;
  if (row.status === "requested" && fileGapOpen(row)) {
    return { label: `Awaiting proof to close ${target}.`, tone: "neutral" };
  }
  if (row.status === "accepted") {
    return { label: `Accepted - ${target} is satisfied.`, tone: "success" };
  }
  return null;
}

export function consequenceInk(tone: NonNullable<EvidenceConsequence>["tone"]): string {
  switch (tone) {
    case "danger":
      return "var(--danger-ink)";
    case "warning":
      return "var(--warning-ink)";
    case "success":
      return "var(--success-ink)";
    default:
      return "var(--text-secondary)";
  }
}
