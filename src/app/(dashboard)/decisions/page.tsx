import Link from "next/link";
import { CircleDot, Layers, Split } from "lucide-react";
import { CreateDecisionForm } from "@/components/decisions/create-decision-form";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ApiJsonLink } from "@/components/ui/api-json-link";
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
      <header className="ui-page-header-compact">
        <div>
          <p className="ui-eyebrow">Records</p>
          <h1 className="ui-page-title-compact mt-2">Decision Queue</h1>
          <p className="ui-page-lead mt-2 max-w-2xl">
            Decision records by type, status, due date, and next action across the governed advanced workspace.
            {typeFilter || queueActiveOnly ? (
              <span className="mt-2 block text-xs text-[var(--text-secondary)]">
                {queueActiveOnly ? <>Showing open and in-review decisions only. </> : null}
                {typeFilter ? (
                  <>
                    Filtered by type <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1">{typeFilter}</code>.{" "}
                  </>
                ) : null}
                <Link href="/decisions" className="ui-link">
                  Clear filters
                </Link>
              </span>
            ) : null}
          </p>
        </div>
        <ApiJsonLink href="/api/decisions" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
          View JSON
        </ApiJsonLink>
      </header>

      <section className="ui-page-shell space-y-3">
        <div>
          <p className="ui-eyebrow">Queue</p>
          <h2 className="ui-page-title mt-2 text-[1.8rem]">Decision metrics</h2>
          <p className="ui-section-lead mt-2">
            Active workspaces, review pressure, and blocked decision paths.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <OperationalSummaryCard
            eyebrow="Filtered"
            headline="Workspaces"
            tone="neutral"
            icon={Layers}
            primaryValue={rows.length}
            primaryUnit="rows shown"
            action={{ href: "/decisions", label: "Review decision queue" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Status"
            headline="Open"
            tone={openCount > 0 ? "attention" : "healthy"}
            icon={CircleDot}
            primaryValue={openCount}
            primaryUnit="awaiting owner"
            action={{ href: "/decisions?queue=active", label: "Review active" }}
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
            action={{ href: "/decisions?queue=active", label: "Review decisions" }}
            variant="compact"
          />
        </div>
      </section>

      <section className="ui-page-shell space-y-4 p-5">
        <p className="ui-kicker">New decision</p>
        <p className="ui-support-copy mt-1">Create a workspace with required decision type and linked scope.</p>
        <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
          <CreateDecisionForm />
        </div>
      </section>

      <div className="ui-table-shell">
        <div className="ui-surface-tint px-5 py-4">
          <p className="ui-eyebrow">Rows</p>
          <h2 className="ui-section-title mt-1 text-[1.05rem]">Decision ledger</h2>
          <p className="ui-support-copy mt-1">Keep type, status, due date, and next action visible as the queue contracts or expands.</p>
        </div>
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
                  <td className="px-5 py-4 font-semibold text-[var(--text-primary)]">
                    <Link href={`/decisions/${row.id}`} className="ui-link">
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-[var(--text-secondary)]">Decision</td>
                  <td className="px-5 py-4 text-[var(--text-secondary)]">{row.decision_type}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={decisionStatusTone(row.status)}>{row.status.replace(/_/g, " ")}</StatusBadge>
                  </td>
                  <td className="px-5 py-4 text-[var(--text-secondary)]">Unassigned</td>
                  <td className="px-5 py-4 text-[var(--text-secondary)]">{row.due_at ? new Date(row.due_at).toLocaleDateString() : "—"}</td>
                  <td className="px-5 py-4 text-[var(--text-secondary)]">
                    <Link href={`/decisions/${row.id}`} className="ui-link">
                      Review decision
                    </Link>
                    <span className="ml-2 text-xs text-[var(--text-tertiary)]">
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

