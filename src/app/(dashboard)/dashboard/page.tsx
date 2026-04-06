import { getAuthContext } from "@/lib/supabase/server";
import { differenceInDays } from "date-fns";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { UpcomingActions } from "@/components/dashboard/upcoming-actions";
import { ContractTable } from "@/components/contracts/contract-table";
import { MissingFieldsSection } from "@/components/dashboard/missing-fields-section";
import { UsageSection } from "@/components/dashboard/usage-section";
import {
  OnboardingBanner,
  type OnboardingActivationStats,
} from "@/components/dashboard/onboarding-banner";
import { attachOwnerProfiles } from "@/lib/contracts";
import { getContractsMissingCriticalFields } from "@/lib/missing-critical-fields";
import { getOrgUsageStats } from "@/lib/usage-stats";
import { isPlanEnforcementEnabled, orgHasActivePlan } from "@/lib/plan";
import Link from "next/link";
import type { Contract, ExtractedField } from "@/lib/types";

export default async function DashboardPage() {
  const ctx = await getAuthContext();
  if (!ctx) {
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

  const { orgId, admin, user } = ctx;

  const [
    { data: profileRow },
    { count: totalContracts },
    { count: pendingReview },
    { count: activeContracts },
    { data: recentContractsData },
    { data: pendingContractsData },
    { data: dateFieldsData },
    { count: extractedFieldsCount },
    { count: approvedOperationalDatesCount },
    missingCritical,
    usageStats,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle(),
    admin
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    admin
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "pending_review"),
    admin
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "active"),
    admin
      .from("contracts")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("contracts")
      .select("id, title, counterparty")
      .eq("organization_id", orgId)
      .eq("status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("extracted_fields")
      .select("*, contracts!inner(id, title, organization_id)")
      .eq("contracts.organization_id", orgId)
      .eq("status", "approved")
      .in("field_name", ["notice_window", "renewal_date", "end_date"])
      .not("field_value", "is", null),
    admin
      .from("extracted_fields")
      .select("id, contracts!inner(organization_id)", { count: "exact", head: true })
      .eq("contracts.organization_id", orgId),
    admin
      .from("extracted_fields")
      .select("id, contracts!inner(organization_id)", { count: "exact", head: true })
      .eq("contracts.organization_id", orgId)
      .eq("status", "approved")
      .in("field_name", [
        "end_date",
        "renewal_date",
        "notice_window",
        "effective_date",
        "start_date",
      ]),
    getContractsMissingCriticalFields(orgId),
    getOrgUsageStats(orgId),
  ]);

  const recentContracts = await attachOwnerProfiles(admin, recentContractsData ?? []);
  const pendingContracts = pendingContractsData ?? [];
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

  const upcomingDeadlines = upcomingActions.filter(
    (a) => a.daysUntil <= 30
  ).length;

  const showPlanBanner =
    isPlanEnforcementEnabled() && !(await orgHasActivePlan(admin, orgId));

  const showOnboarding = !profileRow?.onboarding_completed_at;

  const onboardingStats: OnboardingActivationStats = {
    contractCount: totalContracts ?? 0,
    hasExtractions: (extractedFieldsCount ?? 0) > 0,
    approvedOperationalDates: approvedOperationalDatesCount ?? 0,
  };

  return (
    <div className="space-y-6">
      {showOnboarding && <OnboardingBanner stats={onboardingStats} />}
      {showPlanBanner && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span className="font-medium">Subscription required</span> to create or
          edit contracts.{" "}
          <Link
            href="/settings/billing"
            className="font-medium text-blue-700 underline hover:text-blue-800"
          >
            Open Billing
          </Link>
        </div>
      )}
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
        totalContracts={totalContracts ?? 0}
        pendingReview={pendingReview ?? 0}
        upcomingDeadlines={upcomingDeadlines}
        activeContracts={activeContracts ?? 0}
        missingCriticalCount={missingCritical.length}
      />

      <UsageSection
        contractsCreated={usageStats.contractsCreated}
        extractionsRun={usageStats.extractionsRun}
        fieldsReviewed={usageStats.fieldsReviewed}
        periodLabel={usageStats.periodLabel}
      />

      <MissingFieldsSection contracts={missingCritical} />

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
          {pendingContracts.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-500">
              All contracts have been reviewed.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {pendingContracts.map((c) => (
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
