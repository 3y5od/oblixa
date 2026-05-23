import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ReactNode } from "react";
import { ArrowUpRight, CalendarClock, Download, MoreHorizontal, Plus } from "lucide-react";
import { createContractTask } from "@/actions/tasks";
import { updateRenewalCheckpointStatus } from "@/actions/renewal-playbook";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { UiSelect, type UiSelectOption } from "@/components/ui/ui-select";
import { UiTabs } from "@/components/ui/ui-tabs";
import { V10RecoverableState } from "@/components/ui/v10-recoverable-state";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getAuthContext } from "@/lib/supabase/server";
import { canEditContracts } from "@/lib/permissions";
import type { OrgRole } from "@/lib/types";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface";
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
import type { RenewalActionCapability, RenewalFilterState, RenewalRow } from "@/lib/renewals/types";

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
        actions={
          <>
            <Link href={model.exportHref} className="ui-btn-secondary inline-flex items-center gap-2 px-4 py-2">
              <Download className="h-4 w-4" aria-hidden />
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
        <V10RecoverableState
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

      <section className="ui-card p-0" aria-labelledby="renewals-surface-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 id="renewals-surface-title" className="sr-only">
              {model.title}
            </h2>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              Upcoming decisions
            </p>
            <span className="ui-chip">
              <span className="font-mono tabular-nums">{model.summary.visible}</span>
              <span className="ml-1">visible</span>
            </span>
            {model.summary.noticeWindowOpen > 0 ? (
              <span className="ui-chip">
                <span className="font-mono tabular-nums">{model.summary.noticeWindowOpen}</span>
                <span className="ml-1">notice window open</span>
              </span>
            ) : null}
            {model.summary.needsReview > 0 ? (
              <span className="ui-chip">
                <span className="font-mono tabular-nums">{model.summary.needsReview}</span>
                <span className="ml-1">needs review</span>
              </span>
            ) : null}
          </div>
          <Link href="/contracts" className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
            All contracts
            <ArrowUpRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </Link>
        </div>

        <UiTabs
          ariaLabel="Renewal date windows"
          items={model.windows.map((window) => ({
            href: window.href,
            label: window.label,
            active: window.active,
            count: window.count,
          }))}
          className="px-5"
        />

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
    <form method="get" className="grid gap-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-5 py-4 md:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto_auto]">
      {model.activeWindow !== "90" ? <input type="hidden" name="window" value={model.activeWindow} /> : null}
      {keepCreateOpen ? <input type="hidden" name="create" value="1" /> : null}
      <FilterSelect name="owner" label={RENEWAL_FILTER_LABELS.owner} value={filters.owner} options={model.filterOptions.owners} />
      <FilterSelect name="counterparty" label={RENEWAL_FILTER_LABELS.counterparty} value={filters.counterparty} options={model.filterOptions.counterparties} />
      <FilterSelect name="status" label={RENEWAL_FILTER_LABELS.status} value={filters.status} options={model.filterOptions.statuses} />
      <div className="flex items-end">
        <button type="submit" className="ui-btn-secondary h-10 w-full px-4">
          Apply
        </button>
      </div>
      {hasFilters ? (
        <div className="flex items-end">
          <Link
            href={buildRenewalsHref({ window: model.activeWindow, create: keepCreateOpen })}
            className="ui-btn-ghost h-10 px-3"
          >
            Clear filters
          </Link>
        </div>
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
    <div className="block min-w-0">
      <p className="mb-1.5 block text-[12.5px] font-medium text-[var(--text-secondary)]">
        {label}
      </p>
      <UiSelect
        className="block w-full"
        buttonClassName="h-10 w-full"
        name={name}
        defaultValue={value}
        options={uiOptions}
        placeholder={uiOptions[0]?.label ?? label}
        ariaLabel={label}
      />
    </div>
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
            <Link href={row.href} className="ui-link break-words text-[14px] font-semibold">
              {row.title}
            </Link>
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
      <div className="grid min-w-0 grid-cols-[minmax(10rem,0.85fr)_minmax(10rem,0.85fr)] gap-4">
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
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(10rem,0.85fr)_minmax(10rem,0.85fr)] xl:items-center xl:gap-4">
      <RenewalFact label={RENEWAL_ROW_LABELS.status}>
        <RenewalStatusBadge row={row} />
      </RenewalFact>
      <div className="min-w-0 xl:text-right">
        <p className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)] xl:sr-only">
          {RENEWAL_ROW_LABELS.nextAction}
        </p>
        {/* Inline layout: primary next-action link + icon-only kebab menu
            trigger. Keeping both on a single line means the NEXT ACTION cell
            is the same vertical height as the other row cells (counterparty,
            dates, owner, status pill) — every row cell now occupies one
            text line and centers cleanly against the row baseline. The
            kebab trigger fits horizontally regardless of how long the
            next-action label is, so CTAs (Mark reviewed / Complete /
            Reopen / Create renewal task / etc.) all position identically. */}
        <div className="flex min-w-0 items-center gap-2 xl:justify-end">
          <Link href={row.nextActionHref} className="ui-link min-w-0 truncate text-[13px] font-semibold">
            {row.nextActionLabel}
          </Link>
          <RenewalActionCluster actions={row.actions} canMutate={canMutate} returnTo={returnTo} />
        </div>
      </div>
    </div>
  );
}

function RenewalStatusBadge({ row }: { row: RenewalRow }) {
  // Long-label statuses ("No renewal action needed", "Notice window open")
  // don't fit on one line at the canonical 11px uppercase + 0.14em tracking
  // in the constrained STATUS column. Shrink the font (9px) and tighten the
  // tracking (0.04em) so the full label fits horizontally on one line while
  // keeping uppercase caps consistent with every other status pill on the
  // page. The enclosure (border + bg from the StatusBadge base class) is
  // preserved — only the type recipe shrinks for the long-label cases.
  const longLabel = row.status === "no_renewal_action_needed" || row.status === "notice_window_open";
  return (
    <StatusBadge
      status={row.statusTone}
      className={
        longLabel
          ? "whitespace-nowrap text-[9px] tracking-[0.04em]"
          : "max-w-full whitespace-nowrap"
      }
    >
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
  const empty = value === "Missing" || value === "Unassigned";
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
        className="inline-flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] [&::-webkit-details-marker]:hidden"
        aria-label="Row actions"
      >
        <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
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
