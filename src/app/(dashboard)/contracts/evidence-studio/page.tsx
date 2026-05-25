import Link from "next/link";
import { ArrowUpRight, FileCheck2, Paperclip, Plus } from "lucide-react";
import { EvidenceReleaseActions } from "@/components/evidence/evidence-release-actions";
import { EvidenceRequestCreatePanel } from "@/components/evidence/evidence-request-create-panel";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { UiTabs } from "@/components/ui/ui-tabs";
import { RecoverableState } from "@/components/ui/recoverable-state";
import { canEditContracts } from "@/lib/permissions";
import type { OrgRole } from "@/lib/types";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface";
import { getAuthContext } from "@/lib/supabase/server";
import {
  buildEvidenceHref,
  loadEvidencePageModel,
  EVIDENCE_EMPTY_STATE,
} from "@/lib/evidence/model";
import {
  EVIDENCE_PAGE_TITLE,
  EVIDENCE_PARTIAL_DATA_REASON,
  EVIDENCE_PARTIAL_DATA_TITLE,
  EVIDENCE_ROW_LABELS,
} from "@/lib/evidence/spec-strings";
import type { EvidenceDisplayValue, EvidenceRow } from "@/lib/evidence/types";

export const metadata = { title: EVIDENCE_PAGE_TITLE };

type EvidencePageSearchParams = {
  section?: string | string[];
  contract?: string | string[];
  create?: string | string[];
};

export default async function EvidencePage(props: {
  searchParams: Promise<EvidencePageSearchParams>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) {
    return (
      <WorkspaceRequiredState
        title="Workspace required for evidence"
        message="Evidence requests are workspace-scoped. Refresh this page, then ask a workspace admin to restore access if evidence still does not load."
      />
    );
  }

  const productSurface = await loadProductSurfaceContext(
    ctx.admin,
    ctx.orgId,
    ctx.role as WorkspaceRole
  );
  const model = await loadEvidencePageModel(ctx.admin, ctx.orgId, {
    userId: ctx.user.id,
    role: ctx.role,
    workspaceMode: productSurface.mode,
    section: firstParam(searchParams.section),
    contract: firstParam(searchParams.contract),
    create: firstParam(searchParams.create),
  });
  const canMutate = canEditContracts(ctx.role as OrgRole);
  const createHref = buildEvidenceHref({
    section: model.activeSection,
    contract: model.selectedContractId,
    create: true,
  });
  const cancelCreateHref = buildEvidenceHref({
    section: model.activeSection,
    contract: model.selectedContractId,
  });

  return (
    <div className="ui-page-stack mx-auto max-w-7xl">
      <DashboardPageHeader
        icon={<FileCheck2 className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow={model.eyebrow}
        title={model.title}
        actions={
          <Link href={createHref} className="ui-btn-primary inline-flex items-center gap-2 px-4 py-2">
            <Plus className="h-4 w-4" aria-hidden />
            {model.primaryCta}
          </Link>
        }
      />

      {model.warnings.length > 0 ? (
        <RecoverableState
          state="partial"
          title={EVIDENCE_PARTIAL_DATA_TITLE}
          reason={EVIDENCE_PARTIAL_DATA_REASON}
          accessibleName="Evidence partial data state"
          nextActionLabel="Review workspace health"
          nextAction={
            <Link href="/settings/health" className="ui-link">
              Review workspace health
            </Link>
          }
        />
      ) : null}

      <section
        id="live-request-queue"
        className="ui-card scroll-mt-8 overflow-visible p-0"
        aria-labelledby="evidence-surface-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <h2 id="evidence-surface-title" className="sr-only">
              {model.title}
            </h2>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              Evidence requests
            </p>
            <span className="ui-chip">
              <span className="font-mono tabular-nums">{model.totalVisibleRows}</span>
              <span className="ml-1">visible</span>
            </span>
          </div>
          <Link href="/contracts" className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
            All contracts
            <ArrowUpRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </Link>
        </div>

        <UiTabs
          ariaLabel="Evidence sections"
          items={model.sections.map((section) => ({
            href: section.href,
            label: section.label,
            active: section.active,
            count: section.count,
          }))}
          className="px-5"
        />

        {model.create.open ? (
          <EvidenceRequestCreatePanel model={model.create} cancelHref={cancelCreateHref} />
        ) : null}

        {model.rows.length === 0 ? (
          <div className="px-5 py-7">
            <div className="rounded-xl border border-dashed border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_24%,transparent)] px-4 py-5">
              <p className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
                {EVIDENCE_EMPTY_STATE}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_72%,transparent)]">
            <div className="hidden grid-cols-[minmax(14rem,1.35fr)_minmax(11rem,1fr)_minmax(10rem,0.9fr)_minmax(9rem,0.8fr)_minmax(9rem,0.8fr)_minmax(9rem,0.85fr)_minmax(11rem,0.9fr)] gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)] xl:grid">
              <span>{EVIDENCE_ROW_LABELS.requestTitle}</span>
              <span>{EVIDENCE_ROW_LABELS.linkedContract}</span>
              <span>{EVIDENCE_ROW_LABELS.linkedObligation}</span>
              <span>{EVIDENCE_ROW_LABELS.requestOwner}</span>
              <span>{EVIDENCE_ROW_LABELS.dueDate}</span>
              <span>{EVIDENCE_ROW_LABELS.status}</span>
              <span>Actions</span>
            </div>
            {model.rows.map((row) => (
              <EvidenceRowItem key={row.id} row={row} mutationsEnabled={canMutate} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EvidenceRowItem({
  row,
  mutationsEnabled,
}: {
  row: EvidenceRow;
  mutationsEnabled: boolean;
}) {
  return (
    <article className="px-5 py-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(14rem,1.35fr)_minmax(11rem,1fr)_minmax(10rem,0.9fr)_minmax(9rem,0.8fr)_minmax(9rem,0.8fr)_minmax(9rem,0.85fr)_minmax(11rem,0.9fr)] xl:items-center">
        <FieldValue value={row.display.requestTitle} primary />
        <FieldValue value={row.display.linkedContract} />
        <FieldValue value={row.display.linkedObligation} />
        <FieldValue value={row.display.requestOwner} />
        <FieldValue value={row.display.dueDate} />
        <div className="min-w-0">
          <p className="ui-caps-2 xl:sr-only">{row.display.status.label}</p>
          <StatusBadge status={row.statusTone}>{row.statusLabel}</StatusBadge>
          <p
            className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)]"
            aria-label={`${row.display.attachedFiles.label}: ${row.display.attachedFiles.value}`}
          >
            <Paperclip className="h-3 w-3 shrink-0" strokeWidth={1.85} aria-hidden />
            <span className="tabular-nums">{row.display.attachedFiles.value}</span>
          </p>
        </div>
        <EvidenceReleaseActions row={row} mutationsEnabled={mutationsEnabled} />
      </div>
    </article>
  );
}

function FieldValue({
  value,
  primary = false,
}: {
  value: EvidenceDisplayValue;
  primary?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="ui-caps-2 xl:sr-only">{value.label}</p>
      {value.href ? (
        <Link
          href={value.href}
          className={`ui-link break-words ${primary ? "text-[14px] font-semibold" : "text-[13px] font-medium"}`}
        >
          {value.value}
        </Link>
      ) : (
        <p
          className={`break-words ${primary ? "text-[14px] font-semibold text-[var(--text-primary)]" : "text-[13px] text-[var(--text-secondary)]"}`}
        >
          {value.value}
        </p>
      )}
    </div>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
