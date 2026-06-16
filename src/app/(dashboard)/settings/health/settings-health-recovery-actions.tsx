import { ImportJobRetryButton, V10JobRetryButton } from "@/components/contracts/import-job-retry-button";

type SettingsHealthRecoveryActionsProps = {
  retryableImportJobId: string | null;
  latestFailedReportId: string | null;
};

export function SettingsHealthRecoveryActions({
  retryableImportJobId,
  latestFailedReportId,
}: SettingsHealthRecoveryActionsProps) {
  if (!retryableImportJobId && !latestFailedReportId) return null;

  return (
    <section
      className="rounded-lg border border-l-[0.25rem] border-[color:var(--border-card)] border-l-[color:var(--warning-ink)] bg-[var(--surface)] px-3 py-3"
      aria-labelledby="direct-recovery-actions"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="ui-eyebrow">Retry available</p>
          <h2 id="direct-recovery-actions" className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
            Direct recovery actions
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {retryableImportJobId ? <ImportJobRetryButton jobId={retryableImportJobId} /> : null}
          {latestFailedReportId ? (
            <V10JobRetryButton
              url={`/api/report-runs/${encodeURIComponent(latestFailedReportId)}/retry`}
              label="Retry report"
              successFallbackMessage="Report retry completed."
              testId="report-retry"
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
