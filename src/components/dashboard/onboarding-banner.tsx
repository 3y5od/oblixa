"use client";

import { useState, useTransition, type ReactNode } from "react";
import { completeProductOnboarding } from "@/actions/settings";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import { formatSetupChecklistSummary } from "@/lib/onboarding/calibration-copy";
import { checklistRowOrderFromSetupChecklist } from "@/lib/onboarding/onboarding-banner-checklist-order";
import Link from "next/link";
import { ArrowRight, Check, Circle } from "lucide-react";

export interface OnboardingActivationStats {
  setupConfigured: boolean;
  contractCount: number;
  hasExtractions: boolean;
  approvedOperationalDates: number;
  pendingReviewCount: number;
  ownerAssignedContracts: number;
  visibleWorkItems: number;
  renewalAttention: number;
  dashboardReady: boolean;
  /** True when latest org import job is still `processing` (§7.2 + §17.2 intake progress). */
  importJobProcessing?: boolean;
  /** True when a completed import inserted ≥1 row (server-backed upload step before list metrics refresh). */
  importJobCompletedInserts?: boolean;
  recoverableImportIssue?: string | null;
  failedExtractionIssue?: string | null;
  failedExtractionContractId?: string | null;
}

function StepIcon({ done }: { done: boolean }) {
  return done ? (
    <Check
      size={16}
      className="mt-0.5 shrink-0 text-[var(--success-ink)]"
      strokeWidth={1.85}
      aria-hidden
    />
  ) : (
    <Circle
      size={16}
      className="mt-0.5 shrink-0 text-[var(--text-tertiary)]"
      strokeWidth={1.5}
      aria-hidden
    />
  );
}

export function OnboardingBanner({
  stats,
  setupChecklist,
}: {
  stats: OnboardingActivationStats;
  setupChecklist?: string[];
}) {
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const stepSetup = stats.setupConfigured;
  const stepUpload =
    stats.contractCount >= 1 ||
    Boolean(stats.importJobCompletedInserts);
  const stepReview = stats.hasExtractions && stats.pendingReviewCount === 0;
  const stepOwner = stats.ownerAssignedContracts >= 1;
  const stepApprove = stats.approvedOperationalDates >= 1;
  const stepWork = stats.visibleWorkItems >= 1 || stats.renewalAttention >= 1;
  const stepDashboard = stats.dashboardReady;
  const totalSteps = 7;
  const completedCount = [
    stepSetup,
    stepUpload,
    stepReview,
    stepOwner,
    stepApprove,
    stepWork,
    stepDashboard,
  ].filter(Boolean).length;
  const hasMeaningfulProgress = completedCount >= 2;
  const isLateStage = completedCount >= totalSteps - 2;
  const remainingCount = totalSteps - completedCount;

  if (dismissed || completedCount === totalSteps) return null;

  function dismiss() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await completeProductOnboarding();
        if (result && "error" in result && result.error) {
          setError(describeRecoverableMutationError(result.error));
          return;
        }
        setDismissed(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(describeRecoverableMutationError(message));
      }
    });
  }

  type OnboardingRowKey =
    | "setup"
    | "upload"
    | "review"
    | "owner"
    | "approve"
    | "work"
    | "dashboard";
  const rowOrder = checklistRowOrderFromSetupChecklist(setupChecklist);
  const rows: Record<
    OnboardingRowKey,
    { done: boolean; href: string; actionLabel: string; detail: string; el: ReactNode }
  > = {
    setup: {
      done: stepSetup,
      href: stepSetup ? "/settings/product" : "/onboarding/calibration",
      actionLabel: stepSetup ? "Review product experience" : "Complete workspace calibration",
      detail: stepSetup
        ? "Workspace calibration is on file and the recommended product defaults can still be adjusted later."
        : "Complete the workspace calibration so the starting mode, shortcuts, and landing path point to the right operational surfaces.",
      el: (
        <span>
          {stepSetup ? (
            <>
              Review{" "}
              <Link href="/settings/product" className="ui-link">
                product experience settings
              </Link>{" "}
              if you want to fine-tune the recommended defaults.
            </>
          ) : (
            <>
              Complete{" "}
              <Link href="/onboarding/calibration" className="ui-link">
                workspace calibration
              </Link>{" "}
              so onboarding follows the right operational path.
            </>
          )}
        </span>
      ),
    },
    upload: {
      done: stepUpload,
      href: stats.importJobProcessing ? "/contracts/bulk#recent-imports" : "/contracts/new",
      actionLabel: stepUpload
        ? "Browse contracts"
        : stats.importJobProcessing
          ? "Review import progress"
          : "Upload first contract",
      detail: stepUpload
        ? stats.contractCount >= 1
          ? `${stats.contractCount} contract${stats.contractCount === 1 ? "" : "s"} created.`
          : "A recent import finished with inserted rows. Browse Contracts if the list has not refreshed yet."
        : stats.importJobProcessing
          ? "A CSV import is still running. Contracts appear as rows are inserted; use Bulk import to monitor or retry if something fails."
          : "Add at least one signed agreement so extraction and review can begin.",
      el:
        stats.importJobProcessing && !stepUpload ? (
          <span>
            Follow{" "}
            <Link href="/contracts/bulk#recent-imports" className="ui-link">
              bulk import status
            </Link>{" "}
            for live job progress, or{" "}
            <Link href="/contracts/new" className="ui-link">
              upload a single contract
            </Link>{" "}
            in parallel.
          </span>
        ) : (
          <span>
            <Link href="/contracts/new" className="ui-link">
              Upload
            </Link>{" "}
            a contract (or{" "}
            <Link href="/contracts/bulk" className="ui-link">
              bulk import
            </Link>
            ).
          </span>
        ),
    },
    review: {
      done: stepReview,
      href: "/contracts/review",
      actionLabel: stepReview ? "Resume review" : "Review extracted fields",
      detail: stepReview
        ? "Extraction has produced reviewable data for this workspace."
        : stats.hasExtractions && stats.pendingReviewCount > 0
          ? `${stats.pendingReviewCount} contract${stats.pendingReviewCount === 1 ? "" : "s"} still need review attention before this step is complete.`
          : "Run extraction, then confirm fields with source-backed review.",
      el: (
        <span>
          Run <strong className="font-semibold text-[var(--text-primary)]">Extract fields with AI</strong>
          , then use the{" "}
          <Link href="/contracts/review" className="ui-link">
            review queue
          </Link>{" "}
          — source citations are required before approval.
        </span>
      ),
    },
    owner: {
      done: stepOwner,
      href: "/contracts?sort=activity",
      actionLabel: stepOwner ? "Browse contracts" : "Check contract owners",
      detail: stepOwner
        ? `${stats.ownerAssignedContracts} contract${stats.ownerAssignedContracts === 1 ? "" : "s"} already have an owner recorded.`
        : "Assign an owner so escalations, renewals, and follow-up work have a clear home.",
      el: (
        <span>
          Confirm each active agreement has a visible owner from the{" "}
          <Link href="/contracts?sort=activity" className="ui-link">
            contracts list
          </Link>
          .
        </span>
      ),
    },
    approve: {
      done: stepApprove,
      href: "/contracts/review",
      actionLabel: stepApprove ? "Review dashboard" : "Approve key operational dates",
      detail: stepApprove
        ? `${stats.approvedOperationalDates} approved operational date${stats.approvedOperationalDates === 1 ? "" : "s"} now drive reminders and reporting.`
        : "Approve at least one key date so reminders, renewals, and reports can trust the record.",
      el: (
        <span>
          Approve at least one operational date so{" "}
          <Link href="/dashboard" className="ui-link">
            reminders and reporting
          </Link>{" "}
          can use it.
        </span>
      ),
    },
    work: {
      done: stepWork,
      href: stats.visibleWorkItems > 0 ? "/work?lens=assigned" : "/contracts/renewals",
      actionLabel:
        stepWork && stats.visibleWorkItems > 0
          ? "Review assigned work"
          : stepWork
            ? "Review renewals"
            : "Review execution queues",
      detail: stepWork
        ? stats.visibleWorkItems > 0
          ? `${stats.visibleWorkItems} visible work item${stats.visibleWorkItems === 1 ? "" : "s"} can now be worked from the shared queue.`
          : `${stats.renewalAttention} renewal item${stats.renewalAttention === 1 ? "" : "s"} already ${stats.renewalAttention === 1 ? "needs" : "need"} attention in the active horizon.`
        : "Finish review and key approvals so assigned work, reminders, or renewal follow-up have something actionable to drive.",
      el: (
        <span>
          Use the{" "}
          <Link
            href={stats.visibleWorkItems > 0 ? "/work?lens=assigned" : "/contracts/renewals"}
            className="ui-link"
          >
            {stats.visibleWorkItems > 0 ? "assigned work lens" : "renewals queue"}
          </Link>{" "}
          once approvals and generated work are ready to execute.
        </span>
      ),
    },
    dashboard: {
      done: stepDashboard,
      href: "/dashboard",
      actionLabel: stepDashboard ? "Review dashboard" : "Return to dashboard",
      detail: stepDashboard
        ? "Dashboard cards now point to real queues and records for this workspace."
        : "Return to the dashboard once the first queue, renewal, or review signals are live so the home view becomes actionable.",
      el: (
        <span>
          Return to the{" "}
          <Link href="/dashboard" className="ui-link">
            dashboard
          </Link>{" "}
          once the first review, work, or renewal signals are live.
        </span>
      ),
    },
  };
  const orderedKeys: OnboardingRowKey[] = ["setup", ...rowOrder, "owner", "work", "dashboard"];
  const recoveryRow =
    !stepReview && stats.failedExtractionContractId
      ? {
          href: `/contracts/${stats.failedExtractionContractId}`,
          actionLabel: "Recover failed extraction",
          detail:
            stats.failedExtractionIssue ||
            "Extraction failed on a recent contract. Re-open it and retry from the latest error state.",
        }
      : stats.recoverableImportIssue
        ? {
            href: "/contracts/bulk#recent-imports",
            actionLabel: "Recover failed import",
            detail: stats.recoverableImportIssue,
          }
        : null;
  const nextKey = orderedKeys.find((key) => !rows[key].done) ?? "work";
  const nextRow = rows[nextKey];
  const wrapperClass = hasMeaningfulProgress ? "ui-card relative overflow-hidden" : "ui-card-hero relative overflow-hidden";
  const title = isLateStage
    ? remainingCount === 1
      ? "Complete the last activation step"
      : "Complete the remaining activation steps"
    : hasMeaningfulProgress
      ? "Keep the activation path moving"
      : "Establish your post-signature execution baseline";
  const summary = recoveryRow
    ? recoveryRow.detail
    : isLateStage
      ? "You already have source-backed data flowing. Finish the remaining activation steps so reminders, renewals, and work queues can trust this workspace."
      : stats.hasExtractions && stats.pendingReviewCount > 0 && !stepReview
        ? `${stats.pendingReviewCount} contract${stats.pendingReviewCount === 1 ? "" : "s"} still need review attention before the workspace can trust extracted dates and generated work.`
      : nextRow.detail;

  return (
    <div
      className={wrapperClass}
      role="region"
      aria-label="Getting started checklist"
    >
      <div className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-[var(--accent-strong)]" aria-hidden />
      <div className="flex flex-col gap-5 px-5 py-5 pl-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="ui-caps-1 text-[11px] text-[var(--accent-strong)]">Onboarding</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-[1.05rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)]">
              {title}
            </p>
            <span className="inline-flex items-center rounded-md border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--accent)_10%,var(--surface-raised))] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--accent-strong)] tabular-nums">
              {completedCount}/{totalSteps}
            </span>
          </div>
          <p className="ui-muted-tight mt-2 max-w-xl text-[12.5px]">
            {summary}
          </p>
          {setupChecklist?.length ? (
            <p className="ui-muted-tight mt-2 max-w-xl text-[12.5px]">
              <span className="font-medium text-[var(--text-primary)]">Suggested first steps from setup: </span>
              {formatSetupChecklistSummary(setupChecklist)}
            </p>
          ) : null}
          {recoveryRow ? (
            <div className="ui-alert-warning mt-4 px-4 py-3 text-[12.5px]">
              <p className="font-semibold">Recovery available</p>
              <p className="mt-1">{recoveryRow.detail}</p>
            </div>
          ) : null}
          <ul className="mt-4 space-y-3 text-[14px] leading-relaxed text-[var(--text-secondary)]">
            {orderedKeys.map((key) => (
              <li key={key} className="flex gap-3">
                <StepIcon done={rows[key].done} />
                <div>
                  {rows[key].el}
                  <p className="mt-1 text-[12.5px] text-[var(--text-tertiary)]">{rows[key].detail}</p>
                </div>
              </li>
            ))}
          </ul>
          {stepWork ? (
            <p className="mt-3 text-[12.5px] text-[var(--text-secondary)]">
              Execution is now live in the{" "}
              <Link href="/work?lens=assigned" className="ui-link">
                assigned work lens
              </Link>{" "}
              for tasks, approvals, and obligations in one place.
            </p>
          ) : null}
          {error && <p className="mt-3 text-xs font-medium text-[var(--danger-ink)]">{error}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Link
            href={recoveryRow?.href ?? nextRow.href}
            className="ui-btn-primary inline-flex min-h-9 items-center gap-2 px-5 py-2.5"
          >
            {recoveryRow?.actionLabel ?? nextRow.actionLabel}
            <ArrowRight size={14} aria-hidden />
          </Link>
          <button
            type="button"
            onClick={dismiss}
            disabled={isPending}
            className="ui-btn-secondary min-h-9 px-5 py-2.5"
          >
            {isPending ? "Saving…" : "Hide for now"}
          </button>
        </div>
      </div>
    </div>
  );
}
