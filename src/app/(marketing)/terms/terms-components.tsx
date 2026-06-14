import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function KeyFact({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_50%,transparent)] py-2 first:border-t-0 first:pt-0">
      <dt className="ui-caps-3 shrink-0 text-[var(--text-tertiary)]">{k}</dt>
      <dd className="min-w-0 text-right text-[12.5px] leading-snug text-[var(--text-secondary)]">
        {v}
      </dd>
    </div>
  );
}

export function QuietCard({
  id,
  eyebrow,
  title,
  icon: Icon,
  scrollMargin = false,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  scrollMargin?: boolean;
  children: ReactNode;
}) {
  return (
    <article
      id={id}
      className={`relative flex flex-col rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)] p-5${
        scrollMargin ? " scroll-mt-24" : ""
      }`}
    >
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]"
        aria-hidden
      >
        <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.85} />
      </span>
      <p className="ui-caps-1 mt-3.5 text-[10.5px] text-[var(--accent-strong)]">{eyebrow}</p>
      <h2 className="mt-1.5 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">
        {title}
      </h2>
      <div className="mt-3 flex-1">{children}</div>
    </article>
  );
}
