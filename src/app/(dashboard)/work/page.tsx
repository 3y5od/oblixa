import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  BadgeCheck,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  ListChecks,
  ListTodo,
  Paperclip,
  Plus,
  Sparkles,
  TriangleAlert,
  UserPlus,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createContractTask } from "@/actions/tasks";
import { WorkReleaseActions } from "@/components/work/work-release-actions";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { TimeChip } from "@/components/ui/time-chip";
import { ActionChip } from "@/components/ui/action-chip";
import { CountChip } from "@/components/ui/count-chip";
import { UiSelect } from "@/components/ui/ui-select";
import { UiTabs } from "@/components/ui/ui-tabs";
import { RecoverableState } from "@/components/ui/recoverable-state";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getAuthContext } from "@/lib/supabase/server";
import { canEditContracts } from "@/lib/permissions";
import type { OrgRole } from "@/lib/types";
import type { WorkspaceRole } from "@/lib/navigation";
import { isAdvancedModuleHidden, loadProductSurfaceContext } from "@/lib/product-surface";
import { buildWorkHref, loadWorkPageModel, WORK_EMPTY_STATE } from "@/lib/work/model";
import {
  WORK_FILTER_LABELS,
  WORK_LEAD,
  WORK_PAGE_TITLE,
  WORK_PARTIAL_DATA_REASON,
  WORK_PARTIAL_DATA_TITLE,
  WORK_ROW_LABELS,
} from "@/lib/work/spec-strings";
import type { WorkFilterState, WorkItemRow, WorkOption, WorkPageModel, WorkTypeKey } from "@/lib/work/types";
import { WorkFilterForm } from "./work-filter-form";
import { WorkSortSelect } from "./work-sort-select";

export const metadata = { title: WORK_PAGE_TITLE };

type WorkModel = Awaited<ReturnType<typeof loadWorkPageModel>>;

// Quiet, neutral type glyphs for the Work-item medallion. Tone stays neutral —
// work type is metadata, not status, so it must never compete with the status
// column for color (§10.2).
const WORK_TYPE_ICONS: Record<WorkTypeKey, LucideIcon> = {
  contract_task: ListChecks,
  obligation: FileText,
  approval: BadgeCheck,
  exception: TriangleAlert,
  evidence_request: Paperclip,
  renewal_checkpoint: CalendarClock,
  unassigned_work: UserPlus,
};

const WORK_QUICK_FILTER_EMPTY: WorkFilterState = {
  owner: "",
  dueDate: "",
  contract: "",
  status: "",
  type: "",
};

type WorkPageSearchParams = {
  tab?: string | string[];
  lens?: string | string[];
  owner?: string | string[];
  due?: string | string[];
  contract?: string | string[];
  status?: string | string[];
  type?: string | string[];
  create?: string | string[];
  page?: string | string[];
  sort?: string | string[];
  error?: string | string[];
};

async function createWorkItemAction(formData: FormData) {
  "use server";

  const contractId = stringFromForm(formData, "contractId");
  const title = stringFromForm(formData, "title");
  const details = stringFromForm(formData, "details");
  const assigneeId = stringFromForm(formData, "assigneeId") || null;
  const dueDate = stringFromForm(formData, "dueDate") || null;
  const type = stringFromForm(formData, "type") || null;

  const result = await createContractTask({
    contractId,
    title,
    details,
    assigneeId,
    dueDate,
    teamKey: type,
    createdVia: "manual",
  });

  if ("error" in result && result.error) {
    redirect(`/work?create=1&error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/work");
  redirect("/work");
}

export default async function WorkPage(props: {
  searchParams: Promise<WorkPageSearchParams>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const productSurface = await loadProductSurfaceContext(
    ctx.admin,
    ctx.orgId,
    ctx.role as WorkspaceRole
  );
  const model = await loadWorkPageModel(ctx.admin, ctx.orgId, {
    userId: ctx.user.id,
    role: ctx.role,
    workspaceMode: productSurface.mode,
    tab: firstParam(searchParams.tab),
    lens: firstParam(searchParams.lens),
    owner: firstParam(searchParams.owner),
    due: firstParam(searchParams.due),
    contract: firstParam(searchParams.contract),
    status: firstParam(searchParams.status),
    type: firstParam(searchParams.type),
    create: firstParam(searchParams.create),
    page: firstParam(searchParams.page),
    sort: firstParam(searchParams.sort),
  });
  const workQueueMutationsEnabled = canEditContracts(ctx.role as OrgRole);
  const showDecisionsCta =
    (productSurface.mode === "advanced" || productSurface.mode === "assurance") &&
    !isAdvancedModuleHidden(productSurface, "decisions");
  const createHref = buildWorkHref({ tab: model.activeTab, filters: model.filters, create: true });
  const error = firstParam(searchParams.error);
  const hasAnyFilter = Boolean(
    model.filters.owner ||
      model.filters.dueDate ||
      model.filters.contract ||
      model.filters.status ||
      model.filters.type
  );
  // An empty queue means different things: a fresh workspace with no work vs. a
  // tab/filter combination that happens to match nothing. Branch the empty copy.
  const isFilteredView = hasAnyFilter || model.activeTab !== "all";
  const clearFiltersHref = buildWorkHref({});

  return (
    <div className="ui-page-stack mx-auto w-full min-w-0 max-w-[1600px] overflow-x-clip">
      <DashboardPageHeader
        icon={<ListTodo className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow={model.eyebrow}
        title={WORK_PAGE_TITLE}
        lead={WORK_LEAD}
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
          title={WORK_PARTIAL_DATA_TITLE}
          reason={WORK_PARTIAL_DATA_REASON}
          accessibleName="Work partial data state"
          nextActionLabel="Review workspace health"
          nextAction={
            <Link href="/settings/health" className="ui-link">
              Review workspace health
            </Link>
          }
        />
      ) : null}

      <section className="ui-table-shell min-w-0 max-w-full [contain:inline-size]" aria-labelledby="work-surface-title">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex shrink-0 items-center gap-2.5">
              <h2 id="work-surface-title" className="sr-only">
                {model.title}
              </h2>
              <p className="ui-caps-2 text-[var(--text-tertiary)]">Active work</p>
              <CountChip value={model.totalVisibleRows} emphasis="strong" />
            </div>
            <span
              aria-hidden
              className="hidden h-4 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] sm:block"
            />
            {/* Queue-health quick filters live in the queue band (not the page
                header) so the counts read as part of the queue and double as
                one-click jumps into the matching subset (§10.13). */}
            <WorkQuickFilters model={model} />
          </div>
          {/* `.ui-chip-focus` gives the header CTA the app-standard accent focus
              ring (instead of the inconsistent browser default ActionChip would
              otherwise fall back to), and `active:translate-y-px` adds the
              pressed feedback every other /work control carries (§8). */}
          <ActionChip verb="View contracts" href="/contracts" className="ui-chip-focus active:translate-y-px shrink-0" />
        </div>

        <UiTabs
          ariaLabel="Work tabs"
          items={model.tabs.map((tab) => ({
            href: tab.href,
            label: tab.label,
            active: tab.active,
            count: tab.count,
            // A zero on a needs-action tab (Overdue / Blocked) is the desired
            // outcome — render it all-clear green, matching the queue-health
            // quick filters above, instead of a ghosted grey (§10.10).
            countTone:
              (tab.key === "overdue" || tab.key === "blocked") && tab.count === 0
                ? ("success" as const)
                : undefined,
          }))}
          className="px-5"
        />

        <WorkFilters model={model} keepCreateOpen={model.create.open} />

        {model.create.open ? (
          <div className="border-y border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_26%,transparent)] px-5 py-3">
            <form action={createWorkItemAction} className="grid gap-3 lg:grid-cols-[1.25fr_1.35fr_0.95fr_0.8fr_0.95fr]">
              <div className="space-y-2">
                <p className="ui-caps-2 text-[var(--text-tertiary)]">{model.primaryCta}</p>
                <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="work-create-contract">
                  Linked contract
                </label>
                <UiSelect
                  className="block w-full"
                  buttonClassName="w-full"
                  name="contractId"
                  required
                  options={model.create.contracts.map((contract) => ({
                    value: contract.value,
                    label: contract.label,
                  }))}
                  placeholder="Select contract"
                  ariaLabel="Linked contract"
                  portal
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="work-create-title">
                  Title
                </label>
                <input id="work-create-title" name="title" required className="ui-input w-full" placeholder="e.g., Confirm renewal notice owner" />
                {error ? <p className="text-[12.5px] text-[var(--danger-ink)]">{error}</p> : null}
              </div>
              <div className="space-y-2">
                <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="work-create-owner">
                  Owner
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
                  ariaLabel="Owner"
                  portal
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="work-create-due">
                  Due date
                </label>
                <input id="work-create-due" name="dueDate" type="date" className="ui-input w-full" />
              </div>
              <div className="space-y-2">
                <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="work-create-type">
                  Type
                </label>
                <UiSelect
                  className="block w-full"
                  buttonClassName="w-full"
                  name="type"
                  defaultValue={model.create.typeOptions[0]?.value ?? ""}
                  options={model.create.typeOptions.map((type) => ({
                    value: type.value,
                    label: type.label,
                  }))}
                  placeholder={model.create.typeOptions[0]?.label ?? "Type"}
                  ariaLabel="Type"
                  portal
                />
              </div>
              <div className="space-y-2 lg:col-span-4">
                <label className="block text-[12.5px] font-medium text-[var(--text-secondary)]" htmlFor="work-create-details">
                  Details
                </label>
                <textarea id="work-create-details" name="details" className="ui-input min-h-16 w-full resize-y" />
              </div>
              <div className="flex flex-wrap items-end justify-end gap-2 lg:col-span-1">
                <Link href={buildWorkHref({ tab: model.activeTab, filters: model.filters })} className="ui-btn-secondary px-4 py-2">
                  Cancel
                </Link>
                <button type="submit" className="ui-btn-primary px-4 py-2">
                  {model.primaryCta}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <WorkTable
          rows={model.rows}
          mutationsEnabled={workQueueMutationsEnabled}
          pagination={model.pagination}
          pageHref={(page) =>
            buildWorkHref({ tab: model.activeTab, filters: model.filters, sort: model.sort, page })
          }
          isFiltered={isFilteredView}
          clearHref={clearFiltersHref}
        />
      </section>
    </div>
  );
}

// Queue-health quick filters: the four "needs attention" counts, rendered in
// the queue band as one-click jumps into the matching subset. Each chip toggles
// — clicking the active one returns to All / clears its filter. A zero count
// renders as a calm, non-interactive success chip ("all clear", §2.11/§10.10)
// rather than a link to an empty view.
function WorkQuickFilters({ model }: { model: WorkModel }) {
  const { summary, filters, activeTab, sort } = model;
  const items: {
    key: string;
    label: string;
    value: number;
    tone?: "danger" | "warning";
    active: boolean;
    href: string;
  }[] = [
    {
      key: "blocked",
      label: "Blocked",
      value: summary.blocked,
      tone: "danger",
      active: activeTab === "blocked",
      href: buildWorkHref({ tab: activeTab === "blocked" ? "all" : "blocked", sort }),
    },
    {
      key: "overdue",
      label: "Overdue",
      value: summary.overdue,
      tone: "danger",
      active: activeTab === "overdue",
      href: buildWorkHref({ tab: activeTab === "overdue" ? "all" : "overdue", sort }),
    },
    {
      key: "dueSoon",
      label: "Due soon",
      value: summary.dueSoon,
      tone: "warning",
      active: filters.dueDate === "due_soon",
      href: buildWorkHref({
        tab: "all",
        filters: { ...WORK_QUICK_FILTER_EMPTY, dueDate: filters.dueDate === "due_soon" ? "" : "due_soon" },
        sort,
      }),
    },
    {
      key: "unassigned",
      label: "Unassigned",
      value: summary.unassigned,
      active: filters.owner === "unassigned",
      href: buildWorkHref({
        tab: "all",
        filters: { ...WORK_QUICK_FILTER_EMPTY, owner: filters.owner === "unassigned" ? "" : "unassigned" },
        sort,
      }),
    },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Queue health quick filters">
      {items.map(({ key, ...chip }) => (
        <WorkQuickFilterChip key={key} {...chip} />
      ))}
    </div>
  );
}

function WorkQuickFilterChip({
  label,
  value,
  tone,
  active,
  href,
}: {
  label: string;
  value: number;
  tone?: "danger" | "warning";
  active: boolean;
  href: string;
}) {
  // Zero = all clear. Calm success chip with a check, non-interactive (there's
  // no subset to jump to). Mirrors the zero-state stat treatment (§2.11).
  if (value === 0) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none"
        style={{
          borderColor: "color-mix(in oklab, var(--success-ink) 26%, var(--border-card))",
          background: "color-mix(in oklab, var(--success-ink) 10%, var(--surface-raised))",
          color: "var(--success-ink)",
        }}
      >
        <Check className="h-3 w-3 shrink-0" strokeWidth={2.2} aria-hidden />
        <span>{label.toUpperCase()}</span>
        <span className="tabular-nums">0</span>
      </span>
    );
  }
  // Tone-tinted, clickable. Active = a stronger fill + inset ring so a turned-on
  // filter reads distinctly from a plain status count (§2.6 status value chip).
  const ink =
    tone === "danger"
      ? "var(--danger-ink)"
      : tone === "warning"
        ? "var(--warning-ink)"
        : "var(--text-secondary)";
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      aria-label={`${active ? "Clear" : "Filter by"} ${label.toLowerCase()} — ${value}`}
      className="ui-chip-focus inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none transition-[background-color,border-color,box-shadow,transform] hover:brightness-[1.04] active:translate-y-px"
      style={{
        borderColor: `color-mix(in oklab, ${ink} ${active ? "55%" : "30%"}, var(--border-card))`,
        background: `color-mix(in oklab, ${ink} ${active ? "22%" : "12%"}, var(--surface-raised))`,
        color: ink,
        boxShadow: active ? `inset 0 0 0 1px color-mix(in oklab, ${ink} 38%, transparent)` : undefined,
      }}
    >
      <span>{label.toUpperCase()}</span>
      <span className="tabular-nums">{value}</span>
    </Link>
  );
}

function WorkFilters({
  model,
  keepCreateOpen,
}: {
  model: WorkModel;
  keepCreateOpen: boolean;
}) {
  const filters = model.filters;
  const chips = activeFilterChips(model);

  return (
    <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {/* Keyed on the applied filters/tab so the controlled form resets in sync
            with the URL after any navigation (Apply, chip removal, Clear, tab). */}
        <WorkFilterForm
          key={`${model.activeTab}:${filters.owner}:${filters.dueDate}:${filters.contract}:${filters.status}:${filters.type}`}
          filters={filters}
          filterOptions={model.filterOptions}
          activeTab={model.activeTab}
          sort={model.sort}
          keepCreateOpen={keepCreateOpen}
          clearHref={buildWorkHref({ tab: model.activeTab, sort: model.sort, create: keepCreateOpen })}
        />
        <WorkSortSelect
          sort={model.sort}
          options={model.sortOptions}
          activeTab={model.activeTab}
          filters={filters}
        />
      </div>

      {chips.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Filters</span>
          {/* The whole chip removes one filter; the x glyph is decorative. */}
          {chips.map((chip) => (
            <Link
              key={chip.key}
              href={chip.removeHref}
              aria-label={`Remove ${chip.label} filter`}
              className="ui-active-filter-chip ui-chip-focus max-w-[16rem]"
            >
              <span className="ui-caps-3 text-[9.5px] text-[color:color-mix(in_oklab,var(--accent-strong)_72%,transparent)]">
                {chip.label}
              </span>
              <span className="truncate">{chip.value}</span>
              <span className="ui-active-filter-chip-remove" aria-hidden>
                <X className="h-3 w-3" strokeWidth={2} />
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function activeFilterChips(model: WorkModel) {
  const filters = model.filters;
  const lookup = (options: WorkOption[], value: string) =>
    options.find((option) => option.value === value)?.label ?? value;
  const chips: { key: keyof WorkFilterState; label: string; value: string; removeHref: string }[] = [];
  const add = (key: keyof WorkFilterState, label: string, options: WorkOption[], value: string) => {
    if (!value) return;
    chips.push({
      key,
      label,
      value: lookup(options, value),
      // "" is a valid value for every filter field, so clearing one key keeps a
      // well-formed WorkFilterState. Sort persists across the removal.
      removeHref: buildWorkHref({
        tab: model.activeTab,
        filters: { ...filters, [key]: "" } as WorkFilterState,
        sort: model.sort,
      }),
    });
  };
  add("owner", WORK_FILTER_LABELS.owner, model.filterOptions.owners, filters.owner);
  add("dueDate", WORK_FILTER_LABELS.dueDate, model.filterOptions.dueDates, filters.dueDate);
  add("contract", WORK_FILTER_LABELS.contract, model.filterOptions.contracts, filters.contract);
  add("status", WORK_FILTER_LABELS.status, model.filterOptions.statuses, filters.status);
  add("type", WORK_FILTER_LABELS.type, model.filterOptions.types, filters.type);
  return chips;
}

function WorkTypeIcon({ type, label }: { type: WorkTypeKey; label: string }) {
  const Icon = WORK_TYPE_ICONS[type];
  return (
    <span
      title={label}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_55%,transparent)] text-[var(--text-tertiary)]"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

function WorkStatusBadge({ row }: { row: WorkItemRow }) {
  return (
    <StatusBadge status={row.statusTone} className="gap-1.5 self-start">
      {/* Dot + halo gives a non-color shape cue so status isn't tone alone (§7.7). */}
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full bg-current"
        style={{ boxShadow: "0 0 0 2px color-mix(in oklab, currentColor 22%, transparent)" }}
      />
      {row.statusLabel}
    </StatusBadge>
  );
}

function WorkDue({ row }: { row: WorkItemRow }) {
  // Two-line stack on every row (date on top, relative timing beneath) so rows
  // stay a uniform height whether or not a due date / descriptor exists (§10.9).
  // `items-start` is load-bearing: a flex-column child defaults to align-items:
  // stretch, which blows the toned TimeChip out to the full Due-cell width and
  // makes the date pill read like a progress bar. The min-width keeps the date
  // pills a consistent width down the column.
  if (!row.dueAt) {
    return (
      <span className="flex flex-col items-start gap-0.5">
        <span className="text-[13px] text-[var(--text-tertiary)]">—</span>
        <span aria-hidden className="ui-caps-3 text-[10px] text-transparent">
          &nbsp;
        </span>
      </span>
    );
  }
  const descriptor = dueDescriptor(row.dueInDays);
  // Tone: overdue→danger, due today/soon→warning, future→neutral (borderless) —
  // color is reserved for real urgency (§10.2). The descriptor line always
  // renders (nbsp fallback) so the stack height never collapses to one line.
  return (
    <span className="flex flex-col items-start gap-0.5 tabular-nums">
      <TimeChip
        date={row.dueAt}
        format="calendar"
        tone={
          row.dueState === "overdue"
            ? "danger"
            : row.dueState === "due_today" || row.dueState === "due_soon"
              ? "warning"
              : undefined
        }
        className="min-w-[3.5rem]"
      />
      <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">
        {descriptor ?? " "}
      </span>
    </span>
  );
}

function WorkTable({
  rows,
  mutationsEnabled,
  pagination,
  pageHref,
  isFiltered,
  clearHref,
}: {
  rows: WorkItemRow[];
  mutationsEnabled: boolean;
  pagination: WorkPageModel["pagination"];
  pageHref: (page: number) => string;
  isFiltered: boolean;
  clearHref: string;
}) {
  const rangeStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const rangeEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);

  if (rows.length === 0) {
    return (
      <div className="px-5 py-10">
        {isFiltered ? (
          <RecoverableState
            state="empty"
            title="No work in this view"
            reason="No items match the current tab and filters. Clear filters or pick another tab to see more work."
            accessibleName="Filtered work empty view"
            surface="work"
            section="queue"
            nextActionLabel="Clear filters"
            nextAction={
              <Link href={clearHref} className="ui-link">
                Clear filters
              </Link>
            }
          />
        ) : (
          <RecoverableState
            state="empty"
            title="No work yet"
            reason={WORK_EMPTY_STATE}
            accessibleName="Empty work view"
            surface="work"
            section="queue"
          />
        )}
      </div>
    );
  }

  return (
    <>
      {/* Desktop table (md+): its own scroll container so the header can stick
          while the rows scroll, instead of scrolling the whole page. */}
      <div className="hidden max-h-[calc(100dvh-20rem)] min-w-0 max-w-full overflow-x-auto overflow-y-auto [contain:inline-size] md:block">
        <table className="min-w-full text-sm" aria-label="Work items in this workspace">
          {/* Sticky header: each cell carries an opaque fill + a soft bottom
              shadow so rows scroll cleanly underneath it instead of bleeding
              through. z-20 sits above the rows but under the portaled menus. */}
          <thead className="ui-table-header sticky top-0 z-20 [&_th]:bg-[var(--surface-muted)] [&_th]:shadow-[0_3px_6px_-3px_color-mix(in_oklab,var(--border-strong)_55%,transparent)]">
            <tr className="border-b border-[color:color-mix(in_oklab,var(--border-strong)_45%,var(--border-subtle))] [&_th]:ui-caps-2 [&_th]:text-[11px] [&_th]:text-[var(--text-secondary)]">
            {/* Locked column widths: Work item flexes to fill, the rest are fixed
                so header cells sit exactly over body columns and the Actions slot
                holds a constant right edge across rows (§10.9). Identical px-5
                gutter on thead + tbody keeps the single internal grid. */}
            <th className="px-5 py-3">Work item</th>
            <th className="hidden w-[14rem] px-5 py-3 lg:table-cell">{WORK_ROW_LABELS.linkedContract}</th>
            <th className="hidden w-[10rem] px-5 py-3 md:table-cell">{WORK_ROW_LABELS.owner}</th>
            <th className="w-[9.5rem] px-5 py-3">{WORK_ROW_LABELS.dueDate}</th>
            <th className="w-[12rem] px-5 py-3">{WORK_ROW_LABELS.status}</th>
            <th className="hidden w-[5.5rem] px-5 py-3 lg:table-cell">{WORK_ROW_LABELS.lastUpdate}</th>
            <th className="w-[8.5rem] px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
              const titleHref = row.display.identity.title.href ?? row.href;
              const contract = row.display.identity.linkedContract;
              // The model falls back to the literal "Blocked" when a blocked row
              // has no specific reason — which just duplicates the badge. Only
              // show the line when it carries a real reason.
              const showBlocker = row.blocker !== "—" && row.blocker !== "Blocked";
              return (
                <tr key={row.key} className="ui-table-row group">
                  <td className="px-5 py-2 align-middle">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        {/* A quiet, neutral type medallion (not status color)
                            anchors the title and gives a scannable type cue in a
                            reserved-width slot, replacing the 9px caps token
                            (§11.17 anchor, §10.9 reserved slot, §10.2 calm). */}
                        <WorkTypeIcon type={row.type} label={row.typeLabel} />
                        {/* The row title is the link target; the dedicated Actions
                            column carries the single structured primary verb, so
                            no competing hover "Open" chip rides here (§8.6/§11.22 —
                            one structured affordance per row). */}
                        <Link
                          href={titleHref}
                          title={row.title}
                          className="block max-w-[28rem] truncate font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)]"
                        >
                          {row.display.identity.title.value}
                        </Link>
                      </div>
                      {/* Contract sub-line carries the link below lg, where its own
                          column is hidden — so the contract is always reachable. */}
                      <div className="mt-0.5 lg:hidden">
                        {contract.href ? (
                          <Link
                            href={contract.href}
                            title={contract.value}
                            className="block max-w-[22rem] truncate text-[11.5px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
                          >
                            {contract.value}
                          </Link>
                        ) : (
                          <span className="block text-[11.5px] text-[var(--text-tertiary)]">{contract.value}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden w-[14rem] px-5 py-2 align-middle lg:table-cell">
                    {contract.href ? (
                      <Link
                        href={contract.href}
                        title={contract.value}
                        className="block max-w-[13rem] truncate text-[12.5px] text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-strong)]"
                      >
                        {contract.value}
                      </Link>
                    ) : (
                      <span className="block max-w-[13rem] truncate text-[12.5px] text-[var(--text-tertiary)]">
                        {contract.value}
                      </span>
                    )}
                  </td>
                  <td className="hidden w-[10rem] whitespace-nowrap px-5 py-2 align-middle md:table-cell">
                    <span
                      title={row.ownerLabel}
                      className={
                        row.ownerLabel === "Unassigned"
                          ? "block truncate text-[12.5px] text-[var(--text-tertiary)]"
                          : "block truncate text-[12.5px] text-[var(--text-primary)]"
                      }
                    >
                      {row.ownerLabel}
                    </span>
                  </td>
                  <td className="w-[9.5rem] px-5 py-2 align-middle">
                    <WorkDue row={row} />
                  </td>
                  <td className="w-[12rem] px-5 py-2 align-middle">
                    <div className="flex flex-col gap-1">
                      <WorkStatusBadge row={row} />
                      {/* Blocker reason rides under the badge so the cause travels
                          with the state — but only when it's a real reason, not the
                          generic "Blocked" that just echoes the badge. */}
                      {showBlocker ? (
                        <span
                          className="block max-w-[11rem] truncate text-[11px] text-[var(--text-tertiary)]"
                          title={row.blocker}
                        >
                          {row.blocker}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td
                    className="hidden w-[5.5rem] whitespace-nowrap px-5 py-2 align-middle tabular-nums lg:table-cell"
                    suppressHydrationWarning
                  >
                    {row.lastUpdateAt ? (
                      <TimeChip date={row.lastUpdateAt} />
                    ) : (
                      <span className="text-[var(--text-tertiary)]">—</span>
                    )}
                  </td>
                  {/* Fixed Actions width + the action cluster's reserved primary
                      slot + fixed-size menu trigger keep Review/verb and the
                      ellipsis on one stable right edge across all rows (§10.9). */}
                  <td className="w-[8.5rem] px-5 py-2 text-right align-middle">
                    <WorkReleaseActions row={row} mutationsEnabled={mutationsEnabled} />
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
      </div>

      {/* Below md the table collapses into scannable work-item cards. */}
      <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)] md:hidden">
        {rows.map((row) => {
          const titleHref = row.display.identity.title.href ?? row.href;
          const contract = row.display.identity.linkedContract;
          const showBlocker = row.blocker !== "—" && row.blocker !== "Blocked";
          return (
            <li key={row.key} className="space-y-1.5 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <WorkTypeIcon type={row.type} label={row.typeLabel} />
                <WorkStatusBadge row={row} />
                <span className="ml-auto shrink-0">
                  <WorkDue row={row} />
                </span>
              </div>
              <Link
                href={titleHref}
                title={row.title}
                className="line-clamp-2 block font-semibold leading-snug text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)]"
              >
                {row.display.identity.title.value}
              </Link>
              <div className="flex flex-wrap items-center gap-y-0.5 text-[11.5px] text-[var(--text-tertiary)]">
                {contract.href ? (
                  <Link
                    href={contract.href}
                    title={contract.value}
                    className="max-w-[15rem] truncate text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-strong)]"
                  >
                    {contract.value}
                  </Link>
                ) : (
                  <span className="max-w-[15rem] truncate">{contract.value}</span>
                )}
                <span className="ui-dot-sep" aria-hidden>
                  ·
                </span>
                <span className={row.ownerLabel === "Unassigned" ? "" : "text-[var(--text-secondary)]"}>
                  {row.ownerLabel}
                </span>
              </div>
              {showBlocker ? (
                <p className="truncate text-[11px] text-[var(--text-tertiary)]" title={row.blocker}>
                  {row.blocker}
                </p>
              ) : null}
              <div className="flex items-center justify-end">
                <WorkReleaseActions row={row} mutationsEnabled={mutationsEnabled} />
              </div>
            </li>
          );
        })}
      </ul>

      {pagination.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_92%,transparent)] px-5 py-3">
          <span className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">
            <span className="tabular-nums text-[var(--text-secondary)]">
              {rangeStart}–{rangeEnd}
            </span>{" "}
            of <span className="tabular-nums text-[var(--text-secondary)]">{pagination.total}</span>
          </span>
          {pagination.totalPages > 1 ? (
            <nav aria-label="Work pages" className="flex items-center gap-1.5">
              <PageLink
                href={pagination.page > 1 ? pageHref(pagination.page - 1) : null}
                label="Previous"
              >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </PageLink>
              <span className="ui-caps-2 px-1 text-[10px] tabular-nums text-[var(--text-tertiary)]">
                Page {pagination.page} / {pagination.totalPages}
              </span>
              <PageLink
                href={pagination.page < pagination.totalPages ? pageHref(pagination.page + 1) : null}
                label="Next"
              >
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </PageLink>
            </nav>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function PageLink({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: ReactNode;
}) {
  const base =
    "inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)] px-1.5 text-[var(--text-secondary)] transition-colors";
  if (!href) {
    return (
      <button
        type="button"
        disabled
        aria-label={`${label} page`}
        className={`${base} cursor-not-allowed opacity-40`}
      >
        {children}
      </button>
    );
  }
  return (
    <Link
      href={href}
      aria-label={`${label} page`}
      className={`${base} hover:border-[color:color-mix(in_oklab,var(--border-strong)_82%,transparent)] hover:text-[var(--text-primary)]`}
    >
      {children}
    </Link>
  );
}

function dueDescriptor(dueInDays: number | null): string | null {
  if (dueInDays == null) return null;
  if (dueInDays < 0) return `Overdue ${Math.abs(dueInDays)}d`;
  if (dueInDays === 0) return "Due today";
  if (dueInDays === 1) return "Due tomorrow";
  return `In ${dueInDays}d`;
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function stringFromForm(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
