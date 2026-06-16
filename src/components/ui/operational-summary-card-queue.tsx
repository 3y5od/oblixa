import Link from "next/link";
import type { ReactNode } from "react";
import { OPERATIONAL_SHELL_BY_TONE } from "@/lib/ui/operational-surface";
import type { OperationalTone } from "@/lib/ui/operational-surface";
import {
  CompressedNormalState,
  DiagnosticDisclosure,
  OperationalMetricChip,
  OperationalSectionHeader,
} from "./operational-summary-card-primitives";
import type { OperationalBreakdownItem, OperationalTriageItem } from "./operational-summary-card-types";

export function OperationalQueueRow(props: {
  href: string;
  eyebrow?: string;
  title: string;
  hint?: string;
  chips?: OperationalBreakdownItem[];
  actionLabel: string;
  tone?: OperationalTone;
}) {
  const tone = props.tone ?? "neutral";
  const wrapClass = `ui-operational-focusable ui-operational-card-compact flex h-full min-h-0 flex-col px-3.5 py-3 ${OPERATIONAL_SHELL_BY_TONE[tone]}`.trim();
  const inner = (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {props.eyebrow ? <p className="ui-kicker">{props.eyebrow}</p> : null}
        <p className={`font-semibold tracking-tight text-[14px] text-[var(--text-primary)] ${props.eyebrow ? "mt-1.5" : ""}`}>
          {props.title}
        </p>
        {props.hint ? <p className="ui-support-copy mt-1.5">{props.hint}</p> : null}
        {props.chips && props.chips.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5" role="list">
            {props.chips.map((c) => (
              <OperationalMetricChip key={c.label} {...c} />
            ))}
          </div>
        ) : null}
      </div>
      <span className="ui-operational-action mt-3.5 shrink-0 text-[11px]">
        {props.actionLabel}
        <span aria-hidden>{"\u2192"}</span>
      </span>
    </>
  );
  return props.href.startsWith("#") ? (
    <a href={props.href} className={wrapClass}>
      {inner}
    </a>
  ) : (
    <Link href={props.href} className={wrapClass}>
      {inner}
    </Link>
  );
}

export function OperationalTriagePanel(props: {
  eyebrow: string;
  title: string;
  description?: string;
  items: OperationalTriageItem[];
  allClear?: {
    title: string;
    description?: string;
    action?: { href: string; label: string };
  };
  diagnostics?: ReactNode;
  className?: string;
}) {
  const activeItems = props.items.filter((item) => item.count !== 0 && item.count !== "0");
  if (activeItems.length === 0 && props.allClear) {
    return (
      <CompressedNormalState
        title={props.allClear.title}
        description={props.allClear.description}
        action={props.allClear.action}
        className={props.className}
      />
    );
  }
  return (
    <section className={`ui-card p-4 md:p-5 ${props.className ?? ""}`.trim()}>
      <OperationalSectionHeader
        eyebrow={props.eyebrow}
        title={props.title}
        description={props.description}
        className="items-start"
      />
      {activeItems.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {activeItems.map((item) => (
            <OperationalTriagePanelItem key={item.id} item={item} />
          ))}
        </div>
      ) : props.allClear ? (
        <CompressedNormalState className="mt-4" {...props.allClear} />
      ) : null}
      {props.diagnostics ? <DiagnosticDisclosure className="mt-4">{props.diagnostics}</DiagnosticDisclosure> : null}
    </section>
  );
}

function OperationalTriagePanelItem({ item }: { item: OperationalTriageItem }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text-primary)]">{item.title}</p>
          {item.description ? (
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{item.description}</p>
          ) : null}
        </div>
        {item.count !== undefined ? (
          <span className="shrink-0 text-lg font-semibold tabular-nums text-[var(--text-primary)]">
            {item.count}
          </span>
        ) : null}
      </div>
      {item.meta && item.meta.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5" role="list">
          {item.meta.map((chip) => (
            <OperationalMetricChip key={chip.label} {...chip} />
          ))}
        </div>
      ) : null}
      {item.actionLabel ? (
        <span className="ui-operational-action mt-3 text-[11px]">
          {item.actionLabel}
          <span aria-hidden>{"\u2192"}</span>
        </span>
      ) : null}
    </>
  );
  const className = `ui-operational-focusable ui-operational-card-compact flex min-h-0 flex-col px-3.5 py-3 ${OPERATIONAL_SHELL_BY_TONE[item.tone ?? "neutral"]}`;
  return item.href ? (
    <Link href={item.href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
