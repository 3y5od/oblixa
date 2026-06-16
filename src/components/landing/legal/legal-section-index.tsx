"use client";

import { useEffect, useState } from "react";

export type LegalAnchor = { id: string; label: string };

/**
 * Desktop section index for the editorial legal pages. A quiet anchor list with
 * a scroll-spy active state, designed to sit in a sticky right rail. The mobile
 * "On this page" disclosure is rendered separately (server) by the shell, so
 * only this desktop variant runs the IntersectionObserver.
 */
export function LegalSectionIndex({
  items,
  label = "On this page",
}: {
  items: readonly LegalAnchor[];
  label?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    if (items.length === 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      // Treat the upper third of the viewport as the "active" band so the
      // highlighted section matches what the reader is actually looking at.
      { rootMargin: "-18% 0px -72% 0px", threshold: 0 },
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label={label} className="sticky top-24">
      <p className="ui-caps-3 mb-3 text-[var(--text-tertiary)]">{label}</p>
      <ul className="flex flex-col border-l border-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)]">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id} className="-ml-px">
              <a
                href={`#${item.id}`}
                aria-current={active ? "true" : undefined}
                className={`block border-l py-1.5 pl-3.5 text-[12.5px] leading-snug transition-colors ${
                  active
                    ? "border-[var(--accent-strong)] font-medium text-[var(--text-primary)]"
                    : "border-transparent text-[var(--text-tertiary)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
