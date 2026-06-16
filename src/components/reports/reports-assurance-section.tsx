import Link from "next/link";
import type { AssuranceAnalyticsSummary } from "@/lib/assurance/assurance-analytics";
import { ApiJsonLink } from "@/components/ui/api-json-link";
import { OperationalSectionHeader } from "@/components/ui/operational-summary-card";
import {
  AssuranceDiagnosticsDetails,
  AssuranceOverviewCards,
  OpenFindingsByTypePanel,
} from "@/components/reports/reports-assurance-analytics-details";

export function ReportsV6AssuranceAnalyticsSection(props: {
  analytics: AssuranceAnalyticsSummary;
  canViewAssuranceOps: boolean;
  showAssuranceMode: boolean;
}) {
  if (!props.showAssuranceMode) {
    return (
      <section id="assurance-analytics" className="scroll-mt-8 space-y-4">
        <OperationalSectionHeader
          eyebrow="Assurance"
          title="Assurance analytics"
          description="Assurance analytics are hidden for this workspace mode."
        />
      </section>
    );
  }

  return (
    <section id="assurance-analytics" className="scroll-mt-8 space-y-4">
      <OperationalSectionHeader
        eyebrow="Assurance"
        title="Assurance analytics"
        description="Native assurance rates: policy pass, playbook throughput, autopilot posture, and finding mix."
      />
      {props.canViewAssuranceOps ? (
        <AssuranceOperatorAnalytics analytics={props.analytics} />
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">
          Detailed assurance analytics are limited to workspace operators. Open the{" "}
          <Link className="ui-link" href="/assurance" prefetch={false}>
            Assurance hub
          </Link>{" "}
          for your available views.
        </p>
      )}
    </section>
  );
}

function AssuranceOperatorAnalytics({ analytics }: { analytics: AssuranceAnalyticsSummary }) {
  return (
    <>
      <AssuranceOverviewCards analytics={analytics} />
      <AssuranceDiagnosticsDetails analytics={analytics} />
      <OpenFindingsByTypePanel analytics={analytics} />
      <ApiJsonLink href="/api/assurance/analytics/summary" className="ui-link mt-3 inline-block text-xs">
        Inspect assurance analytics feed
      </ApiJsonLink>
    </>
  );
}

export { ReportsV6AssuranceAnalyticsSection as ReportsAssuranceAnalyticsSection };
