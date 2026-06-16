import {
  AlertTriangle,
  CalendarClock,
  CheckSquare,
  Database,
  Eye,
  ListChecks,
  Percent,
  Shield,
  Stamp,
  Timer,
  Users,
} from "lucide-react";
import { UiSelect } from "@/components/ui/ui-select";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";

export function AnalyticsScopeForm({
  ownerFilter,
  regionFilter,
  typeFilter,
  ownerOptions,
  regionOptions,
  typeOptions,
}: {
  ownerFilter: string;
  regionFilter: string;
  typeFilter: string;
  ownerOptions: string[];
  regionOptions: string[];
  typeOptions: string[];
}) {
  return (
    <section className="ui-page-shell p-4">
      <div className="mb-3 space-y-1">
        <p className="ui-eyebrow">Scope</p>
        <p className="ui-support-copy">Narrow the analytics slice by owner, region, or contract type before comparing workflow pressure and delivery behavior.</p>
      </div>
      <form action="/contracts/analytics" method="get" className="grid gap-2 sm:grid-cols-3">
        <UiSelect
          name="owner"
          defaultValue={ownerFilter}
          ariaLabel="Filter analytics by owner"
          options={[
            { value: "all", label: "Owner: all" },
            ...ownerOptions.map((owner) => ({ value: owner, label: owner })),
          ]}
          variant="compact"
          portal
          searchThreshold={8}
          className="w-full"
          buttonClassName="w-full !min-h-11"
        />
        <UiSelect
          name="region"
          defaultValue={regionFilter}
          ariaLabel="Filter analytics by region"
          options={[
            { value: "all", label: "Region: all" },
            ...regionOptions.map((region) => ({ value: region, label: region })),
          ]}
          variant="compact"
          portal
          searchThreshold={8}
          className="w-full"
          buttonClassName="w-full !min-h-11"
        />
        <UiSelect
          name="type"
          defaultValue={typeFilter}
          ariaLabel="Filter analytics by contract type"
          options={[
            { value: "all", label: "Type: all" },
            ...typeOptions.map((type) => ({ value: type, label: type })),
          ]}
          variant="compact"
          portal
          searchThreshold={8}
          className="w-full"
          buttonClassName="w-full !min-h-11"
        />
        <button type="submit" className="ui-btn-secondary px-4 py-2 text-xs sm:col-span-3">
          Apply trend scope
        </button>
      </form>
    </section>
  );
}

export function AnalyticsMetricSections({
  overdueObligations,
  pendingApprovals,
  avgApprovalDays,
  avgCompleteness,
  unresolvedGaps,
  weeklyOperators,
  reportRunsCount,
  failedReportRuns,
  recipientOpenRate,
  deliveredRecipients,
  roleCoverage,
  tasksCompleted7d,
  missedDatesPrevented7d,
}: {
  overdueObligations: number;
  pendingApprovals: number;
  avgApprovalDays: number;
  avgCompleteness: number;
  unresolvedGaps: number;
  weeklyOperators: number;
  reportRunsCount: number;
  failedReportRuns: number;
  recipientOpenRate: number;
  deliveredRecipients: number;
  roleCoverage: number;
  tasksCompleted7d: number;
  missedDatesPrevented7d: number;
}) {
  return (
    <>
      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Execution</p>
          <h2 className="ui-page-title mt-2 text-[1.8rem]">Workflow pressure</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <OperationalSummaryCard
            eyebrow="Requirements"
            headline="Overdue"
            tone={overdueObligations > 0 ? "risk" : "healthy"}
            icon={ListChecks}
            primaryValue={overdueObligations}
            primaryUnit="open or in progress"
            action={{ href: "/contracts/obligations", label: "Review requirements" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Approvals"
            headline="Pending"
            tone={pendingApprovals > 0 ? "attention" : "healthy"}
            icon={Stamp}
            primaryValue={pendingApprovals}
            primaryUnit="awaiting resolution"
            action={{ href: "/contracts/approvals", label: "Review approvals" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Cycle time"
            headline="Avg approval duration"
            tone="neutral"
            icon={Timer}
            primaryValue={`${avgApprovalDays.toFixed(1)}d`}
            primaryUnit="resolved samples"
            action={{ href: "/contracts/approvals", label: "Review approvals" }}
            variant="compact"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Quality</p>
          <h2 className="ui-section-title mt-2 text-xl">Data and adoption</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <OperationalSummaryCard
            eyebrow="Snapshots"
            headline="Avg completeness"
            tone={avgCompleteness < 70 ? "attention" : "healthy"}
            icon={Percent}
            primaryValue={`${avgCompleteness.toFixed(1)}%`}
            primaryUnit="latest samples"
            action={{ href: "/contracts/data-quality", label: "Review data quality" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Gaps"
            headline="Unresolved gaps"
            tone={unresolvedGaps > 0 ? "attention" : "healthy"}
            icon={Database}
            primaryValue={unresolvedGaps}
            primaryUnit="across snapshots"
            action={{ href: "/contracts/data-quality", label: "Review gaps" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Adoption"
            headline="Weekly operators"
            tone="neutral"
            icon={Users}
            primaryValue={weeklyOperators}
            primaryUnit="from behavior feed"
            action={{ href: "/reports", label: "Review reports hub" }}
            variant="compact"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Reporting</p>
          <h2 className="ui-section-title mt-2 text-xl">Digest health</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <OperationalSummaryCard
            eyebrow="Runs"
            headline="Digest executions"
            tone="neutral"
            icon={CalendarClock}
            primaryValue={reportRunsCount}
            primaryUnit="recent sample"
            action={{ href: "/contracts/reports", label: "Review report history" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Reliability"
            headline="Failed runs"
            tone={failedReportRuns > 0 ? "attention" : "healthy"}
            icon={AlertTriangle}
            primaryValue={failedReportRuns}
            primaryUnit="in sample"
            action={{ href: "/contracts/reports", label: "Inspect failures" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Engagement"
            headline="Open rate"
            tone={recipientOpenRate < 40 && deliveredRecipients > 0 ? "attention" : "neutral"}
            icon={Eye}
            primaryValue={`${recipientOpenRate.toFixed(1)}%`}
            primaryUnit="opens / delivered"
            action={{ href: "/contracts/reports", label: "Review recipients" }}
            variant="compact"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Outcomes</p>
          <h2 className="ui-section-title mt-2 text-xl">Weekly operating metrics</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <OperationalSummaryCard
            eyebrow="Coverage"
            headline="Role coverage"
            tone="neutral"
            icon={Shield}
            primaryValue={roleCoverage}
            primaryUnit="tracked seats"
            action={{ href: "/settings/operations", label: "Workspace operations" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Throughput"
            headline="Tasks completed"
            tone="healthy"
            icon={CheckSquare}
            primaryValue={tasksCompleted7d}
            primaryUnit="last 7 days"
            action={{ href: "/contracts/tasks", label: "Review tasks" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Prevention"
            headline="Missed dates prevented"
            tone="healthy"
            icon={CalendarClock}
            primaryValue={missedDatesPrevented7d}
            primaryUnit="last 7 days"
            action={{ href: "/renewals", label: "Review renewals" }}
            variant="compact"
          />
        </div>
      </section>
    </>
  );
}
