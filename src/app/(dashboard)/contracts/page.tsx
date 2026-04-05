import { createClient } from "@/lib/supabase/server";
import { ContractTable } from "@/components/contracts/contract-table";
import Link from "next/link";

export default async function ContractsPage(props: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const orgId = membership?.organization_id;
  if (!orgId) return null;

  let query = supabase
    .from("contracts")
    .select("*, owner:profiles!contracts_owner_id_fkey(full_name, email)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (searchParams.status) {
    query = query.eq("status", searchParams.status);
  }

  if (searchParams.search) {
    query = query.or(
      `title.ilike.%${searchParams.search}%,counterparty.ilike.%${searchParams.search}%`
    );
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

      <div className="flex items-center gap-4">
        <form className="flex flex-1 items-center gap-4">
          <input
            name="search"
            type="text"
            placeholder="Search by title or counterparty..."
            defaultValue={searchParams.search || ""}
            className="max-w-sm flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex gap-1">
            {statuses.map((s) => (
              <Link
                key={s.value}
                href={`/contracts${s.value ? `?status=${s.value}` : ""}${
                  searchParams.search
                    ? `${s.value ? "&" : "?"}search=${searchParams.search}`
                    : ""
                }`}
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
        </form>
      </div>

      <ContractTable contracts={contracts} />
    </div>
  );
}
