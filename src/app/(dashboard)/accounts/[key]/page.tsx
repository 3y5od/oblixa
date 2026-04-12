import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, History } from "lucide-react";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { getAuthContext } from "@/lib/supabase/server";
import { assertV5PageFeature } from "@/lib/v5/feature-guards";
import { RelationshipWorkspaceOverview } from "@/components/relationship/relationship-workspace-overview";
import { buildRelationshipKeyMetrics } from "@/lib/v5/relationship-key-metrics";
import {
  ensureAccountWorkspaceFromContracts,
  ensureTimelineForAccount,
} from "@/lib/v5/relationship-bootstrap";

export default async function AccountWorkspacePage({ params }: { params: Promise<{ key: string }> }) {
  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV5PageFeature("v5RelationshipLayer");

  const { admin, orgId } = ctx;
  const ensured = await ensureAccountWorkspaceFromContracts(admin, orgId, key);
  if (!ensured) notFound();

  const { data: workspace } = await admin
    .from("account_workspaces")
    .select("id, account_key, display_name, summary_json, health_signal_json, updated_at")
    .eq("organization_id", orgId)
    .eq("id", ensured.id)
    .single();

  const { data: contracts } = await admin
    .from("contracts")
    .select("id, title, counterparty, status, annual_value, updated_at")
    .eq("organization_id", orgId)
    .eq("account_key", key)
    .order("updated_at", { ascending: false })
    .limit(100);

  const timelineId = await ensureTimelineForAccount(
    admin,
    orgId,
    ensured.id,
    `Timeline · ${ensured.display_name}`
  );
  let timelineEvents: {
    id: string;
    event_type: string;
    event_at: string;
    payload_json: unknown;
  }[] = [];
  if (timelineId) {
    const { data: evs } = await admin
      .from("relationship_timeline_events")
      .select("id, event_type, event_at, payload_json")
      .eq("organization_id", orgId)
      .eq("relationship_timeline_id", timelineId)
      .order("event_at", { ascending: false })
      .limit(30);
    timelineEvents = (evs ?? []) as typeof timelineEvents;
  }

  if (!workspace) notFound();

  const liveMetrics = await buildRelationshipKeyMetrics(
    admin,
    orgId,
    (contracts ?? []).map((c) => String(c.id))
  );

  const contractCount = (contracts ?? []).length;

  return (
    <div className="ui-page-stack">
      <header className="border-b border-zinc-200/60 pb-8">
        <div>
          <p className="ui-eyebrow">Account workspace</p>
          <h1 className="ui-display-title mt-2">{workspace.display_name}</h1>
          <p className="ui-muted-tight mt-2 text-[13px]">Key: {workspace.account_key}</p>
          <Link
            href={`/api/accounts/${encodeURIComponent(key)}/summary`}
            className="ui-link mt-3 inline-block text-xs"
            target="_blank"
          >
            Open summary JSON
          </Link>
        </div>
      </header>

      <RelationshipWorkspaceOverview
        healthSignalJson={workspace.health_signal_json}
        summaryJson={workspace.summary_json}
        liveMetrics={liveMetrics}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <OperationalSummaryCard
          eyebrow="Portfolio"
          headline="Contracts on key"
          tone={contractCount > 0 ? "neutral" : "attention"}
          icon={FileText}
          primaryValue={contractCount}
          primaryUnit="loaded sample"
          action={{ href: `/accounts/${encodeURIComponent(key)}`, label: "Refresh" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Activity"
          headline="Timeline events"
          tone={timelineEvents.length > 0 ? "neutral" : "healthy"}
          icon={History}
          primaryValue={timelineEvents.length}
          primaryUnit="recent sample"
          action={{ href: `/accounts/${encodeURIComponent(key)}`, label: "View below" }}
          variant="compact"
        />
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="ui-card p-5">
          <p className="ui-eyebrow">Records</p>
          <p className="ui-section-title mt-1 text-base">Contracts</p>
          <ul className="mt-3 divide-y divide-[var(--border-subtle)] text-sm">
            {(contracts ?? []).length === 0 ? (
              <li className="py-2 text-zinc-500">No contracts with this account key.</li>
            ) : (
              (contracts ?? []).map((c) => (
                <li key={c.id} className="py-2">
                  <Link href={`/contracts/${c.id}`} className="ui-link font-medium">
                    {c.title || "Untitled"}
                  </Link>
                  <p className="text-xs text-zinc-500">{c.status}</p>
                </li>
              ))
            )}
          </ul>
        </article>
        <article className="ui-card p-5">
          <p className="ui-eyebrow">Events</p>
          <p className="ui-section-title mt-1 text-base">Relationship timeline</p>
          <ul className="mt-3 space-y-2 text-sm">
            {timelineEvents.length === 0 ? (
              <li className="text-zinc-500">No timeline events yet.</li>
            ) : (
              timelineEvents.map((e) => (
                <li key={e.id} className="rounded-lg border border-zinc-100 px-3 py-2">
                  <p className="font-medium text-zinc-800">{e.event_type}</p>
                  <p className="text-xs text-zinc-500">{new Date(e.event_at).toLocaleString()}</p>
                </li>
              ))
            )}
          </ul>
        </article>
      </section>
    </div>
  );
}
