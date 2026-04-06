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

interface ExtractionJobAlertProps {
  job: ContractExtractionJob | null;
}

const EXTRACTION_POLL_MS = 3000;

export function ExtractionJobAlert({ job }: ExtractionJobAlertProps) {
  const router = useRouter();
  const kickRefreshDone = useRef(false);

  useEffect(() => {
    if (job?.status !== "processing") {
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
    if (job?.status !== "processing") return;
    if (kickRefreshDone.current) return;
    kickRefreshDone.current = true;
    const t = window.setTimeout(() => router.refresh(), 600);
    return () => clearTimeout(t);
  }, [job?.status, job?.started_at, router]);

  if (!job) return null;

  if (job.status === "processing") {
    const stale = isExtractionProcessingStale(job.started_at);
    const runningForLabel = job.started_at
      ? formatDistanceToNow(new Date(job.started_at), { addSuffix: false })
      : null;

    return (
      <div
        className={
          stale
            ? "mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            : "mb-4 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950"
        }
        role="status"
        aria-live="polite"
      >
        <p className={`font-medium ${stale ? "text-amber-900" : "text-violet-900"}`}>
          {stale ? "Extraction may be stuck" : "Extraction in progress"}
        </p>
        <p className={`mt-1 ${stale ? "text-amber-900/95" : "text-violet-900/90"}`}>
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
          className={
            stale
              ? "mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-300/80 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 transition-colors hover:bg-amber-100/60"
              : "mt-3 inline-flex items-center gap-1.5 rounded-lg border border-violet-300/80 bg-white px-3 py-1.5 text-xs font-medium text-violet-900 transition-colors hover:bg-violet-100/60"
          }
        >
          <RefreshCw size={14} aria-hidden />
          Refresh now
        </button>
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div
        className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
        role="alert"
      >
        <p className="font-medium text-red-900">Last extraction failed</p>
        <p className="mt-1 text-red-800">{job.last_error || "Unknown error"}</p>
        <p className="mt-2 text-xs text-red-800">
          Attempt {job.attempt_count} of {MAX_EXTRACTION_ATTEMPTS}. Fix any issues above, then use
          &ldquo;Extract fields with AI&rdquo; to retry.
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-300/80 bg-white px-3 py-1.5 text-xs font-medium text-red-900 transition-colors hover:bg-red-100/50"
        >
          <RefreshCw size={14} aria-hidden />
          Refresh status
        </button>
      </div>
    );
  }

  return null;
}
