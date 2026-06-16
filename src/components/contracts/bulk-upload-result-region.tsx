import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { ImportPath, ImportResult } from "./bulk-upload-form-types";

export function BulkUploadDisabledBanner({ disabledReason }: { disabledReason?: string }) {
  if (!disabledReason) return null;

  return (
    <div className="border-b border-[var(--border-subtle)] px-5 py-3.5">
      <p className="ui-alert-warning text-sm" role="status">
        {disabledReason}
      </p>
    </div>
  );
}

export function BulkUploadResultRegion({
  result,
  activePath,
  onImportAnotherCsv,
}: {
  result: ImportResult | null;
  activePath: ImportPath;
  onImportAnotherCsv: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={result ? "border-b border-[var(--border-subtle)] px-5 py-3.5" : ""}
    >
      {result ? (
        <div className={`text-sm ${result.type === "error" ? "ui-alert-error" : "ui-alert-success"}`}>
          <div className="flex items-start gap-2">
            {result.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            ) : null}
            <div className="min-w-0">
              <p>{result.text}</p>
              {(result.jobId || (result.type === "success" && activePath === "csv")) ? (
                <ResultLinks result={result} activePath={activePath} onImportAnotherCsv={onImportAnotherCsv} />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ResultLinks({
  result,
  activePath,
  onImportAnotherCsv,
}: {
  result: ImportResult;
  activePath: ImportPath;
  onImportAnotherCsv: () => void;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      <a className="ui-link" href="#recent-imports">
        Review import status
      </a>
      {result.type === "success" ? <SuccessLinks activePath={activePath} /> : null}
      {result.jobId ? (
        <Link className="ui-link" href={`/contracts/imports/${result.jobId}`}>
          Open job details
        </Link>
      ) : null}
      {result.type === "success" && activePath === "csv" ? (
        <button type="button" onClick={onImportAnotherCsv} className="ui-link">
          Import another CSV
        </button>
      ) : null}
    </div>
  );
}

function SuccessLinks({ activePath }: { activePath: ImportPath }) {
  if (activePath === "files") {
    return (
      <Link className="ui-link" href="/contracts/review">
        Confirm suggested details
      </Link>
    );
  }

  return (
    <>
      <Link className="ui-link" href="/contracts">
        View imported contracts
      </Link>
      <Link className="ui-link" href="/contracts/review">
        Review imported details
      </Link>
    </>
  );
}
