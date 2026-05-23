import Link from "next/link";
import { differenceInDays, isValid } from "date-fns";
import { Filter } from "lucide-react";
import {
  getDashboardAdminClientCached,
  getDashboardDateFieldsCached,
} from "@/lib/dashboard-data";

interface SmartFiltersProps {
  orgId: string;
}

type DateFieldRow = {
  field_name: string;
  field_value: string | null;
  contracts: { id: string };
};

interface FilterPill {
  id: string;
  /** Primary caps token — the subject. */
  primary: string;
  /** Optional secondary caps token — the modifier. */
  secondary?: string;
  count: number;
  href: string;
}

export async function SmartFilters({ orgId }: SmartFiltersProps) {
  const admin = await getDashboardAdminClientCached();

  const [dateFieldsRaw, { data: contractsRaw }, { data: tasksRaw }] = await Promise.all([
    getDashboardDateFieldsCached(orgId),
    admin
      .from("contracts")
      .select("id, status, owner_id, created_at")
      .eq("organization_id", orgId)
      .limit(500),
    admin
      .from("contract_tasks")
      .select("id, status, created_at")
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress"])
      .limit(500),
  ]);

  const dateFields = dateFieldsRaw as unknown as DateFieldRow[];
  const contracts = (contractsRaw ?? []) as Array<{
    id: string;
    status: string | null;
    owner_id: string | null;
    created_at: string;
  }>;
  const tasks = (tasksRaw ?? []) as Array<{ id: string; status: string; created_at: string }>;

  const today = new Date();
  const pills: FilterPill[] = [];

  // Filter 1: Contracts expiring this quarter (next 90 days).
  const expiringContractIds = new Set<string>();
  for (const f of dateFields) {
    if (!f.field_value || (f.field_name !== "end_date" && f.field_name !== "expiration_date")) continue;
    const d = new Date(f.field_value);
    if (!isValid(d)) continue;
    const days = differenceInDays(d, today);
    if (days >= 0 && days <= 90) expiringContractIds.add(f.contracts.id);
  }
  if (expiringContractIds.size > 0) {
    pills.push({
      id: "expiring-quarter",
      primary: "EXPIRING",
      secondary: "90D",
      count: expiringContractIds.size,
      href: "/contracts?end_within_days=90",
    });
  }

  // Filter 2: Contracts without notice windows but with renewal dates.
  const hasRenewal = new Set<string>();
  const hasNotice = new Set<string>();
  for (const f of dateFields) {
    if (!f.field_value) continue;
    if (f.field_name === "renewal_date") hasRenewal.add(f.contracts.id);
    if (f.field_name === "notice_window_starts" || f.field_name === "notice_window_ends") {
      hasNotice.add(f.contracts.id);
    }
  }
  const renewalsWithoutNotice = [...hasRenewal].filter((id) => !hasNotice.has(id)).length;
  if (renewalsWithoutNotice > 0) {
    pills.push({
      id: "renewals-no-notice",
      primary: "RENEWAL",
      secondary: "NO NOTICE",
      count: renewalsWithoutNotice,
      href: "/contracts?missing=notice_window",
    });
  }

  // Filter 3: Pending review > 7 days.
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const stalePending = contracts.filter(
    (c) => c.status === "pending_review" && new Date(c.created_at) < sevenDaysAgo
  ).length;
  if (stalePending > 0) {
    pills.push({
      id: "stale-pending-review",
      primary: "PENDING",
      secondary: ">7D",
      count: stalePending,
      href: "/contracts?status=pending_review&age=7",
    });
  }

  // Filter 4: Unassigned contracts.
  const unassigned = contracts.filter((c) => !c.owner_id).length;
  if (unassigned > 0) {
    pills.push({
      id: "unassigned",
      primary: "UNASSIGNED",
      count: unassigned,
      href: "/contracts?owner=unassigned",
    });
  }

  // Filter 5: Old open tasks > 14 days.
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const staleTasks = tasks.filter((t) => new Date(t.created_at) < fourteenDaysAgo).length;
  if (staleTasks > 0) {
    pills.push({
      id: "stale-tasks",
      primary: "TASK",
      secondary: ">14D",
      count: staleTasks,
      href: "/contracts/tasks?age=14",
    });
  }

  if (pills.length === 0) return null;

  return (
    <section className="space-y-3" aria-label="Smart filters">
      <h2 className="inline-flex items-center gap-2 text-[1.375rem] font-semibold tracking-tight text-[var(--text-primary)]">
        <Filter className="h-4 w-4 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
        Smart filters
        <span className="inline-flex items-center rounded-md border border-[var(--border-card)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] leading-none tabular-nums text-[var(--text-secondary)]">
          {pills.length}
        </span>
      </h2>
      <div className="flex flex-wrap gap-2">
        {pills.map((pill) => {
          const isStale =
            pill.id === "stale-pending-review" || pill.id === "stale-tasks";
          const isCritical =
            pill.id === "expiring-quarter" && pill.count >= 5;
          const tone: "warning" | "danger" | "neutral" = isCritical
            ? "danger"
            : isStale
              ? "warning"
              : "neutral";
          const ink =
            tone === "danger"
              ? "var(--danger-ink)"
              : tone === "warning"
                ? "var(--warning-ink)"
                : "var(--text-secondary)";
          const secondaryInk =
            tone === "neutral"
              ? "var(--text-tertiary)"
              : `color-mix(in oklab, ${ink} 70%, var(--text-secondary))`;
          return (
            <Link
              key={pill.id}
              href={pill.href}
              className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[10.5px] uppercase leading-none transition-colors hover:brightness-110"
              style={{
                borderColor:
                  tone === "neutral"
                    ? "var(--border-card)"
                    : `color-mix(in oklab, ${ink} 32%, var(--border-card))`,
                background:
                  tone === "neutral"
                    ? "var(--surface-raised)"
                    : `color-mix(in oklab, ${ink} 10%, var(--surface-raised))`,
                color: ink,
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="font-bold tracking-[0.14em]">{pill.primary}</span>
                {pill.secondary ? (
                  <span
                    className="font-medium tracking-[0.12em]"
                    style={{ color: secondaryInk }}
                  >
                    {pill.secondary}
                  </span>
                ) : null}
              </span>
              <span
                className="inline-flex items-center rounded-md border px-1 py-0 text-[9.5px] font-bold uppercase tracking-[0.12em] leading-none tabular-nums"
                style={{
                  borderColor:
                    tone === "neutral"
                      ? "color-mix(in oklab, var(--border-strong) 60%, transparent)"
                      : `color-mix(in oklab, ${ink} 32%, var(--border-card))`,
                  background:
                    tone === "neutral"
                      ? "var(--surface)"
                      : `color-mix(in oklab, ${ink} 14%, var(--surface-raised))`,
                  color: ink,
                  minHeight: "16px",
                }}
              >
                {pill.count}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
