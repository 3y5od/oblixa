import Link from "next/link";
import { ChevronRight, ListChecks, SlidersHorizontal, UserRound } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCell } from "@/components/ui/stat-cell";
import { UiRadioGroup } from "@/components/ui/ui-radio-group";
import { UiToggle } from "@/components/ui/ui-toggle";
import { loadOrgMemberProfileRows, orgMemberProfileLabel } from "@/lib/org-member-profiles";
import { parseBusinessDateAtNoon } from "@/lib/business-dates";
import { STATUS_FILTERS } from "@/app/(dashboard)/contracts/obligations/obligations-page-config";
import { ObligationsLedger } from "@/app/(dashboard)/contracts/obligations/obligations-ledger";
import { SavedObligationQueues } from "@/app/(dashboard)/contracts/obligations/obligations-saved-queues";
import type {
  ObligationStatusFilter,
  ObligationViewRow,
  SavedObligationView,
} from "@/app/(dashboard)/contracts/obligations/obligations-page-types";

export const metadata = { title: "Requirements" };

function currentTimeMs(): number {
  return Date.now();
}

export default async function ContractObligationsPage(props: {
  searchParams: Promise<{ status?: string; mine?: string }>;
}) {
  const { status: rawStatus, mine } = await props.searchParams;
  const status = (STATUS_FILTERS.find((f) => f.value === rawStatus)?.value ?? "") as ObligationStatusFilter;
  const onlyMine = mine === "1";
  const hasFilters = Boolean(status) || onlyMine;

  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const { admin, orgId, user } = ctx;

  const query = admin
    .from("contract_obligations")
    .select(
      "id, title, obligation_type, cadence, recurrence_type, recurrence_interval_days, next_due_date, escalation_due_at, escalation_status, due_date, status, owner_id, updated_at, contracts!inner(id, title, organization_id)"
    )
    .eq("organization_id", orgId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (status) query.eq("status", status);
  if (onlyMine) query.eq("owner_id", user.id);

  const [{ data: rows }, membersData] = await Promise.all([
    query,
    loadOrgMemberProfileRows(admin, orgId),
  ]);
  const { data: savedViewsData } = await admin
    .from("saved_views")
    .select("id, name, query_json")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("view_type", "obligations")
    .order("created_at", { ascending: true });
  const savedViewIds = (savedViewsData ?? []).map((v) => v.id);
  const { data: subscriptionsData } =
    savedViewIds.length === 0
      ? { data: [] as Array<{ saved_view_id: string; active: boolean }> }
      : await admin
          .from("report_subscriptions")
          .select("saved_view_id, active")
          .eq("user_id", user.id)
          .eq("frequency", "weekly")
          .in("saved_view_id", savedViewIds);
  const weeklyByViewId = new Map((subscriptionsData ?? []).map((s) => [s.saved_view_id, Boolean(s.active)]));

  const ownerById = new Map<string, string>();
  for (const row of membersData ?? []) {
    ownerById.set(row.user_id, orgMemberProfileLabel(row.profiles));
  }

  const obligations: ObligationViewRow[] = (rows ?? []).flatMap((row) => {
    const rel = row.contracts as unknown;
    const contract = (Array.isArray(rel) ? rel[0] : rel) as { id?: string; title?: string } | null;
    if (!contract?.id || !contract?.title) return [];
    return [
      {
        id: row.id,
        title: row.title,
        obligationType: row.obligation_type,
        cadence: row.cadence as string | null,
        recurrenceType: row.recurrence_type as string | null,
        recurrenceIntervalDays: row.recurrence_interval_days as number | null,
        nextDueDate: row.next_due_date as string | null,
        escalationDueAt: row.escalation_due_at as string | null,
        escalationStatus: row.escalation_status as string | null,
        dueDate: row.due_date as string | null,
        status: row.status as string,
        ownerId: row.owner_id as string | null,
        updatedAt: row.updated_at,
        contractId: contract.id,
        contractTitle: contract.title,
      },
    ];
  });
  const savedViews: SavedObligationView[] = (savedViewsData ?? [])
    .map((v) => {
      const q = (v.query_json ?? {}) as Record<string, unknown>;
      const params = new URLSearchParams();
      if (typeof q.status === "string" && q.status) params.set("status", q.status);
      if (typeof q.mine === "string" && q.mine) params.set("mine", q.mine);
      const qs = params.toString();
      return {
        id: v.id,
        name: v.name,
        href: qs ? `/contracts/obligations?${qs}` : "/contracts/obligations",
        weeklyActive: weeklyByViewId.get(v.id) ?? false,
        pinned: q.pinned === true || q.pinned === "1" || q.pinned === "true",
      };
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const openObligations = obligations.filter((ob) => ob.status === "open").length;
  const inProgressObligations = obligations.filter((ob) => ob.status === "in_progress").length;
  const nowMs = currentTimeMs();
  const overdueObligations = obligations.filter((ob) => {
    if (!ob.dueDate) return false;
    const due = parseBusinessDateAtNoon(ob.dueDate);
    if (!due) return false;
    return due.getTime() < nowMs && (ob.status === "open" || ob.status === "in_progress");
  }).length;
  const completedObligations = obligations.filter((ob) => ob.status === "done").length;

  return (
    <div className="ui-page-stack mx-auto w-full min-w-0 max-w-7xl">
      <DashboardPageHeader
        icon={<ListChecks className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Portfolio commitments"
        title="Requirements queue"
        lead="Contract requirements, owners, due dates, and follow-up state."
        actions={
          <Link href="/contracts" className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
            Contract index
            <ChevronRight className="h-3 w-3 opacity-60" aria-hidden />
          </Link>
        }
      />

      <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Requirements summary">
        <StatCell
          label="Open requirements"
          display={String(openObligations)}
          isZero={openObligations === 0}
          tone="warning"
          context={openObligations === 0 ? "Backlog clear" : "Awaiting start"}
        />
        <StatCell
          label="In progress"
          display={String(inProgressObligations)}
          isZero={inProgressObligations === 0}
          tone="neutral"
          context={inProgressObligations === 0 ? "Nothing running" : "Currently running"}
        />
        <StatCell
          label="Past due"
          display={String(overdueObligations)}
          isZero={overdueObligations === 0}
          tone="danger"
          context={overdueObligations === 0 ? "No recovery needed" : "Need recovery"}
        />
        <StatCell
          label="Completed"
          display={String(completedObligations)}
          isZero={completedObligations === 0}
          tone="success"
          context={completedObligations === 0 ? "Nothing closed yet" : "Closed in this view"}
        />
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" aria-label="Requirements filters and saved queues">
        <div className="ui-card min-w-0 overflow-hidden p-0">
          <SectionHeader
            eyebrow="Filters"
            trailing={
              hasFilters ? (
                <Link href="/contracts/obligations" className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
                  <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                  Clear filters
                </Link>
              ) : null
            }
          />
          <form className="px-5 py-4" action="/contracts/obligations" method="get">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="min-w-[4.5rem] shrink-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                  Status
                </p>
                <UiRadioGroup
                  name="status"
                  defaultValue={status}
                  ariaLabel="Requirement status"
                  options={STATUS_FILTERS}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="min-w-[4.5rem] shrink-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                  Owner
                </p>
                <UiToggle
                  name="mine"
                  defaultChecked={onlyMine}
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                      Owned by me
                    </span>
                  }
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3">
              <button type="submit" className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px]">
                <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                Apply filters
              </button>
            </div>
          </form>
        </div>
        <SavedObligationQueues
          onlyMine={onlyMine}
          orgId={orgId}
          savedViews={savedViews}
          status={status}
        />
      </section>
      <ObligationsLedger obligations={obligations} ownerById={ownerById} nowMs={nowMs} />
    </div>
  );
}
