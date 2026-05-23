import Link from "next/link";
import { differenceInDays, isValid } from "date-fns";
import { GitBranch } from "lucide-react";
import { getDashboardAdminClientCached, getDashboardDateFieldsCached } from "@/lib/dashboard-data";

interface RenewalPipelineFunnelProps {
  orgId: string;
}

type DateFieldRow = {
  field_name: string;
  field_value: string | null;
  contracts: { id: string; title: string; organization_id: string };
};

export async function RenewalPipelineFunnel({ orgId }: RenewalPipelineFunnelProps) {
  const admin = await getDashboardAdminClientCached();
  const dateFields = (await getDashboardDateFieldsCached(orgId)) as unknown as DateFieldRow[];

  const { data: contractRows } = await admin
    .from("contracts")
    .select("id, status")
    .eq("organization_id", orgId)
    .limit(1000);
  const contracts = (contractRows ?? []) as Array<{ id: string; status: string | null }>;

  if (contracts.length === 0) return null;

  const today = new Date();

  const activeIds = new Set(
    contracts.filter((c) => c.status === "active").map((c) => c.id)
  );

  // Build per-contract date maps.
  const renewalByContract = new Map<string, Date>();
  const endByContract = new Map<string, Date>();
  const noticeOpensByContract = new Map<string, Date>();
  const noticeClosesByContract = new Map<string, Date>();

  for (const f of dateFields) {
    if (!f.field_value) continue;
    const d = new Date(f.field_value);
    if (!isValid(d)) continue;
    const id = f.contracts.id;
    if (f.field_name === "renewal_date") renewalByContract.set(id, d);
    else if (f.field_name === "end_date" || f.field_name === "expiration_date") endByContract.set(id, d);
    else if (f.field_name === "notice_window_starts") noticeOpensByContract.set(id, d);
    else if (f.field_name === "notice_window_ends") noticeClosesByContract.set(id, d);
  }

  // Stage 1: Active contracts.
  const stage1 = activeIds.size;

  // Stage 2: Renewal within 90 days (using renewal_date OR end_date).
  const stage2Ids = new Set<string>();
  for (const id of activeIds) {
    const candidate = renewalByContract.get(id) ?? endByContract.get(id);
    if (!candidate) continue;
    const days = differenceInDays(candidate, today);
    if (days >= 0 && days <= 90) stage2Ids.add(id);
  }
  const stage2 = stage2Ids.size;

  // Stage 3: Notice window currently open (notice_opens <= today <= notice_closes).
  const stage3Ids = new Set<string>();
  for (const id of stage2Ids) {
    const opens = noticeOpensByContract.get(id);
    const closes = noticeClosesByContract.get(id);
    if (!opens) continue;
    const openDays = differenceInDays(opens, today);
    const closeDays = closes ? differenceInDays(closes, today) : 365;
    if (openDays <= 0 && closeDays >= 0) stage3Ids.add(id);
  }
  const stage3 = stage3Ids.size;

  // Stage 4: Notice window closed (decision overdue or recent).
  const stage4Ids = new Set<string>();
  for (const id of stage2Ids) {
    const closes = noticeClosesByContract.get(id);
    if (!closes) continue;
    const closeDays = differenceInDays(closes, today);
    if (closeDays < 0 && closeDays >= -30) stage4Ids.add(id);
  }
  const stage4 = stage4Ids.size;

  // If everything is zero or we can't say anything useful, skip.
  if (stage1 === 0 || (stage2 === 0 && stage3 === 0 && stage4 === 0)) return null;

  const stages: Array<{
    primary: string;
    secondary?: string;
    count: number;
    href: string;
    tone: "neutral" | "warning" | "danger" | "accent";
  }> = [
    { primary: "ACTIVE", count: stage1, href: "/contracts?status=active", tone: "neutral" },
    { primary: "RENEWAL", secondary: "90D", count: stage2, href: "/contracts?end_within_days=90", tone: "accent" },
    { primary: "NOTICE", secondary: "OPEN", count: stage3, href: "/contracts/renewals", tone: "warning" },
    { primary: "DECISION", secondary: "OVERDUE", count: stage4, href: "/contracts/renewals?decision=overdue", tone: "danger" },
  ];

  const max = Math.max(stage1, 1);

  return (
    <section className="space-y-3" aria-label="Renewal pipeline funnel">
      <h2 className="inline-flex items-center gap-2 text-[1.375rem] font-semibold tracking-tight text-[var(--text-primary)]">
        <GitBranch className="h-4 w-4 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
        Renewal pipeline
      </h2>
      <div className="rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-4">
        <ul className="space-y-2">
          {stages.map((s, idx) => {
            const widthPct = Math.round((s.count / max) * 100);
            const fill =
              s.tone === "accent"
                ? "var(--accent)"
                : s.tone === "warning"
                  ? "var(--warning-ink)"
                  : s.tone === "danger"
                    ? "var(--danger-ink)"
                    : "color-mix(in oklab, var(--text-tertiary) 60%, var(--accent))";
            const conversion = idx > 0 && stages[idx - 1]!.count > 0
              ? Math.round((s.count / stages[idx - 1]!.count) * 100)
              : null;
            return (
              <li key={s.primary}>
                <Link
                  href={s.href}
                  className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface-tint-soft)] focus-visible:bg-[var(--surface-tint-soft)] focus-visible:outline-none"
                >
                  <span className="inline-flex w-28 shrink-0 items-center gap-1.5 text-[10.5px] uppercase leading-none text-[var(--text-secondary)]">
                    <span className="font-bold tracking-[0.14em]">{s.primary}</span>
                    {s.secondary ? (
                      <span className="font-medium tracking-[0.12em] text-[var(--text-tertiary)]">
                        {s.secondary}
                      </span>
                    ) : null}
                  </span>
                  <span className="relative flex-1 overflow-hidden">
                    <span className="block h-2 rounded-full bg-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
                      <span
                        className="block h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(widthPct, s.count > 0 ? 4 : 0)}%`,
                          background: fill,
                        }}
                      />
                    </span>
                  </span>
                  <span className="inline-flex w-12 shrink-0 items-center justify-end rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] leading-none tabular-nums text-[var(--text-primary)]">
                    {s.count}
                  </span>
                  <span className="w-14 shrink-0 text-right text-[10.5px] font-semibold uppercase tracking-[0.12em] tabular-nums text-[var(--text-tertiary)]">
                    {conversion != null ? `${conversion}%` : "—"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
