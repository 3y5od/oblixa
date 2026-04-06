import { getAuthContext } from "@/lib/supabase/server";
import { ContractTable } from "@/components/contracts/contract-table";
import { attachOwnerProfiles } from "@/lib/contracts";
import {
  getContractIdsForDeadlinePreset,
  getContractIdsMatchingFieldSearch,
  type DeadlinePreset,
  DEADLINE_PRESET_VALUES,
} from "@/lib/contract-filters";
import Link from "next/link";
import type { Contract } from "@/lib/types";

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
  }>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const { orgId, admin } = ctx;

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

  let contractsData: Contract[] = [];

  if (deadlineIds !== null && deadlineIds.length === 0) {
    contractsData = [];
  } else {
    let contractsQuery = admin
      .from("contracts")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (searchParams.status) {
      contractsQuery = contractsQuery.eq("status", searchParams.status);
    }
    if (searchParams.owner) {
      contractsQuery = contractsQuery.eq("owner_id", searchParams.owner);
    }
    if (deadlineIds !== null && deadlineIds.length > 0) {
      contractsQuery = contractsQuery.in("id", deadlineIds);
    }

    if (sanitizedSearch) {
      const orParts = [
        `title.ilike.%${sanitizedSearch}%`,
        `counterparty.ilike.%${sanitizedSearch}%`,
        `contract_type.ilike.%${sanitizedSearch}%`,
        `search_document.ilike.%${sanitizedSearch}%`,
      ];
      if (fieldSearchIds.length > 0) {
        orParts.push(`id.in.(${fieldSearchIds.join(",")})`);
      }
      contractsQuery = contractsQuery.or(orParts.join(","));
    }

    const { data } = await contractsQuery;
    contractsData = (data ?? []) as Contract[];
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Contracts</h1>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/export/contracts"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Export CSV
          </a>
          <Link
            href="/contracts/bulk"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Bulk import
          </Link>
          <Link
            href="/contracts/new"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Upload contract
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <form className="flex flex-wrap items-end gap-4" action="/contracts" method="get">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Search
            </label>
            <input
              name="search"
              type="text"
              placeholder="Title, counterparty, type, fees, dates…"
              defaultValue={searchParams.search || ""}
              className="w-72 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Key dates
            </label>
            <select
              name="deadline"
              defaultValue={deadline}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          <button
            type="submit"
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200"
          >
            Apply
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Status:</span>
          <div className="flex flex-wrap gap-1">
            {statuses.map((s) => (
              <Link
                key={s.value}
                href={buildFilterUrl({
                  ...baseParams,
                  status: s.value || undefined,
                })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  (searchParams.status || "") === s.value
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        {members.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Owner:</span>
            <div className="flex flex-wrap gap-1">
              <Link
                href={buildFilterUrl({
                  status: searchParams.status,
                  search: searchParams.search,
                  deadline: searchParams.deadline,
                })}
                className={`rounded-md px-2.5 py-1.5 text-sm font-medium ${
                  !searchParams.owner
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
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
                  className={`rounded-md px-2.5 py-1.5 text-sm font-medium ${
                    searchParams.owner === m.id
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {m.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <ContractTable contracts={contracts} />
    </div>
  );
}
