import Link from "next/link";
import { createElement } from "react";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMonthDay } from "@/lib/ui-copy";
import type { CoreDashboardWorkRow } from "@/lib/dashboard/core-dashboard-model";
import { EMAIL_RE } from "./core-dashboard-data-flags";
import {
  sanitizeWorkTitle,
  statusForWork,
  workStatusInk,
  workStatusLabel,
  workTypeIcon,
  workTypeLabel,
} from "./core-dashboard-work-format";

// The contract-specific stake of a task — why it sits in the queue, not just
// what it is. This is the line the release-state product cares about (cannot
// proceed, decision needed, file missing, date held), surfaced above the
// quieter contract/owner metadata.
function workWhy(row: CoreDashboardWorkRow, status: ReturnType<typeof statusForWork>): string {
  if (status === "blocked" || status === "overdue" || row.dueState === "overdue") {
    return "Cannot proceed until a response is provided";
  }
  switch (row.type) {
    case "approval":
      return "Needs a decision before it can move";
    case "evidence_request":
      return "A required file is still missing";
    case "obligation":
      return "A recurring requirement is coming due";
    case "exception":
      return "Holds a date or term until it is resolved";
    case "contract_task":
      return status === "in_review" ? "Detail review is underway" : "Needs attention to move forward";
    default:
      return "Needs attention to move forward";
  }
}

export function WorkRows({ rows }: { rows: CoreDashboardWorkRow[] }) {
  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
      {rows.map((row) => (
        <WorkRow key={row.id} row={row} />
      ))}
    </ul>
  );
}

// Active work-queue row (not a passive table cell): the task title leads as the
// primary link, severity is unmistakable for blocked/problem rows (tone rail +
// faint tint + boxed status), contract + owner recede to a metadata line, the due
// date reads as a pressure chip, and a row action sits at the trailing edge —
// persistent for urgent rows, revealed on hover/focus otherwise (#7/#8).
function WorkRow({ row }: { row: CoreDashboardWorkRow }) {
  const contractSuffix = row.contractTitle ? `: ${row.contractTitle}` : "";
  const strippedTitle =
    contractSuffix && row.title.endsWith(contractSuffix)
      ? row.title.slice(0, -contractSuffix.length)
      : row.title;
  const cleanTitle = sanitizeWorkTitle(strippedTitle);
  const typeLabel = workTypeLabel(row.type);
  const statusLabel = workStatusLabel(row);
  const status = statusForWork(row);
  const ink = workStatusInk(status);
  const isDanger = status === "blocked" || status === "overdue" || row.dueState === "overdue";
  const dueColor =
    row.dueState === "overdue"
      ? "var(--danger-ink)"
      : row.dueState === "due_soon"
        ? "var(--warning-ink)"
        : "var(--text-secondary)";
  const ownerText = row.ownerLabel?.trim() || "";
  const ownerIsEmail = Boolean(ownerText) && EMAIL_RE.test(ownerText);
  const ownerDisplay = ownerText ? (ownerIsEmail ? "Unassigned" : ownerText) : "Unassigned";
  const ariaLabel = `${typeLabel}, ${statusLabel}: ${cleanTitle}${row.contractTitle ? `, ${row.contractTitle}` : ""}`;
  const actionLabel = row.actionLabel?.trim() || "Open";
  const why = workWhy(row, status);

  // Tabular register row: aligned zones — type · title/consequence · contract/owner
  // · due · action — so the queue reads as a precise operational record. Severity
  // rides the rail + chip + title weight + due + action zone, not a row-wide fill.
  return (
    <li
      className={`group relative grid grid-cols-[1rem_minmax(0,1fr)_auto_auto] items-center gap-x-3.5 px-3.5 transition-colors duration-150 hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_8%,transparent)] lg:grid-cols-[1rem_minmax(0,1.55fr)_minmax(0,0.9fr)_4.25rem_7.5rem] lg:gap-x-5 ${isDanger ? "py-2.5" : "py-2"}`}
      style={isDanger ? { boxShadow: `inset 4px 0 0 0 ${ink}` } : undefined}
    >
      {/* 1 — type */}
      <span
        role="img"
        aria-label={typeLabel}
        title={typeLabel}
        className="self-start pt-0.5"
        style={{ color: isDanger ? ink : "var(--text-tertiary)" }}
      >
        {createElement(workTypeIcon(row.type), { className: "h-[1.05rem] w-[1.05rem]", strokeWidth: 1.85 })}
      </span>

      {/* 2 — task summary: title + status, then the consequence */}
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={row.href}
            aria-label={ariaLabel}
            title={cleanTitle}
            className={`min-w-0 truncate rounded-sm leading-[1.3] tracking-tight text-[var(--text-primary)] underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none ${isDanger ? "text-[14.5px] font-extrabold" : "text-[14px] font-semibold"}`}
          >
            {cleanTitle}
          </Link>
          {isDanger ? (
            <StatusBadge status={status}>{statusLabel}</StatusBadge>
          ) : (
            <span
              className="shrink-0 text-[10px] font-bold uppercase tracking-[0.07em]"
              style={{
                color:
                  status === "in_review"
                    ? "var(--text-tertiary)"
                    : status === "healthy"
                      ? "var(--success-ink)"
                      : "var(--warning-ink)",
              }}
            >
              {statusLabel}
            </span>
          )}
        </div>
        <p
          className={`mt-0.5 flex items-center gap-1.5 leading-[1.35] text-[12px] ${isDanger ? "font-semibold" : "font-medium"}`}
          style={{ color: isDanger ? "var(--danger-ink)" : "var(--text-secondary)" }}
        >
          <span aria-hidden className="h-1 w-1 shrink-0 rounded-full" style={{ background: ink }} />
          <span className="truncate">{why}</span>
        </p>
        {/* Contract / owner inline on small; promoted to its own column on lg. */}
        <p className="mt-0.5 truncate text-[11.5px] leading-[1.4] text-[var(--text-tertiary)] lg:hidden">
          {row.contractTitle ? <span className="text-[var(--text-secondary)]">{row.contractTitle}</span> : null}
          {row.contractTitle ? <span aria-hidden className="px-1.5">&middot;</span> : null}
          <span>{ownerDisplay}</span>
        </p>
      </div>

      {/* 3 — contract / owner column (lg) */}
      <div className="hidden min-w-0 self-center lg:block">
        <span className="block truncate text-[12.5px] font-medium leading-tight text-[var(--text-secondary)]">
          {row.contractTitle ?? "—"}
        </span>
        <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-[var(--text-tertiary)]">{ownerDisplay}</span>
      </div>

      {/* 4 — due date: plain tabular text, severity-colored (no chip) */}
      <div className="flex flex-col items-end justify-self-end leading-tight">
        {row.dueAt ? (
          <time className="text-[12px] font-semibold tabular-nums" style={{ color: dueColor }}>
            {formatMonthDay(row.dueAt)}
          </time>
        ) : (
          <span aria-hidden className="text-[11px] text-[var(--text-tertiary)]">No date</span>
        )}
        {row.dueState === "overdue" ? (
          <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--danger-ink)]">Overdue</span>
        ) : null}
      </div>

      {/* 5 — action column: always reserved so it reads as part of the table; the
           blocked row's action is emphasized and divided off. */}
      <div
        className={`flex items-center justify-end justify-self-end ${isDanger ? "self-stretch border-l pl-3.5" : ""}`}
        style={isDanger ? { borderColor: `color-mix(in oklab, ${ink} 24%, transparent)` } : undefined}
      >
        <Link
          href={row.href}
          aria-hidden
          tabIndex={-1}
          className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-[4px] border px-2 py-1 text-[11px] font-semibold leading-none transition-colors duration-150"
          style={
            isDanger
              ? { borderColor: ink, color: "#fff", background: ink }
              : { borderColor: "color-mix(in oklab, var(--border-strong) 55%, var(--border-card))", color: "var(--text-secondary)" }
          }
        >
          {actionLabel}
          <ChevronRight className="h-3 w-3" strokeWidth={2} />
        </Link>
      </div>
    </li>
  );
}
