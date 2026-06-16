import Link from "next/link";
import { FileCheck2, Plus } from "lucide-react";
import { EvidenceFilterBar } from "@/components/evidence/evidence-filter-bar";
import { EvidenceRequestCreatePanel } from "@/components/evidence/evidence-request-create-panel";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricSummaryBand } from "@/components/ui/metric-summary-band";
import { UiTabs } from "@/components/ui/ui-tabs";
import { RecoverableState } from "@/components/ui/recoverable-state";
import { canEditContracts } from "@/lib/permissions";
import type { OrgRole } from "@/lib/types";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface";
import { getAuthContext } from "@/lib/supabase/server";
import {
  buildEvidenceHref,
  EVIDENCE_EMPTY_STATE,
  loadEvidencePageModel,
} from "@/lib/evidence/model";
import {
  EVIDENCE_PAGE_TITLE,
  EVIDENCE_PARTIAL_DATA_REASON,
  EVIDENCE_PARTIAL_DATA_TITLE,
} from "@/lib/evidence/spec-strings";
import { FilteredEmptyState, SectionEmptyState } from "./evidence-page-empty-states";
import { EvidenceFooterSummary, EvidenceTable } from "./evidence-table";

export const metadata = { title: EVIDENCE_PAGE_TITLE };

type EvidencePageSearchParams = {
  section?: string | string[];
  contract?: string | string[];
  owner?: string | string[];
  status?: string | string[];
  due?: string | string[];
  obligation?: string | string[];
  file?: string | string[];
  page?: string | string[];
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

  const productSurface = await loadProductSurfaceContext(ctx.admin, ctx.orgId, ctx.role as WorkspaceRole);
  const model = await loadEvidencePageModel(ctx.admin, ctx.orgId, {
    userId: ctx.user.id,
    role: ctx.role,
    workspaceMode: productSurface.mode,
    section: firstParam(searchParams.section),
    contract: firstParam(searchParams.contract),
    owner: firstParam(searchParams.owner),
    status: firstParam(searchParams.status),
    due: firstParam(searchParams.due),
    obligation: firstParam(searchParams.obligation),
    file: firstParam(searchParams.file),
    page: firstParam(searchParams.page),
    create: firstParam(searchParams.create),
  });
  const canMutate = canEditContracts(ctx.role as OrgRole);
  const createHref = buildEvidenceHref({ section: model.activeSection, filters: model.filters, create: true });
  const cancelCreateHref = buildEvidenceHref({ section: model.activeSection, filters: model.filters });
  const clearFiltersHref = buildEvidenceHref({ section: model.activeSection });

  return (
    <div className="ui-page-stack mx-auto w-full min-w-0 max-w-7xl">
      <DashboardPageHeader
        icon={<FileCheck2 className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        density="compact"
        eyebrow={model.eyebrow}
        title={EVIDENCE_PAGE_TITLE}
        lead={model.lead}
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
        className="ui-card min-w-0 max-w-full scroll-mt-8 overflow-x-hidden p-0"
        aria-labelledby="evidence-surface-title"
      >
        <MetricSummaryBand
          srTitle={model.title}
          srTitleId="evidence-surface-title"
          eyebrow="Evidence requests"
          count={{ kind: "count", value: model.totalVisibleRows, emphasis: "strong" }}
          action={{ verb: "View contracts", href: "/contracts" }}
        />
        <UiTabs
          ariaLabel="Evidence sections"
          items={model.sections.map((section) => ({
            href: section.href,
            label: section.label,
            active: section.active,
            count: section.count,
            countTone:
              section.key === "overdue_requests" && section.count === 0 ? ("success" as const) : undefined,
          }))}
          className="px-5"
        />
        <div className="grid min-w-0 gap-x-4 gap-y-1 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-5 py-2.5 text-[11px] leading-snug text-[var(--text-tertiary)] sm:grid-cols-2 xl:grid-cols-4">
          <p><span className="font-medium text-[var(--text-secondary)]">Open:</span> requests not completed or accepted.</p>
          <p><span className="font-medium text-[var(--text-secondary)]">Overdue:</span> open requests with a past due date.</p>
          <p><span className="font-medium text-[var(--text-secondary)]">Received:</span> evidence has been submitted and may need review.</p>
          <p><span className="font-medium text-[var(--text-secondary)]">Linked requirements:</span> requests tied to a contract requirement.</p>
        </div>

        {model.totalUnfilteredRows > 0 || model.hasActiveFilters ? (
          <EvidenceFilterBar
            activeSection={model.activeSection}
            filters={model.filters}
            filterOptions={model.filterOptions}
            summary={model.summary}
            hasActiveFilters={model.hasActiveFilters}
          />
        ) : null}

        {model.create.open ? (
          <EvidenceRequestCreatePanel model={model.create} cancelHref={cancelCreateHref} />
        ) : model.rows.length === 0 ? (
          model.totalUnfilteredRows === 0 ? (
            <div className="px-5 py-12">
              <EmptyState
                icon={<FileCheck2 className="h-7 w-7 text-[var(--text-tertiary)]" strokeWidth={1.65} aria-hidden />}
                eyebrow="Evidence requests"
                title="No evidence requests yet"
                copy={EVIDENCE_EMPTY_STATE}
                action={
                  <Link href={createHref} className="ui-btn-primary inline-flex items-center gap-2 px-4 py-2">
                    <Plus className="h-4 w-4" aria-hidden />
                    {model.primaryCta}
                  </Link>
                }
              />
            </div>
          ) : model.hasActiveFilters && model.totalVisibleRows === 0 ? (
            <FilteredEmptyState clearHref={clearFiltersHref} />
          ) : (
            <SectionEmptyState sections={model.sections} activeSection={model.activeSection} createHref={createHref} />
          )
        ) : (
          <>
            <EvidenceTable rows={model.rows} mutationsEnabled={canMutate} />
            <EvidenceFooterSummary model={model} />
          </>
        )}
      </section>
    </div>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
