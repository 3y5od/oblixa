import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";
import { getContractsMissingCriticalFields } from "@/lib/missing-critical-fields";

type Filter =
  | ""
  | "missing_dates"
  | "ownerless"
  | "stale_ownership"
  | "overdue_tasks"
  | "overdue_obligations";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "", label: "All exceptions" },
  { value: "missing_dates", label: "Missing critical dates" },
  { value: "ownerless", label: "No owner assigned" },
  { value: "stale_ownership", label: "Stale ownership" },
  { value: "overdue_tasks", label: "Overdue tasks" },
  { value: "overdue_obligations", label: "Overdue obligations" },
];

export default async function ExceptionsPage(props: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await props.searchParams;
  const filter = (FILTERS.find((f) => f.value === rawFilter)?.value ?? "") as Filter;

  const ctx = await getAuthContext();
  if (!ctx) return null;
  const { admin, orgId } = ctx;

  const today = new Date().toISOString().slice(0, 10);
  const { data: workflowSettings } = await admin
    .from("organization_workflow_settings")
    .select("stale_ownership_days")
    .eq("organization_id", orgId)
    .maybeSingle();
  const now = new Date();
  const staleOwnershipDays = Math.max(14, Number(workflowSettings?.stale_ownership_days ?? 90));
  const staleOwnerCutoff = new Date(
    now.getTime() - staleOwnershipDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const [missingCritical, ownerless, staleOwnership, overdueTasks, overdueObligations] =
    await Promise.all([
    getContractsMissingCriticalFields(admin, orgId),
    admin
      .from("contracts")
      .select("id, title, counterparty")
      .eq("organization_id", orgId)
      .in("status", ["active", "pending_review"])
      .is("owner_id", null)
      .order("updated_at", { ascending: false })
      .limit(100)
      .then((r) => r.data ?? []),
    admin
      .from("contracts")
      .select("id, title, counterparty")
      .eq("organization_id", orgId)
      .not("owner_id", "is", null)
      .lt("owner_assigned_at", staleOwnerCutoff)
      .order("owner_assigned_at", { ascending: true })
      .limit(100)
      .then((r) => r.data ?? []),
    admin
      .from("contract_tasks")
      .select("id, title, due_date, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress", "blocked"])
      .not("due_date", "is", null)
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(100)
      .then((r) => r.data ?? []),
    admin
      .from("contract_obligations")
      .select("id, title, due_date, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress"])
      .not("due_date", "is", null)
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(100)
      .then((r) => r.data ?? []),
    ]);

  const sections = [
    {
      key: "missing_dates" as const,
      title: "Missing critical dates",
      description: "Active or review-stage contracts without approved end/renewal/notice fields.",
      count: missingCritical.length,
      rows: missingCritical.map((c) => ({
        id: c.id,
        title: c.title,
        subtitle: c.counterparty || "No counterparty",
      })),
    },
    {
      key: "ownerless" as const,
      title: "Ownerless contracts",
      description: "Contracts in active review workflows that do not have an owner.",
      count: ownerless.length,
      rows: ownerless.map((c) => ({
        id: c.id,
        title: c.title as string,
        subtitle: (c.counterparty as string | null) || "No counterparty",
      })),
    },
    {
      key: "stale_ownership" as const,
      title: "Stale ownership",
      description: `Contracts with unchanged owner assignment older than ${staleOwnershipDays} days.`,
      count: staleOwnership.length,
      rows: staleOwnership.map((c) => ({
        id: c.id,
        title: c.title as string,
        subtitle: (c.counterparty as string | null) || "No counterparty",
      })),
    },
    {
      key: "overdue_tasks" as const,
      title: "Overdue tasks",
      description: "Task follow-up that has passed due date without completion.",
      count: overdueTasks.length,
      rows: overdueTasks.flatMap((row) => {
        const rel = row.contracts as unknown;
        const contract = (Array.isArray(rel) ? rel[0] : rel) as { id?: string; title?: string } | null;
        if (!contract?.id || !contract?.title) return [];
        return [
          {
            id: contract.id,
            title: row.title as string,
            subtitle: `${contract.title} · due ${(row.due_date as string) ?? "unknown"}`,
          },
        ];
      }),
    },
    {
      key: "overdue_obligations" as const,
      title: "Overdue obligations",
      description: "Operational commitments that are overdue and still open.",
      count: overdueObligations.length,
      rows: overdueObligations.flatMap((row) => {
        const rel = row.contracts as unknown;
        const contract = (Array.isArray(rel) ? rel[0] : rel) as { id?: string; title?: string } | null;
        if (!contract?.id || !contract?.title) return [];
        return [
          {
            id: contract.id,
            title: row.title as string,
            subtitle: `${contract.title} · due ${(row.due_date as string) ?? "unknown"}`,
          },
        ];
      }),
    },
  ] as const;

  const visibleSections = filter ? sections.filter((s) => s.key === filter) : sections;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 border-b border-zinc-200/60 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ui-eyebrow">Operational risk</p>
          <h1 className="ui-display-title mt-2">Exceptions workspace</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-500">
            Prioritized exception queues for missing data, ownership, and overdue execution work.
          </p>
        </div>
        <Link href="/contracts" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
          Back to contracts
        </Link>
      </header>

      <div className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] md:p-6">
        <form className="flex flex-wrap items-end gap-4" action="/contracts/exceptions" method="get">
          <div>
            <label htmlFor="exception-filter" className="ui-label-caps">
              View
            </label>
            <select
              id="exception-filter"
              name="filter"
              defaultValue={filter}
              className="ui-input min-w-[16rem]"
            >
              {FILTERS.map((f) => (
                <option key={f.value || "all"} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="ui-btn-primary px-5 py-2.5 text-[13px]">
            Apply
          </button>
        </form>
      </div>

      <div className="space-y-6">
        {visibleSections.map((section) => (
          <section key={section.key} className="ui-card overflow-hidden">
            <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-6 py-4">
              <h2 className="ui-section-title text-base">
                {section.title} <span className="text-zinc-400">({section.count})</span>
              </h2>
              <p className="mt-1 text-[12px] text-zinc-500">{section.description}</p>
            </div>
            {section.rows.length === 0 ? (
              <div className="px-6 py-6 text-sm text-zinc-500">No exceptions in this category.</div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {section.rows.map((row, idx) => (
                  <li key={`${section.key}-${idx}`}>
                    <Link
                      href={`/contracts/${row.id}`}
                      className="block px-6 py-4 transition-colors hover:bg-zinc-50/70"
                    >
                      <p className="text-[15px] font-semibold text-zinc-900">{row.title}</p>
                      <p className="mt-0.5 text-[13px] text-zinc-500">{row.subtitle}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
