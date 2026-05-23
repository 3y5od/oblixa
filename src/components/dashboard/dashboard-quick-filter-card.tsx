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
    <nav aria-label="Quick filters" className="ui-segmented inline-flex flex-wrap items-center gap-1">
      {options.map((option) => (
        <Link
          key={option.id}
          href={option.href}
          className={`ui-segmented-item ${quickFilter === option.id ? "ui-segmented-item-active" : ""}`.trim()}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}
