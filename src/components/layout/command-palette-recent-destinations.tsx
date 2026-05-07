"use client";

import Link from "next/link";
import { Clock3 } from "lucide-react";
import type { PaletteItem } from "./command-palette-helpers";

export function CommandPaletteRecentDestinations({
  items,
  onSelect,
}: {
  items: PaletteItem[];
  onSelect: (item: PaletteItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
      <p className="ui-eyebrow">Recent destinations</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onSelect(item)}
            className="ui-chip gap-1.5 px-3 py-1.5 text-[11px] font-medium hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_92%,transparent)]"
          >
            <Clock3 size={12} aria-hidden />
            {item.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
