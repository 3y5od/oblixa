import { getAuthContext } from "@/lib/supabase/server";
import { ContractTable } from "@/components/contracts/contract-table";
import Link from "next/link";

function buildFilterUrl(params: Record<string, string | undefined>) {
  const parts = Object.entries(params).filter(([, v]) => v);
  if (parts.length === 0) return "/contracts";
  return `/contracts?${parts.map(([k, v]) => `${k}=${v}`).join("&")}`;
}

export default async function ContractsPage(props: {
  searchParams: Promise<{ status?: string; search?: string; owner?: string }>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const { orgId, admin } = ctx;

  const { data: membersData } = await admin
    .from("organization_members")
    .select("user_id, profiles(full_name, email)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });

  const members = (membersData ?? []).map((m) => {
    const profile = m.profiles as unknown as { full_name: string | null; email: string | null } | null;
    return {
      id: m.user_id,
      label: profile?.full_name || profile?.email || "Unknown",
    };
  });

  let query = admin
    .from("contracts")
    .select("*, owner:profiles!contracts_owner_id_fkey(full_name, email)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (searchParams.status) {
    query = query.eq("status", searchParams.status);
  }

  if (searchParams.search) {
    const sanitized = searchParams.search.replace(/[%_\\()"',.*]/g, "");
    if (sanitized) {
      query = query.or(
        `title.ilike.%${sanitized}%,counterparty.ilike.%${sanitized}%`
      );
    }
  }

  if (searchParams.owner) {
    query = query.eq("owner_id", searchParams.owner);
  }

  const { data: contractsData } = await query;
  const contracts = contractsData ?? [];

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
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Contracts</h1>
        <Link
          href="/contracts/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Upload contract
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <form className="flex items-center gap-4">
          <input
            name="search"
            type="text"
            placeholder="Search by title or counterparty..."
            defaultValue={searchParams.search || ""}
            className="w-64 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {searchParams.status && (
            <input type="hidden" name="status" value={searchParams.status} />
          )}
          {searchParams.owner && (
            <input type="hidden" name="owner" value={searchParams.owner} />
          )}
        </form>

        <div className="flex gap-1">
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

        {members.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Owner:</span>
            <div className="flex gap-1">
              <Link
                href={buildFilterUrl({
                  status: searchParams.status,
                  search: searchParams.search,
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
