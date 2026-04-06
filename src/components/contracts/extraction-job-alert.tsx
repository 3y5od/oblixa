import type { ContractExtractionJob } from "@/lib/types";
import { MAX_EXTRACTION_ATTEMPTS } from "@/lib/extraction/constants";

interface ExtractionJobAlertProps {
  job: ContractExtractionJob | null;
}

export function ExtractionJobAlert({ job }: ExtractionJobAlertProps) {
  if (!job) return null;

  if (job.status === "processing") {
    return (
      <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
        <p className="font-medium text-violet-900">Extraction in progress</p>
        <p className="mt-1 text-violet-900/90">
          Attempt {job.attempt_count} of {MAX_EXTRACTION_ATTEMPTS}. Refresh this page in a few
          seconds to see new fields.
        </p>
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
        <p className="font-medium text-red-900">Last extraction failed</p>
        <p className="mt-1 text-red-800">{job.last_error || "Unknown error"}</p>
        <p className="mt-2 text-xs text-red-800">
          Attempt {job.attempt_count} of {MAX_EXTRACTION_ATTEMPTS}. Fix any issues above, then use
          &ldquo;Extract fields with AI&rdquo; to retry.
        </p>
      </div>
    );
  }

  return null;
}
