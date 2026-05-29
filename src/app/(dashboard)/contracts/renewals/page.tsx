import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ReactNode } from "react";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  CircleUserRound,
  Clock,
  Download,
  Eye,
  MoreHorizontal,
  Plus,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { createContractTask } from "@/actions/tasks";
import { updateRenewalCheckpointStatus } from "@/actions/renewal-playbook";
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
import { CountChip } from "@/components/ui/count-chip";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { UiSelect, type UiSelectOption } from "@/components/ui/ui-select";
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
  RENEWAL_FILTER_LABELS,
  RENEWAL_ACTION_LABELS,
  RENEWAL_ROW_LABELS,
  RENEWALS_EMPTY_STATE,
  RENEWALS_PAGE_TITLE,
  RENEWALS_PARTIAL_DATA_REASON,
  RENEWALS_PARTIAL_DATA_TITLE,
} from "@/lib/renewals/spec-strings";
import type { RenewalActionCapability, RenewalFilterState, RenewalRow, RenewalStatus, RenewalWindowSummary } from "@/lib/renewals/types";

export const metadata = { title: RENEWALS_PAGE_TITLE };

type RenewalsSearchParams = {
  window?: string | string[];
  horizon?: string | string[];
  owner?: string | string[];
  counterparty?: string | string[];
  status?: string | string[];
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
    <div className="ui-page-stack mx-auto max-w-7xl">
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
                className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
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
              className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              {RENEWAL_ACTION_LABELS.export_renewal_report}
            </Link>
            <Link href={createHref} className="ui-btn-primary inline-flex items-center gap-2 px-4 py-2">
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

      {/* §10.1 calmer cousin — a dense work surface rides the quiet card tier
          (no accent wash, no deep shadow) so the data, not the container, is
          the focal object. overflow-hidden clips the stacked row borders to
          the rounded corner. */}
      <section className="ui-card-quiet overflow-hidden" aria-labelledby="renewals-surface-title">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h2 id="renewals-surface-title" className="sr-only">
              {model.title}
            </h2>
            <p className="ui-caps-2 pr-0.5 text-[11px] text-[var(--text-tertiary)]">Upcoming decisions</p>
            <KeyValueChip label="Visible" value={model.summary.visible} />
            {model.summary.noticeWindowOpen > 0 ? (
              <KeyValueChip label="Notice window open" value={model.summary.noticeWindowOpen} tone="warning" />
            ) : null}
            {model.summary.needsReview > 0 ? (
              <KeyValueChip label="Needs review" value={model.summary.needsReview} />
            ) : null}
          </div>
          {/* §21 — internal navigation reads with a forward chevron, not the
              ↗ external-link glyph that implies a new tab / outside surface. */}
          <Link href="/contracts" className="ui-btn-ghost inline-flex items-center gap-1 px-3 py-1.5 text-[12.5px]">
            All contracts
            <ChevronRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </Link>
        </div>

        <RenewalWindowControl windows={model.windows} />

        <RenewalFilters filters={model.filters} model={model} keepCreateOpen={model.create.open} />

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
        />
      </section>
    </div>
  );
}

function RenewalWindowControl({ windows }: { windows: RenewalWindowSummary[] }) {
  // §6/§7 — the windows are cumulative (60 includes 30, etc.), so a "Due
  // within" label + segmented control reads as one horizon dial rather than
  // four mutually-exclusive buckets. Counts ride the canonical CountChip
  // vocabulary instead of filled circular bubbles.
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-5 py-3">
      <span className="ui-caps-2 text-[11px] text-[var(--text-tertiary)]">Due within</span>
      <div className="ui-segmented max-w-full overflow-x-auto" role="group" aria-label="Renewal date windows">
        {windows.map((window) => (
          <Link
            key={window.key}
            href={window.href}
            aria-current={window.active ? "true" : undefined}
            className={`ui-segmented-item gap-2 ${window.active ? "ui-segmented-item-active" : ""}`}
          >
            {window.label}
            <CountChip value={window.count} emphasis={window.active ? "strong" : "subtle"} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function RenewalFilters({
  filters,
  model,
  keepCreateOpen,
}: {
  filters: RenewalFilterState;
  model: Awaited<ReturnType<typeof loadRenewalsPageModel>>;
  keepCreateOpen: boolean;
}) {
  const hasFilters = Boolean(filters.owner || filters.counterparty || filters.status);
  return (
    // §8 — a single flat toolbar row instead of a full label-over-field band.
    // The label-less comboboxes default to their "Any …" option, so the row
    // reads as filters without a stack of redundant field captions; each
    // control keeps an ariaLabel for assistive tech.
    <form
      method="get"
      className="ui-filter-toolbar border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-5 py-3"
    >
      {model.activeWindow !== "90" ? <input type="hidden" name="window" value={model.activeWindow} /> : null}
      {keepCreateOpen ? <input type="hidden" name="create" value="1" /> : null}
      <span className="ui-caps-2 pr-0.5 text-[11px] text-[var(--text-tertiary)]">Filter</span>
      <FilterSelect name="owner" label={RENEWAL_FILTER_LABELS.owner} value={filters.owner} options={model.filterOptions.owners} />
      <FilterSelect name="counterparty" label={RENEWAL_FILTER_LABELS.counterparty} value={filters.counterparty} options={model.filterOptions.counterparties} />
      <FilterSelect name="status" label={RENEWAL_FILTER_LABELS.status} value={filters.status} options={model.filterOptions.statuses} />
      <button type="submit" className="ui-btn-secondary inline-flex h-9 items-center px-3.5 text-[12.5px]">
        Apply
      </button>
      {hasFilters ? (
        <Link
          href={buildRenewalsHref({ window: model.activeWindow, create: keepCreateOpen })}
          className="ui-btn-ghost inline-flex h-9 items-center px-2.5 text-[12.5px]"
        >
          Clear
        </Link>
      ) : null}
    </form>
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

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  const uiOptions: UiSelectOption[] = options.map((option) => ({
    value: option.value,
    label: option.label,
  }));
  return (
    <UiSelect
      className="min-w-0"
      buttonClassName="h-9 min-w-[8.5rem]"
      menuWidth="fit"
      name={name}
      defaultValue={value}
      options={uiOptions}
      placeholder={uiOptions[0]?.label ?? label}
      ariaLabel={label}
    />
  );
}

function RenewalRows({
  rows,
  canMutate,
  returnTo,
}: {
  rows: RenewalRow[];
  canMutate: boolean;
  returnTo: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-12 text-center">
        <p className="mx-auto max-w-xl text-[1.05rem] font-semibold text-[var(--text-primary)]">
          {RENEWALS_EMPTY_STATE}
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)]">
      <RenewalRowsHeader />
      {rows.map((row) => (
        <article
          key={row.id}
          aria-labelledby={`renewal-row-${row.id}`}
          className="grid gap-4 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-5 py-4 last:border-b-0 xl:grid-cols-[minmax(13rem,0.9fr)_minmax(0,1.45fr)_minmax(20rem,1fr)] xl:items-center"
        >
          <RenewalFact label={RENEWAL_ROW_LABELS.contract} titleId={`renewal-row-${row.id}`}>
            {/* §15 — the contract title is the row's heading, so it reads as
                primary text and only reveals the link affordance (accent +
                underline) on hover. It no longer out-shouts the dates/status
                it labels. */}
            <Link
              href={row.href}
              className="ui-chip-focus break-words text-[14px] font-semibold text-[var(--text-primary)] underline-offset-[3px] decoration-from-font transition-colors hover:text-[var(--accent-strong)] hover:underline"
            >
              {row.title}
            </Link>
            {/* §13/§14/§20 — the cross-object links collapse behind a single
                "Related work" disclosure so they stop repeating on every row,
                stop duplicating the word against a "Work" chip, and stop
                making column one taller than its neighbours. The blank inner
                label keeps the chips while letting the summary own the
                wording. */}
            <details className="group mt-1.5">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)] [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-3 w-3 shrink-0 transition-transform group-open:rotate-90" strokeWidth={2} aria-hidden />
                Related work
              </summary>
              <ContractContinuityLinks
                contractId={row.id}
                omit={["contract", "renewals"]}
                label=" "
                className="mt-2 flex max-w-[18rem] flex-wrap items-center gap-x-1 gap-y-1 text-[12.5px] text-[var(--text-tertiary)]"
              />
            </details>
          </RenewalFact>

          <RenewalRowFactGrid row={row} />

          <RenewalRowStateGrid row={row} canMutate={canMutate} returnTo={returnTo} />
        </article>
      ))}
    </div>
  );
}

function RenewalRowsHeader() {
  return (
    // Outer `gap-4` must match the row article's outer `gap-4` so column 2
    // (counterparty/dates/owner) starts at the same X in both header band
    // and data rows. Without the gap here, the header column labels were
    // offset 16px left of the row values below them — visible misalignment.
    <div className="hidden border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-5 py-3 xl:grid xl:grid-cols-[minmax(13rem,0.9fr)_minmax(0,1.45fr)_minmax(20rem,1fr)] xl:gap-4">
      <RenewalColumnLabel>{RENEWAL_ROW_LABELS.contract}</RenewalColumnLabel>
      <div className="grid min-w-0 grid-cols-[minmax(10rem,1.15fr)_minmax(7.5rem,0.8fr)_minmax(7.5rem,0.8fr)_minmax(8.5rem,0.85fr)] gap-3">
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
      className={`text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)] ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </p>
  );
}

function RenewalRowFactGrid({ row }: { row: RenewalRow }) {
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(10rem,1.15fr)_minmax(7.5rem,0.8fr)_minmax(7.5rem,0.8fr)_minmax(8.5rem,0.85fr)] xl:items-center">
      <RenewalFact label={RENEWAL_ROW_LABELS.counterparty} value={row.counterparty} />
      <RenewalFact label={RENEWAL_ROW_LABELS.renewalDate} value={row.renewalDateLabel} tabular />
      <RenewalFact label={RENEWAL_ROW_LABELS.noticeDate} value={row.noticeDateLabel} tabular />
      <RenewalFact label={RENEWAL_ROW_LABELS.owner} value={row.ownerLabel} />
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
        <p className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)] xl:sr-only">
          {RENEWAL_ROW_LABELS.nextAction}
        </p>
        {/* §16/§17 — the primary next-action and the overflow trigger now share
            one ghost-action vocabulary (rounded-md, hover-tinted, no persistent
            border) so they read as a single cohesive cluster on one line. The
            cluster keeps every row's action cell at the same height as the
            other cells. */}
        <div className="flex min-w-0 items-center gap-1 xl:justify-end">
          <Link
            href={row.nextActionHref}
            title={row.nextActionLabel}
            className="ui-chip-focus inline-flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)]"
          >
            <span className="truncate">{row.nextActionLabel}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={2} aria-hidden />
          </Link>
          <RenewalActionCluster actions={row.actions} canMutate={canMutate} returnTo={returnTo} />
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
  // relying on colour alone. §10.2/§12 — resting states (completed / no action
  // needed) shed the coloured pill and read as a quiet icon + caps label, so
  // the loud pills stay reserved for rows that actually need a decision. This
  // also retires the old font-shrink fit hack: with the longest label off the
  // pill track, the remaining pills fit one line at the canonical scale.
  const Icon = RENEWAL_STATUS_ICON[row.status];
  const resting = row.status === "completed" || row.status === "no_renewal_action_needed";
  if (resting) {
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
  return (
    <div className="min-w-0">
      <p className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)] xl:sr-only">
        {label}
      </p>
      <p
        id={titleId}
        className={`break-words text-[13px] leading-snug ${tabular ? "tabular-nums" : ""} ${
          empty ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"
        }`}
      >
        {children ?? value}
      </p>
    </div>
  );
}

function RenewalActionCluster({
  actions,
  canMutate,
  returnTo,
}: {
  actions: RenewalActionCapability[];
  canMutate: boolean;
  returnTo: string;
}) {
  return (
    <details className="group relative shrink-0">
      <summary
        className="ui-chip-focus inline-flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_70%,transparent)] hover:text-[var(--text-primary)] group-open:bg-[color:color-mix(in_oklab,var(--surface-muted)_70%,transparent)] group-open:text-[var(--text-primary)] [&::-webkit-details-marker]:hidden"
        aria-label="More actions"
        title="More actions"
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.85} aria-hidden />
      </summary>
      <div className="absolute right-0 top-full z-20 mt-1.5 flex w-max max-w-[18rem] flex-col gap-1 rounded-[0.625rem] border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[var(--surface-raised)] p-1.5 shadow-[var(--shadow-2)]">
        {actions.map((action) => {
          if (action.kind === "mutation" && canMutate && action.checkpointId && action.mutation) {
            return (
              <form key={action.key} action={updateRenewalAction}>
                <input type="hidden" name="checkpointId" value={action.checkpointId} />
                <input type="hidden" name="status" value={action.mutation === "reopen_checkpoint" ? "pending" : "completed"} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button
                  type="submit"
                  className="w-full rounded-[0.45rem] px-2.5 py-1.5 text-left text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] hover:text-[var(--text-primary)]"
                >
                  {action.label}
                </button>
              </form>
            );
          }
          return (
            <Link
              key={action.key}
              href={action.href ?? "/contracts/renewals"}
              className="w-full rounded-[0.45rem] px-2.5 py-1.5 text-left text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] hover:text-[var(--text-primary)]"
            >
              {action.label}
            </Link>
          );
        })}
        {!canMutate ? (
          <span className="px-2.5 py-1.5 text-[12px] text-[var(--text-tertiary)]">
            Editing requires contract access
          </span>
        ) : null}
      </div>
    </details>
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
