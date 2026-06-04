import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BellRing,
  Calculator,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  CircleUserRound,
  Clock,
  Download,
  Eye,
  Filter,
  Plus,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { createContractTask } from "@/actions/tasks";
import { updateRenewalCheckpointStatus } from "@/actions/renewal-playbook";
import { RenewalFilterBar } from "@/components/renewals/renewal-filter-bar";
import { RenewalRowActionsMenu } from "@/components/renewals/renewal-row-actions-menu";
import { ActionChip } from "@/components/ui/action-chip";
import { ChipPair } from "@/components/ui/chip-pair";
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
import { CountChip } from "@/components/ui/count-chip";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { UiSelect } from "@/components/ui/ui-select";
import { RecoverableState } from "@/components/ui/recoverable-state";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getAuthContext } from "@/lib/supabase/server";
import { canEditContracts } from "@/lib/permissions";
import type { OrgRole } from "@/lib/types";
import type { WorkspaceRole } from "@/lib/navigation";
import { isAdvancedModuleHidden, loadProductSurfaceContext } from "@/lib/product-surface";
import {
  buildRenewalsHref,
  loadRenewalsPageModel,
} from "@/lib/renewals/model";
import {
  RENEWAL_DATE_REVIEW_HINTS,
  RENEWAL_DATE_REVIEW_LABELS,
  RENEWAL_FILTER_LABELS,
  RENEWAL_ACTION_LABELS,
  RENEWAL_ROW_LABELS,
  RENEWALS_EMPTY_STATE,
  RENEWALS_FILTERED_EMPTY_STATE,
  RENEWALS_PAGE_TITLE,
  RENEWALS_PARTIAL_DATA_REASON,
  RENEWALS_PARTIAL_DATA_TITLE,
  RENEWALS_SECTION_EYEBROW,
} from "@/lib/renewals/spec-strings";
import type { RenewalActionCapability, RenewalDateReviewState, RenewalRow, RenewalStatus, RenewalWindowKey } from "@/lib/renewals/types";

export const metadata = { title: RENEWALS_PAGE_TITLE };

type RenewalsSearchParams = {
  window?: string | string[];
  horizon?: string | string[];
  owner?: string | string[];
  counterparty?: string | string[];
  status?: string | string[];
  review?: string | string[];
  create?: string | string[];
  contract?: string | string[];
  error?: string | string[];
};

async function createRenewalTaskAction(formData: FormData) {
  "use server";

  const contractId = stringFromForm(formData, "contractId");
  const title = stringFromForm(formData, "title");
  const details = stringFromForm(formData, "details");
  const assigneeId = stringFromForm(formData, "assigneeId") || null;
  const dueDate = stringFromForm(formData, "dueDate") || null;

  const result = await createContractTask({
    contractId,
    title,
    details,
    assigneeId,
    dueDate,
    teamKey: "renewal_checkpoint",
    createdVia: "manual",
  });

  if ("error" in result && result.error) {
    redirect(`/contracts/renewals?create=1&error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/contracts/renewals");
  redirect("/contracts/renewals");
}

async function updateRenewalAction(formData: FormData) {
  "use server";

  const checkpointId = stringFromForm(formData, "checkpointId");
  const status = stringFromForm(formData, "status");
  const returnTo = safeRenewalsReturnTo(stringFromForm(formData, "returnTo"));
  const result = await updateRenewalCheckpointStatus({
    checkpointId,
    status: status === "pending" ? "pending" : "completed",
  });

  if ("error" in result && result.error) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/contracts/renewals");
  redirect(returnTo);
}

export default async function RenewalsPage(props: {
  searchParams: Promise<RenewalsSearchParams>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const productSurface = await loadProductSurfaceContext(
    ctx.admin,
    ctx.orgId,
    ctx.role as WorkspaceRole
  );
  const model = await loadRenewalsPageModel(ctx.admin, ctx.orgId, {
    userId: ctx.user.id,
    role: ctx.role,
    workspaceMode: productSurface.mode,
    window: firstParam(searchParams.window),
    horizon: firstParam(searchParams.horizon),
    owner: firstParam(searchParams.owner),
    counterparty: firstParam(searchParams.counterparty),
    status: firstParam(searchParams.status),
    review: firstParam(searchParams.review),
    create: firstParam(searchParams.create),
    contract: firstParam(searchParams.contract),
  });
  const canMutate = canEditContracts(ctx.role as OrgRole);
  const showDecisionsCta =
    (productSurface.mode === "advanced" || productSurface.mode === "assurance") &&
    !isAdvancedModuleHidden(productSurface, "decisions");
  const createHref = buildRenewalsHref({
    window: model.activeWindow,
    filters: model.filters,
    create: true,
  });
  const error = firstParam(searchParams.error);

  return (
    <div className="ui-page-stack mx-auto w-full min-w-0 max-w-7xl">
      <DashboardPageHeader
        icon={<CalendarClock className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow={model.eyebrow}
        title={model.title}
        lead={model.lead}
        actions={
          <>
            {showDecisionsCta ? (
              <Link
                href="/decisions"
                prefetch={false}
                className="ui-btn-ghost inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px]"
              >
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                Review decisions
                <ChevronRight className="h-3 w-3 opacity-60" aria-hidden />
              </Link>
            ) : null}
            {/* §3 weight ladder — the report export is a secondary escape hatch,
                so it rides as a ghost action and lets the solid primary own the
                page's single loudest CTA. */}
            <Link
              href={model.exportHref}
              className="ui-btn-ghost inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px]"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              {RENEWAL_ACTION_LABELS.export_renewal_report}
            </Link>
            <Link href={createHref} className="ui-btn-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px]">
              <Plus className="h-4 w-4" aria-hidden />
              {model.primaryCta}
            </Link>
          </>
        }
      />

      {model.warnings.length > 0 ? (
        <RecoverableState
          state="partial"
          title={RENEWALS_PARTIAL_DATA_TITLE}
          reason={RENEWALS_PARTIAL_DATA_REASON}
          accessibleName="Renewals partial data state"
          nextActionLabel="Review workspace health"
          nextAction={
            <Link href="/settings/health" className="ui-link">
              Review workspace health
            </Link>
          }
        />
      ) : null}

      {/* §2.1 — the renewals list is the page's main content surface, so it rides
          the standard card tier (soft accent wash + shadow-1), a notch above the
          quiet/inset tier: polished operational surface, still a calmer cousin
          (not a hero). overflow-hidden clips the stacked row borders to the
          rounded corner. */}
      <section className="ui-card min-w-0 max-w-full overflow-hidden" aria-labelledby="renewals-surface-title">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h2 id="renewals-surface-title" className="sr-only">
              {model.title}
            </h2>
            {/* Section identity + a compact metadata strip of the actionable
                signals (deadlines in view, plus owner/review/notice gaps). The
                eyebrow stays in renewal vocabulary, not "decisions". */}
            <p className="ui-caps-2 pr-0.5 text-[11px] text-[var(--text-tertiary)]">{RENEWALS_SECTION_EYEBROW}</p>
            <ChipPair
              primary={String(model.summary.visible)}
              secondary={model.summary.visible === 1 ? "deadline" : "deadlines"}
              className="tabular-nums"
            />
            {model.summary.needsReview > 0 ? (
              <KeyValueChip label="Unreviewed" value={model.summary.needsReview} tone="warning" />
            ) : null}
            {model.summary.needsOwner > 0 ? (
              <KeyValueChip label="Missing owner" value={model.summary.needsOwner} tone="warning" />
            ) : null}
            {model.summary.noticeWindowOpen > 0 ? (
              <KeyValueChip label="Notice open" value={model.summary.noticeWindowOpen} tone="warning" />
            ) : null}
          </div>
          <ActionChip verb="View contracts" href="/contracts" />
        </div>

        <RenewalFilterBar
          activeWindow={model.activeWindow}
          filters={model.filters}
          labels={RENEWAL_FILTER_LABELS}
          windowOptions={model.windows.map((window) => ({
            value: window.key,
            label: window.label,
          }))}
          ownerOptions={model.filterOptions.owners}
          counterpartyOptions={model.filterOptions.counterparties}
          statusOptions={model.filterOptions.statuses}
          reviewOptions={model.filterOptions.reviewStates}
          keepCreateOpen={model.create.open}
          matchCount={model.summary.visible}
        />

        {model.create.open ? (
          <CreateRenewalTaskPanel
            model={model}
            error={error}
            cancelHref={buildRenewalsHref({ window: model.activeWindow, filters: model.filters })}
          />
        ) : null}

        <RenewalRows
          rows={model.rows}
          canMutate={canMutate}
          returnTo={buildRenewalsHref({ window: model.activeWindow, filters: model.filters })}
          filtersActive={Boolean(
            model.filters.owner || model.filters.counterparty || model.filters.status || model.filters.review
          )}
          clearFiltersHref={buildRenewalsHref({ window: model.activeWindow })}
          activeWindow={model.activeWindow}
          widenHref={buildRenewalsHref({ window: "180", filters: model.filters })}
        />
      </section>
    </div>
  );
}

function CreateRenewalTaskPanel({
  model,
  error,
  cancelHref,
}: {
  model: Awaited<ReturnType<typeof loadRenewalsPageModel>>;
  error: string;
  cancelHref: string;
}) {
  return (
    <div className="border-y border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_26%,transparent)] px-5 py-4">
      <form action={createRenewalTaskAction} className="grid gap-3 lg:grid-cols-[1.25fr_1.35fr_0.95fr_0.8fr]">
        <div className="space-y-2">
          <p className="ui-caps-2 text-[var(--text-tertiary)]">{model.primaryCta}</p>
          <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="renewal-create-contract">
            {RENEWAL_ROW_LABELS.contract}
          </label>
          <UiSelect
            className="block w-full"
            buttonClassName="w-full"
            portal
            name="contractId"
            required
            defaultValue={model.create.selectedContract}
            options={model.create.contracts.map((contract) => ({
              value: contract.value,
              label: contract.label,
            }))}
            placeholder="Select contract"
            ariaLabel={RENEWAL_ROW_LABELS.contract}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="renewal-create-title">
            Title
          </label>
          <input id="renewal-create-title" name="title" required className="ui-input w-full" placeholder="e.g., Confirm renewal notice plan" />
          {error ? <p className="text-[12.5px] text-[var(--danger-ink)]">{error}</p> : null}
        </div>
        <div className="space-y-2">
          <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="renewal-create-owner">
            {RENEWAL_ROW_LABELS.owner}
          </label>
          <UiSelect
            className="block w-full"
            buttonClassName="w-full"
            portal
            name="assigneeId"
            options={[
              { value: "", label: "Unassigned" },
              ...model.create.ownerOptions.map((owner) => ({
                value: owner.value,
                label: owner.label,
              })),
            ]}
            placeholder="Unassigned"
            ariaLabel={RENEWAL_ROW_LABELS.owner}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="renewal-create-due">
            Due date
          </label>
          <input id="renewal-create-due" name="dueDate" type="date" className="ui-input w-full" />
        </div>
        <div className="space-y-2 lg:col-span-3">
          <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="renewal-create-details">
            Details
          </label>
          <textarea id="renewal-create-details" name="details" className="ui-input min-h-16 w-full resize-y" />
        </div>
        <div className="flex flex-wrap items-end justify-end gap-2">
          <Link href={cancelHref} className="ui-btn-secondary px-4 py-2">
            Cancel
          </Link>
          <button type="submit" className="ui-btn-primary px-4 py-2">
            {model.primaryCta}
          </button>
        </div>
      </form>
    </div>
  );
}

function RenewalRows({
  rows,
  canMutate,
  returnTo,
  filtersActive,
  clearFiltersHref,
  activeWindow,
  widenHref,
}: {
  rows: RenewalRow[];
  canMutate: boolean;
  returnTo: string;
  filtersActive: boolean;
  clearFiltersHref: string;
  activeWindow: RenewalWindowKey;
  widenHref: string;
}) {
  if (rows.length === 0) {
    return (
      <RenewalsEmptyState
        filtersActive={filtersActive}
        clearFiltersHref={clearFiltersHref}
        activeWindow={activeWindow}
        widenHref={widenHref}
      />
    );
  }

  return (
    <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)]">
      {/* Bounded scroll region with a sticky column header (top) AND a sticky count
          footer (bottom). At the 90/180-day horizons the list runs 20–40 rows, so
          cap the height and scroll the body between the two opaque sticky bands —
          rows pass cleanly behind them, so the last row is never clipped into the
          footer. Header, footer, and rows share one scrollbar so columns stay
          aligned; scrollbar-gutter keeps the right edge stable. The kebab menu and
          filter popovers are portaled, so they escape this overflow clip. overflow-x
          is hidden (not auto like the fixed-min-width queue tables) because this grid
          is responsive and stacks to one column below xl. This intentionally diverges
          from /contracts' 25-per-page pagination: the cumulative day-windows don't
          page cleanly and the counts stay small (≤~40). */}
      <div className="max-h-[60vh] max-w-full overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]">
        <RenewalRowsHeader />
        {rows.map((row) => (
          <article
            key={row.id}
            aria-labelledby={`renewal-row-${row.id}`}
            className="grid gap-4 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_48%,transparent)] px-5 py-4 transition-colors last:border-b-0 hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_55%,transparent)] xl:grid-cols-[minmax(13rem,0.9fr)_minmax(0,1.45fr)_minmax(20rem,1fr)] xl:items-center"
          >
            <RenewalFact label={RENEWAL_ROW_LABELS.contract} titleId={`renewal-row-${row.id}`}>
              {/* §15 — the contract title is the row's heading: primary text that
                  reveals the link affordance (accent + underline) on hover.
                  line-clamp-2 keeps long names from making rows uneven; the full
                  name stays available via the title attribute. */}
              <Link
                href={row.href}
                title={row.title}
                className="ui-chip-focus line-clamp-2 break-words text-[14px] font-semibold text-[var(--text-primary)] underline-offset-[3px] decoration-from-font transition-colors hover:text-[var(--accent-strong)] hover:underline"
              >
                {row.title}
              </Link>
              {/* Required contextual-entry anchor (refinement-trace.ts §14/§16.3 +
                  the refinement-contextual-entry tripwire): the renewals list must
                  offer cross-surface continuity to a contract's work / exceptions /
                  evidence. Rendered as a compact one-line chip group — the first
                  three destinations plus a "+N" overflow chip — so it never wraps
                  onto a messy second line and stays subordinate to the title. */}
              <ContractContinuityLinks
                contractId={row.id}
                omit={["contract", "renewals"]}
                label="Related"
                maxVisible={2}
                className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1 text-[11px] text-[var(--text-tertiary)]"
              />
            </RenewalFact>

            <RenewalRowFactGrid row={row} />

            <RenewalRowStateGrid row={row} canMutate={canMutate} returnTo={returnTo} />
          </article>
        ))}
        {/* Sticky count bar pinned to the bottom of the scroll region. A stronger
            top border + a soft upward lift shadow separate it from the rows that
            scroll behind it, so it reads as an intentional count bar rather than a
            clipped strip. The count rides a CountChip (tabular) and the caps label
            keeps the "… in view" phrasing without doubling the number (§11.18). */}
        <div
          className="sticky bottom-0 z-10 flex items-center gap-2 border-t border-[color:color-mix(in_oklab,var(--border-strong)_45%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--surface-muted)_94%,var(--surface-raised))] px-5 py-2.5"
          style={{
            boxShadow:
              "0 -10px 20px -16px color-mix(in oklab, var(--text-primary) 18%, transparent)",
          }}
        >
          <CalendarClock className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
          <CountChip value={rows.length} emphasis="subtle" />
          <p className="ui-caps-2 text-[10.5px] text-[var(--text-tertiary)]">
            {rows.length === 1 ? "deadline" : "deadlines"} in view
          </p>
        </div>
      </div>
    </div>
  );
}

function RenewalsEmptyState({
  filtersActive,
  clearFiltersHref,
  activeWindow,
  widenHref,
}: {
  filtersActive: boolean;
  clearFiltersHref: string;
  activeWindow: RenewalWindowKey;
  widenHref: string;
}) {
  const iconTile =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]";
  if (filtersActive) {
    return (
      <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-12">
        <div className="mx-auto flex max-w-md items-start gap-4">
          <span className={iconTile} aria-hidden>
            <Filter className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />
          </span>
          <div className="min-w-0">
            <p className="ui-caps-2 text-[10.5px] text-[var(--text-tertiary)]">No matches</p>
            <p className="mt-1 text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
              {RENEWALS_FILTERED_EMPTY_STATE}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              Clear the filters to see upcoming renewal and notice deadlines.
            </p>
            <div className="mt-4">
              <Link href={clearFiltersHref} className="ui-btn-secondary inline-flex items-center px-3.5 py-2 text-[12.5px]">
                Clear filters
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-12">
      <div className="mx-auto flex max-w-xl items-start gap-4">
        <span className={iconTile} aria-hidden>
          <CalendarClock className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />
        </span>
        <div className="min-w-0">
          <p className="ui-caps-2 text-[10.5px] text-[var(--text-tertiary)]">Get started</p>
          <p className="mt-1 text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
            {RENEWALS_EMPTY_STATE}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            Upload a contract or import your tracker, then review the dates.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/contracts/new" className="ui-btn-primary inline-flex items-center gap-2 px-4 py-2">
              <Plus className="h-4 w-4" aria-hidden />
              Upload contract
            </Link>
            <Link href="/contracts/bulk" className="ui-btn-ghost inline-flex items-center px-3 py-2 text-[12.5px]">
              Import tracker
            </Link>
            <Link href="/contracts/review" className="ui-btn-ghost inline-flex items-center px-3 py-2 text-[12.5px]">
              Review dates
            </Link>
            {activeWindow !== "180" ? (
              <Link href={widenHref} className="ui-btn-ghost inline-flex items-center px-3 py-2 text-[12.5px]">
                Show 180 days
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function RenewalRowsHeader() {
  return (
    // Outer `gap-4` must match the row article's outer `gap-4` so column 2
    // (counterparty/dates/owner) starts at the same X in both header band
    // and data rows. Without the gap here, the header column labels were
    // offset 16px left of the row values below them — visible misalignment.
    <div className="sticky top-0 z-10 hidden border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_92%,var(--surface-raised))] px-5 py-3 xl:grid xl:grid-cols-[minmax(13rem,0.9fr)_minmax(0,1.45fr)_minmax(20rem,1fr)] xl:gap-4">
      <RenewalColumnLabel>{RENEWAL_ROW_LABELS.contract}</RenewalColumnLabel>
      <div className="grid min-w-0 grid-cols-[minmax(8rem,0.85fr)_minmax(7.25rem,0.8fr)_minmax(7.25rem,0.8fr)_minmax(9rem,1fr)] gap-3">
        <RenewalColumnLabel>{RENEWAL_ROW_LABELS.counterparty}</RenewalColumnLabel>
        <RenewalColumnLabel>{RENEWAL_ROW_LABELS.renewalDate}</RenewalColumnLabel>
        <RenewalColumnLabel>{RENEWAL_ROW_LABELS.noticeDate}</RenewalColumnLabel>
        <RenewalColumnLabel>{RENEWAL_ROW_LABELS.owner}</RenewalColumnLabel>
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(11.5rem,1fr)_minmax(7.5rem,0.7fr)] gap-3">
        <RenewalColumnLabel>{RENEWAL_ROW_LABELS.status}</RenewalColumnLabel>
        <RenewalColumnLabel align="right">{RENEWAL_ROW_LABELS.nextAction}</RenewalColumnLabel>
      </div>
    </div>
  );
}

function RenewalColumnLabel({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <p
      className={`ui-caps-2 text-[10.5px] text-[var(--text-tertiary)] ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </p>
  );
}

function RenewalRowFactGrid({ row }: { row: RenewalRow }) {
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(8rem,0.85fr)_minmax(7.25rem,0.8fr)_minmax(7.25rem,0.8fr)_minmax(9rem,1fr)] xl:items-start">
      <RenewalFact label={RENEWAL_ROW_LABELS.counterparty} value={row.counterparty} />
      <RenewalDateCell
        label={RENEWAL_ROW_LABELS.renewalDate}
        dateLabel={row.renewalDateLabel}
        days={row.daysUntilRenewal}
        review={row.renewalDateReview}
      />
      <RenewalDateCell
        label={RENEWAL_ROW_LABELS.noticeDate}
        dateLabel={row.noticeDateLabel}
        days={row.daysUntilNotice}
        review={row.noticeDateReview}
      />
      <RenewalFact label={RENEWAL_ROW_LABELS.owner}>
        <RenewalOwnerCell row={row} />
      </RenewalFact>
    </div>
  );
}

// One coherent owner-state cell. When an owner exists it reads as a name with a
// small initial medallion for consistent identity. When it is missing, this is
// the single home for the owner gap: a warning chip (icon + "Unassigned") paired
// with its primary fix, "Assign →". The redundant `needs_owner` Status badge and
// inline next-action are suppressed (see RenewalStatusBadge / RenewalRowStateGrid)
// so the gap reads exactly once — as one cell, with one fix — rather than as the
// two scattered "UNASSIGNED" + "NEEDS OWNER" fragments the spec flags.
function RenewalOwnerCell({ row }: { row: RenewalRow }) {
  if (row.ownerUserId) {
    const initial = row.ownerLabel.trim().charAt(0).toUpperCase() || "?";
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        {/* Neutral initial medallion — an owner is identity, not status or action,
            so it stays in the neutral scale (§10.2) and never spends accent. */}
        <span
          aria-hidden
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_72%,var(--surface-raised))] text-[10px] font-semibold leading-none text-[var(--text-secondary)]"
        >
          {initial}
        </span>
        <span className="truncate text-[13px] leading-snug text-[var(--text-primary)]">{row.ownerLabel}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className="ui-caps-3 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] leading-none"
        style={{
          borderColor: "color-mix(in oklab, var(--warning-ink) 30%, var(--border-subtle))",
          background: "color-mix(in oklab, var(--warning-soft) 26%, var(--surface-raised))",
          color: "var(--warning-ink)",
        }}
      >
        <CircleUserRound className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
        Unassigned
      </span>
      <Link
        href={`/contracts/${row.id}`}
        className="ui-chip-focus inline-flex items-center gap-0.5 whitespace-nowrap rounded-md px-1 py-0.5 text-[12px] font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)]"
      >
        Assign
        <ArrowRight className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
      </Link>
    </span>
  );
}

const RENEWAL_REVIEW_ICON: Record<RenewalDateReviewState, LucideIcon> = {
  reviewed: CheckCircle2,
  suggested: Eye,
  computed: Calculator,
  missing: CircleDashed,
};

// Per-date provenance chip. §7.7 — icon + label, never colour alone. Trust
// ladder via tone: "reviewed" (human-approved) reads success; "computed" (a
// derived notice date) reads neutral so it never looks as trusted as reviewed;
// "suggested" (extracted, unapproved) and "missing" read warning. The `title`
// makes each state self-explanatory on hover — especially "Computed".
function RenewalReviewChip({ state }: { state: RenewalDateReviewState }) {
  const Icon = RENEWAL_REVIEW_ICON[state];
  // Trust ladder by tone: only "reviewed" (human-approved) earns success green.
  // Everything unverified reads warning so a computed/suggested/missing date never
  // looks as trusted as an approved one. "computed" rides a *muted* warning (the
  // §spec's "quieter and less authoritative") so a derived notice date is clearly
  // not-trusted without shouting as loudly as a suggested/missing actionable gap.
  const ink =
    state === "reviewed"
      ? "var(--success-ink)"
      : state === "computed"
        ? "color-mix(in oklab, var(--warning-ink) 68%, var(--text-tertiary))"
        : "var(--warning-ink)";
  return (
    <span
      className="ui-caps-3 inline-flex items-center gap-1 text-[10.5px]"
      style={{ color: ink }}
      title={RENEWAL_DATE_REVIEW_HINTS[state]}
    >
      <Icon className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
      {RENEWAL_DATE_REVIEW_LABELS[state]}
    </span>
  );
}

// Compact "days remaining" indicator. Urgency reads through tone-ink only
// (warning ≤ 14 days, danger once overdue, quiet tertiary further out) — a
// borderless caps token rather than a separate red badge, so it pairs cleanly
// with the review chip as one coherent meta line beneath the date.
function RenewalDueChip({ days }: { days: number | null }) {
  if (days == null) return null;
  const overdue = days < 0;
  const near = days >= 0 && days <= 14;
  const ink = overdue ? "var(--danger-ink)" : near ? "var(--warning-ink)" : "var(--text-tertiary)";
  // "21d overdue" is unambiguous where the old "21d ago" read like a neutral
  // timestamp; a passed renewal/notice date is an action state, not history.
  const label = overdue ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `${days}d`;
  // "36d" is cryptic to a screen reader on its own; the full relative phrase
  // (and a hover title) make the day count accessible alongside the date shown.
  const description = overdue ? `${Math.abs(days)} days overdue` : days === 0 ? "Due today" : `In ${days} days`;
  return (
    <span
      aria-label={description}
      title={description}
      className="ui-caps-3 inline-flex items-center text-[10.5px] leading-none tabular-nums"
      style={{ color: ink }}
    >
      {label}
    </span>
  );
}

function RenewalDateCell({
  label,
  dateLabel,
  days,
  review,
}: {
  label: string;
  dateLabel: string;
  days: number | null;
  review: RenewalDateReviewState;
}) {
  const empty = dateLabel === "—";
  return (
    <div className="min-w-0">
      <p className="ui-caps-3 mb-1.5 block text-[10.5px] text-[var(--text-tertiary)] xl:sr-only">{label}</p>
      {/* Predictable stack: the absolute date on its own line, then ONE meta line
          pairing relative timing (days) with review/source provenance — so the
          small labels read as one coherent group, not scattered tiny tags. */}
      <p
        className={`text-[13px] leading-snug tabular-nums ${
          empty ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"
        }`}
      >
        {dateLabel}
      </p>
      {/* One coherent meta strip: relative timing and review/source provenance
          bound by a 1px hairline (§2.9) so the two small tokens read as a single
          group rather than two scattered tags. The rule renders only when both
          sides are present (a missing date carries no relative-day token). */}
      <div className="mt-1 flex flex-wrap items-center gap-y-1">
        {days != null ? (
          <>
            <RenewalDueChip days={days} />
            <span className="ui-rule-vert" aria-hidden />
          </>
        ) : null}
        <RenewalReviewChip state={review} />
      </div>
    </div>
  );
}

function RenewalRowStateGrid({
  row,
  canMutate,
  returnTo,
}: {
  row: RenewalRow;
  canMutate: boolean;
  returnTo: string;
}) {
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(11.5rem,1fr)_minmax(7.5rem,0.7fr)] xl:items-center xl:gap-3">
      <RenewalFact label={RENEWAL_ROW_LABELS.status}>
        <RenewalStatusBadge row={row} />
      </RenewalFact>
      <div className="min-w-0 xl:text-right">
        <p className="ui-caps-3 mb-1.5 block text-[10.5px] text-[var(--text-tertiary)] xl:sr-only">
          {RENEWAL_ROW_LABELS.nextAction}
        </p>
        {/* §11.22/§8.6 — the primary next action reads as a structured ActionChip
            (verb + arrow, nowrap so it never truncates mid-word like the old
            "Mark revie…"), with the quieter overflow menu beside it. */}
        <div className="flex min-w-0 items-center gap-1.5 xl:justify-end">
          {/* A resting "No action needed" row has no pending action — its dates are
              already reviewed — so it shows only the overflow menu, never a
              contradictory "Mark reviewed" chip beside the resting status. A
              `needs_owner` row likewise suppresses its inline next action here: the
              real fix is "Assign →", which lives in the coherent Owner cell, so the
              action column stays out of its way (Create task remains in the menu). */}
          {/* §10.6/scale — at 20–40 rows a bordered ActionChip per row reads as a
              wall of buttons, so the row's next action is a quiet structured link
              (verb + arrow, accent ink, hover-tinted, nowrap so it never
              truncates). The loud bordered ActionChip is reserved for the single
              page-level "View contracts". */}
          {row.status !== "no_renewal_action_needed" && row.status !== "needs_owner" ? (
            <Link
              href={row.nextActionHref}
              className="ui-chip-focus inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[12.5px] font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)]"
            >
              {row.nextActionLabel}
              <ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
            </Link>
          ) : null}
          <RenewalActionCluster
            actions={row.actions}
            canMutate={canMutate}
            returnTo={returnTo}
            contractTitle={row.title}
          />
        </div>
      </div>
    </div>
  );
}

const RENEWAL_STATUS_ICON: Record<RenewalStatus, LucideIcon> = {
  needs_owner: CircleUserRound,
  needs_review: Eye,
  notice_window_open: BellRing,
  in_progress: Clock,
  completed: CheckCircle2,
  no_renewal_action_needed: CircleDashed,
};

function RenewalStatusBadge({ row }: { row: RenewalRow }) {
  // §7.7 — every status carries a glyph, so the state is legible without
  // relying on colour alone. §10.2/§12 — quiet states shed the coloured pill and
  // read as a quiet icon + caps label, so the loud pills stay reserved for rows
  // that actually need a Status-column decision. `completed` / `no action needed`
  // are genuinely resting.
  const Icon = RENEWAL_STATUS_ICON[row.status];
  // `needs_owner` is fully expressed by the coherent Owner cell (warning
  // "Unassigned" chip + "Assign →"). Restating it here as a second "Needs owner"
  // fragment is exactly the owner/status duplication the spec rejects, so the
  // Status cell defers with an em-dash placeholder (§10.12) and keeps the label
  // for assistive tech and the status filter.
  if (row.status === "needs_owner") {
    return (
      <span
        className="inline-flex items-center text-[13px] leading-snug text-[var(--text-tertiary)]"
        title="Owner needed — see the Owner column"
      >
        <span aria-hidden>—</span>
        <span className="sr-only">{row.statusLabel}</span>
      </span>
    );
  }
  const quiet = row.status === "completed" || row.status === "no_renewal_action_needed";
  if (quiet) {
    const ink = row.status === "completed" ? "var(--success-ink)" : "var(--text-tertiary)";
    return (
      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase leading-tight tracking-[0.1em] text-[var(--text-tertiary)]">
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} style={{ color: ink }} aria-hidden />
        <span>{row.statusLabel}</span>
      </span>
    );
  }
  return (
    <StatusBadge status={row.statusTone} className="gap-1.5 whitespace-nowrap">
      <Icon className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
      {row.statusLabel}
    </StatusBadge>
  );
}

function RenewalFact({
  label,
  value,
  children,
  titleId,
  tabular = false,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
  titleId?: string;
  /** Apply `tabular-nums` to the rendered value — for date/numeric columns. */
  tabular?: boolean;
}) {
  const empty = value === "—" || value === "Unassigned";
  const valueClassName = `break-words text-[13px] leading-snug ${tabular ? "tabular-nums" : ""} ${
    empty ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"
  }`;
  return (
    <div className="min-w-0">
      <p className="ui-caps-3 mb-1.5 block text-[10.5px] text-[var(--text-tertiary)] xl:sr-only">
        {label}
      </p>
      {children ? (
        <div id={titleId} className={valueClassName}>
          {children}
        </div>
      ) : (
        <p id={titleId} className={valueClassName}>
          {value}
        </p>
      )}
    </div>
  );
}

function RenewalActionCluster({
  actions,
  canMutate,
  returnTo,
  contractTitle,
}: {
  actions: RenewalActionCapability[];
  canMutate: boolean;
  returnTo: string;
  contractTitle: string;
}) {
  // §7.3/§11.12 — the menu portals out of the card's `overflow-hidden` clip via
  // RenewalRowActionsMenu; here we just render the items (mutation forms + links)
  // as menuitems. The server actions keep working through the portal.
  const itemClass =
    "ui-chip-focus block w-full rounded-[0.45rem] px-2.5 py-1.5 text-left text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] hover:text-[var(--text-primary)]";
  return (
    <RenewalRowActionsMenu contractTitle={contractTitle}>
      {actions.map((action) => {
        if (action.kind === "mutation" && canMutate && action.checkpointId && action.mutation) {
          return (
            <form key={action.key} action={updateRenewalAction}>
              <input type="hidden" name="checkpointId" value={action.checkpointId} />
              <input type="hidden" name="status" value={action.mutation === "reopen_checkpoint" ? "pending" : "completed"} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button type="submit" role="menuitem" tabIndex={-1} className={itemClass}>
                {action.label}
              </button>
            </form>
          );
        }
        return (
          <Link key={action.key} href={action.href ?? "/contracts/renewals"} role="menuitem" tabIndex={-1} className={itemClass}>
            {action.label}
          </Link>
        );
      })}
      {!canMutate ? (
        <span className="px-2.5 py-1.5 text-[12px] text-[var(--text-tertiary)]">
          Editing requires contract access
        </span>
      ) : null}
    </RenewalRowActionsMenu>
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function stringFromForm(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function safeRenewalsReturnTo(value: string) {
  return value.startsWith("/contracts/renewals") ? value : "/contracts/renewals";
}
