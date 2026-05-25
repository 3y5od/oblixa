import { TrendingUp } from "lucide-react";
import { subDays, startOfDay, format } from "date-fns";
import { getDashboardAdminClientCached } from "@/lib/dashboard-data";
import { Sparkline } from "@/components/ui/sparkline";
import type { StatTone } from "@/components/ui/stat-cell";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import { SectionRefreshButton } from "@/components/dashboard/section-refresh-button";

interface TrendsSectionProps {
  orgId: string;
}

const SERIES_ACTIONS = [
  { action: "contract.uploaded", label: "Uploads", tone: "neutral" as StatTone },
  { action: "field.approved", label: "Fields reviewed", tone: "success" as StatTone },
  { action: "approval.completed", label: "Approvals signed", tone: "success" as StatTone },
  { action: "exception.opened", label: "Exceptions opened", tone: "warning" as StatTone },
];

export async function TrendsSection({ orgId }: TrendsSectionProps) {
  const admin = await getDashboardAdminClientCached();
  const since = subDays(new Date(), 30);
  const sinceIso = since.toISOString();

  const { data: rows } = await admin
    .from("audit_events")
    .select("action, created_at")
    .eq("organization_id", orgId)
    .in(
      "action",
      SERIES_ACTIONS.map((s) => s.action)
    )
    .gte("created_at", sinceIso)
    .range(0, 4999);

  const events = (rows ?? []) as Array<{ action: string; created_at: string }>;
  if (events.length === 0) return null;

  // Bucket per-day per-action.
  const dayKeys: string[] = [];
  const today = startOfDay(new Date());
  for (let i = 29; i >= 0; i--) {
    dayKeys.push(format(subDays(today, i), "yyyy-MM-dd"));
  }
  const dayKeySet = new Set(dayKeys);

  const buckets = new Map<string, Map<string, number>>(); // action -> day -> count
  for (const e of events) {
    const day = format(new Date(e.created_at), "yyyy-MM-dd");
    if (!dayKeySet.has(day)) continue;
    const cur = buckets.get(e.action) ?? new Map<string, number>();
    cur.set(day, (cur.get(day) ?? 0) + 1);
    buckets.set(e.action, cur);
  }

  const series = SERIES_ACTIONS.map((s) => {
    const dayMap = buckets.get(s.action) ?? new Map<string, number>();
    const data = dayKeys.map((k) => dayMap.get(k) ?? 0);
    const total = data.reduce((sum, v) => sum + v, 0);
    return { ...s, data, total };
  });

  const anyNonZero = series.some((s) => s.total > 0);
  if (!anyNonZero) return null;

  return (
    <section aria-label="30-day activity trends">
      <CollapsibleSection
        storageKey="trends-section"
        header={
          <div className="flex flex-1 items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 text-[1.375rem] font-semibold tracking-tight text-[var(--text-primary)]">
              <TrendingUp
                className="h-4 w-4 text-[var(--accent-strong)]"
                strokeWidth={1.85}
                aria-hidden
              />
              30-day trends
            </h2>
            <SectionRefreshButton label="Refresh 30-day trends" />
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-4 sm:grid-cols-4">
        {series.map((s) => {
          const hasData = s.total > 0;
          return (
            <div key={s.action} className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                {s.label}
              </p>
              <p
                className="text-[1.625rem] font-semibold leading-none tabular-nums tracking-[-0.02em]"
                style={{
                  color: hasData
                    ? s.tone === "success"
                      ? "var(--success-ink)"
                      : s.tone === "warning"
                        ? "var(--warning-ink)"
                        : s.tone === "danger"
                          ? "var(--danger-ink)"
                          : "var(--text-primary)"
                    : "var(--text-tertiary)",
                }}
              >
                {s.total}
              </p>
              <Sparkline
                data={s.data}
                tone={s.tone}
                width={140}
                height={28}
                placeholder={!hasData}
                ariaLabel={`${s.label} 30-day sparkline`}
              />
            </div>
          );
        })}
      </div>
      </CollapsibleSection>
    </section>
  );
}
