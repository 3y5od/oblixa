import Link from "next/link";
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Compass,
  Inbox,
  ListChecks,
  Pin,
  Save,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import {
  createSavedView,
  deleteSavedView,
  setSavedViewPinned,
  setSavedViewWeeklySummary,
} from "@/actions/saved-views";
import { createObligationClarificationTaskForm } from "@/actions/tasks";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { SamplePreviewCard } from "@/components/ui/sample-preview-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCell, type StatTone } from "@/components/ui/stat-cell";
import { StatusPill } from "@/components/ui/status-pill";
import { UiRadioGroup } from "@/components/ui/ui-radio-group";
import { UiToggle } from "@/components/ui/ui-toggle";
import { loadOrgMemberProfileRows, orgMemberProfileLabel } from "@/lib/org-member-profiles";

export const metadata = { title: "Obligations" };

type ObligationStatusFilter = "" | "open" | "in_progress" | "done" | "waived";
const STATUS_FILTERS: { value: ObligationStatusFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "waived", label: "Waived" },
];

function statusToneFor(status: string): StatTone {
  if (status === "done") return "success";
  if (status === "waived") return "neutral";
  if (status === "in_progress") return "neutral";
  return "warning";
}

function statusLabelFor(status: string): string {
  if (status === "in_progress") return "In progress";
  if (status === "done") return "Done";
  if (status === "waived") return "Waived";
  if (status === "open") return "Open";
  return status.replace("_", " ");
}

function currentTimeMs(): number {
  return Date.now();
}

export default async function ContractObligationsPage(props: {
  searchParams: Promise<{ status?: string; mine?: string }>;
}) {
  const { status: rawStatus, mine } = await props.searchParams;
  const status = (STATUS_FILTERS.find((f) => f.value === rawStatus)?.value ??
    "") as ObligationStatusFilter;
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

  const obligations = (rows ?? []).flatMap((row) => {
    const rel = row.contracts as unknown;
    const contract = (
      Array.isArray(rel) ? rel[0] : rel
    ) as { id?: string; title?: string } | null;
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
  const savedViews = (savedViewsData ?? [])
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
    return (
      new Date(`${ob.dueDate}T12:00:00`).getTime() < nowMs &&
      (ob.status === "open" || ob.status === "in_progress")
    );
  }).length;
  const completedObligations = obligations.filter((ob) => ob.status === "done").length;

  return (
    <div className="ui-page-stack mx-auto max-w-7xl">
      <DashboardPageHeader
        icon={<ListChecks className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Portfolio commitments"
        title="Obligations queue"
        lead="Operational commitments and due-state execution."
        actions={
          <Link
            href="/contracts"
            className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
          >
            Contract index
            <ChevronRight className="h-3 w-3 opacity-60" aria-hidden />
          </Link>
        }
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Obligations summary">
        <StatCell
          label="Open obligations"
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

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" aria-label="Obligations filters and saved queues">
        <div className="ui-card min-w-0 overflow-hidden p-0">
          <SectionHeader
            eyebrow="Filters"
            trailing={
              hasFilters ? (
                <Link
                  href="/contracts/obligations"
                  className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
                >
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
                  ariaLabel="Obligation status"
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
              <button
                type="submit"
                className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px]"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                Apply filters
              </button>
            </div>
          </form>
        </div>

        <div className="ui-card min-w-0 overflow-hidden p-0">
          <SectionHeader
            eyebrow="Saved queues"
            trailing={
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                <Save className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                {savedViews.length} saved
              </span>
            }
          />
          <div className="space-y-4 px-5 py-4">
            <form action={createSavedView as never} className="space-y-2">
              <input type="hidden" name="organizationId" value={orgId} />
              <input type="hidden" name="viewType" value="obligations" />
              <input type="hidden" name="status" value={status} />
              <input type="hidden" name="mine" value={onlyMine ? "1" : ""} />
              <label
                htmlFor="obligation-view-name"
                className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]"
              >
                Queue name
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <input aria-label="My open obligations" id="obligation-view-name"
                  name="name"
                  required
                  placeholder="My open obligations"
                  className="ui-input min-w-0 flex-1"
                />
                <button
                  type="submit"
                  className="ui-btn-secondary inline-flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-[12.5px]"
                >
                  <Save className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                  Save queue
                </button>
              </div>
            </form>
            {savedViews.length > 0 ? (
              <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] border-y border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]" aria-label="Saved obligation queues">
                {savedViews.map((view) => (
                  <li key={view.id} className="space-y-2 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={view.href} className="ui-link text-[12.5px] font-semibold">
                        {view.name}
                      </Link>
                      <div className="flex flex-wrap gap-1.5">
                        {view.pinned ? <StatusPill tone="success">Pinned</StatusPill> : null}
                        <StatusPill tone={view.weeklyActive ? "success" : "neutral"}>
                          {view.weeklyActive ? "Weekly on" : "Weekly off"}
                        </StatusPill>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <form action={setSavedViewPinned.bind(null, view.id, !view.pinned) as never}>
                        <button
                          type="submit"
                          className="ui-btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px]"
                          aria-label={`${view.pinned ? "Unpin" : "Pin"} saved obligation queue ${view.name}`}
                        >
                          <Pin className="h-3 w-3" aria-hidden />
                          {view.pinned ? "Unpin" : "Pin"}
                        </button>
                      </form>
                      <form action={setSavedViewWeeklySummary.bind(null, view.id, !view.weeklyActive) as never}>
                        <button
                          type="submit"
                          className="ui-btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px]"
                          aria-label={`${view.weeklyActive ? "Disable" : "Enable"} weekly summary for ${view.name}`}
                        >
                          {view.weeklyActive ? "Disable weekly" : "Enable weekly"}
                        </button>
                      </form>
                      <form action={deleteSavedView.bind(null, view.id) as never}>
                        <button
                          type="submit"
                          className="ui-btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-[var(--danger-ink)]"
                          aria-label={`Delete saved obligation queue ${view.name}`}
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_28%,transparent)] px-4 py-3">
                <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold tracking-tight text-[var(--text-primary)]">
                    No saved queues yet
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                    Bookmark the current filter set when it becomes a recurring view.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {obligations.length === 0 ? (
        <section className="ui-card-raised relative overflow-hidden rounded-2xl border p-5 sm:p-6 lg:p-7">
          <div
            aria-hidden
            className="landing-corner-ring"
            style={{ top: "-2.25rem", right: "-2.25rem", width: "7rem", height: "7rem" }}
          />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-8">
            <EmptyState
              eyebrow="Queue status"
              title="No obligations match this queue"
              copy="Adjust the filters above, clear the current queue, or review unified work for other action types."
              icon={<Compass className="h-7 w-7 text-[var(--accent-strong)]" strokeWidth={1.65} aria-hidden />}
              className="lg:items-start lg:text-left"
              action={
                <>
                  <Link
                    href="/work"
                    className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px]"
                  >
                    <ArrowRight className="h-4 w-4" strokeWidth={1.85} aria-hidden />
                    Review unified work
                  </Link>
                  <Link
                    href="/contracts/obligations"
                    className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px]"
                  >
                    Clear filters
                  </Link>
                </>
              }
            />

            <SamplePreviewCard
              eyebrow="Sample obligation"
              title="Renew certificate of insurance"
              meta={["Insurance renewal", "Annual cadence"]}
              status={<StatusPill tone="warning">Open</StatusPill>}
              rows={[
                { label: "Contract", value: "Acme Corp MSA 2025" },
                { label: "Owner", value: "Sarah K." },
                { label: "Due", value: "Mar 15, 2026" },
                { label: "Escalation", value: "Apr 01 · pending" },
              ]}
              footerValue="Confirm renewal with broker"
            />
          </div>
        </section>
      ) : (
        <section className="ui-card overflow-hidden p-0">
          <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                Rows
              </p>
              <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">
                Obligation ledger
              </h2>
              <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                Due state, escalation timing, and the next clarification step — visible without losing contract context.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,transparent)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              <ListChecks className="h-3 w-3" strokeWidth={1.85} aria-hidden />
              {obligations.length} {obligations.length === 1 ? "row" : "rows"}
            </span>
          </header>
          <div className="overflow-x-auto">
            <table aria-label="Obligations in this queue" className="min-w-full divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Obligation
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Contract
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Owner
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Status
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Due
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Next due
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Escalation
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Updated
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
                {obligations.map((ob) => {
                  const isOverdue =
                    Boolean(ob.dueDate) &&
                    (ob.status === "open" || ob.status === "in_progress") &&
                    new Date(`${ob.dueDate}T12:00:00`).getTime() < nowMs;
                  return (
                    <tr key={ob.id} className="align-top">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[var(--text-primary)]">{ob.title}</p>
                        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
                          {ob.obligationType}
                          {ob.cadence ? ` · ${ob.cadence}` : ""}
                          {ob.recurrenceType && ob.recurrenceType !== "none"
                            ? ` · ${ob.recurrenceType}${
                                ob.recurrenceType === "custom_days" && ob.recurrenceIntervalDays
                                  ? ` (${ob.recurrenceIntervalDays}d)`
                                  : ""
                              }`
                            : ""}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <Link href={`/contracts/${ob.contractId}`} className="ui-link text-[12.5px] font-semibold">
                          {ob.contractTitle}
                        </Link>
                        <ContractContinuityLinks
                          contractId={ob.contractId}
                          omit={["obligations"]}
                          className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[var(--text-tertiary)]"
                        />
                      </td>
                      <td className="px-5 py-4 text-[12.5px]">
                        {ob.ownerId ? (
                          <span className="text-[var(--text-secondary)]">{ownerById.get(ob.ownerId) ?? "Member"}</span>
                        ) : (
                          <span className="font-medium text-[var(--warning-ink)]">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill tone={statusToneFor(ob.status)}>{statusLabelFor(ob.status)}</StatusPill>
                      </td>
                      <td className="px-5 py-4 font-mono text-[12.5px] tabular-nums">
                        {ob.dueDate ? (
                          <span className={isOverdue ? "text-[var(--danger-ink)]" : "text-[var(--text-secondary)]"}>
                            {format(new Date(`${ob.dueDate}T12:00:00`), "MMM d, yyyy")}
                          </span>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-[12.5px] tabular-nums text-[var(--text-secondary)]">
                        {ob.nextDueDate
                          ? format(new Date(`${ob.nextDueDate}T12:00:00`), "MMM d, yyyy")
                          : "—"}
                      </td>
                      <td className="px-5 py-4 font-mono text-[12.5px] tabular-nums text-[var(--text-secondary)]">
                        {ob.escalationDueAt
                          ? `${format(new Date(ob.escalationDueAt), "MMM d, yyyy")} · ${ob.escalationStatus ?? "pending"}`
                          : "—"}
                      </td>
                      <td className="px-5 py-4 font-mono text-[11px] text-[var(--text-tertiary)]">
                        {format(new Date(ob.updatedAt), "MMM d")}
                      </td>
                      <td className="px-5 py-4">
                        <form
                          action={createObligationClarificationTaskForm as never}
                          className="flex flex-col gap-1.5"
                        >
                          <input type="hidden" name="contractId" value={ob.contractId} />
                          <input type="hidden" name="obligationId" value={ob.id} />
                          <input aria-label="Clarification note" name="requesterNote"
                            placeholder="Clarification note"
                            className="ui-input h-7 text-[11px]"
                          />
                          <button
                            type="submit"
                            className="ui-btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px]"
                          >
                            <AlertTriangle className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                            Clarification task
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

