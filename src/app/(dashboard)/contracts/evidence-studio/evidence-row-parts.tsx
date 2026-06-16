import { AlertTriangle, CheckCircle2, Clock, Inbox, MessageSquareText, Paperclip, XCircle } from "lucide-react";
import type { EvidenceRow } from "@/lib/evidence/types";

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
    return (
      <span
        className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none text-[color:color-mix(in_oklab,var(--text-tertiary)_78%,transparent)]"
        aria-label="No file uploaded"
      >
        <Paperclip className="h-3 w-3 shrink-0" strokeWidth={1.65} aria-hidden />
        <span>No file uploaded</span>
      </span>
    );
  }
  const ink = attention ? "var(--warning-ink)" : "var(--accent-strong)";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[4px] border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none"
      style={{
        borderColor: `color-mix(in oklab, ${ink} ${attention ? "44%" : "30%"}, var(--border-card))`,
        background: `color-mix(in oklab, ${ink} ${attention ? "16%" : "10%"}, var(--surface-raised))`,
        color: ink,
      }}
      aria-label={
        attention
          ? "No files attached - request is overdue"
          : `${count} ${count === 1 ? "file" : "files"} attached`
      }
    >
      {attention ? (
        <>
          <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
          <span>missing</span>
        </>
      ) : (
        <>
          <Paperclip className="h-3 w-3 shrink-0" strokeWidth={1.85} aria-hidden />
          <span className="tabular-nums">{count}</span>
          <span>{count === 1 ? "file" : "files"}</span>
        </>
      )}
    </span>
  );
}

export function EvidenceFileState({ row }: { row: EvidenceRow }) {
  if (row.requiresFile) {
    return (
      <FilesChip
        count={row.attachedFilesCount}
        attention={row.status === "overdue" && row.attachedFilesCount === 0}
      />
    );
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
      className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none text-[color:color-mix(in_oklab,var(--text-tertiary)_82%,transparent)]"
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
