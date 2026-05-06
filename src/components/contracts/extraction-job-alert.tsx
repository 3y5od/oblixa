"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw } from "lucide-react";
import type { ContractExtractionJob } from "@/lib/types";
import {
  EXTRACTION_PROCESSING_STALE_MS,
  isExtractionProcessingStale,
  MAX_EXTRACTION_ATTEMPTS,
} from "@/lib/extraction/constants";
import { formatRelativeSampleAge } from "@/lib/v9-data-freshness";

interface ExtractionJobAlertProps {
  job: ContractExtractionJob | null;
  fieldsCount?: number;
  pendingFieldsCount?: number;
}

const EXTRACTION_POLL_MS = 3000;

export function ExtractionJobAlert({
  job,
  fieldsCount = 0,
  pendingFieldsCount = 0,
}: ExtractionJobAlertProps) {
  const router = useRouter();
  const kickRefreshDone = useRef(false);

  useEffect(() => {
    if (job?.status !== "processing" && job?.status !== "pending") {
      kickRefreshDone.current = false;
      return;
    }
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
    }, EXTRACTION_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [job?.status, router]);

  useEffect(() => {
    if (job?.status !== "processing" && job?.status !== "pending") return;
    if (kickRefreshDone.current) return;
    kickRefreshDone.current = true;
    const t = window.setTimeout(() => router.refresh(), 600);
    return () => clearTimeout(t);
  }, [job?.status, job?.started_at, router]);

  if (!job) return null;

  const jobFreshness = formatRelativeSampleAge(job.updated_at);
  const completedLabel = job.completed_at
    ? formatDistanceToNow(new Date(job.completed_at), { addSuffix: true })
    : null;

  if (job.status === "pending") {
    return (
      <div
        className="ui-alert-info"
        role="status"
        aria-live="polite"
      >
        <p className="font-medium">Extraction queued</p>
        <p className="mt-1">
          The request has been accepted and is waiting for a worker pickup. This page refreshes while the run
          starts, or use the button below if you want to check again now.
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="ui-btn-secondary mt-3 px-3 py-1.5 text-xs"
        >
          <RefreshCw size={14} aria-hidden />
          Refresh now
        </button>
        {jobFreshness ? <p className="mt-2 text-[11px] opacity-80">{jobFreshness}</p> : null}
      </div>
    );
  }

  if (job.status === "processing") {
    const stale = isExtractionProcessingStale(job.started_at);
    const runningForLabel = job.started_at
      ? formatDistanceToNow(new Date(job.started_at), { addSuffix: false })
      : null;

    return (
      <div
        className={
          stale
            ? "ui-alert-warning"
            : "ui-alert-info"
        }
        role="status"
        aria-live="polite"
      >
        <p className="font-medium">{stale ? "Extraction may be stuck" : "Extraction in progress"}</p>
        <p className="mt-1">
          {stale ? (
            <>
              No completion after{" "}
              {Math.round(EXTRACTION_PROCESSING_STALE_MS / 60000)}+ minutes. You can use
              &ldquo;Extract fields with AI&rdquo; again to retry, or refresh if the run already
              finished.
            </>
          ) : (
            <>
              Attempt {job.attempt_count} of {MAX_EXTRACTION_ATTEMPTS}
              {runningForLabel ? (
                <>
                  {" "}
                  · running for {runningForLabel}
                </>
              ) : null}
              . This page refreshes every few seconds, or use the button below.
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="ui-btn-secondary mt-3 px-3 py-1.5 text-xs"
        >
          <RefreshCw size={14} aria-hidden />
          Refresh now
        </button>
        {jobFreshness ? <p className="mt-2 text-[11px] opacity-80">{jobFreshness}</p> : null}
      </div>
    );
  }

  if (job.status === "succeeded") {
    const needsReview = pendingFieldsCount > 0;
    const noFieldsExtracted = fieldsCount === 0;

    return (
      <div
        className={
          noFieldsExtracted
            ? "ui-alert-warning"
            : needsReview
              ? "ui-alert-success"
              : "ui-alert-success"
        }
        role="status"
        aria-live="polite"
      >
        <p className="font-medium">
          {noFieldsExtracted ? "Extraction completed with no reviewable fields" : "Extraction completed"}
        </p>
        <p className="mt-1">
          {noFieldsExtracted
            ? "No fields were extracted from the current source set. Re-attach clearer or more complete signed files, then run extraction again."
            : needsReview
              ? `${pendingFieldsCount} of ${fieldsCount} extracted field${fieldsCount === 1 ? " is" : "s are"} still waiting for review before reminders and downstream workflow rely on them.`
              : `${fieldsCount} extracted field${fieldsCount === 1 ? " is" : "s are"} available and no items are currently waiting for review.`}
          {completedLabel ? ` Completed ${completedLabel}.` : ""}
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="ui-btn-secondary mt-3 px-3 py-1.5 text-xs"
        >
          <RefreshCw size={14} aria-hidden />
          Refresh status
        </button>
        {jobFreshness ? <p className="mt-2 text-[11px] opacity-80">{jobFreshness}</p> : null}
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div
        className="ui-alert-error"
        role="alert"
      >
        <p className="font-medium">Last extraction failed</p>
        <p className="mt-1">{job.last_error || "Unknown error"}</p>
        <p className="mt-2 text-xs">
          Attempt {job.attempt_count} of {MAX_EXTRACTION_ATTEMPTS}. Fix any issues above, then use
          &ldquo;Extract fields with AI&rdquo; to retry.
          {completedLabel ? ` Last failure ${completedLabel}.` : ""}
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="ui-btn-secondary mt-3 px-3 py-1.5 text-xs"
        >
          <RefreshCw size={14} aria-hidden />
          Refresh status
        </button>
        {jobFreshness ? <p className="mt-2 text-[11px] opacity-80">{jobFreshness}</p> : null}
      </div>
    );
  }

  return null;
}
