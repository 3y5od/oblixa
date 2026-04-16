import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState(props: {
  title: string;
  copy: string;
  icon?: ReactNode;
  action?: ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div className={`ui-empty-state flex flex-col items-center justify-center ${props.className ?? ""}`.trim()}>
      <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_82%,white)] shadow-[var(--shadow-1)]">
        {props.icon ?? <Inbox className="h-7 w-7 text-[var(--text-tertiary)]" strokeWidth={1.55} aria-hidden />}
      </div>
      {props.eyebrow ? <p className="ui-eyebrow mt-5">{props.eyebrow}</p> : null}
      <h3 className="ui-empty-state-title">{props.title}</h3>
      <p className="ui-empty-state-copy">{props.copy}</p>
      {props.action ? <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{props.action}</div> : null}
    </div>
  );
}
