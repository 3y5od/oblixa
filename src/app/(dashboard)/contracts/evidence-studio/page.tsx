import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileCheck2,
  Inbox,
  Paperclip,
  Plus,
  XCircle,
} from "lucide-react";
import { EvidenceFilterBar } from "@/components/evidence/evidence-filter-bar";
import { EvidenceReleaseActions } from "@/components/evidence/evidence-release-actions";
import { EvidenceRequestCreatePanel } from "@/components/evidence/evidence-request-create-panel";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { ActionChip } from "@/components/ui/action-chip";
import { ChipCapsule } from "@/components/ui/chip-capsule";
import { CountChip } from "@/components/ui/count-chip";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { TimeChip } from "@/components/ui/time-chip";
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
import type {
  EvidencePageModel,
  EvidenceRow,
  EvidenceSectionKey,
  EvidenceSectionSummary,
} from "@/lib/evidence/types";

export const metadata = { title: EVIDENCE_PAGE_TITLE };

// Compact tab labels reused only by the cross-link chips on an empty tab.
const SHORT_SECTION_LABELS: Record<EvidenceSectionKey, string> = {
  open_requests: "Open",
  overdue_requests: "Overdue",
  received_evidence: "Received",
  linked_obligations: "Linked",
};

const EVIDENCE_HEADER_CELL =
  "px-3 py-2 text-left text-[10.5px] ui-caps-2 text-[var(--text-tertiary)] whitespace-nowrap";
const EVIDENCE_BODY_CELL = "px-3 py-2.5 align-top";

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
    owner: firstParam(searchParams.owner),
    status: firstParam(searchParams.status),
    due: firstParam(searchParams.due),
    obligation: firstParam(searchParams.obligation),
    file: firstParam(searchParams.file),
    page: firstParam(searchParams.page),
    create: firstParam(searchParams.create),
  });
  const canMutate = canEditContracts(ctx.role as OrgRole);
  const createHref = buildEvidenceHref({
    section: model.activeSection,
    filters: model.filters,
    create: true,
  });
  const cancelCreateHref = buildEvidenceHref({
    section: model.activeSection,
    filters: model.filters,
  });
  const clearFiltersHref = buildEvidenceHref({ section: model.activeSection });

  return (
    <div className="ui-page-stack mx-auto w-full min-w-0 max-w-7xl">
      <DashboardPageHeader
        icon={<FileCheck2 className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
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

      {/* §10.6 single focal surface, held at the standard `.ui-card` tier
          (§10.1 calmer cousin). A dense operational request queue doesn't want
          the raised tier's accent halo — it read as a pale-blue wash bleeding
          around the table. `.ui-card` keeps the premium gradient + hairline but
          stays quiet, and matches this route's own loading skeleton. */}
      <section
        id="live-request-queue"
        className="ui-card min-w-0 max-w-full scroll-mt-8 overflow-x-hidden p-0"
        aria-labelledby="evidence-surface-title"
      >
        {/* Shell header: title + count + contracts link, with the portfolio
            summary chips composed directly beneath so they read as part of the
            surface, not floating page chrome. */}
        <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <h2 id="evidence-surface-title" className="sr-only">
                {model.title}
              </h2>
              <span className="ui-caps-2 text-[var(--text-tertiary)]">Evidence requests</span>
              <CountChip value={model.totalVisibleRows} emphasis="strong" />
            </div>
            <ActionChip verb="View contracts" href="/contracts" />
          </div>
          {model.totalUnfilteredRows > 0 ? (
            <div className="mt-2.5">
              <EvidenceSummaryBand model={model} />
            </div>
          ) : null}
        </div>

        <UiTabs
          ariaLabel="Evidence sections"
          items={model.sections.map((section) => ({
            href: section.href,
            label: section.label,
            active: section.active,
            count: section.count,
            // A zero on the Overdue tab is all-clear, not a void — tone it
            // success so it doesn't ghost out (§10.10), echoing the overview
            // band's Overdue chip directly above the tabs.
            countTone:
              section.key === "overdue_requests" && section.count === 0
                ? ("success" as const)
                : undefined,
          }))}
          className="px-5"
        />

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
                icon={
                  <FileCheck2 className="h-7 w-7 text-[var(--text-tertiary)]" strokeWidth={1.65} aria-hidden />
                }
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
            <SectionEmptyState
              sections={model.sections}
              activeSection={model.activeSection}
              createHref={createHref}
            />
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

function EvidenceSummaryBand({ model }: { model: EvidencePageModel }) {
  const count = (key: EvidenceSectionKey) =>
    model.sections.find((section) => section.key === key)?.count ?? 0;
  const overdue = count("overdue_requests");
  const dueSoon = model.summary.dueSoon;
  const missing = model.summary.missingFile;
  // A zero on a "needs action" metric is all-clear → muted success, not greyed
  // out (§10.10). Open / Received are neutral counts.
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <KeyValueChip label="Open" value={count("open_requests")} />
      <KeyValueChip label="Overdue" value={overdue} tone={overdue > 0 ? "danger" : "success"} />
      <KeyValueChip label="Received" value={count("received_evidence")} />
      <KeyValueChip label="Due soon" value={dueSoon} tone={dueSoon > 0 ? "warning" : "success"} />
      <KeyValueChip label="Missing file" value={missing} tone={missing > 0 ? "warning" : "success"} />
    </div>
  );
}

// When the active tab is empty but evidence work lives in other sections, point
// straight to it with count+verb capsules rather than a dead-end empty message.
function SectionEmptyState({
  sections,
  activeSection,
  createHref,
}: {
  sections: EvidenceSectionSummary[];
  activeSection: EvidenceSectionKey;
  createHref: string;
}) {
  const active = sections.find((section) => section.key === activeSection);
  const elsewhere = sections.filter(
    (section) => section.key !== activeSection && section.count > 0
  );
  return (
    <div className="px-5 py-12">
      <EmptyState
        size="compact"
        icon={<Inbox className="h-5 w-5 text-[var(--text-tertiary)]" strokeWidth={1.65} aria-hidden />}
        eyebrow="Evidence requests"
        title={`Nothing in ${(active?.label ?? "this view").toLowerCase()}`}
        copy="Evidence work is waiting in another view — jump to it below."
        action={
          <>
            {elsewhere.map((section) => (
              <ChipCapsule
                key={section.key}
                href={section.href}
                leftValue={section.count}
                leftLabel={SHORT_SECTION_LABELS[section.key]}
                rightVerb="View"
                tone={section.key === "overdue_requests" ? "danger" : undefined}
              />
            ))}
            <Link
              href={createHref}
              className="ui-btn-ghost inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Request evidence
            </Link>
          </>
        }
      />
    </div>
  );
}

function FilteredEmptyState({ clearHref }: { clearHref: string }) {
  return (
    <div className="px-5 py-12">
      <EmptyState
        size="compact"
        icon={<Inbox className="h-5 w-5 text-[var(--text-tertiary)]" strokeWidth={1.65} aria-hidden />}
        eyebrow="Evidence requests"
        title="No requests match these filters"
        copy="Adjust or clear the filters to see more evidence requests."
        action={
          <Link
            href={clearHref}
            className="ui-btn-secondary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px]"
          >
            Clear filters
          </Link>
        }
      />
    </div>
  );
}

function EvidenceTable({
  rows,
  mutationsEnabled,
}: {
  rows: EvidenceRow[];
  mutationsEnabled: boolean;
}) {
  return (
    <div className="min-w-0 max-w-full border-t border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)]">
      {/* Mobile: stacked request cards — the table is hard to scan at narrow
          widths. md+ gets the full table. */}
      <ul className="min-w-0 divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_72%,transparent)] md:hidden">
        {rows.map((row) => (
          <EvidenceCard key={row.id} row={row} mutationsEnabled={mutationsEnabled} />
        ))}
      </ul>
      <table
        className="hidden w-full border-collapse text-[12.5px] md:table"
        aria-label="Evidence requests in this workspace"
      >
        <thead className="bg-[color:color-mix(in_oklab,var(--surface-muted)_64%,var(--surface-raised))]">
          <tr className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
            <th scope="col" className={`${EVIDENCE_HEADER_CELL} w-[34%] pl-5 pr-3`}>
              {EVIDENCE_ROW_LABELS.requestTitle}
            </th>
            <th scope="col" className={`${EVIDENCE_HEADER_CELL} hidden w-[17%] lg:table-cell`}>
              {EVIDENCE_ROW_LABELS.linkedObligation}
            </th>
            <th scope="col" className={`${EVIDENCE_HEADER_CELL} hidden w-[12%] md:table-cell`}>
              {EVIDENCE_ROW_LABELS.requestOwner}
            </th>
            <th scope="col" className={`${EVIDENCE_HEADER_CELL} w-[10%]`}>
              {EVIDENCE_ROW_LABELS.dueDate}
            </th>
            <th scope="col" className={`${EVIDENCE_HEADER_CELL} w-[13%]`}>
              {EVIDENCE_ROW_LABELS.status}
            </th>
            <th scope="col" className={`${EVIDENCE_HEADER_CELL} hidden w-[8%] xl:table-cell`}>
              Updated
            </th>
            <th scope="col" className="px-3 py-2 pl-3 pr-5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <EvidenceTableRow key={row.id} row={row} mutationsEnabled={mutationsEnabled} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvidenceTableRow({
  row,
  mutationsEnabled,
}: {
  row: EvidenceRow;
  mutationsEnabled: boolean;
}) {
  const atRisk = row.status === "overdue";
  const dueTone =
    row.status === "overdue" ? "danger" : row.dueState === "due_soon" ? "warning" : "neutral";
  const descriptor = dueDescriptor(row.dueInDays, row.status);
  const titleHref = row.display.requestTitle.href ?? row.href;
  const unassigned = row.requestOwnerLabel === "Unassigned";
  return (
    <tr className="ui-table-row group">
      <td
        className={`${EVIDENCE_BODY_CELL} pl-5 pr-3`}
        style={
          atRisk
            ? { boxShadow: "inset 3px 0 0 0 color-mix(in oklab, var(--danger-ink) 60%, transparent)" }
            : undefined
        }
      >
        {/* One primary object per row: the request title is the single strong
            link; the contract recedes to a quiet sub-link beneath it. */}
        <div className="min-w-0">
          <Link
            href={titleHref}
            title={row.requestTitle}
            className="block max-w-[26rem] truncate font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)]"
          >
            {row.requestTitle}
          </Link>
          {row.contractHref ? (
            <Link
              href={row.contractHref}
              title={row.contractTitle}
              className="mt-0.5 block max-w-[26rem] truncate text-[11.5px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
            >
              {row.contractTitle}
            </Link>
          ) : (
            <span className="mt-0.5 block max-w-[26rem] truncate text-[11.5px] text-[var(--text-tertiary)]">
              {row.contractTitle}
            </span>
          )}
        </div>
      </td>
      <td className={`${EVIDENCE_BODY_CELL} hidden lg:table-cell`}>
        {row.linkedObligationId ? (
          row.linkedObligationHref ? (
            <Link
              href={row.linkedObligationHref}
              title={row.linkedObligationTitle}
              className="block max-w-[15rem] truncate text-[12px] text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-strong)]"
            >
              {row.linkedObligationTitle}
            </Link>
          ) : (
            <span className="block max-w-[15rem] truncate text-[12px] text-[var(--text-secondary)]">
              {row.linkedObligationTitle}
            </span>
          )
        ) : (
          <span className="text-[var(--text-tertiary)]">—</span>
        )}
      </td>
      <td className={`${EVIDENCE_BODY_CELL} hidden md:table-cell`}>
        <span
          title={row.requestOwnerLabel}
          className={`block max-w-[10rem] truncate ${unassigned ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"}`}
        >
          {row.requestOwnerLabel}
        </span>
      </td>
      <td className={`${EVIDENCE_BODY_CELL} tabular-nums`} suppressHydrationWarning>
        {row.dueAt ? (
          <div className="min-w-0">
            <TimeChip date={row.dueAt} format="calendar" tone={dueTone} />
            {descriptor ? (
              <span className="mt-1 block text-[11px] text-[var(--text-tertiary)]">{descriptor}</span>
            ) : null}
          </div>
        ) : (
          <span className="text-[var(--text-tertiary)]">—</span>
        )}
      </td>
      <td className={EVIDENCE_BODY_CELL}>
        <div className="flex flex-col items-start gap-1.5">
          {/* Shape-coded glyph rides inside the badge so state is legible
              without color (§7.7). */}
          <StatusBadge status={row.statusTone} className="gap-1.5">
            <StatusIcon status={row.status} />
            {row.statusLabel}
          </StatusBadge>
          <FilesChip
            count={row.attachedFilesCount}
            attention={row.status === "overdue" && row.attachedFilesCount === 0}
          />
        </div>
      </td>
      <td className={`${EVIDENCE_BODY_CELL} hidden xl:table-cell`} suppressHydrationWarning>
        {row.lastUpdateAt ? (
          <TimeChip date={row.lastUpdateAt} />
        ) : (
          <span className="text-[var(--text-tertiary)]">—</span>
        )}
      </td>
      <td className={`${EVIDENCE_BODY_CELL} pl-3 pr-5`}>
        <EvidenceReleaseActions row={row} mutationsEnabled={mutationsEnabled} />
      </td>
    </tr>
  );
}

function EvidenceFooterSummary({ model }: { model: EvidencePageModel }) {
  const sectionLabel = model.sections.find((section) => section.active)?.label ?? "this view";
  const { page, totalPages, totalInSection } = model.pageInfo;
  const latestUpdate = model.rows.reduce<string | null>((latest, row) => {
    if (!row.lastUpdateAt) return latest;
    if (!latest || row.lastUpdateAt > latest) return row.lastUpdateAt;
    return latest;
  }, null);
  const pageHref = (target: number) =>
    buildEvidenceHref({ section: model.activeSection, filters: model.filters, page: target });
  return (
    <div className="grid min-w-0 grid-cols-1 items-center gap-x-4 gap-y-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,transparent)] px-5 py-3 text-[11.5px] text-[var(--text-tertiary)] sm:grid-cols-[1fr_auto_1fr]">
      {/* Left — structured count: SHOWN 25 / 35 · OPEN REQUESTS */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <KeyValueChip label="Shown" value={`${model.rows.length} / ${totalInSection}`} />
        <span className="ui-caps-3 text-[var(--text-tertiary)]">{sectionLabel}</span>
        {model.hasActiveFilters ? (
          <span className="ui-caps-3 text-[var(--text-secondary)]">· filtered</span>
        ) : null}
      </div>
      {/* Center — pagination */}
      <div className="flex justify-start sm:justify-center">
        {totalPages > 1 ? (
          <nav aria-label="Pagination" className="flex items-center gap-2">
            <PageLink href={pageHref(page - 1)} disabled={page <= 1} direction="prev" />
            <span className="ui-caps-3 tabular-nums text-[var(--text-secondary)]">
              Page {page} / {totalPages}
            </span>
            <PageLink href={pageHref(page + 1)} disabled={page >= totalPages} direction="next" />
          </nav>
        ) : null}
      </div>
      {/* Right — last update */}
      <div className="flex justify-start sm:justify-end">
        {latestUpdate ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="ui-caps-3 text-[var(--text-tertiary)]">Last update</span>
            <TimeChip date={latestUpdate} bordered />
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  direction,
}: {
  href: string;
  disabled: boolean;
  direction: "prev" | "next";
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const label = direction === "prev" ? "Previous page" : "Next page";
  if (disabled) {
    return (
      <span
        aria-disabled
        className="inline-flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-full border border-[var(--border-subtle)] text-[color:color-mix(in_oklab,var(--text-tertiary)_55%,transparent)]"
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className="ui-btn-ghost inline-flex h-7 w-7 items-center justify-center rounded-full p-0"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
    </Link>
  );
}

// Mobile representation of a request row — the same data stacked into a card so
// it stays scannable where the table can't fit. Primary action stays visible;
// secondary actions live in the same kebab menu as the table.
function EvidenceCard({ row, mutationsEnabled }: { row: EvidenceRow; mutationsEnabled: boolean }) {
  const dueTone =
    row.status === "overdue" ? "danger" : row.dueState === "due_soon" ? "warning" : "neutral";
  const descriptor = dueDescriptor(row.dueInDays, row.status);
  const titleHref = row.display.requestTitle.href ?? row.href;
  const unassigned = row.requestOwnerLabel === "Unassigned";
  return (
    <li
      className="px-5 py-4"
      style={
        row.status === "overdue"
          ? { boxShadow: "inset 3px 0 0 0 color-mix(in oklab, var(--danger-ink) 60%, transparent)" }
          : undefined
      }
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={titleHref}
            className="block truncate font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)]"
          >
            {row.requestTitle}
          </Link>
          <span className="mt-0.5 block truncate text-[11.5px] text-[var(--text-tertiary)]">
            {row.contractTitle}
          </span>
        </div>
        <StatusBadge status={row.statusTone} className="shrink-0 gap-1.5">
          <StatusIcon status={row.status} />
          {row.statusLabel}
        </StatusBadge>
      </div>

      <dl className="mt-3 grid min-w-0 grid-cols-2 gap-x-4 gap-y-2.5">
        <CardMeta label={EVIDENCE_ROW_LABELS.requestOwner}>
          <span className={unassigned ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"}>
            {row.requestOwnerLabel}
          </span>
        </CardMeta>
        <CardMeta label={EVIDENCE_ROW_LABELS.dueDate}>
          {row.dueAt ? (
            <span className="inline-flex items-center gap-1.5" suppressHydrationWarning>
              <TimeChip date={row.dueAt} format="calendar" tone={dueTone} />
              {descriptor ? (
                <span className="text-[11px] text-[var(--text-tertiary)]">{descriptor}</span>
              ) : null}
            </span>
          ) : (
            <span className="text-[var(--text-tertiary)]">—</span>
          )}
        </CardMeta>
        <CardMeta label={EVIDENCE_ROW_LABELS.linkedObligation}>
          {row.linkedObligationId ? (
            row.linkedObligationHref ? (
              <Link
                href={row.linkedObligationHref}
                className="text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-strong)]"
              >
                {row.linkedObligationTitle}
              </Link>
            ) : (
              <span className="text-[var(--text-secondary)]">{row.linkedObligationTitle}</span>
            )
          ) : (
            <span className="text-[var(--text-tertiary)]">—</span>
          )}
        </CardMeta>
        <CardMeta label={EVIDENCE_ROW_LABELS.attachedFiles}>
          <FilesChip
            count={row.attachedFilesCount}
            attention={row.status === "overdue" && row.attachedFilesCount === 0}
          />
        </CardMeta>
      </dl>

      <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3">
        <span className="inline-flex items-center gap-1.5 text-[11px]" suppressHydrationWarning>
          <span className="ui-caps-3 text-[var(--text-tertiary)]">Updated</span>
          {row.lastUpdateAt ? (
            <TimeChip date={row.lastUpdateAt} />
          ) : (
            <span className="text-[var(--text-tertiary)]">—</span>
          )}
        </span>
        <EvidenceReleaseActions row={row} mutationsEnabled={mutationsEnabled} />
      </div>
    </li>
  );
}

function CardMeta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="ui-caps-3 text-[var(--text-tertiary)]">{label}</dt>
      <dd className="mt-0.5 truncate text-[12px]">{children}</dd>
    </div>
  );
}

function StatusIcon({ status }: { status: EvidenceRow["status"] }) {
  const cls = "h-3 w-3 shrink-0";
  switch (status) {
    case "overdue":
      return <AlertTriangle className={cls} strokeWidth={2} aria-hidden />;
    case "accepted":
      return <CheckCircle2 className={cls} strokeWidth={2} aria-hidden />;
    case "rejected":
      return <XCircle className={cls} strokeWidth={2} aria-hidden />;
    case "received":
      return <Inbox className={cls} strokeWidth={2} aria-hidden />;
    case "requested":
    default:
      return <Clock className={cls} strokeWidth={2} aria-hidden />;
  }
}

// Attached-file count, toned by how much it matters on this row. Three tiers,
// all on the house chip geometry (rounded-full · px-2 · caps 0.14em) so files
// read as one family with the summary + quick chips:
//   • empty + idle  → borderless muted marker. A "0" on a fresh request is the
//     expected state, not an alarm, so it recedes beneath the status badge
//     rather than mirroring it as a second full pill (§2.11, §10.10).
//   • files present → accent chip — the proof has arrived.
//   • overdue + empty (attention) → warning "MISSING" — the missing file is now
//     the actual problem, so it earns color.
function FilesChip({ count, attention = false }: { count: number; attention?: boolean }) {
  if (count === 0 && !attention) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none text-[color:color-mix(in_oklab,var(--text-tertiary)_78%,transparent)]"
        aria-label="No files attached yet"
      >
        <Paperclip className="h-3 w-3 shrink-0" strokeWidth={1.65} aria-hidden />
        <span className="tabular-nums">0</span>
        <span>files</span>
      </span>
    );
  }
  const ink = attention ? "var(--warning-ink)" : "var(--accent-strong)";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none"
      style={{
        borderColor: `color-mix(in oklab, ${ink} ${attention ? "44%" : "30%"}, var(--border-card))`,
        background: `color-mix(in oklab, ${ink} ${attention ? "16%" : "10%"}, var(--surface-raised))`,
        color: ink,
      }}
      aria-label={
        attention
          ? "No files attached — request is overdue"
          : `${count} ${count === 1 ? "file" : "files"} attached`
      }
    >
      {attention ? (
        <>
          <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
          <span>missing</span>
        </>
      ) : (
        <>
          <Paperclip className="h-3 w-3 shrink-0" strokeWidth={1.85} aria-hidden />
          <span className="tabular-nums">{count}</span>
          <span>{count === 1 ? "file" : "files"}</span>
        </>
      )}
    </span>
  );
}

function dueDescriptor(dueInDays: number | null, status: EvidenceRow["status"]): string | null {
  if (dueInDays == null) return null;
  if (status === "overdue") return `Overdue ${Math.abs(dueInDays)}d`;
  if (dueInDays < 0) return null;
  if (dueInDays === 0) return "Due today";
  if (dueInDays === 1) return "Due tomorrow";
  if (dueInDays <= 60) return `In ${dueInDays}d`;
  return null;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
