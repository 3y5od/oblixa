import Link from "next/link";
import { BarChart3, Check, ChevronRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import type { OperationalTone } from "@/lib/ui/operational-surface";
import { Sparkline } from "@/components/ui/sparkline";

// Derive a 7-point trend for a metric. Surfaces visual motion without a
// time-series store; the last value is always the current count.
function syntheticTrend(seed: string, current: number): number[] {
  const trend: number[] = [];
  for (let i = 0; i < 7; i++) {
    const c = (seed.charCodeAt(0) ?? 64) + i * 13;
    const wobble = ((c * 9301 + 49297) % 233280) / 233280;
    trend.push(Math.max(0, Math.round(current * (0.55 + wobble * 0.9))));
  }
  trend[trend.length - 1] = current;
  return trend;
}

function sparklineTone(tone: OperationalTone): "neutral" | "success" | "warning" | "danger" {
  if (tone === "risk") return "danger";
  if (tone === "attention") return "warning";
  if (tone === "healthy") return "success";
  return "neutral";
}

type QuickFilter = "all" | "approvals" | "deadlines" | "data_gaps";

const QUICK_FILTER_LABELS: Record<QuickFilter, string> = {
  all: "All",
  approvals: "Approvals",
  deadlines: "Deadlines",
  data_gaps: "Data gaps",
};

export async function CommandCenterRoleMetrics(props: {
  orgId: string;
  role: WorkspaceRole;
  view?: "personal" | "team" | "portfolio";
  quickFilter?: QuickFilter;
}) {
  const view = props.view ?? "personal";
  const quickFilter: QuickFilter = props.quickFilter ?? "all";
  const admin = await createAdminClient();
  const nowIso = new Date().toISOString();

  const [
    { count: exceptionOpen },
    { count: approvalsPending },
    { count: approvalsBreached },
    { count: tasksActive },
    { count: obligationsActive },
  ] = await Promise.all([
    admin
      .from("exceptions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", props.orgId)
      .in("status", ["open", "in_progress"]),
    admin
      .from("contract_approvals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", props.orgId)
      .eq("status", "pending"),
    admin
      .from("contract_approvals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", props.orgId)
      .eq("status", "pending")
      .not("due_at", "is", null)
      .lt("due_at", nowIso),
    admin
      .from("contract_tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", props.orgId)
      .in("status", ["open", "in_progress", "blocked"]),
    admin
      .from("contract_obligations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", props.orgId)
      .in("status", ["open", "in_progress"]),
  ]);

  const ex = exceptionOpen ?? 0;
  const ap = approvalsPending ?? 0;
  const br = approvalsBreached ?? 0;
  const ta = tasksActive ?? 0;
  const ob = obligationsActive ?? 0;

  const cells: Array<{
    label: string;
    value: number;
    unit: string;
    tone: OperationalTone;
    href: string;
    ariaLabel: string;
    key: string;
  }> = [
    {
      key: "exceptions",
      label: "Exceptions",
      value: ex,
      unit: "OPEN WIP",
      tone: ex > 10 ? "risk" : ex > 0 ? "attention" : "healthy",
      href: "/contracts/exceptions",
      ariaLabel: "View open exceptions",
    },
    {
      key: "approvals",
      label: "Approvals",
      value: ap,
      unit: "AWAITING",
      tone: ap > 0 ? "attention" : "healthy",
      href: "/contracts/approvals",
      ariaLabel: "View pending approvals",
    },
    {
      key: "past_due",
      label: "Past due",
      value: br,
      unit: "OVERDUE",
      tone: br > 0 ? "risk" : "healthy",
      href: "/contracts/approvals/workload",
      ariaLabel: "View overdue approvals",
    },
    {
      key: "active_tasks",
      label: "Active tasks",
      value: ta,
      unit: "ACTIVE",
      tone: ta > 0 ? "neutral" : "healthy",
      href: "/work",
      ariaLabel: "View work queue",
    },
    {
      key: "obligations",
      label: "Obligations",
      value: ob,
      unit: "OPEN",
      tone: ob > 0 ? "neutral" : "healthy",
      href: "/contracts/obligations",
      ariaLabel: "View active obligations",
    },
  ];

  const filterOptions: Array<{ id: QuickFilter; href: string }> = [
    { id: "all", href: `/dashboard?view=${view}` },
    { id: "approvals", href: `/dashboard?view=${view}&qf=approvals` },
    { id: "deadlines", href: `/dashboard?view=${view}&qf=deadlines` },
    { id: "data_gaps", href: `/dashboard?view=${view}&qf=data_gaps` },
  ];
  const filterIsActive = quickFilter !== "all";

  // Mark cells that fall outside the active filter scope, so they read as
  // de-emphasized when a non-`all` filter is selected.
  function isInScope(cellKey: string): boolean {
    if (!filterIsActive) return true;
    if (quickFilter === "approvals") return cellKey === "approvals" || cellKey === "past_due";
    if (quickFilter === "deadlines") return cellKey === "obligations" || cellKey === "past_due";
    if (quickFilter === "data_gaps") return cellKey === "exceptions";
    return true;
  }

  return (
    <section aria-label="Live portfolio metrics" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-[1.375rem] font-semibold tracking-tight text-[var(--text-primary)]">
          <BarChart3 className="h-4 w-4 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
          Live portfolio metrics
        </h2>
        <nav aria-label="Quick filters" className="ui-segmented inline-flex">
          {filterOptions.map((option) => (
            <Link
              key={option.id}
              href={option.href}
              aria-current={quickFilter === option.id ? "true" : undefined}
              className={`ui-segmented-item ${quickFilter === option.id ? "ui-segmented-item-active" : ""}`}
            >
              {QUICK_FILTER_LABELS[option.id]}
            </Link>
          ))}
        </nav>
      </div>
      {filterIsActive ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_32%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] px-2 py-0.5 text-[10.5px] uppercase leading-none">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--accent-strong)]" />
            <span className="font-bold tracking-[0.14em] text-[var(--accent-strong)]">FILTER</span>
            <span className="font-medium tracking-[0.12em] text-[color:color-mix(in_oklab,var(--accent-strong)_70%,var(--text-secondary))]">
              {QUICK_FILTER_LABELS[quickFilter].toUpperCase()}
            </span>
          </span>
          <Link
            href={`/dashboard?view=${view}`}
            className="inline-flex items-center gap-0.5 rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <span aria-hidden>×</span>
            CLEAR
          </Link>
        </div>
      ) : null}
      <div className="grid grid-cols-2 divide-x divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] sm:grid-cols-3 lg:grid-cols-5">
        {cells.map((c) => {
          const isZero = c.value === 0;
          const inScope = isInScope(c.key);
          return (
            <Link
              key={c.key}
              href={c.href}
              aria-label={c.ariaLabel}
              data-out-of-scope={!inScope || undefined}
              className={`group relative flex min-h-[96px] items-stretch gap-3 px-4 py-3 transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_50%,transparent)] ${
                inScope ? "" : "opacity-40"
              }`}
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-1.5">
                  {/* Tone dot — active cells get the tone-tinted dot with halo;
                     0-value cells get a muted success dot to communicate "all clear". */}
                  <span
                    aria-hidden
                    className="relative inline-flex h-2 w-2 min-w-[0.625rem] shrink-0 items-center justify-center"
                  >
                    {!isZero ? (
                      <>
                        <span
                          className="absolute inset-0 rounded-full"
                          style={{
                            background: `color-mix(in oklab, ${toneDot(c.tone)} 30%, transparent)`,
                          }}
                        />
                        <span
                          className="relative h-1.5 w-1.5 rounded-full"
                          style={{ background: toneDot(c.tone) }}
                        />
                      </>
                    ) : (
                      <span
                        className="relative h-1.5 w-1.5 rounded-full"
                        style={{
                          background:
                            "color-mix(in oklab, var(--success-ink) 60%, transparent)",
                        }}
                      />
                    )}
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    {c.label}
                  </p>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {isZero ? (
                    <span
                      aria-hidden
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border"
                      style={{
                        borderColor:
                          "color-mix(in oklab, var(--success-ink) 28%, var(--border-card))",
                        background:
                          "color-mix(in oklab, var(--success-ink) 12%, var(--surface))",
                        color: "var(--success-ink)",
                      }}
                    >
                      <Check className="h-3 w-3" strokeWidth={2.2} />
                    </span>
                  ) : null}
                  <p
                    className="text-[2rem] font-semibold leading-none tabular-nums tracking-[-0.02em]"
                    style={{
                      color: numberColor(c.tone, isZero),
                      animation: "ui-stat-value-enter 360ms var(--ui-ease-out, ease-out)",
                    }}
                  >
                    {c.value}
                  </p>
                </div>
                <div className="mt-1 flex min-h-[16px] items-center justify-between gap-2">
                  <span
                    className="inline-flex h-4 shrink-0 items-center whitespace-nowrap rounded-md border bg-[var(--surface)] px-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] leading-none"
                    style={{
                      borderColor: isZero
                        ? "color-mix(in oklab, var(--success-ink) 24%, var(--border-card))"
                        : "var(--border-card)",
                      color: isZero
                        ? "color-mix(in oklab, var(--success-ink) 55%, var(--text-tertiary))"
                        : "var(--text-tertiary)",
                    }}
                  >
                    {c.unit}
                  </span>
                  <Sparkline
                    data={syntheticTrend(c.key, c.value)}
                    tone={sparklineTone(c.tone)}
                    width={48}
                    height={14}
                    showArea
                    placeholder
                  />
                </div>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 self-center text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-90"
                strokeWidth={1.85}
                aria-hidden
              />
              {/* Hover popover with extended sparkline. CSS-only — no client state. */}
              <span
                role="tooltip"
                aria-hidden
                className="pointer-events-none invisible absolute left-1/2 top-full z-30 mt-1 w-[212px] -translate-x-1/2 rounded-xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-3 opacity-0 shadow-[var(--shadow-2)] transition-[opacity,visibility] duration-150 group-hover:visible group-hover:opacity-100"
              >
                <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  <span>{c.label}</span>
                  <span aria-hidden className="ui-dot-sep">·</span>
                  <span>7D</span>
                </span>
                <span className="mt-1.5 block">
                  <Sparkline
                    data={syntheticTrend(c.key, c.value)}
                    tone={sparklineTone(c.tone)}
                    width={188}
                    height={48}
                    showArea
                    showDot
                    placeholder
                  />
                </span>
                <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
                  <dt className="text-[var(--text-tertiary)]">CURRENT</dt>
                  <dd className="tabular-nums text-[var(--text-primary)]">{c.value}</dd>
                  <dt className="text-[var(--text-tertiary)]">UNIT</dt>
                  <dd className="text-[var(--text-secondary)]">{c.unit}</dd>
                  <dt className="text-[var(--text-tertiary)]">TREND</dt>
                  <dd className="text-[var(--text-tertiary)]">—</dd>
                </dl>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function numberColor(tone: OperationalTone, isZero: boolean): string {
  // 0-value cells imply a healthy / clear state — render in muted success
  // so the number visually pairs with the green Check medallion next to it.
  if (isZero) return "color-mix(in oklab, var(--success-ink) 55%, var(--text-tertiary))";
  if (tone === "risk") return "var(--danger-ink)";
  if (tone === "attention") return "var(--warning-ink)";
  if (tone === "healthy") return "var(--success-ink)";
  return "var(--text-primary)";
}

function toneDot(tone: OperationalTone): string {
  if (tone === "risk") return "var(--danger-ink)";
  if (tone === "attention") return "var(--warning-ink)";
  if (tone === "healthy") return "var(--success-ink)";
  return "color-mix(in oklab, var(--border-strong) 70%, var(--text-tertiary))";
}
