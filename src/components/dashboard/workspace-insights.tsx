import { Clock4, Sparkles, Trophy } from "lucide-react";
import { subDays } from "date-fns";
import { getDashboardAdminClientCached } from "@/lib/dashboard-data";
import { UiAvatar } from "@/components/ui/ui-avatar";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import { SectionRefreshButton } from "@/components/dashboard/section-refresh-button";

interface WorkspaceInsightsProps {
  orgId: string;
}

const APPROVED_FIELD_SECONDS = 90;

function formatHoursSaved(seconds: number): { value: string; unit: string } {
  const hours = seconds / 3600;
  if (hours >= 1) {
    return { value: hours.toFixed(hours >= 10 ? 0 : 1), unit: hours === 1 ? "hour" : "hours" };
  }
  const minutes = Math.round(seconds / 60);
  return { value: String(minutes), unit: minutes === 1 ? "minute" : "minutes" };
}

export async function WorkspaceInsights({ orgId }: WorkspaceInsightsProps) {
  const admin = await getDashboardAdminClientCached();
  const sevenDaysAgo = subDays(new Date(), 7).toISOString();

  const [
    approvedFieldsTotalRes,
    approvalsCompletedRecentRes,
    reviewerEventsRes,
  ] = await Promise.all([
    admin
      .from("contract_fields")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "approved"),
    admin
      .from("audit_events")
      .select("id, created_at", { count: "exact" })
      .eq("organization_id", orgId)
      .eq("action", "approval.completed")
      .gte("created_at", sevenDaysAgo)
      .limit(50),
    admin
      .from("audit_events")
      .select("user_id, details")
      .eq("organization_id", orgId)
      .eq("action", "field.approved")
      .gte("created_at", sevenDaysAgo)
      .not("user_id", "is", null)
      .limit(500),
  ]);

  const approvedFieldsTotal = approvedFieldsTotalRes.count ?? 0;
  const approvalsThisWeek = approvalsCompletedRecentRes.count ?? 0;

  const hoursSaved = formatHoursSaved(approvedFieldsTotal * APPROVED_FIELD_SECONDS);

  // Reviewer leaderboard — aggregate by user_id, prefer detail.actor_name for label.
  const reviewerCounts = new Map<string, { count: number; name?: string; email?: string }>();
  for (const row of (reviewerEventsRes.data ?? []) as Array<{
    user_id: string | null;
    details: Record<string, unknown> | null;
  }>) {
    const userId = row.user_id;
    if (!userId) continue;
    const cur = reviewerCounts.get(userId) ?? { count: 0 };
    cur.count += 1;
    if (!cur.name && row.details && typeof row.details.actor_name === "string") {
      cur.name = row.details.actor_name;
    }
    if (!cur.email && row.details && typeof row.details.email === "string") {
      cur.email = row.details.email;
    }
    reviewerCounts.set(userId, cur);
  }
  const topReviewers = Array.from(reviewerCounts.entries())
    .map(([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Resolve missing names from profiles table.
  const unresolvedIds = topReviewers.filter((r) => !r.name && !r.email).map((r) => r.userId);
  if (unresolvedIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", unresolvedIds);
    const map = new Map(
      ((profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map(
        (p) => [p.id, p]
      )
    );
    for (const r of topReviewers) {
      const p = map.get(r.userId);
      if (p) {
        if (!r.name && p.full_name && p.full_name.trim() !== "name") r.name = p.full_name;
        if (!r.email && p.email) r.email = p.email;
      }
    }
  }

  // Nothing meaningful to show — skip the entire section.
  if (
    approvedFieldsTotal === 0 &&
    approvalsThisWeek === 0 &&
    topReviewers.length === 0
  ) {
    return null;
  }

  const maxReviewerCount = topReviewers[0]?.count ?? 1;

  return (
    <section aria-label="Workspace insights">
      <CollapsibleSection
        storageKey="workspace-insights"
        header={
          <div className="flex flex-1 items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 text-[1.375rem] font-semibold tracking-tight text-[var(--text-primary)]">
              <Sparkles
                className="h-4 w-4 text-[var(--accent-strong)]"
                strokeWidth={1.85}
                aria-hidden
              />
              Workspace insights
            </h2>
            <SectionRefreshButton label="Refresh workspace insights" />
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Time saved */}
        <div className="rounded-2xl border border-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--border-card))] bg-[var(--surface-raised)] p-4">
          <header className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              Time saved
            </p>
          </header>
          <div className="mt-3 flex items-baseline gap-1.5">
            <p
              className="text-[2rem] font-semibold leading-none tabular-nums tracking-[-0.02em] text-[var(--accent-strong)]"
              title={`Based on ${approvedFieldsTotal.toLocaleString()} approved fields × ${APPROVED_FIELD_SECONDS}s manual review time`}
            >
              {hoursSaved.value}
            </p>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              {hoursSaved.unit.toUpperCase()}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-card)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] leading-none">
              <span className="text-[var(--text-tertiary)]">FIELDS</span>
              <span className="tabular-nums text-[var(--text-primary)]">
                {approvedFieldsTotal.toLocaleString()}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-card)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] leading-none">
              <span className="text-[var(--text-tertiary)]">PER</span>
              <span className="tabular-nums text-[var(--text-primary)]">
                {APPROVED_FIELD_SECONDS}s
              </span>
            </span>
          </div>
        </div>

        {/* Approval velocity */}
        <div className="rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-4">
          <header className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              <Clock4 className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              Approval velocity
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] uppercase leading-none">
              <span className="font-bold tracking-[0.14em] text-[var(--text-secondary)]">WINDOW</span>
              <span className="font-medium tracking-[0.12em] text-[var(--text-tertiary)]">7D</span>
            </span>
          </header>
          <div className="mt-3 flex items-baseline gap-1.5">
            <p
              className="text-[2rem] font-semibold leading-none tabular-nums tracking-[-0.02em]"
              style={{
                color:
                  approvalsThisWeek > 0
                    ? "var(--success-ink)"
                    : "var(--text-tertiary)",
              }}
            >
              {approvalsThisWeek}
            </p>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              SIGNED
            </span>
          </div>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-[var(--border-card)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--text-tertiary)]">
            {approvalsThisWeek === 0 ? "NONE THIS WEEK" : "APPROVALS COMPLETED"}
          </span>
        </div>

        {/* Reviewer leaderboard */}
        <div className="rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-4">
          <header className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              <Trophy className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              Top reviewers
            </p>
            <span className="inline-flex items-center rounded-full border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--text-tertiary)]">
              7D
            </span>
          </header>
          {topReviewers.length === 0 ? (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-card)] bg-[var(--surface)] px-2 py-0.5 text-[10.5px] uppercase leading-none">
              <span className="font-bold tracking-[0.14em] text-[var(--text-secondary)]">NO APPROVALS</span>
              <span className="font-medium tracking-[0.12em] text-[var(--text-tertiary)]">7D</span>
            </span>
          ) : (
            <ul className="mt-3 space-y-2">
              {topReviewers.map((r) => {
                const display = r.name ?? (r.email ? r.email.split("@")[0] : "Member");
                const widthPct = Math.round((r.count / maxReviewerCount) * 100);
                return (
                  <li key={r.userId} className="flex items-center gap-2 text-[12px]">
                    <UiAvatar name={r.name ?? null} email={r.email ?? null} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)]">{display}</p>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] leading-none tabular-nums text-[var(--text-secondary)]">
                      <span className="text-[var(--success-ink)]">APPROVED</span>
                      <span>{r.count}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      </CollapsibleSection>
    </section>
  );
}
