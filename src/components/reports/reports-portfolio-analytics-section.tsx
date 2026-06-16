import Link from "next/link";
import { ApiJsonLink } from "@/components/ui/api-json-link";
import { OperationalSectionHeader } from "@/components/ui/operational-summary-card";

type PortfolioProgramRow = { program_id: string; active_assignments: number };
type PortfolioCounterpartyRow = { counterparty_key: string; open_exceptions: number };

export function ReportsPortfolioAnalyticsSection(props: {
  portfolioByProgram: { programs: PortfolioProgramRow[]; error: string | null };
  portfolioByCounterparty: { counterparties: PortfolioCounterpartyRow[]; error: string | null };
  relationshipsVisible: boolean;
}) {
  const { portfolioByProgram, portfolioByCounterparty, relationshipsVisible } = props;
  return (
    <section id="portfolio-analytics" className="scroll-mt-8 space-y-4">
      <OperationalSectionHeader
        eyebrow="Portfolio"
        title="Portfolio analytics"
        description="Workload by active program assignment and open exception concentration by counterparty."
      />
      {portfolioByProgram.error ? (
        <p className="ui-alert-error">Program analytics: {portfolioByProgram.error}</p>
      ) : null}
      {portfolioByCounterparty.error ? (
        <p className="ui-alert-error">Counterparty analytics: {portfolioByCounterparty.error}</p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <PortfolioByProgramCard programs={portfolioByProgram.programs ?? []} />
        <PortfolioByCounterpartyCard
          counterparties={portfolioByCounterparty.counterparties ?? []}
          relationshipsVisible={relationshipsVisible}
        />
      </div>
      <details className="ui-soft-details p-4 text-xs text-[var(--text-secondary)]">
        <summary className="cursor-pointer font-medium text-[var(--text-primary)]">Raw analytics payloads</summary>
        <pre className="ui-soft-details mt-3 max-h-64 overflow-auto p-3 font-mono text-[11px] text-[var(--text-secondary)]">
          {JSON.stringify(
            {
              programs: portfolioByProgram.programs,
              counterparties: portfolioByCounterparty.counterparties,
            },
            null,
            2
          )}
        </pre>
      </details>
    </section>
  );
}

function PortfolioByProgramCard({ programs }: { programs: PortfolioProgramRow[] }) {
  return (
    <article className="ui-card p-5" id="portfolio-by-program">
      <p className="ui-eyebrow">Programs</p>
      <h3 className="ui-section-title mt-1 text-base">Contracts by program</h3>
      <p className="ui-muted-tight mt-1">Active assignment row counts per program.</p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
        <table className="min-w-full text-left text-sm text-[var(--text-secondary)]">
          <thead className="bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            <tr>
              <th className="px-3 py-2">Program</th>
              <th className="px-3 py-2">Active assignments</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {programs.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-3 py-4 text-[var(--text-tertiary)]">
                  No active program assignments.
                </td>
              </tr>
            ) : (
              programs.map((p) => (
                <tr key={p.program_id}>
                  <td className="px-3 py-2 font-mono text-xs">{p.program_id}</td>
                  <td className="px-3 py-2">{p.active_assignments}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <ApiJsonLink href="/api/intelligence/portfolio-by-program" className="ui-link mt-3 inline-block text-xs">
        View JSON
      </ApiJsonLink>
    </article>
  );
}

function PortfolioByCounterpartyCard({
  counterparties,
  relationshipsVisible,
}: {
  counterparties: PortfolioCounterpartyRow[];
  relationshipsVisible: boolean;
}) {
  return (
    <article className="ui-card p-5" id="portfolio-by-counterparty">
      <p className="ui-eyebrow">Counterparties</p>
      <h3 className="ui-section-title mt-1 text-base">Active exceptions by counterparty</h3>
      <p className="ui-muted-tight mt-1">Contracts with exceptions, grouped by counterparty key.</p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
        <table className="min-w-full text-left text-sm text-[var(--text-secondary)]">
          <thead className="bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            <tr>
              <th className="px-3 py-2">Counterparty</th>
              <th className="px-3 py-2">Open / in progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {counterparties.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-3 py-4 text-[var(--text-tertiary)]">
                  No matching exceptions.
                </td>
              </tr>
            ) : (
              counterparties.map((c) => (
                <tr key={c.counterparty_key}>
                  <td className="px-3 py-2">
                    {relationshipsVisible ? (
                      <Link
                        href={`/counterparties/${encodeURIComponent(c.counterparty_key)}`}
                        className="ui-link font-mono text-xs"
                      >
                        {c.counterparty_key}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs">{c.counterparty_key}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{c.open_exceptions}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <ApiJsonLink href="/api/intelligence/portfolio-by-counterparty" className="ui-link mt-3 inline-block text-xs">
        View JSON
      </ApiJsonLink>
    </article>
  );
}
