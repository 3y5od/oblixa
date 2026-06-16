import Link from "next/link";
import type { ReactNode } from "react";
import { OPERATIONAL_SHELL_BY_TONE } from "@/lib/ui/operational-surface";
import type { OperationalBreakdownItem } from "./operational-summary-card-types";
import type { OperationalTone } from "@/lib/ui/operational-surface";

export function OperationalSectionHeader(props: {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-4 ${props.className ?? ""}`.trim()}>
      <div className="min-w-0 space-y-1.5">
        <p className="ui-eyebrow">{props.eyebrow}</p>
        <h2 className="ui-page-title text-[1.6rem] sm:text-[2.2rem]">{props.title}</h2>
        {props.description ? <p className="ui-page-lead">{props.description}</p> : null}
      </div>
      {props.actions ? <div className="ui-toolbar-strong shrink-0 gap-2">{props.actions}</div> : null}
    </div>
  );
}

export function OperationalMetricChip({ label, value }: OperationalBreakdownItem) {
  return (
    <div role="listitem" className="ui-metric-chip">
      <span className="ui-metric-label">{label}</span>
      <span className="font-semibold tabular-nums text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

export function CompressedNormalState(props: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`rounded-2xl border border-[var(--border-subtle)] bg-[color:var(--surface-tint)] px-3.5 py-3 text-[12.5px] text-[var(--text-secondary)] ${props.className ?? ""}`.trim()}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text-primary)]">{props.title}</p>
          {props.description ? <p className="mt-0.5">{props.description}</p> : null}
        </div>
        {props.action ? (
          <Link href={props.action.href} className="ui-operational-action shrink-0 text-[11px]">
            <span>{props.action.label}</span>
            <span aria-hidden>{"\u2192"}</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function DiagnosticDisclosure(props: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details
      className={`rounded-2xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_54%,transparent)] px-3.5 py-3 text-[12.5px] text-[var(--text-secondary)] ${props.className ?? ""}`.trim()}
    >
      <summary className="cursor-pointer list-none font-semibold text-[var(--text-primary)] marker:hidden">
        {props.title ?? "Diagnostics"}
      </summary>
      <div className="mt-2 leading-relaxed">{props.children}</div>
    </details>
  );
}

export function SeverityMetricStrip(props: {
  items: Array<OperationalBreakdownItem & { tone?: OperationalTone }>;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${props.className ?? ""}`.trim()} role="list">
      {props.items.map((item) => (
        <div
          key={item.label}
          role="listitem"
          className={`ui-metric-chip ${item.tone ? OPERATIONAL_SHELL_BY_TONE[item.tone] : ""}`.trim()}
        >
          <span className="ui-metric-label">{item.label}</span>
          <span className="font-semibold tabular-nums text-[var(--text-primary)]">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
