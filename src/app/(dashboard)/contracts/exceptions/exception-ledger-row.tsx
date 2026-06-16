import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertOctagon, ChevronRight } from "lucide-react";
import { ExceptionMutationPanels } from "@/components/contracts/exception-mutation-panels";
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
import { StatusPill } from "@/components/ui/status-pill";
import {
  displayEnumValue,
  displayExceptionEvent,
  EXCEPTION_TYPE_DISPLAY,
  SEVERITY_DISPLAY,
  severityMedallionClass,
  severityTone,
  STATUS_DISPLAY,
  statusTone,
} from "@/app/(dashboard)/contracts/exceptions/exceptions-page-config";
import type {
  ExceptionEvent,
  ExceptionRow,
  OwnerOption,
  ResolutionActionOptions,
} from "@/app/(dashboard)/contracts/exceptions/exceptions-page-types";

export function ExceptionLedgerRow({
  canEdit,
  contractTitle,
  events,
  item,
  ownerLabelById,
  ownerOptions,
  resolutionActionOptions,
  todayIso,
}: {
  canEdit: boolean;
  contractTitle: string | null;
  events: ExceptionEvent[];
  item: ExceptionRow;
  ownerLabelById: Map<string, string>;
  ownerOptions: OwnerOption[];
  resolutionActionOptions: ResolutionActionOptions;
  todayIso: string;
}) {
  const ownerLabel = item.owner_id ? ownerLabelById.get(item.owner_id) ?? "Assigned" : "Unassigned";
  const ageLabel = formatDistanceToNowStrict(new Date(item.updated_at), { addSuffix: true });
  const showAssign = canEdit && (item.status === "open" || item.status === "in_progress");
  const showResolve = canEdit && (item.status === "open" || item.status === "in_progress");
  const showReopen = canEdit && (item.status === "resolved" || item.status === "closed");
  const statusLabel = STATUS_DISPLAY[item.status] ?? displayEnumValue(item.status);
  const severityLabel = SEVERITY_DISPLAY[item.severity] ?? displayEnumValue(item.severity);
  const issueLabel = EXCEPTION_TYPE_DISPLAY[item.exception_type] ?? displayEnumValue(item.exception_type);
  const isActive = item.status === "open" || item.status === "in_progress";
  const nextStep = nextStepLabel({ item, isActive, showReopen });
  const dueDateOverdue = Boolean(item.due_date) && String(item.due_date) < todayIso && isActive;

  return (
    <li className="px-5 py-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${severityMedallionClass(item.severity)}`}
            aria-hidden
          >
            <AlertOctagon className="h-4 w-4" strokeWidth={1.85} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
                {issueLabel}
              </h3>
              <StatusPill tone={severityTone(item.severity)}>{severityLabel}</StatusPill>
              <StatusPill tone={statusTone(item.status)}>{statusLabel}</StatusPill>
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
              Cause: {issueLabel}
            </p>
            {item.contract_id && contractTitle ? (
              <ContractLinkBlock contractId={item.contract_id} contractTitle={contractTitle} />
            ) : null}
          </div>
        </div>
        <ExceptionFacts
          ageLabel={ageLabel}
          dueDateOverdue={dueDateOverdue}
          item={item}
          ownerLabel={ownerLabel}
        />
      </div>
      <ExceptionNextAction events={events} nextStep={nextStep} />
      {canEdit ? (
        <div className="mt-4">
          <ExceptionMutationPanels
            exceptionId={item.id}
            ownerId={item.owner_id}
            dueDate={item.due_date}
            ownerOptions={ownerOptions}
            resolutionActionOptions={resolutionActionOptions}
            canAssign={showAssign}
            canResolve={showResolve}
            canReopen={showReopen}
          />
        </div>
      ) : null}
    </li>
  );
}

function nextStepLabel({
  item,
  isActive,
  showReopen,
}: {
  item: ExceptionRow;
  isActive: boolean;
  showReopen: boolean;
}) {
  if (!item.owner_id) return "Needs owner";
  if (isActive && !item.due_date) return "Needs target date";
  if (item.status === "open") return "Ready to start";
  if (item.status === "in_progress") return "Ready to close";
  if (showReopen) return "Can reopen";
  return "Fixed";
}

function ContractLinkBlock({
  contractId,
  contractTitle,
}: {
  contractId: string;
  contractTitle: string;
}) {
  return (
    <div className="mt-2">
      <Link href={`/contracts/${contractId}`} className="ui-link inline-flex items-center gap-1 text-[12.5px] font-semibold">
        {contractTitle}
        <ChevronRight className="h-3 w-3 opacity-70" aria-hidden />
      </Link>
      <ContractContinuityLinks
        contractId={contractId}
        omit={["exceptions"]}
        className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[var(--text-tertiary)]"
      />
    </div>
  );
}

function ExceptionFacts({
  ageLabel,
  dueDateOverdue,
  item,
  ownerLabel,
}: {
  ageLabel: string;
  dueDateOverdue: boolean;
  item: ExceptionRow;
  ownerLabel: string;
}) {
  return (
    <dl className="flex shrink-0 flex-wrap items-start gap-x-4 gap-y-1.5 text-[11px] lg:max-w-[20rem] lg:justify-end">
      <div className="inline-flex items-center gap-1.5">
        <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          Owner
        </dt>
        <dd className={`font-medium ${item.owner_id ? "text-[var(--text-secondary)]" : "text-[var(--warning-ink)]"}`}>
          {ownerLabel}
        </dd>
      </div>
      <div className="inline-flex items-center gap-1.5">
        <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          Target
        </dt>
        <dd className={`font-mono ${dueDateOverdue ? "text-[var(--danger-ink)]" : "text-[var(--text-secondary)]"}`}>
          {item.due_date ?? "Not set"}
        </dd>
      </div>
      <div className="inline-flex items-center gap-1.5">
        <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          Updated
        </dt>
        <dd className="font-medium text-[var(--text-secondary)]">{ageLabel}</dd>
      </div>
    </dl>
  );
}

function ExceptionNextAction({ events, nextStep }: { events: ExceptionEvent[]; nextStep: string }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3">
      <p className="inline-flex items-center gap-1.5 text-[12.5px]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          Next action
        </span>
        <span className="font-semibold text-[var(--text-primary)]">{nextStep}</span>
      </p>
      <EventSummary events={events} />
    </div>
  );
}

function EventSummary({ events }: { events: ExceptionEvent[] }) {
  const eventGroups = new Map<string, { label: string; count: number; latest: string }>();
  for (const evt of events) {
    const label = displayExceptionEvent(evt.event_type);
    const existing = eventGroups.get(evt.event_type);
    if (existing) {
      existing.count += 1;
    } else {
      eventGroups.set(evt.event_type, { label, count: 1, latest: evt.created_at });
    }
  }
  const eventSummary = Array.from(eventGroups.values()).slice(0, 3);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {eventSummary.length > 0 ? (
        eventSummary.map((evt) => (
          <span
            key={evt.label}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,var(--surface-raised))] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
          >
            <span className="font-semibold text-[var(--text-primary)]">{evt.label}</span>
            <span className="font-mono text-[var(--text-tertiary)]">
              {evt.count}× {new Date(evt.latest).toLocaleDateString()}
            </span>
          </span>
        ))
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--border-subtle)] px-2 py-0.5 text-[11px] text-[var(--text-tertiary)]">
          No movement yet
        </span>
      )}
    </div>
  );
}
