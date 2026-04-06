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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="ui-page-title">Contracts</h1>
          <p className="ui-muted mt-1.5 max-w-xl">
            Filter and paginate your workspace. Use the{" "}
            <Link href="/contracts/review" className="ui-link">
              review queue
            </Link>{" "}
            for contracts that still need field approval.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/export/contracts" className="ui-btn-secondary px-4 py-2">
            Export CSV
          </a>
          <Link href="/contracts/bulk" className="ui-btn-secondary px-4 py-2">
            Bulk import
          </Link>
          <Link href="/contracts/new" className="ui-btn-primary px-4 py-2">
            Upload contract
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <form className="flex flex-wrap items-end gap-4" action="/contracts" method="get">
          <div>
            <label className="ui-label mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Search
            </label>
            <input
              name="search"
              type="text"
              placeholder="Title, counterparty, type, fees, dates…"
              defaultValue={searchParams.search || ""}
              className="ui-input w-72"
            />
          </div>
          <div>
            <label className="ui-label mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Key dates
            </label>
            <select
              name="deadline"
              defaultValue={deadline}
              className="ui-input w-auto min-w-[11rem] py-2"
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
          <button type="submit" className="ui-btn-secondary px-4 py-2">
            Apply
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Status
          </span>
          <div className="flex flex-wrap gap-1.5">
            {statuses.map((s) => (
              <Link
                key={s.value}
                href={buildFilterUrl({
                  ...baseParams,
                  status: s.value || undefined,
                })}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  (searchParams.status || "") === s.value
                    ? "bg-zinc-900 text-white ring-1 ring-zinc-900/10"
                    : "text-zinc-600 hover:bg-zinc-100/90"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        {members.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Owner
            </span>
            <div className="flex flex-wrap gap-1.5">
              <Link
                href={buildFilterUrl({
                  status: searchParams.status,
                  search: searchParams.search,
                  deadline: searchParams.deadline,
                })}
                className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  !searchParams.owner
                    ? "bg-zinc-900 text-white ring-1 ring-zinc-900/10"
                    : "text-zinc-600 hover:bg-zinc-100/90"
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
                  className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                    searchParams.owner === m.id
                      ? "bg-zinc-900 text-white ring-1 ring-zinc-900/10"
                      : "text-zinc-600 hover:bg-zinc-100/90"
                  }`}
                >
                  {m.label}
                </Link>
              ))}
            </div>
          </div>
        )}
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
