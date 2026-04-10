import Link from "next/link";
import { Database, ListFilter, Table2 } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { isFeatureEnabled } from "@/lib/feature-flags";

export default async function ContractDataQualityPage() {
  if (!isFeatureEnabled("v3ReportingHistory")) {
    return (
      <div className="ui-card px-6 py-8">
        <p className="ui-eyebrow">Feature flag</p>
        <h1 className="ui-display-title mt-2">Data quality is disabled</h1>
        <p className="mt-3 max-w-xl text-sm text-zinc-500">
          Data quality is tied to the same toggle as reporting history. It is off when{" "}
          <code className="text-xs">ENABLE_V3_REPORTING_HISTORY</code> is explicitly false, 0, no, or off.
        </p>
      </div>
    );
  }
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const { admin, orgId } = ctx;

  const [snapshotsRes, fieldsRes] = await Promise.all([
    admin
      .from("contract_data_quality_snapshots")
      .select("contract_id, completeness_score, stale_field_count, missing_critical_count, generated_at, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .order("generated_at", { ascending: false })
      .limit(60),
    admin
      .from("extracted_fields")
      .select("id, contract_id, field_name, field_value, source, source_snippet, confidence, status, contracts!inner(id, title, organization_id)")
      .eq("contracts.organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(120),
  ]);

  const snapshots = snapshotsRes.data ?? [];
  const latestByContract = new Map<string, (typeof snapshots)[number]>();
  for (const row of snapshots) {
    if (!latestByContract.has(row.contract_id)) latestByContract.set(row.contract_id, row);
  }
  const topGaps = [...latestByContract.values()]
    .sort(
      (a, b) =>
        Number(b.missing_critical_count ?? 0) - Number(a.missing_critical_count ?? 0) ||
        Number(a.completeness_score ?? 0) - Number(b.completeness_score ?? 0)
    )
    .slice(0, 12);

  const weakLineage = (fieldsRes.data ?? [])
    .filter((field) => !field.source_snippet || Number(field.confidence ?? 0) < 0.75)
    .slice(0, 20);

  const trackedContracts = latestByContract.size;

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Quality</p>
          <h1 className="ui-display-title mt-2">Data quality and lineage</h1>
          <p className="ui-muted-tight mt-2 max-w-2xl text-[15px]">
            Track completeness gaps and inspect field-level source confidence to target cleanup work.
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Signals</p>
          <h2 className="ui-section-title mt-2 text-xl">Quality overview</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <OperationalSummaryCard
            eyebrow="Snapshots"
            headline="Contracts tracked"
            tone="neutral"
            icon={Table2}
            primaryValue={trackedContracts}
            primaryUnit="latest per contract"
            action={{ href: "/contracts/data-quality", label: "Refresh view" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Gaps"
            headline="Largest gap sample"
            tone={topGaps.length > 0 ? "attention" : "healthy"}
            icon={ListFilter}
            primaryValue={topGaps.length}
            primaryUnit="in top list"
            action={{ href: "#gap-leaders", label: "Jump to list" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Lineage"
            headline="Weak field signals"
            tone={weakLineage.length > 0 ? "attention" : "healthy"}
            icon={Database}
            primaryValue={weakLineage.length}
            primaryUnit="low confidence / no snippet"
            action={{ href: "#weak-lineage", label: "Jump to list" }}
            variant="compact"
          />
        </div>
      </section>

      <section id="gap-leaders" className="ui-card scroll-mt-8 overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
          <p className="ui-eyebrow">Portfolio</p>
          <h2 className="ui-section-title mt-1 text-base">Contracts with largest data gaps</h2>
        </div>
        <ul className="divide-y divide-zinc-100">
          {topGaps.length === 0 ? (
            <li className="px-5 py-4 text-sm text-zinc-500">No snapshot data yet.</li>
          ) : (
            topGaps.map((row) => {
              const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
                | { id?: string; title?: string }
                | undefined;
              if (!contract?.id) return null;
              return (
                <li key={row.contract_id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link href={`/contracts/${contract.id}`} className="text-sm text-zinc-700 hover:text-zinc-900">
                    {contract.title ?? "Untitled contract"}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    score {Number(row.completeness_score ?? 0).toFixed(1)}% · missing{" "}
                    {Number(row.missing_critical_count ?? 0)} · stale {Number(row.stale_field_count ?? 0)}
                  </p>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section id="weak-lineage" className="ui-card scroll-mt-8 overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
          <p className="ui-eyebrow">Fields</p>
          <h2 className="ui-section-title mt-1 text-base">Weak lineage / low-confidence fields</h2>
        </div>
        <ul className="divide-y divide-zinc-100">
          {weakLineage.length === 0 ? (
            <li className="px-5 py-4 text-sm text-zinc-500">No weak lineage signals found.</li>
          ) : (
            weakLineage.map((row) => {
              const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
                | { id?: string; title?: string }
                | undefined;
              return (
                <li key={row.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-zinc-700">
                      <span className="font-medium">{row.field_name}</span> on{" "}
                      {contract?.id ? (
                        <Link className="ui-link" href={`/contracts/${contract.id}`}>
                          {contract.title ?? "Untitled"}
                        </Link>
                      ) : (
                        "Unknown contract"
                      )}
                    </p>
                    <span className="text-xs text-zinc-500">
                      {row.source} · confidence {Math.round(Number(row.confidence ?? 0) * 100)}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {row.source_snippet ? row.source_snippet : "Missing source snippet (lineage gap)."}
                  </p>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
