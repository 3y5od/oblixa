import Link from "next/link";
import { Eye } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
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
      <header className="ui-page-header border-b border-zinc-200/60 pb-8">
        <div>
          <p className="ui-eyebrow">Priority monitoring</p>
          <h1 className="ui-display-title mt-2">My watchlist</h1>
          <p className="ui-muted-tight mt-3 max-w-2xl text-[15px]">
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
          <p className="mt-2 text-sm text-zinc-500">
            Open a contract and use Add to watchlist to track escalations.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-surface shadow-[var(--shadow-1)]">
          <table className="min-w-full divide-y divide-[var(--border-subtle)] text-sm">
            <thead className="bg-zinc-50/70 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
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
                  <td className="px-5 py-4 font-semibold text-zinc-900">
                    <Link href={`/contracts/${row.contractId}`} className="ui-link">
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-zinc-700">{row.status}</td>
                  <td className="px-5 py-4 text-zinc-700">{row.teamKey ?? "—"}</td>
                  <td className="px-5 py-4 text-zinc-600">{row.note ?? "—"}</td>
                  <td className="px-5 py-4 text-zinc-700">
                    {row.annualValue == null ? "—" : `$${row.annualValue.toLocaleString()}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
