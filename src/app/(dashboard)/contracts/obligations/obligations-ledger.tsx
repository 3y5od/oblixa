import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, ArrowRight, Compass, ListChecks } from "lucide-react";
import { createObligationClarificationTaskForm } from "@/actions/tasks";
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
import { EmptyState } from "@/components/ui/empty-state";
import { SamplePreviewCard } from "@/components/ui/sample-preview-card";
import { StatusPill } from "@/components/ui/status-pill";
import { formatBusinessDateAtNoon, parseBusinessDateAtNoon } from "@/lib/business-dates";
import {
  statusLabelFor,
  statusToneFor,
} from "@/app/(dashboard)/contracts/obligations/obligations-page-config";
import type { ObligationViewRow } from "@/app/(dashboard)/contracts/obligations/obligations-page-types";

export function ObligationsLedger({
  obligations,
  ownerById,
  nowMs,
}: {
  obligations: ObligationViewRow[];
  ownerById: Map<string, string>;
  nowMs: number;
}) {
  if (obligations.length === 0) return <ObligationsEmptyState />;
  return <ObligationsTable obligations={obligations} ownerById={ownerById} nowMs={nowMs} />;
}

function ObligationsEmptyState() {
  return (
    <section className="ui-card-raised relative overflow-hidden rounded-2xl border p-5 sm:p-6 lg:p-7">
      <div
        aria-hidden
        className="landing-corner-ring"
        style={{ top: "-2.25rem", right: "-2.25rem", width: "7rem", height: "7rem" }}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-8">
        <EmptyState
          eyebrow="Queue status"
          title="No requirements match this queue"
          copy="Adjust the filters above, clear the current queue, or review tasks for other action types."
          icon={<Compass className="h-7 w-7 text-[var(--accent-strong)]" strokeWidth={1.65} aria-hidden />}
          className="lg:items-start lg:text-left"
          action={
            <>
              <Link href="/work" className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px]">
                <ArrowRight className="h-4 w-4" strokeWidth={1.85} aria-hidden />
                Review tasks
              </Link>
              <Link href="/contracts/obligations" className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px]">
                Clear filters
              </Link>
            </>
          }
        />
        <SamplePreviewCard
          eyebrow="Sample requirement"
          title="Renew certificate of insurance"
          meta={["Insurance renewal", "Annual cadence"]}
          status={<StatusPill tone="warning">Open</StatusPill>}
          rows={[
            { label: "Contract", value: "Acme Corp MSA 2025" },
            { label: "Owner", value: "Sarah K." },
            { label: "Due", value: "Mar 15, 2026" },
            { label: "Escalation", value: "Apr 01 · pending" },
          ]}
          footerValue="Confirm renewal with broker"
        />
      </div>
    </section>
  );
}

function ObligationsTable({
  obligations,
  ownerById,
  nowMs,
}: {
  obligations: ObligationViewRow[];
  ownerById: Map<string, string>;
  nowMs: number;
}) {
  return (
    <section className="ui-card min-w-0 max-w-full overflow-hidden p-0">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
            Rows
          </p>
          <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">
            Requirements ledger
          </h2>
          <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            Due state, escalation timing, and the next clarification step - visible without losing contract context.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,transparent)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          <ListChecks className="h-3 w-3" strokeWidth={1.85} aria-hidden />
          {obligations.length} {obligations.length === 1 ? "row" : "rows"}
        </span>
      </header>
      <div className="max-w-full overflow-x-auto [contain:inline-size]">
        <table aria-label="Requirements in this queue" className="min-w-full divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] text-sm">
          <ObligationsTableHead />
          <tbody className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
            {obligations.map((ob) => (
              <ObligationRow key={ob.id} obligation={ob} ownerById={ownerById} nowMs={nowMs} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ObligationsTableHead() {
  const labels = ["Requirement", "Contract", "Owner", "Status", "Due", "Next due", "Escalation", "Updated", "Actions"];
  return (
    <thead>
      <tr className="text-left">
        {labels.map((label) => (
          <th
            key={label}
            className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
          >
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function ObligationRow({
  obligation,
  ownerById,
  nowMs,
}: {
  obligation: ObligationViewRow;
  ownerById: Map<string, string>;
  nowMs: number;
}) {
  const isOverdue =
    Boolean(obligation.dueDate) &&
    (obligation.status === "open" || obligation.status === "in_progress") &&
    (parseBusinessDateAtNoon(obligation.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY) < nowMs;
  return (
    <tr className="align-top">
      <td className="px-5 py-4">
        <p className="font-semibold text-[var(--text-primary)]">{obligation.title}</p>
        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
          {obligation.obligationType}
          {obligation.cadence ? ` · ${obligation.cadence}` : ""}
          {obligation.recurrenceType && obligation.recurrenceType !== "none"
            ? ` · ${obligation.recurrenceType}${
                obligation.recurrenceType === "custom_days" && obligation.recurrenceIntervalDays
                  ? ` (${obligation.recurrenceIntervalDays}d)`
                  : ""
              }`
            : ""}
        </p>
      </td>
      <td className="px-5 py-4">
        <Link href={`/contracts/${obligation.contractId}`} className="ui-link text-[12.5px] font-semibold">
          {obligation.contractTitle}
        </Link>
        <ContractContinuityLinks
          contractId={obligation.contractId}
          omit={["obligations"]}
          className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[var(--text-tertiary)]"
        />
      </td>
      <td className="px-5 py-4 text-[12.5px]">
        {obligation.ownerId ? (
          <span className="text-[var(--text-secondary)]">{ownerById.get(obligation.ownerId) ?? "Member"}</span>
        ) : (
          <span className="font-medium text-[var(--warning-ink)]">Unassigned</span>
        )}
      </td>
      <td className="px-5 py-4">
        <StatusPill tone={statusToneFor(obligation.status)}>{statusLabelFor(obligation.status)}</StatusPill>
      </td>
      <td className="px-5 py-4 font-mono text-[12.5px] tabular-nums">
        {obligation.dueDate ? (
          <span className={isOverdue ? "text-[var(--danger-ink)]" : "text-[var(--text-secondary)]"}>
            {formatBusinessDateAtNoon(obligation.dueDate)}
          </span>
        ) : (
          <span className="text-[var(--text-tertiary)]">—</span>
        )}
      </td>
      <td className="px-5 py-4 font-mono text-[12.5px] tabular-nums text-[var(--text-secondary)]">
        {obligation.nextDueDate ? formatBusinessDateAtNoon(obligation.nextDueDate) : "—"}
      </td>
      <td className="px-5 py-4 font-mono text-[12.5px] tabular-nums text-[var(--text-secondary)]">
        {obligation.escalationDueAt
          ? `${format(new Date(obligation.escalationDueAt), "MMM d, yyyy")} · ${obligation.escalationStatus ?? "pending"}`
          : "—"}
      </td>
      <td className="px-5 py-4 font-mono text-[11px] text-[var(--text-tertiary)]">
        {format(new Date(obligation.updatedAt), "MMM d")}
      </td>
      <td className="px-5 py-4">
        <ClarificationTaskForm obligation={obligation} />
      </td>
    </tr>
  );
}

function ClarificationTaskForm({ obligation }: { obligation: ObligationViewRow }) {
  return (
    <form action={createObligationClarificationTaskForm as never} className="flex flex-col gap-1.5">
      <input type="hidden" name="contractId" value={obligation.contractId} />
      <input type="hidden" name="obligationId" value={obligation.id} />
      <input
        aria-label="Clarification note"
        name="requesterNote"
        placeholder="Clarification note"
        className="ui-input h-7 text-[11px]"
      />
      <button type="submit" className="ui-btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px]">
        <AlertTriangle className="h-3 w-3" strokeWidth={1.85} aria-hidden />
        Clarification task
      </button>
    </form>
  );
}
