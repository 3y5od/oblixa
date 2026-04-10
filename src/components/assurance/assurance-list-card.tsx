import type { ReactNode } from "react";
import { OPERATIONAL_SHELL_BY_TONE } from "@/lib/ui/operational-surface";

export function AssuranceListCard(props: {
  title: string;
  subtitle: string;
  children: ReactNode;
  explainer?: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--border-subtle)] p-4 shadow-[var(--shadow-1)] ${OPERATIONAL_SHELL_BY_TONE.neutral}`}
    >
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{props.subtitle}</p>
        <h2 className="mt-1 text-base font-semibold tracking-tight text-zinc-900">{props.title}</h2>
      </header>
      {props.explainer ? (
        <div className="mt-3 rounded-lg border border-zinc-200/90 bg-surface/70 p-2.5 text-[12px] leading-[1.45] text-zinc-600 dark:bg-zinc-900/20">
          {props.explainer}
        </div>
      ) : null}
      <div className="mt-3">{props.children}</div>
    </section>
  );
}
