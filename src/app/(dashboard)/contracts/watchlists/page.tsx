import Link from "next/link";
import { Eye } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { STATUS_LABELS } from "@/lib/contracts";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";

export default async function ContractWatchlistsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const { admin, orgId, user } = ctx;

  const { data } = await admin
    .from("contract_watchlists")
    .select("id, note, team_key, created_at, contracts!inner(id, title, organization_id, status, annual_value)")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (data ?? []).flatMap((row) => {
    const rel = row.contracts as unknown;
    const contract = (
      Array.isArray(rel) ? rel[0] : rel
    ) as { id?: string; title?: string; status?: string; annual_value?: number | null } | null;
    if (!contract?.id || !contract?.title) return [];
    return [
      {
        id: row.id,
        contractId: contract.id,
        title: contract.title,
        status: contract.status ?? "unknown",
        annualValue: contract.annual_value ?? null,
        teamKey: row.team_key ?? null,
        note: row.note ?? null,
      },
    ];
  });

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header border-b border-[var(--border-subtle)] pb-8">
        <div>
          <p className="ui-eyebrow">Priority monitoring</p>
          <h1 className="ui-display-title mt-2">My watchlist</h1>
          <p className="ui-page-lead mt-3 max-w-2xl">
            Contracts you flagged for heightened operational attention.
          </p>
        </div>
      </header>

      <OperationalSummaryCard
        eyebrow="Coverage"
        headline="Watchlisted contracts"
        tone={rows.length > 0 ? "attention" : "healthy"}
        icon={Eye}
        primaryValue={rows.length}
        primaryUnit="in your queue"
        action={{ href: "/contracts", label: "Browse contracts" }}
        variant="compact"
        className="max-w-md"
      />

      {rows.length === 0 ? (
        <div className="ui-card px-8 py-14 text-center">
          <h2 className="ui-section-title text-base">No watchlisted contracts</h2>
          <p className="ui-support-copy mt-2">
            Open a contract and use Add to watchlist to track escalations.
          </p>
        </div>
      ) : (
        <div className="ui-table-shell">
          <div className="ui-surface-tint px-5 py-4">
            <p className="ui-eyebrow">Rows</p>
            <h2 className="ui-section-title mt-1 text-[1.05rem]">Watchlist ledger</h2>
            <p className="ui-support-copy mt-1">Keep status, team routing, and your monitoring note visible in one compact queue.</p>
          </div>
          <div className="overflow-x-auto">
          <table aria-label="Contracts on your watchlist" className="min-w-full divide-y divide-[var(--border-subtle)] text-sm">
            <thead className="bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))]/70 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              <tr>
                <th className="px-5 py-3">Contract</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Team key</th>
                <th className="px-5 py-3">Note</th>
                <th className="px-5 py-3">Annual value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-4 font-semibold text-[var(--text-primary)]">
                    <Link href={`/contracts/${row.contractId}`} className="ui-link">
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-[var(--text-secondary)]">
                    {STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] ?? row.status.replace(/_/g, " ")}
                  </td>
                  <td className="px-5 py-4 text-[var(--text-secondary)]">{row.teamKey ?? "—"}</td>
                  <td className="px-5 py-4 text-[var(--text-secondary)]">{row.note ?? "—"}</td>
                  <td className="px-5 py-4 text-[var(--text-secondary)]">
                    {row.annualValue == null ? "—" : `$${row.annualValue.toLocaleString()}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
