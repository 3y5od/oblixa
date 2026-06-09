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
import { formatRelativeSampleAge } from "@/lib/data-freshness";

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
        <p className="font-medium">Suggestions queued</p>
        <p className="mt-1">
          The request has been accepted and queued for worker pickup. This page refreshes while the run
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
        <p className="font-medium">{stale ? "Suggestions may be stuck" : "Suggestions in progress"}</p>
        <p className="mt-1">
          {stale ? (
            <>
              No completion after{" "}
              {Math.round(EXTRACTION_PROCESSING_STALE_MS / 60000)}+ minutes. You can use
              &ldquo;Suggest contract details&rdquo; again to retry, or refresh if the run already
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

    // No confirmable details is a real problem — keep the warning alert plus
    // recovery guidance so it still reads as actionable.
    if (noFieldsExtracted) {
      return (
        <div className="ui-alert-warning" role="status" aria-live="polite">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="font-medium">Suggestions completed with no details to confirm</p>
            {completedLabel ? (
              <span className="text-[11px] text-[var(--text-tertiary)]">Completed {completedLabel}</span>
            ) : null}
            <button
              type="button"
              onClick={() => router.refresh()}
              className="ui-btn-ghost ml-auto inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px]"
            >
              <RefreshCw size={13} aria-hidden />
              Refresh
            </button>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-snug">
            No details were suggested from the current source set. Re-attach clearer or more complete signed
            files, then run suggestions again.
          </p>
        </div>
      );
    }

    // §10.1 calmer cousin: a successful run is the expected outcome, so it reads
    // as a quiet status row (neutral inset + tone dot) rather than a full green
    // wash. Color is reserved for the still-waiting signal.
    return (
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_40%,transparent)] px-3 py-2"
        role="status"
        aria-live="polite"
      >
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-flex h-2 w-2 items-center justify-center">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: needsReview ? "var(--warning-ink)" : "var(--success-ink)",
                boxShadow: `0 0 0 2.5px color-mix(in oklab, ${
                  needsReview ? "var(--warning-soft)" : "var(--success-soft)"
                } 42%, transparent)`,
              }}
            />
          </span>
          <span className="text-[12.5px] font-medium text-[var(--text-primary)]">Suggestions completed</span>
        </span>
        {needsReview ? (
          <span className="inline-flex items-center rounded-full border border-[color:color-mix(in_oklab,var(--warning)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_24%,var(--surface-raised))] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--warning-ink)]">
            {pendingFieldsCount} of {fieldsCount} need review
          </span>
        ) : null}
        {completedLabel ? (
          <span className="text-[11px] text-[var(--text-tertiary)]">Completed {completedLabel}</span>
        ) : null}
        <button
          type="button"
          onClick={() => router.refresh()}
          title="Refresh suggestion status"
          aria-label="Refresh suggestion status"
          className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-tertiary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <RefreshCw size={13} aria-hidden />
        </button>
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div
        className="ui-alert-error"
        role="alert"
      >
        <p className="font-medium">Last suggestion run failed</p>
        <p className="mt-1">{job.last_error || "Unknown error"}</p>
        <p className="mt-2 text-xs">
          Attempt {job.attempt_count} of {MAX_EXTRACTION_ATTEMPTS}. Fix any issues above, then use
          &ldquo;Suggest contract details&rdquo; to retry.
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
