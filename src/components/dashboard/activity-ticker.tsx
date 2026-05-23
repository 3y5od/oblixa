"use client";

import { useEffect, useState } from "react";
import { Sparkles, FileCheck2, UploadCloud, Activity } from "lucide-react";
import { formatRelativeCompact } from "@/lib/ui-copy";

export interface TickerEvent {
  id: string;
  action: string;
  actor?: string | null;
  contractTitle?: string | null;
  timestamp: string;
}

interface ActivityTickerProps {
  events: TickerEvent[];
}

const ICONS: Record<string, typeof Activity> = {
  "contract.uploaded": UploadCloud,
  "extraction.completed": Sparkles,
  "field.approved": FileCheck2,
};

const VERBS: Record<string, string> = {
  "contract.uploaded": "UPLOADED",
  "extraction.completed": "EXTRACTED",
  "field.approved": "APPROVED",
};

export function ActivityTicker({ events }: ActivityTickerProps) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  const visible = events.slice(0, 4);
  if (!hydrated || visible.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] px-4 py-2.5"
    >
      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
        <span
          aria-hidden
          className="relative inline-flex h-2 w-2 items-center justify-center"
        >
          <span
            className="absolute inset-0 animate-pulse rounded-full"
            style={{
              background: "color-mix(in oklab, var(--accent-strong) 28%, transparent)",
              animationDuration: "2.5s",
            }}
          />
          <span className="relative h-1.5 w-1.5 rounded-full bg-[var(--accent-strong)]" />
        </span>
        LIVE
      </span>
      <ul className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        {visible.map((event) => {
          const Icon = ICONS[event.action] ?? Activity;
          const verb = VERBS[event.action] ?? event.action.replace(/[._]/g, " ").toUpperCase();
          return (
            <li
              key={event.id}
              className="inline-flex min-w-0 items-center gap-1.5"
            >
              <Icon
                className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]"
                strokeWidth={1.85}
                aria-hidden
              />
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)]">
                {verb}
              </span>
              {event.contractTitle ? (
                <span
                  className="inline-flex max-w-[10rem] items-center rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] leading-none text-[var(--text-secondary)] sm:max-w-[14rem] lg:max-w-[18rem]"
                  title={event.contractTitle}
                >
                  <span className="truncate">{event.contractTitle}</span>
                </span>
              ) : null}
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] tabular-nums text-[var(--text-tertiary)]">
                {formatRelativeCompact(event.timestamp)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
