import { getAuthContext } from "@/lib/supabase/server";
import { ContractTable } from "@/components/contracts/contract-table";
import { ContractPagination } from "@/components/contracts/contract-pagination";
import { attachOwnerProfiles } from "@/lib/contracts";
import { fetchContractsPage, CONTRACTS_PAGE_SIZE } from "@/lib/contract-list";
import { getReviewStatsForContractIds } from "@/lib/contract-review-stats";
import {
  createContractsSavedView,
  deleteSavedView,
  setSavedViewMonthlySummary,
  setSavedViewWeeklyRecipients,
  setSavedViewWeeklySummary,
} from "@/actions/saved-views";
import {
  getContractIdsForDeadlinePreset,
  getContractIdsMatchingFieldSearch,
  type DeadlinePreset,
  DEADLINE_PRESET_VALUES,
} from "@/lib/contract-filters";
import Link from "next/link";
import { CheckCircle2, Eye, Files } from "lucide-react";
import { redirect } from "next/navigation";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";

function buildFilterUrl(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) search.set(k, v);
  }
  const qs = search.toString();
  return qs ? `/contracts?${qs}` : "/contracts";
}

function sanitizeSearch(raw: string): string {
  return raw.replace(/[%_\\()"',.*]/g, "").trim();
}

const DEADLINE_OPTIONS: { value: DeadlinePreset; label: string }[] = [
  { value: "", label: "Any date" },
  { value: "renewal_30", label: "Renewal ≤30d" },
  { value: "renewal_90", label: "Renewal ≤90d" },
  { value: "renewal_180", label: "Renewal ≤180d" },
  { value: "renewal_365", label: "Renewal ≤365d" },
  { value: "end_30", label: "End date ≤30d" },
  { value: "end_90", label: "End date ≤90d" },
  { value: "end_180", label: "End date ≤180d" },
  { value: "end_365", label: "End date ≤365d" },
  {
    value: "notice_deadline_30",
    label: "Notice deadline ≤30d",
  },
  {
    value: "notice_deadline_90",
    label: "Notice deadline ≤90d",
  },
  {
    value: "notice_deadline_180",
    label: "Notice deadline ≤180d",
  },
  {
    value: "notice_deadline_365",
    label: "Notice deadline ≤365d",
  },
];

function isDeadlinePreset(v: string | undefined): v is DeadlinePreset {
  return DEADLINE_PRESET_VALUES.includes(v as DeadlinePreset);
}

export default async function ContractsPage(props: {
  searchParams: Promise<{
    status?: string;
    search?: string;
    owner?: string;
    region?: string;
    deadline?: string;
    page?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const { orgId, admin } = ctx;

  const parsedPage = parseInt(searchParams.page ?? "1", 10);
  const page =
    Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const deadlineParam = searchParams.deadline;
  const deadline: DeadlinePreset =
    deadlineParam && isDeadlinePreset(deadlineParam) ? deadlineParam : "";
  const sanitizedSearch = searchParams.search
    ? sanitizeSearch(searchParams.search)
    : "";

  const [deadlineIds, fieldSearchIds] = await Promise.all([
    deadline
      ? getContractIdsForDeadlinePreset(admin, orgId, deadline)
      : Promise.resolve<string[] | null>(null),
    sanitizedSearch
      ? getContractIdsMatchingFieldSearch(admin, orgId, sanitizedSearch)
      : Promise.resolve<string[]>([]),
  ]);

  const membersPromise = admin
    .from("organization_members")
    .select("user_id, profiles(full_name, email)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });
  const savedViewsPromise = admin
    .from("saved_views")
    .select("id, name, query_json")
    .eq("organization_id", orgId)
    .eq("user_id", ctx.user.id)
    .eq("view_type", "contracts")
    .order("created_at", { ascending: true });
  const contractsPagePromise = fetchContractsPage(
    admin,
    {
      orgId,
      status: searchParams.status,
      owner: searchParams.owner,
      region: searchParams.region,
      deadlineIds,
      sanitizedSearch,
      fieldSearchIds,
    },
    page
  );
  const [
    { data: membersData },
    { data: savedViewsData },
    { contracts: contractsData, total: contractTotal },
  ] = await Promise.all([membersPromise, savedViewsPromise, contractsPagePromise]);

  const listTotalPages =
    contractTotal > 0
      ? Math.max(1, Math.ceil(contractTotal / CONTRACTS_PAGE_SIZE))
      : 1;
  if (page > listTotalPages && contractTotal > 0) {
    const next = new URLSearchParams();
    if (searchParams.search) next.set("search", searchParams.search);
    if (searchParams.status) next.set("status", searchParams.status);
    if (searchParams.owner) next.set("owner", searchParams.owner);
    if (searchParams.region) next.set("region", searchParams.region);
    if (searchParams.deadline) next.set("deadline", searchParams.deadline);
    next.set("page", String(listTotalPages));
    redirect(`/contracts?${next.toString()}`);
  }

  const savedViewIds = (savedViewsData ?? []).map((v) => v.id);
  const { data: subscriptionsData } =
    savedViewIds.length === 0
      ? {
          data: [] as Array<{
            saved_view_id: string;
            frequency: "weekly" | "monthly";
            active: boolean;
            recipient_emails: string[] | null;
          }>,
        }
      : await admin
          .from("report_subscriptions")
          .select("saved_view_id, frequency, active, recipient_emails")
          .eq("user_id", ctx.user.id)
          .in("frequency", ["weekly", "monthly"])
          .in("saved_view_id", savedViewIds);
  const weeklyByViewId = new Map<string, boolean>();
  const monthlyByViewId = new Map<string, boolean>();
  for (const row of subscriptionsData ?? []) {
    if (row.frequency === "weekly") weeklyByViewId.set(row.saved_view_id, Boolean(row.active));
    if (row.frequency === "monthly") monthlyByViewId.set(row.saved_view_id, Boolean(row.active));
  }
  const recipientsByViewId = new Map(
    (subscriptionsData ?? []).map((s) => [s.saved_view_id, (s.recipient_emails ?? []).join(", ")])
  );

  const members = (membersData ?? []).map((m) => {
    const profile = m.profiles as unknown as {
      full_name: string | null;
      email: string | null;
    } | null;
    return {
      id: m.user_id,
      label: profile?.full_name || profile?.email || "Unknown",
    };
  });

  const [contracts, reviewStats] = await Promise.all([
    attachOwnerProfiles(admin, contractsData),
    getReviewStatsForContractIds(
      admin,
      contractsData.map((c) => c.id)
    ),
  ]);

  const savedViews = (savedViewsData ?? []).map((v) => {
    const q = (v.query_json ?? {}) as Record<string, string | null | undefined>;
    const viewParams = new URLSearchParams();
    if (q.search) viewParams.set("search", q.search);
    if (q.status) viewParams.set("status", q.status);
    if (q.owner) viewParams.set("owner", q.owner);
    if (q.region) viewParams.set("region", q.region);
    if (q.deadline) viewParams.set("deadline", q.deadline);
    const qs = viewParams.toString();
    return {
      id: v.id,
      name: v.name,
      href: qs ? `/contracts?${qs}` : "/contracts",
      weeklyActive: weeklyByViewId.get(v.id) ?? false,
      monthlyActive: monthlyByViewId.get(v.id) ?? false,
      recipientsCsv: recipientsByViewId.get(v.id) ?? "",
    };
  });

  const statuses = [
    { value: "", label: "All" },
    { value: "pending_review", label: "Pending Review" },
    { value: "active", label: "Active" },
    { value: "expired", label: "Expired" },
    { value: "terminated", label: "Terminated" },
    { value: "draft", label: "Draft" },
  ];

  const baseParams = {
    search: searchParams.search,
    owner: searchParams.owner,
    region: searchParams.region,
    deadline: searchParams.deadline,
  };

  const paginationQuery: Record<string, string | undefined> = {
    ...baseParams,
    status: searchParams.status,
    region: searchParams.region,
  };

  const pagePendingReview = contracts.filter((c) => c.status === "pending_review").length;
  const pageActive = contracts.filter((c) => c.status === "active").length;

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Records</p>
          <h1 className="ui-display-title mt-2">Contracts</h1>
          <p className="ui-muted-tight mt-2 max-w-xl">Contract records, queue states, and ownership filters.</p>
        </div>
        <div className="ui-page-actions">
          <Link href="/contracts/new" className="ui-btn-primary px-5 py-2.5">
            Upload contract
          </Link>
          <Link href="/contracts/bulk" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
            Bulk import
          </Link>
          <a href="/api/export/contracts" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
            Export CSV
          </a>
          <a href="/api/export/calendar" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
            Export calendar
          </a>
          <details className="relative">
            <summary className="ui-btn-secondary cursor-pointer list-none px-4 py-2.5 text-[13px] [&::-webkit-details-marker]:hidden">
              More actions
            </summary>
            <div className="absolute right-0 top-[calc(100%+0.4rem)] z-20 w-64 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-surface shadow-[var(--shadow-2)]">
              <ul className="divide-y divide-zinc-100 text-sm">
                <li>
                  <Link href="/api/export/calendar/feed" className="block px-4 py-2.5 hover:bg-zinc-50">
                    Calendar feed token
                  </Link>
                </li>
                <li>
                  <Link href="/contracts/intake" className="block px-4 py-2.5 hover:bg-zinc-50">
                    Intake
                  </Link>
                </li>
                <li>
                  <Link href="/contracts/approvals" className="block px-4 py-2.5 hover:bg-zinc-50">
                    Approvals
                  </Link>
                </li>
                <li>
                  <Link href="/contracts/renewals" className="block px-4 py-2.5 hover:bg-zinc-50">
                    Renewals
                  </Link>
                </li>
                <li>
                  <Link href="/contracts/tasks" className="block px-4 py-2.5 hover:bg-zinc-50">
                    Tasks
                  </Link>
                </li>
                <li>
                  <Link href="/contracts/obligations" className="block px-4 py-2.5 hover:bg-zinc-50">
                    Obligations
                  </Link>
                </li>
                <li>
                  <Link href="/contracts/exceptions" className="block px-4 py-2.5 hover:bg-zinc-50">
                    Exceptions
                  </Link>
                </li>
                <li>
                  <Link href="/contracts/review-cadence" className="block px-4 py-2.5 hover:bg-zinc-50">
                    Review cadence
                  </Link>
                </li>
                <li>
                  <Link href="/contracts/analytics" className="block px-4 py-2.5 hover:bg-zinc-50">
                    Analytics
                  </Link>
                </li>
                <li>
                  <Link href="/contracts/maintenance" className="block px-4 py-2.5 hover:bg-zinc-50">
                    Maintenance
                  </Link>
                </li>
              </ul>
            </div>
          </details>
        </div>
      </header>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Table</p>
          <h2 className="ui-section-title mt-2 text-xl">Page snapshot</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <OperationalSummaryCard
            eyebrow="Filtered"
            headline="In scope"
            tone="neutral"
            icon={Files}
            primaryValue={contractTotal}
            primaryUnit="rows this page"
            action={{ href: "/contracts", label: "Refresh filters" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Inbox"
            headline="Pending review"
            tone={pagePendingReview > 0 ? "attention" : "healthy"}
            icon={Eye}
            primaryValue={pagePendingReview}
            primaryUnit="on this page"
            action={{ href: "/contracts?status=pending_review", label: "View pending" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Live"
            headline="Active"
            tone="neutral"
            icon={CheckCircle2}
            primaryValue={pageActive}
            primaryUnit="on this page"
            action={{ href: "/contracts?status=active", label: "View active" }}
            variant="compact"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 md:gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="space-y-6 xl:sticky xl:top-6 xl:h-fit">
          <div className="ui-card p-4 md:p-5">
            <form className="space-y-3.5 md:space-y-4" action="/contracts" method="get">
              <div>
                <label htmlFor="contract-search" className="ui-label-caps">
                  Search
                </label>
                <input
                  id="contract-search"
                  name="search"
                  type="search"
                  placeholder="Title, counterparty, type, dates..."
                  defaultValue={searchParams.search || ""}
                  className="ui-input-compact w-full"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="contract-deadline-filter" className="ui-label-caps">
                  Date preset
                </label>
                <select
                  id="contract-deadline-filter"
                  name="deadline"
                  defaultValue={deadline}
                  className="ui-input-compact w-full"
                >
                  {DEADLINE_OPTIONS.map((o) => (
                    <option key={o.value || "any"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {searchParams.status && (
                <input type="hidden" name="status" value={searchParams.status} />
              )}
              {searchParams.owner && (
                <input type="hidden" name="owner" value={searchParams.owner} />
              )}
              {searchParams.region && (
                <input type="hidden" name="region" value={searchParams.region} />
              )}
              <input type="hidden" name="page" value="1" />
              <button type="submit" className="ui-btn-primary w-full">
                Apply filters
              </button>
            </form>

            <div className="mt-4 border-t border-zinc-100 pt-3.5 md:mt-5 md:pt-4">
              <p className="ui-label-caps mb-2">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {statuses.map((s) => (
                  <Link
                    key={s.value}
                    href={buildFilterUrl({
                      ...baseParams,
                      status: s.value || undefined,
                    })}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      (searchParams.status || "") === s.value
                        ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900"
                    }`}
                  >
                    {s.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-4 border-t border-zinc-100 pt-3.5 md:mt-5 md:pt-4">
              <p className="ui-label-caps mb-2">Region</p>
              <div className="flex flex-wrap gap-1.5">
                {["", "NA", "EMEA", "APAC", "LATAM"].map((region) => (
                  <Link
                    key={region || "all"}
                    href={buildFilterUrl({
                      status: searchParams.status,
                      search: searchParams.search,
                      owner: searchParams.owner,
                      deadline: searchParams.deadline,
                      region: region || undefined,
                    })}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      (searchParams.region || "") === region
                        ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900"
                    }`}
                  >
                    {region || "All"}
                  </Link>
                ))}
              </div>
            </div>

            {members.length > 1 && (
              <div className="mt-4 border-t border-zinc-100 pt-3.5 md:mt-5 md:pt-4">
                <p className="ui-label-caps mb-2">Owner</p>
                <div className="flex flex-wrap gap-1.5">
                  <Link
                    href={buildFilterUrl({
                      status: searchParams.status,
                      search: searchParams.search,
                      region: searchParams.region,
                      deadline: searchParams.deadline,
                    })}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      !searchParams.owner
                        ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900"
                    }`}
                  >
                    All
                  </Link>
                  {members.map((m) => (
                    <Link
                      key={m.id}
                      href={buildFilterUrl({
                        status: searchParams.status,
                        search: searchParams.search,
                        region: searchParams.region,
                        deadline: searchParams.deadline,
                        owner: m.id,
                      })}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        searchParams.owner === m.id
                          ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900"
                      }`}
                    >
                      {m.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="ui-card p-4 md:p-5">
            <form action={createContractsSavedView} className="space-y-3">
              <input type="hidden" name="organizationId" value={orgId} />
              <input type="hidden" name="search" value={searchParams.search || ""} />
              <input type="hidden" name="status" value={searchParams.status || ""} />
              <input type="hidden" name="owner" value={searchParams.owner || ""} />
              <input type="hidden" name="region" value={searchParams.region || ""} />
              <input type="hidden" name="deadline" value={searchParams.deadline || ""} />
              <div>
                <label htmlFor="saved-view-name" className="ui-label-caps">
                  Save current view
                </label>
                <input
                  id="saved-view-name"
                  name="name"
                  required
                  maxLength={80}
                  placeholder="Q4 renewals by owner"
                  className="ui-input-compact w-full"
                />
              </div>
              <button type="submit" className="ui-btn-secondary w-full">
                Save view
              </button>
            </form>
            {savedViews.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-zinc-100 pt-3.5 md:pt-4">
                {savedViews.map((view) => (
                  <div key={view.id} className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={view.href} className="truncate text-[12px] font-semibold text-zinc-800 hover:text-zinc-950">
                        {view.name}
                      </Link>
                      <form action={deleteSavedView.bind(null, view.id)}>
                        <button
                          type="submit"
                          aria-label={`Delete saved view ${view.name}`}
                          className="rounded-full px-1.5 py-0.5 text-[11px] text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800"
                        >
                          x
                        </button>
                      </form>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <form action={setSavedViewWeeklySummary.bind(null, view.id, !view.weeklyActive)}>
                        <button
                          type="submit"
                          className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${
                            view.weeklyActive
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                          }`}
                        >
                          {view.weeklyActive ? "Weekly on" : "Weekly off"}
                        </button>
                      </form>
                      <form action={setSavedViewMonthlySummary.bind(null, view.id, !view.monthlyActive)}>
                        <button
                          type="submit"
                          className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${
                            view.monthlyActive
                              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                          }`}
                        >
                          {view.monthlyActive ? "Monthly on" : "Monthly off"}
                        </button>
                      </form>
                    </div>
                    {(view.weeklyActive || view.monthlyActive) && (
                      <form action={setSavedViewWeeklyRecipients.bind(null, view.id)} className="mt-2 flex gap-1.5">
                        <input
                          name="recipientsCsv"
                          defaultValue={view.recipientsCsv}
                          placeholder="extra@company.com"
                          className="ui-input-compact h-7 text-[11px]"
                        />
                        <button type="submit" className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700">
                          Save
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="space-y-3.5 md:space-y-4">
          <div className="ui-card p-3.5 md:p-4">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-600 md:gap-2 md:text-[12px]">
              <span className="ui-chip">Rows: {contractTotal}</span>
              <span className="ui-chip">Page {page}</span>
              {searchParams.status ? <span className="ui-chip">Status: {searchParams.status}</span> : null}
              {searchParams.deadline ? <span className="ui-chip">Date: {searchParams.deadline}</span> : null}
              <Link href="/contracts/review" className="ui-link ml-auto text-[11px] md:text-[12px]">
                Open review queue
              </Link>
            </div>
          </div>
          <ContractTable
            contracts={contracts}
            reviewStats={reviewStats}
            footer={
              <ContractPagination
                total={contractTotal}
                page={page}
                pageSize={CONTRACTS_PAGE_SIZE}
                basePath="/contracts"
                queryParams={paginationQuery}
              />
            }
          />
        </section>
      </div>
    </div>
  );
}
