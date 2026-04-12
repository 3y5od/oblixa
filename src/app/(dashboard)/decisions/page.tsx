import Link from "next/link";
import { CircleDot, Layers, Split } from "lucide-react";
import { CreateDecisionForm } from "@/components/decisions/create-decision-form";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import { getAuthContext } from "@/lib/supabase/server";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { assertV5PageFeature } from "@/lib/v5/feature-guards";

function decisionStatusTone(status: string): SemanticStatus {
  if (status === "open") return "info";
  if (status === "in_review") return "in_review";
  if (status === "closed") return "healthy";
  if (status === "blocked") return "blocked";
  return "empty";
}

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; queue?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertV5PageFeature("v5DecisionFoundation");

  const sp = await searchParams;
  const typeFilter = typeof sp.type === "string" ? sp.type.trim() : "";
  const queueRaw = typeof sp.queue === "string" ? sp.queue.trim().toLowerCase() : "";
  const queueActiveOnly = queueRaw === "active" || queueRaw === "1" || queueRaw === "open";

  const { admin, orgId } = ctx;
  const { data } = await admin
    .from("decision_workspaces")
    .select("id, title, decision_type, status, due_at, linked_contract_ids, updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(200);

  const allRows = data ?? [];
  let rows = typeFilter
    ? allRows.filter((r) => String(r.decision_type) === typeFilter)
    : allRows;
  if (queueActiveOnly) {
    rows = rows.filter((r) => r.status === "open" || r.status === "in_review");
  }
  const openCount = rows.filter((r) => r.status === "open").length;
  const reviewCount = rows.filter((r) => r.status === "in_review").length;
  const blockedCount = rows.filter((r) => r.status === "blocked").length;

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Records</p>
          <h1 className="ui-display-title mt-2">Decision Queue</h1>
          <p className="ui-muted-tight mt-2 max-w-2xl">
            Decision records by type, status, due date, and next action.
            {typeFilter || queueActiveOnly ? (
              <span className="mt-2 block text-xs text-zinc-600">
                {queueActiveOnly ? <>Showing open and in-review decisions only. </> : null}
                {typeFilter ? (
                  <>
                    Filtered by type <code className="rounded bg-zinc-100 px-1">{typeFilter}</code>.{" "}
                  </>
                ) : null}
                <Link href="/decisions" className="ui-link">
                  Clear filters
                </Link>
              </span>
            ) : null}
          </p>
        </div>
        <Link href="/api/decisions" className="ui-btn-secondary px-4 py-2.5 text-[13px]" target="_blank">
          View JSON
        </Link>
      </header>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Queue</p>
          <h2 className="ui-section-title mt-2 text-xl">Decision metrics</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <OperationalSummaryCard
            eyebrow="Filtered"
            headline="Workspaces"
            tone="neutral"
            icon={Layers}
            primaryValue={rows.length}
            primaryUnit="rows shown"
            action={{ href: "/decisions", label: "View queue" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Status"
            headline="Open"
            tone={openCount > 0 ? "attention" : "healthy"}
            icon={CircleDot}
            primaryValue={openCount}
            primaryUnit="awaiting owner"
            action={{ href: "/decisions?queue=active", label: "View active" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Flow"
            headline="Review / blocked"
            tone={blockedCount > 0 ? "risk" : reviewCount > 0 ? "attention" : "healthy"}
            icon={Split}
            primaryValue={reviewCount + blockedCount}
            primaryUnit="needs attention"
            breakdown={[
              { label: "In review", value: String(reviewCount) },
              { label: "Blocked", value: String(blockedCount) },
            ]}
            action={{ href: "/decisions?queue=active", label: "View decisions" }}
            variant="compact"
          />
        </div>
      </section>

      <section className="ui-card p-5">
        <p className="ui-kicker">New decision</p>
        <p className="ui-muted-tight mt-1">Create a workspace with required decision type and linked scope.</p>
        <div className="mt-4 border-t border-zinc-100 pt-4">
          <CreateDecisionForm />
        </div>
      </section>

      <div className="ui-card overflow-hidden">
        <table className="min-w-full divide-y divide-[var(--border-subtle)] text-sm">
          <thead className="ui-table-header">
            <tr>
              <th className="px-5 py-3">Title</th>
              <th className="px-5 py-3">Object</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Owner</th>
              <th className="px-5 py-3">Due</th>
              <th className="px-5 py-3">Next action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8">
                  <EmptyState title="No decision workspaces" copy="No decision records match the current queue filters." />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="ui-table-row">
                  <td className="px-5 py-4 font-semibold text-zinc-900">
                    <Link href={`/decisions/${row.id}`} className="ui-link">
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-zinc-600">Decision</td>
                  <td className="px-5 py-4 text-zinc-600">{row.decision_type}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={decisionStatusTone(row.status)}>{row.status.replace(/_/g, " ")}</StatusBadge>
                  </td>
                  <td className="px-5 py-4 text-zinc-600">Unassigned</td>
                  <td className="px-5 py-4 text-zinc-600">{row.due_at ? new Date(row.due_at).toLocaleDateString() : "—"}</td>
                  <td className="px-5 py-4 text-zinc-600">
                    <Link href={`/decisions/${row.id}`} className="ui-link">
                      Review decision
                    </Link>
                    <span className="ml-2 text-xs text-zinc-500">
                      ({Array.isArray(row.linked_contract_ids) ? row.linked_contract_ids.length : 0} linked)
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

