"use client";

import Link from "next/link";

export function DashboardQuickFilterCard(props: {
  view: "personal" | "team" | "portfolio";
  quickFilter: "all" | "approvals" | "deadlines" | "data_gaps";
}) {
  const { view, quickFilter } = props;
  const options: Array<{
    id: "all" | "approvals" | "deadlines" | "data_gaps";
    label: string;
    href: string;
  }> = [
    { id: "all", label: "All", href: `/dashboard?view=${view}` },
    { id: "approvals", label: "Approvals", href: `/dashboard?view=${view}&qf=approvals` },
    { id: "deadlines", label: "Deadlines", href: `/dashboard?view=${view}&qf=deadlines` },
    { id: "data_gaps", label: "Data gaps", href: `/dashboard?view=${view}&qf=data_gaps` },
  ];

  return (
    <section className="ui-toolbar px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="ui-kicker">Quick filters</p>
        {options.map((option) => (
          <Link
            key={option.id}
            href={option.href}
            className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              quickFilter === option.id
                ? "border-[var(--accent-strong)] bg-[var(--accent-strong)] text-[var(--accent-fg)]"
                : "border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_80%,white)] text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_74%,transparent)] hover:text-[var(--text-primary)]"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
