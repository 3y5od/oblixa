import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CircleAlert, FileCheck2, FileSpreadsheet, UploadCloud } from "lucide-react";
import { ActionChip } from "@/components/ui/action-chip";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { TimeChip } from "@/components/ui/time-chip";
import {
  DASHBOARD_PRIMARY_CTA,
  DASHBOARD_SECONDARY_CTA,
  DASHBOARD_TITLE,
} from "@/lib/dashboard/spec-strings";
import type { CoreDashboardImportStatus } from "@/lib/dashboard/core-dashboard-model";

export function PartialDataNotice({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Dashboard partial data state"
      className="ui-alert-warning flex items-start gap-2.5 px-5 py-3"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      <p className="text-[13px] leading-snug">
        <span className="font-semibold">Some dashboard data could not load.</span>{" "}
        {count === 1 ? "One section" : `${count} sections`} may show incomplete
        counts - reload to try again.
      </p>
    </div>
  );
}

export function ImportStatusNotice({ status }: { status: CoreDashboardImportStatus }) {
  if (status.kind === "none") return null;
  const alertClass =
    status.tone === "danger"
      ? "ui-alert-error"
      : status.tone === "warning"
        ? "ui-alert-warning"
        : "ui-alert-info";
  const chipTone = status.tone === "danger" ? "danger" : status.tone === "warning" ? "warning" : undefined;
  const ink =
    status.tone === "danger"
      ? "var(--danger-ink)"
      : status.tone === "warning"
        ? "var(--warning-ink)"
        : "var(--accent-strong)";
  const StatusIcon =
    status.kind === "processing"
      ? UploadCloud
      : status.tone === "danger"
        ? CircleAlert
        : AlertTriangle;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Contract import status"
      className={`${alertClass} flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
          style={{
            borderColor: `color-mix(in oklab, ${ink} 30%, var(--border-card))`,
            background: `color-mix(in oklab, ${ink} 14%, var(--surface-raised))`,
            color: ink,
          }}
        >
          <StatusIcon className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-snug">{status.headline}</p>
          <p className="mt-0.5 text-[12px] leading-snug">{status.detail}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
        {status.occurredAt ? (
          <TimeChip date={status.occurredAt} bordered className="shrink-0" />
        ) : null}
        <ActionChip
          verb={status.canRetry ? "Retry import" : "View imports"}
          href={status.href}
          tone={chipTone}
          className="shrink-0"
        />
      </div>
    </div>
  );
}

export function CoreDashboardIntakeActions({
  className,
  buttonClassName,
}: {
  className?: string;
  buttonClassName: string;
}) {
  return (
    <div className={className}>
      <Link
        href="/contracts/new"
        className={`ui-btn-primary inline-flex items-center justify-center gap-1.5 ${buttonClassName}`}
      >
        <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
        {DASHBOARD_PRIMARY_CTA}
      </Link>
      <Link
        href="/contracts/bulk"
        prefetch={false}
        className={`ui-btn-secondary inline-flex items-center justify-center gap-1.5 ${buttonClassName}`}
      >
        <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
        {DASHBOARD_SECONDARY_CTA}
      </Link>
    </div>
  );
}

export function CoreDashboardHeader({
  title,
  lead,
  actions,
  meta,
}: {
  title: string;
  /** Optional supporting line — omitted on the compact in-app workspace header. */
  lead?: string;
  actions?: ReactNode;
  /** Optional compact meta line (e.g. workspace · counts) rendered under the title. */
  meta?: ReactNode;
}) {
  // Compact authenticated workspace header — not a landing masthead. Identity +
  // intake actions only; the operational counts live in the status bar below and
  // the trust boundary is carried by the review surface itself (reduced copy).
  return (
    <DashboardPageHeader
      icon={<FileCheck2 className="h-4 w-4" strokeWidth={1.85} aria-hidden />}
      eyebrow="Dashboard"
      suppressEyebrow
      title={title}
      lead={lead}
      metaStrip={meta}
      actions={actions}
      actionsAlign="center"
      density="compact"
    />
  );
}

export function EmptyDashboard({ importStatus }: { importStatus: CoreDashboardImportStatus }) {
  return (
    <div className="ui-page-stack mx-auto w-full max-w-[1440px] gap-4">
      <CoreDashboardHeader
        title={DASHBOARD_TITLE}
        lead="Upload signed contracts or import your tracker to start turning them into confirmed owners, dates, tasks, evidence, and reports."
      />
      <ImportStatusNotice status={importStatus} />
      <section className="ui-card-raised relative overflow-hidden rounded-2xl border p-6 sm:p-8">
        <div
          aria-hidden
          className="landing-corner-ring"
          style={{ top: "-2.25rem", right: "-2.25rem", width: "7rem", height: "7rem" }}
        />
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]">
            <UploadCloud className="h-5 w-5" strokeWidth={1.85} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p>
              <span className="landing-eyebrow-dot ui-caps-2 text-[var(--accent-strong)]">
                Get started
              </span>
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]">
              Add your first signed contracts
            </h2>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
              Confirmed, source-backed details become owners, dates, tasks, evidence,
              and exportable reports. Start with a bounded set - you don&apos;t need
              to migrate everything at once.
            </p>
            <CoreDashboardIntakeActions
              className="mt-5 flex flex-wrap gap-x-2 gap-y-2"
              buttonClassName="rounded-full px-4 py-2 text-[12.5px] font-semibold"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
