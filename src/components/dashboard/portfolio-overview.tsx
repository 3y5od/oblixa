import { Building2, FileType2, Lock, PieChart, Sigma } from "lucide-react";
import { getDashboardAdminClientCached } from "@/lib/dashboard-data";
import { StackedBar } from "@/components/ui/stacked-bar";
import { TopNList } from "@/components/ui/top-n-list";
import { DonutChart } from "@/components/ui/donut-chart";
import { CounterpartyInsightCard } from "@/components/dashboard/counterparty-insight-card";

interface PortfolioOverviewProps {
  orgId: string;
}

export async function PortfolioOverview({ orgId }: PortfolioOverviewProps) {
  const admin = await getDashboardAdminClientCached();
  const { data: rows } = await admin
    .from("contracts")
    .select("id, status, counterparty, contract_type, annual_value, updated_at")
    .eq("organization_id", orgId)
    .limit(500);

  const list = (rows ?? []) as Array<{
    id: string;
    status: string | null;
    counterparty: string | null;
    contract_type: string | null;
    annual_value: number | null;
    updated_at: string | null;
  }>;

  if (list.length === 0) return null;

  // Status distribution
  const STATUS_GROUPS: Record<string, "success" | "warning" | "danger" | "accent" | "neutral"> = {
    active: "success",
    pending_review: "warning",
    in_clarification: "warning",
    at_risk: "danger",
    renewal_prep: "accent",
    notice_decision: "accent",
    draft: "neutral",
    closed: "neutral",
    terminated: "neutral",
  };
  const STATUS_LABELS: Record<string, string> = {
    active: "Active",
    pending_review: "Pending",
    in_clarification: "In clarification",
    at_risk: "At risk",
    renewal_prep: "Renewal",
    notice_decision: "Notice",
    draft: "Draft",
    closed: "Closed",
    terminated: "Terminated",
  };
  const statusBuckets = new Map<string, number>();
  for (const r of list) {
    const k = r.status ?? "draft";
    statusBuckets.set(k, (statusBuckets.get(k) ?? 0) + 1);
  }
  const statusSegments = [...statusBuckets.entries()]
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([key, value]) => ({
      label: STATUS_LABELS[key] ?? key,
      value,
      tone: STATUS_GROUPS[key] ?? "neutral",
    }));

  // Top counterparties
  const cpBuckets = new Map<string, number>();
  for (const r of list) {
    const k = r.counterparty?.trim();
    if (!k) continue;
    cpBuckets.set(k, (cpBuckets.get(k) ?? 0) + 1);
  }
  const topCounterparties = [...cpBuckets.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Contract types
  const typeBuckets = new Map<string, number>();
  for (const r of list) {
    const k = r.contract_type?.trim();
    if (!k) continue;
    typeBuckets.set(k, (typeBuckets.get(k) ?? 0) + 1);
  }
  const topTypes = [...typeBuckets.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Deep stats for the single top counterparty — surfaces additional value
  // (sum, latest activity) beyond the simple top-N list.
  const topCounterpartyDeep = (() => {
    const top = topCounterparties[0];
    if (!top) return null;
    const matching = list.filter((r) => r.counterparty?.trim() === top.label);
    const annualSum = matching.reduce(
      (sum, r) => sum + (typeof r.annual_value === "number" ? r.annual_value : 0),
      0
    );
    const latestUpdate = matching
      .map((r) => r.updated_at)
      .filter((s): s is string => !!s)
      .sort()
      .pop();
    return {
      name: top.label,
      contractCount: top.value,
      annualValueTotal: annualSum > 0 ? annualSum : null,
      latestUpdatedAt: latestUpdate ?? null,
    };
  })();

  // When the workspace has only 1-2 contracts, the sub-cards (status / counterparties /
  // types) each show a single-segment bar that carries no comparative info. Hide
  // them and render a single "workspace just starting" message instead.
  const showStatus = statusSegments.length >= 2;
  const showCounterparties = topCounterparties.length >= 2;
  const showTypes = topTypes.length >= 2;
  const showTopCounterpartyDeep =
    topCounterpartyDeep !== null && topCounterpartyDeep.contractCount >= 2;
  const anyVisible = showStatus || showCounterparties || showTypes || showTopCounterpartyDeep;

  // v11 dashboard spec compliance: "Portfolio overview" violates approved
  // Core vocabulary. Renamed to "Contracts overview". Full Tier 3.9 removal
  // of this section is deferred to a coordinated pass.
  return (
    <section className="space-y-4" aria-label="Contracts overview">
      <h2 className="inline-flex items-center gap-2 text-[1.375rem] font-semibold tracking-tight text-[var(--text-primary)]">
        <PieChart className="h-4 w-4 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
        Contracts overview
      </h2>
      {!anyVisible ? (
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-card)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] leading-none text-[var(--text-tertiary)]">
            <Lock className="h-2.5 w-2.5" strokeWidth={1.85} aria-hidden />
            3 LOCKED
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                label: "STATUS MIX",
                icon: Sigma,
                now: statusSegments.length,
                need: 2,
                iconTone: "var(--accent-strong)",
              },
              {
                label: "COUNTERPARTIES",
                icon: Building2,
                now: topCounterparties.length,
                need: 2,
                iconTone: "var(--success-ink)",
              },
              {
                label: "CONTRACT TYPES",
                icon: FileType2,
                now: topTypes.length,
                need: 2,
                iconTone: "var(--warning-ink)",
              },
            ].map(({ label, icon: TileIcon, now, need, iconTone }) => {
              const pct = Math.min(100, Math.round((now / need) * 100));
              const barTone =
                pct >= 75
                  ? "var(--accent-strong)"
                  : pct >= 50
                    ? "var(--accent)"
                    : "color-mix(in oklab, var(--accent) 55%, transparent)";
              return (
                <div
                  key={label}
                  className="rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] px-3 py-2.5"
                >
                  <header className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      <TileIcon
                        className="h-3 w-3"
                        strokeWidth={1.85}
                        style={{ color: iconTone }}
                        aria-hidden
                      />
                      {label}
                    </span>
                  </header>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)]">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        background: barTone,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <span className="inline-flex items-baseline gap-0.5 rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] leading-none tabular-nums">
                      <span className="text-[var(--text-secondary)]">{now}</span>
                      <span className="font-mono text-[var(--border-strong)]" aria-hidden>
                        /
                      </span>
                      <span className="text-[var(--text-tertiary)]">{need}</span>
                    </span>
                    <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] leading-none text-[var(--text-tertiary)]">
                      UNLOCK
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {showTopCounterpartyDeep && topCounterpartyDeep ? (
            <CounterpartyInsightCard
              name={topCounterpartyDeep.name}
              contractCount={topCounterpartyDeep.contractCount}
              annualValueTotal={topCounterpartyDeep.annualValueTotal}
              latestUpdatedAt={topCounterpartyDeep.latestUpdatedAt}
              href={`/contracts?counterparty=${encodeURIComponent(topCounterpartyDeep.name)}`}
            />
          ) : null}
          {showStatus ? (
            <div className="rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                Status distribution
              </p>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                <span className="tabular-nums font-semibold text-[var(--text-primary)]">{list.length}</span>{" "}
                contracts in this workspace.
              </p>
              <div className="mt-3">
                <StackedBar segments={statusSegments} height={12} />
              </div>
            </div>
          ) : null}
          {showCounterparties ? (
            <div className="rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                Top counterparties
              </p>
              <div className="mt-3">
                <TopNList items={topCounterparties} unit=" contracts" />
              </div>
            </div>
          ) : null}
          {showTypes ? (
            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-4 sm:grid-cols-[1fr_180px] lg:col-span-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  Contract types
                </p>
                <div className="mt-3">
                  <TopNList items={topTypes} unit=" contracts" />
                </div>
              </div>
              <div className="flex items-center justify-center">
                <DonutChart
                  segments={topTypes.map((t) => ({ label: t.label, value: t.value }))}
                  size={140}
                  thickness={16}
                  centerLabel="By type"
                  centerValue={list.length}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
