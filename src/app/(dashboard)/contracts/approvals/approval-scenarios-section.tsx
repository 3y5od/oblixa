import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, ChevronRight, GitBranch } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { formatBusinessDateAtNoon } from "@/lib/business-dates";
import type { RenewalScenarioRow } from "@/app/(dashboard)/contracts/approvals/approvals-page-types";

export function RenewalScenariosSection({ scenarios }: { scenarios: RenewalScenarioRow[] }) {
  return (
    <section className="ui-card overflow-hidden p-0">
      <ScenariosHeader count={scenarios.length} />
      {scenarios.length === 0 ? <NoScenariosState /> : <ScenariosList scenarios={scenarios} />}
    </section>
  );
}

function ScenariosHeader({ count }: { count: number }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
          Scenarios
        </p>
        <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">
          Renewal scenarios
        </h2>
        <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          Approval timing aligned with scenario dependencies, escalation dates, and target decisions.
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,transparent)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
        <GitBranch className="h-3 w-3" strokeWidth={1.85} aria-hidden />
        {count} {count === 1 ? "scenario" : "scenarios"}
      </span>
    </header>
  );
}

function NoScenariosState() {
  return (
    <div className="flex flex-col items-start gap-3 px-5 py-7 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,var(--surface-raised))] text-[var(--text-secondary)]"
          aria-hidden
        >
          <GitBranch className="h-4 w-4" strokeWidth={1.85} />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
            No renewal scenarios yet
          </p>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            Scenarios appear once contracts have decision timing, dependencies, or renewal paths to compare against approvals.
          </p>
        </div>
      </div>
      <Link href="/renewals" className="ui-btn-secondary inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2 text-[12.5px]">
        Review renewals
        <ChevronRight className="h-3 w-3 opacity-70" aria-hidden />
      </Link>
    </div>
  );
}

function ScenariosList({ scenarios }: { scenarios: RenewalScenarioRow[] }) {
  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
      {scenarios.map((row) => (
        <ScenarioRow key={row.id} row={row} />
      ))}
    </ul>
  );
}

function ScenarioRow({ row }: { row: RenewalScenarioRow }) {
  const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
    | { id: string; title: string }
    | undefined;
  return (
    <li className="px-5 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))] text-[var(--accent-strong)]"
            aria-hidden
          >
            <GitBranch className="h-4 w-4" strokeWidth={1.85} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                {row.scenario.replace(/_/g, " ")}
              </h3>
              {row.blocker ? <StatusPill tone="warning">Needs input</StatusPill> : null}
            </div>
            {contract ? (
              <Link href={`/contracts/${contract.id}`} className="ui-link mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold">
                {contract.title}
                <ChevronRight className="h-3 w-3 opacity-70" aria-hidden />
              </Link>
            ) : null}
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
              Updated {format(new Date(row.updated_at), "MMM d, yyyy · h:mm a")}
            </p>
            {row.blocker ? (
              <p className="mt-2 inline-flex items-start gap-1.5 text-[12.5px] text-[var(--warning-ink)]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden />
                <span>Input needed · {row.blocker}</span>
              </p>
            ) : null}
          </div>
        </div>
        <ScenarioFacts row={row} />
      </div>
    </li>
  );
}

function ScenarioFacts({ row }: { row: RenewalScenarioRow }) {
  return (
    <dl className="flex shrink-0 flex-wrap items-start gap-x-4 gap-y-1.5 text-[11px] lg:max-w-[22rem] lg:justify-end">
      {row.workspace_status ? (
        <div className="inline-flex items-center gap-1.5">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Workspace
          </dt>
          <dd className="font-medium text-[var(--text-secondary)]">
            {String(row.workspace_status).replace(/_/g, " ")}
          </dd>
        </div>
      ) : null}
      {row.target_decision_date ? (
        <div className="inline-flex items-center gap-1.5">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Target
          </dt>
          <dd className="font-mono text-[var(--text-secondary)]">
            {formatBusinessDateAtNoon(row.target_decision_date)}
          </dd>
        </div>
      ) : null}
      {row.escalation_date ? (
        <div className="inline-flex items-center gap-1.5">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Escalate
          </dt>
          <dd className="font-mono text-[var(--warning-ink)]">
            {formatBusinessDateAtNoon(row.escalation_date)}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
