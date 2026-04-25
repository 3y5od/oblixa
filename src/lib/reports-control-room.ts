import {
  getExportJobDetail,
  getExportJobHeadline,
  getExportJobTone,
  type ExportJobTone,
  type ExportJobVisibilityInput,
} from "@/lib/export-job-visibility";

export type ReportRunVisibilityInput = {
  status: string | null;
  started_at: string | null;
};

export type ReportsControlRoomSummary = {
  reportsNeedAttention: boolean;
  failedRunsCount: number;
  runningRunsCount: number;
  succeededRunsCount: number;
  latestFailedRunAt: string | null;
  latestSucceededRunAt: string | null;
  latestExportTone: ExportJobTone;
  latestExportHeadline: string;
  latestExportDetail: string;
  latestExportStateLabel: string;
};

export function buildReportsControlRoomSummary(input: {
  reportRuns: ReportRunVisibilityInput[];
  exportJobs: ExportJobVisibilityInput[];
}): ReportsControlRoomSummary {
  const failedRuns = input.reportRuns.filter((run) => run.status === "failed");
  const succeededRuns = input.reportRuns.filter((run) => run.status === "succeeded");
  const runningRuns = input.reportRuns.filter((run) => run.status === "running");
  const latestExportJob = input.exportJobs[0] ?? null;
  const latestExportTone = latestExportJob ? getExportJobTone(latestExportJob) : "neutral";
  const latestExportHeadline = latestExportJob ? getExportJobHeadline(latestExportJob) : "No recent exports";
  const latestExportDetail = latestExportJob
    ? getExportJobDetail(latestExportJob)
    : "No recent export jobs are recorded yet.";

  return {
    reportsNeedAttention: failedRuns.length > 0,
    failedRunsCount: failedRuns.length,
    runningRunsCount: runningRuns.length,
    succeededRunsCount: succeededRuns.length,
    latestFailedRunAt: failedRuns[0]?.started_at ?? null,
    latestSucceededRunAt: succeededRuns[0]?.started_at ?? null,
    latestExportTone,
    latestExportHeadline,
    latestExportDetail,
    latestExportStateLabel: describeLatestExportState(latestExportJob),
  };
}

function describeLatestExportState(job: ExportJobVisibilityInput | null): string {
  if (!job) return "No recent exports recorded";
  if (job.status === "failed") return "Export failed";
  if (job.status === "processing" || job.status === "queued") return "Export is preparing";
  if (job.status === "partial" || job.truncated) return "Export finished partially";
  return "Export completed";
}
