import { getAuthContext } from "@/lib/supabase/server";
import { differenceInDays, isValid } from "date-fns";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { UpcomingActions } from "@/components/dashboard/upcoming-actions";
import { ContractTable } from "@/components/contracts/contract-table";
import { MissingFieldsSection } from "@/components/dashboard/missing-fields-section";
import { UsageSection } from "@/components/dashboard/usage-section";
import {
  OnboardingBanner,
  type OnboardingActivationStats,
} from "@/components/dashboard/onboarding-banner";
import { CONTRACT_LIST_ROW_COLUMNS } from "@/lib/contract-list";
import { attachOwnerProfiles } from "@/lib/contracts";
import { getContractsMissingCriticalFields } from "@/lib/missing-critical-fields";
import { getOrgUsageStats } from "@/lib/usage-stats";
import { isPlanEnforcementEnabled, orgHasActivePlan } from "@/lib/plan";
import Link from "next/link";
import type { Contract } from "@/lib/types";

/** Slim row from dashboard deadline query (no full ExtractedField / Contract payload). */
type DashboardDeadlineField = {
  id: string;
  field_name: string;
  field_value: string | null;
  contracts: { id: string; title: string; organization_id: string };
};

export default async function DashboardPage() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-dashed border-zinc-200/80 bg-white/50 px-6 py-16">
        <div className="max-w-sm text-center">
          <p className="ui-eyebrow text-zinc-400">Organization</p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-900">
            No workspace linked
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Your account is not linked to an organization yet. Try refreshing, or
            contact support if this persists.
          </p>
        </div>
      </div>
    );
  }

  const { orgId, admin, user } = ctx;
  const enforcePlan = isPlanEnforcementEnabled();

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
    hasActivePlan,
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
      .select(CONTRACT_LIST_ROW_COLUMNS)
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
      .select(
        "id, field_name, field_value, contracts!inner(id, title, organization_id)"
      )
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
    getContractsMissingCriticalFields(admin, orgId),
    getOrgUsageStats(admin, orgId),
    enforcePlan ? orgHasActivePlan(admin, orgId) : Promise.resolve(true),
  ]);

  const recentContracts = await attachOwnerProfiles(admin, recentContractsData ?? []);
  const pendingContracts = pendingContractsData ?? [];
  const dateFields = (dateFieldsData ?? []) as unknown as DashboardDeadlineField[];

  const today = new Date();
  const upcomingActions = dateFields
    .filter((field) => field.field_value)
    .map((field) => {
      const dateValue = new Date(field.field_value as string);
      if (!isValid(dateValue)) return null;
      const daysUntil = differenceInDays(dateValue, today);
      if (Number.isNaN(daysUntil)) return null;
      return {
        contract: field.contracts,
        field: {
          id: field.id,
          field_name: field.field_name,
          field_value: field.field_value,
        },
        daysUntil,
      };
    })
    .filter(
      (a): a is NonNullable<typeof a> =>
        a != null && a.daysUntil >= 0 && a.daysUntil <= 90
    )
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 10);

  const upcomingDeadlines = upcomingActions.filter(
    (a) => a.daysUntil <= 30
  ).length;

  const showPlanBanner = enforcePlan && !hasActivePlan;

  const showOnboarding = !profileRow?.onboarding_completed_at;

  const onboardingStats: OnboardingActivationStats = {
    contractCount: totalContracts ?? 0,
    hasExtractions: (extractedFieldsCount ?? 0) > 0,
    approvedOperationalDates: approvedOperationalDatesCount ?? 0,
  };

  return (
    <div className="space-y-10">
      {showOnboarding && <OnboardingBanner stats={onboardingStats} />}
      {showPlanBanner && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] leading-relaxed text-amber-950">
            <span className="font-semibold">Subscription required</span> to create or
            edit contracts.
          </p>
          <Link href="/settings/billing" className="ui-btn-secondary shrink-0 px-4 py-2 text-[13px]">
            Billing
          </Link>
        </div>
      )}

      <header className="flex flex-col gap-6 border-b border-zinc-200/60 pb-10 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ui-eyebrow">Overview</p>
          <h1 className="ui-display-title mt-2">Dashboard</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-zinc-500">
            Operational snapshot of your agreements — deadlines, review load, and
            portfolio health at a glance.
          </p>
        </div>
        <Link href="/contracts/new" className="ui-btn-primary h-11 px-6">
          Upload contract
        </Link>
      </header>

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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
        <UpcomingActions actions={upcomingActions} />

        <section className="ui-card flex flex-col overflow-hidden">
          <div className="border-b border-zinc-100/90 bg-zinc-50/30 px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="ui-section-title">Needs review</h2>
                <p className="mt-1 text-[12px] text-zinc-500">
                  Pending field approval
                </p>
              </div>
              <Link href="/contracts/review" className="ui-link text-[13px]">
                Full queue
              </Link>
            </div>
          </div>
          {pendingContracts.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
              <p className="text-[13px] font-medium text-zinc-600">Queue clear</p>
              <p className="mt-1 text-[13px] text-zinc-400">
                All contracts have been reviewed.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {pendingContracts.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/contracts/${c.id}`}
                    className="block px-6 py-4 transition-colors hover:bg-zinc-50/70"
                  >
                    <p className="text-[15px] font-semibold text-zinc-900">{c.title}</p>
                    <p className="mt-0.5 text-[13px] text-zinc-500">
                      {c.counterparty || "No counterparty"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="ui-section-title text-base">Recent contracts</h2>
            <p className="mt-1 text-[13px] text-zinc-500">Latest activity in your workspace</p>
          </div>
          <Link href="/contracts" className="ui-link text-[13px]">
            View all
          </Link>
        </div>
        <ContractTable contracts={recentContracts as Contract[]} />
      </section>
    </div>
  );
}
