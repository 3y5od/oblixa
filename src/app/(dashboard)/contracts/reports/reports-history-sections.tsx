import Link from "next/link";
import { Activity, Layers, Mail, Package } from "lucide-react";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";

export function ReportsHistoryDisabledState() {
  return (
    <div className="ui-card px-6 py-8">
      <p className="ui-eyebrow">Feature flag</p>
      <h1 className="ui-display-title mt-2">Reports history is disabled</h1>
      <p className="mt-3 max-w-xl text-sm text-[var(--text-tertiary)]">
        This surface is off because the server has disabled it (set{" "}
        <code className="text-xs">ENABLE_REPORTING_HISTORY</code> to false, 0, no, or off). Remove or unset that variable
        to turn reporting history back on.
      </p>
    </div>
  );
}

export function ReportsHistorySummaryCards({
  failedDigestRuns,
  runCount,
  selectedRunId,
  reportPackCount,
  activeReportPackCount,
  subscriptionCount,
  activeSubscriptionCount,
  failedPackRuns,
  packRunCount,
}: {
  failedDigestRuns: number;
  runCount: number;
  selectedRunId: string | null;
  reportPackCount: number;
  activeReportPackCount: number;
  subscriptionCount: number;
  activeSubscriptionCount: number;
  failedPackRuns: number;
  packRunCount: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <OperationalSummaryCard
        eyebrow="Digest"
        headline="Email digest runs"
        tone={failedDigestRuns > 0 ? "attention" : "healthy"}
        icon={Activity}
        primaryValue={runCount}
        breakdown={[
          { label: "Failed", value: String(failedDigestRuns) },
          { label: "Selected", value: selectedRunId ? "Yes" : "-" },
        ]}
        action={{ href: "#digest-runs", label: "Review digest runs" }}
        variant="compact"
      />
      <OperationalSummaryCard
        eyebrow="Catalog"
        headline="Report packs"
        tone={reportPackCount > 0 ? "neutral" : "attention"}
        icon={Package}
        primaryValue={reportPackCount}
        breakdown={[{ label: "Active", value: String(activeReportPackCount) }]}
        action={{ href: "#report-packs", label: "Manage packs" }}
        variant="compact"
      />
      <OperationalSummaryCard
        eyebrow="Delivery"
        headline="Subscriptions"
        tone={subscriptionCount > 0 ? "healthy" : "neutral"}
        icon={Mail}
        primaryValue={subscriptionCount}
        breakdown={[{ label: "Active", value: String(activeSubscriptionCount) }]}
        action={{ href: "#subscriptions", label: "Review subscriptions" }}
        variant="compact"
      />
      <OperationalSummaryCard
        eyebrow="Automation"
        headline="Pack run history"
        tone={failedPackRuns > 0 ? "attention" : "healthy"}
        icon={Layers}
        primaryValue={packRunCount}
        breakdown={[{ label: "Failed", value: String(failedPackRuns) }]}
        action={{ href: "#pack-runs", label: "Review pack runs" }}
        variant="compact"
      />
    </div>
  );
}

type DigestRunRow = {
  id: string;
  report_mode: string | null;
  status: string | null;
  started_at: string;
};

export function DigestRunsSection({
  runs,
  selectedRunId,
}: {
  runs: DigestRunRow[];
  selectedRunId: string | null;
}) {
  return (
    <section id="digest-runs" className="ui-card scroll-mt-8 overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-5 py-3">
        <p className="ui-eyebrow">Timeline</p>
        <h2 className="ui-section-title mt-1 text-base">Digest runs</h2>
      </div>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {runs.map((run) => (
          <li key={run.id} className="px-5 py-3 text-sm">
            <Link
              href={`/contracts/reports?runId=${run.id}`}
              className={`block rounded-lg border px-3 py-2 ${
                selectedRunId === run.id
                  ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-white"
                  : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,var(--canvas))]"
              }`}
            >
              <p className="font-semibold">
                {run.report_mode} - {run.status}
              </p>
              <p className={`text-xs ${selectedRunId === run.id ? "text-[var(--text-tertiary)]" : "text-[var(--text-tertiary)]"}`}>
                {new Date(run.started_at).toLocaleString()}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
