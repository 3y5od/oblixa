import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ChevronDown,
  Download,
  Files,
  FileText,
  Link2,
  Upload,
  UploadCloud,
} from "lucide-react";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { PortaledPopover } from "@/components/contracts/portaled-popover";

export function ContractsPageHeader({
  orgId,
  canEdit,
  workspaceContractTotal,
  latestExportSummary,
}: {
  orgId: string;
  canEdit: boolean;
  workspaceContractTotal: number;
  latestExportSummary: string | null;
}) {
  const exportItems: { href: string; label: string; icon: LucideIcon }[] = [
    {
      href: `/api/export/contracts?orgId=${encodeURIComponent(orgId)}`,
      label: "Contract inventory (CSV)",
      icon: FileText,
    },
    {
      href: "/api/export/calendar",
      label: "Renewal calendar (ICS)",
      icon: CalendarDays,
    },
    {
      href: "/api/export/calendar/feed",
      label: "Calendar feed URL",
      icon: Link2,
    },
  ];

  return (
    <DashboardPageHeader
      icon={<Files className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
      // The cobalt eyebrow is reserved for actions; the register overline reads in
      // cool steel ink instead. Suppressed here and re-rendered as a steel kicker
      // inside the lead so the page identity opens with ink, not accent.
      eyebrow="Contract tracking"
      suppressEyebrow
      density="compact"
      title="Contracts"
      lead={
        <>
          <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--calculated-ink)]">
            Contract tracking
          </span>
          {workspaceContractTotal === 0
            ? "Upload your first signed agreement to start confirming details, dates, owners, tasks, evidence, and reports."
            : "Track signed contracts, owners, dates, requirements, tasks, and evidence."}
        </>
      }
      metaStrip={
        workspaceContractTotal > 0 ? (
          <div className="inline-flex items-center">
            <dt className="sr-only">Contracts in workspace</dt>
            <dd className="inline-flex items-baseline gap-1.5 rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] px-2.5 py-1">
              <span className="font-mono text-[12.5px] font-semibold tabular-nums text-[var(--text-primary)]">
                {workspaceContractTotal}
              </span>
              <span className="text-[11px] text-[var(--text-tertiary)]">
                {workspaceContractTotal === 1 ? "contract in workspace" : "contracts in workspace"}
              </span>
            </dd>
          </div>
        ) : undefined
      }
      actions={
        <>
          {canEdit ? (
            <>
              <Link
                href="/contracts/new"
                className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold"
              >
                <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                Upload contract
              </Link>
              <Link
                href="/contracts/bulk"
                className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold"
              >
                <Upload className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                Import contracts
              </Link>
            </>
          ) : null}
          <PortaledPopover
            ariaLabel="Export options"
            align="right"
            widthClassName="w-[15rem]"
            scrollClassName="py-1"
            triggerClassName="ui-btn-ghost inline-flex cursor-pointer items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold"
            triggerContent={
              <>
                <Download className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                Export
                <ChevronDown className="popover-caret h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              </>
            }
          >
            <ul className="text-[12.5px]">
              {exportItems.map((row) => {
                const Icon = row.icon;
                return (
                  <li key={row.href}>
                    <Link
                      href={row.href}
                      className="flex items-center gap-2.5 px-3 py-2 text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_7%,transparent)] hover:text-[var(--accent-strong)]"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
                      {row.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {latestExportSummary ? (
              <p className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] px-4 py-2 text-[11px] tabular-nums text-[var(--text-tertiary)]">
                {latestExportSummary}
              </p>
            ) : null}
          </PortaledPopover>
        </>
      }
    />
  );
}
