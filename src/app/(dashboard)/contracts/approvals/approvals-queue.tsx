import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Compass,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  delegateContractApprovalForm,
  updateContractApprovalStatusForm,
} from "@/actions/approvals";
import { UiSelect } from "@/components/ui/ui-select";
import { EmptyState } from "@/components/ui/empty-state";
import { SamplePreviewCard } from "@/components/ui/sample-preview-card";
import { StatusPill } from "@/components/ui/status-pill";
import {
  approvalStatusTone,
  formatOperatorLabel,
} from "@/app/(dashboard)/contracts/approvals/approvals-page-config";
import type {
  ApprovalRow,
  MemberOption,
} from "@/app/(dashboard)/contracts/approvals/approvals-page-types";

export function ApprovalQueue({
  approvals,
  hasFilters,
  isAdmin,
  memberOptions,
}: {
  approvals: ApprovalRow[];
  hasFilters: boolean;
  isAdmin: boolean;
  memberOptions: MemberOption[];
}) {
  if (approvals.length === 0) return <ApprovalsEmptyState hasFilters={hasFilters} />;
  return (
    <section className="ui-card overflow-hidden p-0">
      <ApprovalQueueHeader count={approvals.length} />
      <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
        {approvals.map((row) => (
          <ApprovalListItem key={row.id} isAdmin={isAdmin} memberOptions={memberOptions} row={row} />
        ))}
      </ul>
    </section>
  );
}

function ApprovalsEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <section className="ui-card-raised relative overflow-hidden rounded-2xl border p-5 sm:p-6 lg:p-7">
      <div
        aria-hidden
        className="landing-corner-ring"
        style={{ top: "-2.25rem", right: "-2.25rem", width: "7rem", height: "7rem" }}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-8">
        <EmptyState
          eyebrow="Approval queue"
          title="No approvals match this queue"
          copy="Adjust the approval status filter, clear the queue, or review unified work for other decision pressure."
          icon={<Compass className="h-7 w-7 text-[var(--accent-strong)]" strokeWidth={1.65} aria-hidden />}
          className="lg:items-start lg:text-left"
          action={
            <>
              <Link href="/work" className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px]">
                <ArrowRight className="h-4 w-4" strokeWidth={1.85} aria-hidden />
                Review tasks
              </Link>
              {hasFilters ? (
                <Link href="/contracts/approvals" className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px]">
                  Clear filters
                </Link>
              ) : (
                <Link href="/renewals" className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px]">
                  Browse renewals
                </Link>
              )}
            </>
          }
        />
        <SamplePreviewCard
          eyebrow="Sample approval"
          title="Renewal signoff · Acme Corp MSA 2025"
          meta={["Commercial", "≥ $50K"]}
          status={<StatusPill tone="warning">Pending</StatusPill>}
          rows={[
            { label: "Approver", value: "Sarah K." },
            { label: "SLA due", value: "Mar 18 · 5:00 PM" },
            { label: "Created", value: "Mar 11, 2026" },
            { label: "Category", value: "Commercial" },
          ]}
          footerValue="Approve, reject, or delegate"
        />
      </div>
    </section>
  );
}

function ApprovalQueueHeader({ count }: { count: number }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
          Queue
        </p>
        <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">
          Approval queue
        </h2>
        <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          Execution queue for signoff, delegation, and issue-aware decision pressure.
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,transparent)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        <Clock3 className="h-3 w-3" strokeWidth={1.85} aria-hidden />
        {count} {count === 1 ? "row" : "rows"}
      </span>
    </header>
  );
}

function ApprovalListItem({
  isAdmin,
  memberOptions,
  row,
}: {
  isAdmin: boolean;
  memberOptions: MemberOption[];
  row: ApprovalRow;
}) {
  const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
    | { id: string; title: string }
    | undefined;
  const stTone = approvalStatusTone(row.status);
  const memberLabel = row.delegated_to_id
    ? memberOptions.find((m) => m.id === row.delegated_to_id)?.label ?? "Member"
    : null;
  return (
    <li className="px-5 py-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <ApprovalIdentity contract={contract} row={row} stTone={stTone} />
        <ApprovalFacts memberLabel={memberLabel} row={row} />
      </div>
      {row.status === "pending" ? (
        <ApprovalDecisionForms isAdmin={isAdmin} memberOptions={memberOptions} row={row} />
      ) : null}
    </li>
  );
}

function ApprovalIdentity({
  contract,
  row,
  stTone,
}: {
  contract: { id: string; title: string } | undefined;
  row: ApprovalRow;
  stTone: ReturnType<typeof approvalStatusTone>;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span
        className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))] text-[var(--accent-strong)]"
        aria-hidden
      >
        <ShieldCheck className="h-4 w-4" strokeWidth={1.85} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
            {formatOperatorLabel(row.approval_type)}
          </h3>
          <StatusPill tone={stTone}>{formatOperatorLabel(row.status)}</StatusPill>
          {row.exception_flag ? <StatusPill tone="warning">Issue</StatusPill> : null}
        </div>
        {contract ? (
          <Link href={`/contracts/${contract.id}`} className="ui-link mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold">
            {contract.title}
            <ChevronRight className="h-3 w-3 opacity-70" aria-hidden />
          </Link>
        ) : null}
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
          {format(new Date(row.created_at), "MMM d, yyyy · h:mm a")}
        </p>
        {row.notes ? (
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{row.notes}</p>
        ) : null}
        {row.exception_flag ? (
          <p className="mt-2 inline-flex items-start gap-1.5 text-[12.5px] text-[var(--warning-ink)]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden />
            <span>{row.exception_reason || "Issue reason not provided"}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ApprovalFacts({ memberLabel, row }: { memberLabel: string | null; row: ApprovalRow }) {
  return (
    <dl className="flex shrink-0 flex-wrap items-start gap-x-4 gap-y-1.5 text-[11px] lg:max-w-[22rem] lg:justify-end">
      {row.category ? (
        <div className="inline-flex items-center gap-1.5">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Category
          </dt>
          <dd className="font-medium text-[var(--text-secondary)]">{formatOperatorLabel(row.category)}</dd>
        </div>
      ) : null}
      {row.due_at ? (
        <div className="inline-flex items-center gap-1.5">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            SLA due
          </dt>
          <dd className="font-mono text-[var(--text-secondary)]">
            {format(new Date(row.due_at), "MMM d · h:mm a")}
          </dd>
        </div>
      ) : null}
      {memberLabel ? (
        <div className="inline-flex items-center gap-1.5">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Delegated
          </dt>
          <dd className="font-medium text-[var(--text-secondary)]">{memberLabel}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function ApprovalDecisionForms({
  isAdmin,
  memberOptions,
  row,
}: {
  isAdmin: boolean;
  memberOptions: MemberOption[];
  row: ApprovalRow;
}) {
  return (
    <div className="mt-4 space-y-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
        Decision
      </p>
      <form action={updateContractApprovalStatusForm} className="space-y-3">
        <input type="hidden" name="approvalId" value={row.id} />
        <div className="space-y-2">
          <label
            htmlFor={`approval-note-${row.id}`}
            className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]"
          >
            Decision note
          </label>
          <textarea
            id={`approval-note-${row.id}`}
            name="notes"
            className="ui-input min-h-[3.5rem] w-full text-[12.5px] leading-relaxed"
            placeholder="Required for reject or request changes"
          />
        </div>
        <ApprovalDecisionButtons />
      </form>
      {isAdmin ? <ApprovalDelegateForm memberOptions={memberOptions} row={row} /> : null}
    </div>
  );
}

function ApprovalDecisionButtons() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button type="submit" name="status" value="changes_requested" className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
        Request changes
      </button>
      <button type="submit" name="status" value="rejected" className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] text-[var(--danger-ink)]">
        Reject
      </button>
      <button type="submit" name="status" value="approved" className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px]">
        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
        Approve
      </button>
    </div>
  );
}

function ApprovalDelegateForm({ memberOptions, row }: { memberOptions: MemberOption[]; row: ApprovalRow }) {
  return (
    <form
      action={delegateContractApprovalForm}
      className="flex flex-col gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3 sm:flex-row sm:items-center sm:justify-end"
    >
      <input type="hidden" name="approvalId" value={row.id} />
      <label
        htmlFor={`approval-delegate-${row.id}`}
        className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]"
      >
        Delegate to
      </label>
      <div className="flex flex-1 flex-wrap items-stretch gap-2 sm:max-w-[20rem]">
        <UiSelect
          id={`approval-delegate-${row.id}`}
          name="delegateToUserId"
          defaultValue=""
          placeholder="Select member..."
          options={memberOptions.map((member) => ({
            value: member.id,
            label: member.label,
          }))}
          variant="compact"
          portal
          searchThreshold={8}
          className="min-w-0 flex-1"
          buttonClassName="w-full !min-h-11 text-[12.5px]"
        />
        <button type="submit" className="ui-btn-secondary inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
          <Users className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
          Delegate
        </button>
      </div>
    </form>
  );
}
