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
      className={`ui-page-shell ${OPERATIONAL_SHELL_BY_TONE.neutral}`}
    >
      <header>
        <p className="ui-eyebrow">{props.subtitle}</p>
        <h2 className="ui-page-title mt-2 text-[1.8rem]">{props.title}</h2>
      </header>
      {props.explainer ? (
        <div className="ui-surface-tint mt-4 rounded-[var(--radius-2xl)] p-3 text-[13px] leading-[1.55] text-[var(--text-secondary)]">
          {props.explainer}
        </div>
      ) : null}
      <div className="mt-4">{props.children}</div>
    </section>
  );
}
