import type { AssuranceAnalyticsSummary } from "@/lib/assurance/assurance-analytics";
import {
  AssuranceHubVisitorsCard,
  DiagnosticSummaryCards,
  ExternalCollaborationCard,
  OverviewSummaryCards,
} from "@/components/reports/reports-assurance-metric-cards";
import {
  AdoptionPanel,
  FindingCalibrationPanel,
  OpenFindingsTypePanel,
  PolicyPassRatePanel,
  QualityCountersPanel,
  SegmentRollupPanel,
} from "@/components/reports/reports-assurance-panels";

export function AssuranceOverviewCards({ analytics }: { analytics: AssuranceAnalyticsSummary }) {
  return <OverviewSummaryCards analytics={analytics} />;
}

export function AssuranceDiagnosticsDetails({ analytics }: { analytics: AssuranceAnalyticsSummary }) {
  return (
    <details className="ui-soft-details">
      <summary className="cursor-pointer text-sm font-semibold text-[var(--text-primary)]">
        Advanced assurance diagnostics
      </summary>
      <DiagnosticSummaryCards analytics={analytics} />
      <SegmentRollupPanel analytics={analytics} />
      <AdoptionPanel analytics={analytics} />
      <QualityCountersPanel analytics={analytics} />
      <FindingCalibrationPanel analytics={analytics} />
      <ExternalCollaborationCard analytics={analytics} />
      <AssuranceHubVisitorsCard analytics={analytics} />
      <PolicyPassRatePanel analytics={analytics} />
    </details>
  );
}

export function OpenFindingsByTypePanel({ analytics }: { analytics: AssuranceAnalyticsSummary }) {
  return <OpenFindingsTypePanel analytics={analytics} />;
}
