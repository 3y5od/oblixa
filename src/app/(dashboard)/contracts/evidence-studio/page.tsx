import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck2,
  Inbox,
  Paperclip,
  Plus,
  XCircle,
} from "lucide-react";
import { EvidenceReleaseActions } from "@/components/evidence/evidence-release-actions";
import { EvidenceRequestCreatePanel } from "@/components/evidence/evidence-request-create-panel";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { ChipCapsule } from "@/components/ui/chip-capsule";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { EmptyState } from "@/components/ui/empty-state";
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
  EvidenceDisplayValue,
  EvidenceRow,
  EvidenceSectionKey,
  EvidenceSectionSummary,
} from "@/lib/evidence/types";

export const metadata = { title: EVIDENCE_PAGE_TITLE };

// Compact tab labels reused only by the cross-link chips on an empty tab, so a
// long section name like "Evidence linked to obligations" stays a tidy capsule.
const SHORT_SECTION_LABELS: Record<EvidenceSectionKey, string> = {
  open_requests: "Open",
  overdue_requests: "Overdue",
  received_evidence: "Received",
  linked_obligations: "Linked",
};

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

      {/* §10.6 single focal surface: the request queue is the one surface on the
          page. Section counts ride its tabs, so there is no separate metric
          strip competing for the eye (§10.4). */}
      <section
        id="live-request-queue"
        className="ui-card-quiet scroll-mt-8 overflow-visible p-0"
        aria-labelledby="evidence-surface-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <h2 id="evidence-surface-title" className="sr-only">
              {model.title}
            </h2>
            <span className="ui-caps-2 text-[var(--text-tertiary)]">Evidence requests</span>
          </div>
          {/* §21 — internal navigation reads with a forward chevron, not the
              ↗ external-link glyph that implies a new tab / outside surface. */}
          <Link
            href="/contracts"
            className="ui-btn-ghost inline-flex items-center gap-1 px-3 py-1.5 text-[12.5px]"
          >
            All contracts
            <ChevronRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </Link>
        </div>

        {/* #3: counts ride the tabs (and nowhere else) so the user never has to
            reconcile a tab against a separate metric strip below it. */}
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
        ) : model.rows.length === 0 ? (
          model.totalVisibleRows === 0 ? (
            // #4/#5/#6: canonical empty surface — icon tile, caps eyebrow, and a
            // co-located primary action, not a dashed placeholder box.
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
          ) : (
            // #1: this tab is empty but other tabs hold live work — name where it
            // is and link straight to it instead of implying the page is empty.
            <SectionEmptyState
              sections={model.sections}
              activeSection={model.activeSection}
              createHref={createHref}
            />
          )
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

// #1: when the active tab is empty but evidence work lives in other sections,
// point straight to it with count+verb capsules rather than a dead-end empty
// message (§8.1). The auto-pick default keeps a fresh load off this path, so it
// only surfaces when the user explicitly opens an empty tab.
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

function EvidenceRowItem({
  row,
  mutationsEnabled,
}: {
  row: EvidenceRow;
  mutationsEnabled: boolean;
}) {
  return (
    <article className="px-5 py-3.5">
      <div className="grid gap-x-4 gap-y-3 xl:grid-cols-[minmax(14rem,1.35fr)_minmax(11rem,1fr)_minmax(10rem,0.9fr)_minmax(9rem,0.8fr)_minmax(9rem,0.8fr)_minmax(9rem,0.85fr)_minmax(11rem,0.9fr)] xl:items-center">
        {/* §10.2 + #7 one primary object per row: the request title is the
            single strong accent link; contract + obligation recede to quiet
            secondary links so they don't compete for the row's focus. */}
        <FieldValue value={row.display.requestTitle} variant="primary" />
        <FieldValue value={row.display.linkedContract} />
        <FieldValue value={row.display.linkedObligation} />
        <FieldValue value={row.display.requestOwner} />
        <div className="min-w-0">
          <p className="ui-caps-2 text-[var(--text-tertiary)] xl:sr-only">
            {row.display.dueDate.label}
          </p>
          {row.dueAt ? (
            <TimeChip
              date={row.dueAt}
              format="calendar"
              tone={row.status === "overdue" ? "danger" : "neutral"}
            />
          ) : (
            <span className="text-[13px] text-[var(--text-tertiary)]">—</span>
          )}
        </div>
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <p className="ui-caps-2 text-[var(--text-tertiary)] xl:sr-only">
            {row.display.status.label}
          </p>
          {/* §7.7 + #6 non-color reinforcement: a shape-coded status glyph
              rides inside the badge so the state is legible without color. */}
          <StatusBadge status={row.statusTone} className="gap-1.5">
            <StatusIcon status={row.status} />
            {row.statusLabel}
          </StatusBadge>
          <FilesChip count={row.attachedFilesCount} />
        </div>
        <EvidenceReleaseActions row={row} mutationsEnabled={mutationsEnabled} />
      </div>
    </article>
  );
}

function FieldValue({
  value,
  variant = "secondary",
}: {
  value: EvidenceDisplayValue;
  variant?: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";
  // Hover-only underline (not the permanent `.ui-link` underline) so wrapped
  // titles don't fragment into a jagged stack of underlined lines (#9).
  const linkBase =
    "rounded-sm break-words no-underline underline-offset-[3px] decoration-[color:color-mix(in_oklab,var(--accent)_40%,transparent)] transition-colors hover:underline focus-visible:underline";
  return (
    <div className="min-w-0">
      <p className="ui-caps-2 text-[var(--text-tertiary)] xl:sr-only">{value.label}</p>
      {value.href ? (
        <Link
          href={value.href}
          className={
            isPrimary
              ? `${linkBase} text-[14px] font-semibold text-[var(--accent-strong)]`
              : `${linkBase} text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-strong)]`
          }
        >
          {value.value}
        </Link>
      ) : (
        <p
          className={`break-words ${isPrimary ? "text-[14px] font-semibold text-[var(--text-primary)]" : "text-[13px] text-[var(--text-secondary)]"}`}
        >
          {value.value}
        </p>
      )}
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

// #7: attached-file count as its own structured, tabular chip instead of a
// loose paperclip + number bolted onto the status cell.
function FilesChip({ count }: { count: number }) {
  const hasFiles = count > 0;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none"
      style={{
        borderColor: hasFiles
          ? "color-mix(in oklab, var(--accent) 24%, var(--border-card))"
          : "var(--border-card)",
        background: hasFiles
          ? "color-mix(in oklab, var(--accent-soft) 16%, var(--surface-raised))"
          : "var(--surface)",
        color: hasFiles ? "var(--accent-strong)" : "var(--text-tertiary)",
      }}
      aria-label={`${count} ${count === 1 ? "file" : "files"} attached`}
    >
      <Paperclip className="h-3 w-3 shrink-0" strokeWidth={1.85} aria-hidden />
      <span className="tabular-nums">{count}</span>
      <span>{count === 1 ? "file" : "files"}</span>
    </span>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
