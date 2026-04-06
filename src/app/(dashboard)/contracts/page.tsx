import { getAuthContext } from "@/lib/supabase/server";
import { ContractTable } from "@/components/contracts/contract-table";
import { ContractPagination } from "@/components/contracts/contract-pagination";
import { attachOwnerProfiles } from "@/lib/contracts";
import { fetchContractsPage, CONTRACTS_PAGE_SIZE } from "@/lib/contract-list";
import { getReviewStatsForContractIds } from "@/lib/contract-review-stats";
import {
  getContractIdsForDeadlinePreset,
  getContractIdsMatchingFieldSearch,
  type DeadlinePreset,
  DEADLINE_PRESET_VALUES,
} from "@/lib/contract-filters";
import Link from "next/link";
import { redirect } from "next/navigation";

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
  { value: "end_30", label: "End date ≤30d" },
  { value: "end_90", label: "End date ≤90d" },
  {
    value: "notice_deadline_30",
    label: "Notice deadline ≤30d",
  },
  {
    value: "notice_deadline_90",
    label: "Notice deadline ≤90d",
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
    deadline?: string;
    page?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return null;

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

  let deadlineIds: string[] | null = null;
  if (deadline) {
    deadlineIds = await getContractIdsForDeadlinePreset(admin, orgId, deadline);
  }

  let fieldSearchIds: string[] = [];
  if (sanitizedSearch) {
    fieldSearchIds = await getContractIdsMatchingFieldSearch(
      admin,
      orgId,
      sanitizedSearch
    );
  }

  const { contracts: contractsData, total: contractTotal } =
    await fetchContractsPage(
      admin,
      {
        orgId,
        status: searchParams.status,
        owner: searchParams.owner,
        deadlineIds,
        sanitizedSearch,
        fieldSearchIds,
      },
      page
    );

  const listTotalPages =
    contractTotal > 0
      ? Math.max(1, Math.ceil(contractTotal / CONTRACTS_PAGE_SIZE))
      : 1;
  if (page > listTotalPages && contractTotal > 0) {
    const next = new URLSearchParams();
    if (searchParams.search) next.set("search", searchParams.search);
    if (searchParams.status) next.set("status", searchParams.status);
    if (searchParams.owner) next.set("owner", searchParams.owner);
    if (searchParams.deadline) next.set("deadline", searchParams.deadline);
    next.set("page", String(listTotalPages));
    redirect(`/contracts?${next.toString()}`);
  }

  const [{ data: membersData }] = await Promise.all([
    admin
      .from("organization_members")
      .select("user_id, profiles(full_name, email)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true }),
  ]);

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

  const contracts = await attachOwnerProfiles(admin, contractsData);

  const reviewStats = await getReviewStatsForContractIds(
    admin,
    contracts.map((c) => c.id)
  );

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
    deadline: searchParams.deadline,
  };

  const paginationQuery: Record<string, string | undefined> = {
    ...baseParams,
    status: searchParams.status,
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 border-b border-zinc-200/60 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ui-eyebrow">Portfolio</p>
          <h1 className="ui-display-title mt-2">Contracts</h1>
          <p className="ui-muted mt-3 max-w-xl">
            Search, filter by deadline and owner, and open the{" "}
            <Link href="/contracts/review" className="ui-link">
              review queue
            </Link>{" "}
            for pending field approval.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/export/contracts" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
            Export CSV
          </a>
          <Link href="/contracts/bulk" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
            Bulk import
          </Link>
          <Link href="/contracts/new" className="ui-btn-primary px-5 py-2.5">
            Upload
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] md:p-6">
          <form className="flex flex-col gap-5 lg:flex-row lg:flex-wrap lg:items-end" action="/contracts" method="get">
          <div className="min-w-0 flex-1 lg:max-w-md">
            <label htmlFor="contract-search" className="ui-label-caps">
              Search
            </label>
            <input
              id="contract-search"
              name="search"
              type="search"
              placeholder="Title, counterparty, type, dates…"
              defaultValue={searchParams.search || ""}
              className="ui-input w-full"
              autoComplete="off"
            />
          </div>
          <div className="w-full lg:w-auto">
            <label htmlFor="contract-deadline-filter" className="ui-label-caps">
              Key dates
            </label>
            <select
              id="contract-deadline-filter"
              name="deadline"
              defaultValue={deadline}
              className="ui-input w-full min-w-0 py-2.5 lg:w-auto lg:min-w-[12rem]"
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
          <input type="hidden" name="page" value="1" />
          <button type="submit" className="ui-btn-primary w-full lg:w-auto lg:shrink-0">
            Apply filters
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3 border-t border-zinc-100 pt-6">
          <span className="ui-label-caps mb-0">Status</span>
          <div className="flex flex-wrap gap-2">
            {statuses.map((s) => (
              <Link
                key={s.value}
                href={buildFilterUrl({
                  ...baseParams,
                  status: s.value || undefined,
                })}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  (searchParams.status || "") === s.value
                    ? "bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm"
                    : "bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        {members.length > 1 && (
          <div className="flex flex-col gap-3 border-t border-zinc-100 pt-6">
            <span className="ui-label-caps mb-0">Owner</span>
            <div className="flex flex-wrap gap-2">
              <Link
                href={buildFilterUrl({
                  status: searchParams.status,
                  search: searchParams.search,
                  deadline: searchParams.deadline,
                })}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  !searchParams.owner
                    ? "bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm"
                    : "bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900"
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
                    deadline: searchParams.deadline,
                    owner: m.id,
                  })}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    searchParams.owner === m.id
                      ? "bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm"
                      : "bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900"
                  }`}
                >
                  {m.label}
                </Link>
              ))}
            </div>
          </div>
        )}
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
    </div>
  );
}
