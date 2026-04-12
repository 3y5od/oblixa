"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readResponseJson } from "@/lib/http/client-json";

type TimelineEvent = {
  id: string;
  event_type: string;
  event_at: string;
  payload_json?: unknown;
  linked_contract_id?: string | null;
};

async function loadTimeline(
  kind: "accounts" | "counterparties",
  key: string,
  signal?: AbortSignal
): Promise<TimelineEvent[]> {
  const path =
    kind === "accounts"
      ? `/api/accounts/${encodeURIComponent(key)}/summary`
      : `/api/counterparties/${encodeURIComponent(key)}/summary`;
  const res = await fetch(path, { credentials: "same-origin", signal });
  const parsed = await readResponseJson(res);
  if (!parsed.ok) return [];
  const payload = parsed.data as { timelineEvents?: TimelineEvent[] };
  return Array.isArray(payload.timelineEvents) ? payload.timelineEvents : [];
}

export function RelationshipTimelineCard({
  accountKey,
  counterpartyKey,
}: {
  accountKey?: string | null;
  counterpartyKey?: string | null;
}) {
  const [accountEvents, setAccountEvents] = useState<TimelineEvent[] | null>(null);
  const [counterpartyEvents, setCounterpartyEvents] = useState<TimelineEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    async function run() {
      setError(null);
      try {
        if (accountKey) {
          const evs = await loadTimeline("accounts", accountKey, ac.signal);
          if (!ac.signal.aborted) setAccountEvents(evs);
        } else {
          setAccountEvents(null);
        }
        if (counterpartyKey) {
          const evs = await loadTimeline("counterparties", counterpartyKey, ac.signal);
          if (!ac.signal.aborted) setCounterpartyEvents(evs);
        } else {
          setCounterpartyEvents(null);
        }
      } catch {
        if (!ac.signal.aborted) setError("Could not load relationship timeline.");
      }
    }
    void run();
    return () => ac.abort();
  }, [accountKey, counterpartyKey]);

  if (!accountKey && !counterpartyKey) return null;

  function renderList(title: string, href: string, events: TimelineEvent[] | null) {
    if (events === null) {
      return (
        <div className="mt-3">
          <p className="text-xs font-semibold text-zinc-700">{title}</p>
          <p className="mt-1 text-xs text-zinc-500">Loading…</p>
        </div>
      );
    }
    return (
      <div className="mt-3">
        <p className="text-xs font-semibold text-zinc-700">
          <Link href={href} className="ui-link">
            {title}
          </Link>
        </p>
        {events.length === 0 ? (
          <p className="mt-1 text-xs text-zinc-500">No timeline events yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs text-zinc-600">
            {events.slice(0, 8).map((e) => (
              <li key={e.id} className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-2 py-1.5">
                <p className="font-medium text-zinc-800">{e.event_type}</p>
                <p className="text-[10px] text-zinc-500">{new Date(e.event_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <article className="ui-card p-5">
      <p className="ui-eyebrow">Activity</p>
      <h2 className="ui-section-title mt-1 text-base">Relationship timeline</h2>
      <p className="ui-muted-tight mt-1">
        Recent events from account and counterparty workspaces (same data as summary APIs).
      </p>
      {error ? (
        <p className="mt-2 text-xs text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      {accountKey
        ? renderList(`Account · ${accountKey}`, `/accounts/${encodeURIComponent(accountKey)}`, accountEvents)
        : null}
      {counterpartyKey
        ? renderList(
            `Counterparty · ${counterpartyKey}`,
            `/counterparties/${encodeURIComponent(counterpartyKey)}`,
            counterpartyEvents
          )
        : null}
    </article>
  );
}
