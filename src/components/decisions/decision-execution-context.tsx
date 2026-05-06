import Link from "next/link";
import { ApiJsonLink } from "@/components/ui/api-json-link";
import type { DecisionExecutionContext } from "@/lib/v5/decision-context";

type Props = {
  decisionId: string;
  context: DecisionExecutionContext;
};

export function DecisionExecutionContextCard({ decisionId, context }: Props) {
  const { counts, truncated, linkedContractIdsUsed } = context;

  return (
    <section className="ui-card p-5">
      <p className="ui-eyebrow">Context</p>
      <h2 className="ui-section-title mt-1 text-base">Linked execution context</h2>
      <p className="ui-muted-tight mt-1">
        Active work across linked contracts (up to {linkedContractIdsUsed.length} shown
        {truncated ? "; list truncated to cap" : ""}).
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 md:grid-cols-6">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] px-3 py-2 text-center">
          <p className="text-lg font-semibold text-[var(--text-primary)]">{counts.openTasks}</p>
          <p className="text-[11px] text-[var(--text-tertiary)]">Active tasks</p>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] px-3 py-2 text-center">
          <p className="text-lg font-semibold text-[var(--text-primary)]">{counts.pendingApprovals}</p>
          <p className="text-[11px] text-[var(--text-tertiary)]">Pending approvals</p>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] px-3 py-2 text-center">
          <p className="text-lg font-semibold text-[var(--text-primary)]">{counts.openObligations}</p>
          <p className="text-[11px] text-[var(--text-tertiary)]">Active obligations</p>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] px-3 py-2 text-center">
          <p className="text-lg font-semibold text-[var(--text-primary)]">{counts.openExceptions}</p>
          <p className="text-[11px] text-[var(--text-tertiary)]">Active exceptions</p>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] px-3 py-2 text-center">
          <p className="text-lg font-semibold text-[var(--text-primary)]">{counts.requiredEvidence}</p>
          <p className="text-[11px] text-[var(--text-tertiary)]">Evidence required</p>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] px-3 py-2 text-center">
          <p className="text-lg font-semibold text-[var(--text-primary)]">{counts.openAttestations}</p>
          <p className="text-[11px] text-[var(--text-tertiary)]">Pending attestations</p>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <ContextList
          title="Tasks"
          empty="No open tasks on linked contracts."
          rows={context.tasks.map((t) => ({
            id: t.id,
            contractId: t.contract_id,
            line1: (t.title ?? "").trim() || "Task",
            line2: `${t.status}${t.due_date ? ` · due ${t.due_date}` : ""}`,
          }))}
        />
        <ContextList
          title="Approvals"
          empty="No pending approvals."
          rows={context.approvals.map((a) => ({
            id: a.id,
            contractId: a.contract_id,
            line1: a.approval_type.replace(/_/g, " "),
            line2: a.notes?.slice(0, 80) || a.status,
          }))}
        />
        <ContextList
          title="Obligations"
          empty="No open obligations."
          rows={context.obligations.map((o) => ({
            id: o.id,
            contractId: o.contract_id,
            line1: (o.title ?? "").trim() || "Obligation",
            line2: `${o.status}${o.due_date ? ` · due ${o.due_date}` : ""}`,
          }))}
        />
        <ContextList
          title="Exceptions"
          empty="No open exceptions."
          rows={context.exceptions.map((x) => ({
            id: x.id,
            contractId: x.contract_id ?? "",
            line1: (x.title ?? "").trim() || "Exception",
            line2: x.status,
          }))}
        />
        <ContextList
          title="Evidence requirements"
          empty="No unsatisfied evidence requirements."
          rows={context.evidenceRequirements.map((e) => ({
            id: e.id,
            contractId: e.contract_id ?? "",
            line1: (e.title ?? "").trim() || "Evidence requirement",
            line2: e.status,
          }))}
        />
        <ContextList
          title="Attestations"
          empty="No open attestation requests."
          rows={context.attestations.map((a) => ({
            id: a.id,
            contractId: a.contract_id ?? "",
            line1: (a.title ?? "").trim() || "Attestation",
            line2: `${a.status}${a.due_at ? ` · due ${a.due_at.slice(0, 10)}` : ""}`,
          }))}
        />
      </div>

      <p className="mt-4 text-xs text-[var(--text-tertiary)]">
        <ApiJsonLink href={`/api/decisions/${decisionId}/context`} className="ui-link font-mono text-[11px]">
          GET /api/decisions/…/context (JSON)
        </ApiJsonLink>
      </p>
    </section>
  );
}

function ContextList(props: {
  title: string;
  empty: string;
  rows: { id: string; contractId: string; line1: string; line2: string }[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-[var(--text-secondary)]">{props.title}</p>
      {props.rows.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">{props.empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--border-subtle)] text-sm">
          {props.rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
              <div>
                <p className="font-medium text-[var(--text-primary)]">{r.line1}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{r.line2}</p>
              </div>
              {r.contractId ? (
                <Link href={`/contracts/${r.contractId}`} className="ui-link shrink-0 text-xs">
                  Contract
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
