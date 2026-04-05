import { createClient } from "@/lib/supabase/server";
import { differenceInDays } from "date-fns";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { UpcomingActions } from "@/components/dashboard/upcoming-actions";
import { ContractTable } from "@/components/contracts/contract-table";
import Link from "next/link";
import type { Contract, ExtractedField } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Get user's org
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const orgId = membership?.organization_id;
  if (!orgId) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">No organization found</h2>
          <p className="mt-1 text-sm text-gray-500">
            Your account is not linked to an organization yet.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: contractsData }, { data: dateFieldsData }] = await Promise.all([
    supabase
      .from("contracts")
      .select("*, owner:profiles!contracts_owner_id_fkey(full_name, email)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("extracted_fields")
      .select("*, contracts!inner(id, title, organization_id)")
      .eq("contracts.organization_id", orgId)
      .eq("status", "approved")
      .in("field_name", ["notice_window", "renewal_date", "end_date"])
      .not("field_value", "is", null),
  ]);

  const contracts = contractsData ?? [];
  const dateFields = dateFieldsData ?? [];

  const today = new Date();
  const upcomingActions = (dateFields as (ExtractedField & { contracts: Contract })[])
    .map((field) => {
      const dateValue = new Date(field.field_value!);
      const daysUntil = differenceInDays(dateValue, today);
      return {
        contract: field.contracts,
        field,
        daysUntil,
      };
    })
    .filter((a) => a.daysUntil >= 0 && a.daysUntil <= 90)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 10);

  const totalContracts = contracts.length;
  const pendingReview = contracts.filter(
    (c) => c.status === "pending_review"
  ).length;
  const activeContracts = contracts.filter((c) => c.status === "active").length;
  const upcomingDeadlines = upcomingActions.filter(
    (a) => a.daysUntil <= 30
  ).length;

  const recentContracts = contracts.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          href="/contracts/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Upload contract
        </Link>
      </div>

      <StatsCards
        totalContracts={totalContracts}
        pendingReview={pendingReview}
        upcomingDeadlines={upcomingDeadlines}
        activeContracts={activeContracts}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingActions actions={upcomingActions} />

        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Needs Review
            </h2>
            <Link
              href="/contracts?status=pending_review"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              View all
            </Link>
          </div>
          {contracts.filter((c) => c.status === "pending_review").length ===
          0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-500">
              All contracts have been reviewed.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {contracts
                .filter((c) => c.status === "pending_review")
                .slice(0, 5)
                .map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/contracts/${c.id}`}
                      className="block px-6 py-3 hover:bg-gray-50"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {c.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {c.counterparty || "No counterparty"}
                      </p>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Contracts
          </h2>
          <Link
            href="/contracts"
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            View all
          </Link>
        </div>
        <ContractTable contracts={recentContracts} />
      </div>
    </div>
  );
}
