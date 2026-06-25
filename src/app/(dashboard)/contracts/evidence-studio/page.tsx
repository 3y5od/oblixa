import Link from "next/link";
import { ArrowRight, FileCheck2, FileWarning, Plus } from "lucide-react";
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
import type { EvidencePageModel, EvidenceRow } from "@/lib/evidence/types";
import { FilteredEmptyState, SectionEmptyState } from "./evidence-page-empty-states";
import { fileGapOpen } from "./evidence-row-parts";
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
        eyebrowTone="ink"
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
        {/* No route-away header action here — the evidence workflow lives in the
            section tabs (incl. Linked requirements) and the per-row actions; a
            generic "View contracts" link only competed with them (§7 #4 critique). */}
        <MetricSummaryBand
          srTitle={model.title}
          srTitleId="evidence-surface-title"
          eyebrow="Evidence requests"
          count={{ kind: "count", value: model.totalVisibleRows, emphasis: "strong" }}
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
        {/* The linked requirement + its consequence are promoted ABOVE the filter
            chrome: overdue proof keeps contract requirements open, so the record's
            stake leads, and the filters read as secondary controls (§4 promote the
            requirement; product-owner direction #4/#7). Shown only when the
            workspace holds requests and isn't in the focused create flow, so an
            empty workspace keeps its clean empty state. */}
        {model.totalUnfilteredRows > 0 && !model.create.open ? (
          <EvidenceConsequenceLede model={model} />
        ) : null}
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

// The single most pressing at-risk request currently in view — the one whose
// proof is overdue (most days past due first). Used to NAME the requirement the
// promoted lede is about, so the consequence reads against a real object rather
// than an abstract count. Falls back to null when nothing in view is at risk.
function pickPressingRow(rows: EvidenceRow[]): EvidenceRow | null {
  const atRisk = rows.filter((row) => row.status === "overdue" && row.linkedObligationId);
  if (atRisk.length === 0) return null;
  return atRisk.reduce((worst, row) =>
    (row.dueInDays ?? 0) < (worst.dueInDays ?? 0) ? row : worst
  );
}

/**
 * The promoted requirement-and-consequence band, sat above the filter chrome so
 * the record's stake — not the controls — is the visual center. When proof is
 * overdue it states the headline consequence in operational terms (overdue proof
 * keeps the linked contract requirements open) with a §19-correct count, names
 * the most pressing requirement when one is in view, and offers the Overdue
 * jump. When nothing is at risk it collapses to a slim all-clear line so the
 * canvas stays intentional rather than carrying an empty band.
 */
function EvidenceConsequenceLede({ model }: { model: EvidencePageModel }) {
  const overdueSection = model.sections.find((section) => section.key === "overdue_requests");
  const overdueCount = overdueSection?.count ?? 0;
  const missingFile = model.summary.missingFile;
  const pressing = pickPressingRow(model.rows);

  if (overdueCount === 0 && missingFile === 0) {
    // Calm queue: a quiet confirmation, not an empty band.
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-2.5 text-[12px] leading-snug text-[var(--text-secondary)]">
        <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-[var(--success-ink)]" strokeWidth={2} aria-hidden />
        <span>No proof is overdue. Linked requirements stay closed while evidence is on track.</span>
      </div>
    );
  }

  const overdueHref = overdueSection?.href ?? buildEvidenceHref({ section: "overdue_requests", filters: model.filters });
  const headline =
    overdueCount > 0
      ? `${overdueCount} overdue evidence ${overdueCount === 1 ? "request is" : "requests are"} keeping linked requirements open`
      : `${missingFile} evidence ${missingFile === 1 ? "request is" : "requests are"} missing a file`;

  return (
    <section
      aria-label="Evidence at risk"
      className="min-w-0 border-b px-5 py-3.5"
      style={{
        borderBottomColor: "color-mix(in oklab, var(--border-subtle) 85%, transparent)",
        background: "color-mix(in oklab, var(--danger-soft) 14%, var(--surface-raised))",
        boxShadow: "inset 3px 0 0 0 color-mix(in oklab, var(--danger-ink) 55%, transparent)",
      }}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <FileWarning
            className="mt-0.5 h-4 w-4 shrink-0"
            strokeWidth={2}
            style={{ color: "var(--danger-ink)" }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold leading-snug tracking-tight" style={{ color: "var(--danger-ink)" }}>
              {headline}
            </p>
            {pressing ? (
              <p className="mt-0.5 truncate text-[12px] leading-snug text-[var(--text-secondary)]">
                <span className="text-[var(--text-tertiary)]">Most pressing: </span>
                {pressing.linkedObligationHref ? (
                  <Link
                    href={pressing.linkedObligationHref}
                    title={pressing.linkedObligationTitle}
                    className="font-semibold text-[var(--text-primary)] underline-offset-2 transition-colors hover:text-[var(--accent-strong)] hover:underline"
                  >
                    {pressing.linkedObligationTitle}
                  </Link>
                ) : (
                  <span className="font-semibold text-[var(--text-primary)]">{pressing.linkedObligationTitle}</span>
                )}
                <span className="text-[var(--text-tertiary)]">
                  {" "}
                  - proof {fileGapOpen(pressing) ? "not yet uploaded" : "past due"}
                  {pressing.dueInDays != null ? ` (${Math.abs(pressing.dueInDays)}d overdue)` : ""}.
                </span>
              </p>
            ) : (
              <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-secondary)]">
                Each stays open until its evidence is received and accepted.
              </p>
            )}
          </div>
        </div>
        {overdueCount > 0 && model.activeSection !== "overdue_requests" ? (
          <Link
            href={overdueHref}
            className="ui-chip-focus inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)]"
          >
            Review overdue
            <ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
