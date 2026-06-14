import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ChevronRight,
  ListTodo,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { createContractTask } from "@/actions/tasks";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { UiSelect } from "@/components/ui/ui-select";
import { UiTabs } from "@/components/ui/ui-tabs";
import { RecoverableState } from "@/components/ui/recoverable-state";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getAuthContext } from "@/lib/supabase/server";
import { canEditContracts } from "@/lib/permissions";
import type { OrgRole } from "@/lib/types";
import type { WorkspaceRole } from "@/lib/navigation";
import { isAdvancedModuleHidden, loadProductSurfaceContext } from "@/lib/product-surface";
import { buildWorkHref, loadWorkPageModel } from "@/lib/work/model";
import {
  WORK_FILTER_LABELS,
  WORK_LEAD,
  WORK_PAGE_TITLE,
  WORK_PARTIAL_DATA_REASON,
  WORK_PARTIAL_DATA_TITLE,
} from "@/lib/work/spec-strings";
import type { WorkFilterState, WorkOption } from "@/lib/work/types";
import { WorkFilterForm } from "./work-filter-form";
import { WorkTable } from "./work-table";

export const metadata = { title: WORK_PAGE_TITLE };

type WorkModel = Awaited<ReturnType<typeof loadWorkPageModel>>;

// Quiet, neutral type glyphs for the Work-item medallion. Tone stays neutral —
// work type is metadata, not status, so it must never compete with the status
// column for color (§10.2).
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
    <div className="ui-page-stack mx-auto w-full min-w-0 max-w-[1440px] overflow-x-clip">
      <DashboardPageHeader
        icon={<ListTodo className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        density="compact"
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
          accessibleName="Task partial data state"
          nextActionLabel="Review workspace health"
          nextAction={
            <Link href="/settings/health" className="ui-link">
              Review workspace health
            </Link>
          }
        />
      ) : null}

      <section className="ui-table-shell min-w-0 max-w-full [contain:inline-size]" aria-labelledby="work-surface-title">
        <WorkQueueOverview model={model} />
        <WorkViewTabs model={model} />

        <WorkFilters model={model} keepCreateOpen={model.create.open} />

        {model.create.open ? (
          <div className="border-y border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_26%,transparent)] px-5 py-3">
            <form action={createWorkItemAction} className="grid gap-3 lg:grid-cols-[1.25fr_1.35fr_0.95fr_0.8fr_0.95fr]">
              <div className="space-y-2">
                <p className="ui-caps-2 text-[var(--text-tertiary)]">{model.primaryCta}</p>
                <label className="ui-label-caps" htmlFor="work-create-contract">
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
                <label className="ui-label-caps" htmlFor="work-create-title">
                  Title
                </label>
                <input id="work-create-title" name="title" required className="ui-input w-full" placeholder="e.g., Confirm renewal notice owner" />
                {error ? <p className="text-[12.5px] text-[var(--danger-ink)]">{error}</p> : null}
              </div>
              <div className="space-y-2">
                <label className="ui-label-caps" htmlFor="work-create-owner">
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
                <label className="ui-label-caps" htmlFor="work-create-due">
                  Due date
                </label>
                <input id="work-create-due" name="dueDate" type="date" className="ui-input w-full" />
              </div>
              <div className="space-y-2">
                <label className="ui-label-caps" htmlFor="work-create-type">
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
                <label className="ui-label-caps" htmlFor="work-create-details">
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

function WorkQueueOverview({ model }: { model: WorkModel }) {
  return (
    <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="work-surface-title" className="ui-caps-2 text-[var(--text-secondary)]">
              Active tasks
            </h2>
            <span className="inline-flex items-center rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_82%,transparent)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
              <span className="tabular-nums">{model.totalVisibleRows}</span>
              <span className="ml-1">tasks</span>
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Condition filters</span>
            <WorkQuickFilters model={model} />
          </div>
          <p className="mt-1.5 max-w-[52rem] text-[12.5px] leading-5 text-[var(--text-secondary)]">
            Active tasks are open follow-up items linked to signed contracts. Condition filters show matching task
            counts and narrow the table when selected.
          </p>
          <p
            className="mt-1 max-w-[62rem] text-[12px] leading-5 text-[var(--text-tertiary)]"
            aria-label="Condition filter definitions"
          >
            <span className="font-semibold text-[var(--text-secondary)]">Cannot proceed:</span> answer,
            approval, file, or owner is missing.{" "}
            <span className="font-semibold text-[var(--text-secondary)]">Past due:</span> due date has
            passed.{" "}
            <span className="font-semibold text-[var(--text-secondary)]">Due within 7 days:</span> due
            today or this week.{" "}
            <span className="font-semibold text-[var(--text-secondary)]">Unassigned:</span> no owner is
            assigned.
          </p>
        </div>
        <Link
          href="/contracts"
          className="ui-btn-secondary inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
        >
          View contracts
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function WorkViewTabs({ model }: { model: WorkModel }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 pt-3">
        <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Views</span>
        <span className="text-[12px] text-[var(--text-tertiary)]">
          Choose the row category shown below. Counts reflect the active filters.
        </span>
      </div>
      <UiTabs
        ariaLabel="Task table views"
        items={model.tabs.map((tab) => ({
          href: tab.href,
          label: tab.label,
          active: tab.active,
          count: tab.count,
          // A zero on a needs-action tab (Past due / Cannot proceed) is the desired
          // outcome — render it all-clear green instead of a ghosted grey.
          countTone:
            (tab.key === "overdue" || tab.key === "blocked") && tab.count === 0
              ? ("success" as const)
              : undefined,
        }))}
        className="px-5"
      />
    </div>
  );
}

// Condition filters: one-click jumps into task subsets with explicit operational
// conditions. They sit above the views because they answer a different question:
// "which active tasks have a condition that needs attention?"
function WorkQuickFilters({ model }: { model: WorkModel }) {
  const { summary, filters, activeTab, sort } = model;
  const items: {
    key: string;
    label: string;
    chipLabel: string;
    description: string;
    value: number;
    tone?: "danger" | "warning";
    active: boolean;
    href: string;
  }[] = [
    {
      key: "blocked",
      label: "Cannot proceed",
      chipLabel: "Cannot proceed",
      description: "Answer, approval, file, or owner is missing.",
      value: summary.blocked,
      tone: "danger",
      active: activeTab === "blocked",
      href: buildWorkHref({ tab: activeTab === "blocked" ? "all" : "blocked", sort }),
    },
    {
      key: "overdue",
      label: "Past due",
      chipLabel: "Past due",
      description: "Due date has passed.",
      value: summary.overdue,
      tone: "danger",
      active: activeTab === "overdue",
      href: buildWorkHref({ tab: activeTab === "overdue" ? "all" : "overdue", sort }),
    },
    {
      key: "dueSoon",
      label: "Due within 7 days",
      chipLabel: "Due within 7 days",
      description: "Due today or within the next 7 days.",
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
      chipLabel: "Unassigned",
      description: "No owner is assigned.",
      value: summary.unassigned,
      active: filters.owner === "unassigned",
      href: buildWorkHref({
        tab: "all",
        filters: { ...WORK_QUICK_FILTER_EMPTY, owner: filters.owner === "unassigned" ? "" : "unassigned" },
        sort,
      }),
    },
  ];
  if (items.every((item) => item.value === 0)) {
    return (
      <span className="text-[12px] font-medium text-[var(--success-ink)]">
        No condition filters need attention.
      </span>
    );
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="Task condition filters">
      {items.map(({ key, ...chip }) => (
        <WorkQuickFilterChip key={key} {...chip} />
      ))}
    </div>
  );
}

function WorkQuickFilterChip({
  label,
  chipLabel,
  description,
  value,
  tone,
  active,
  href,
}: {
  label: string;
  chipLabel: string;
  description: string;
  value: number;
  tone?: "danger" | "warning";
  active: boolean;
  href: string;
}) {
  if (value === 0) {
    return null;
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
      aria-label={`${active ? "Clear" : "Filter by"} ${label.toLowerCase()} — ${value} matching tasks. ${description}`}
      title={description}
      className="ui-chip-focus inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase leading-none tracking-[0.12em] transition-[background-color,border-color,box-shadow,transform] hover:brightness-[1.04] active:translate-y-px"
      style={{
        borderColor: `color-mix(in oklab, ${ink} ${active ? "55%" : "30%"}, var(--border-card))`,
        background: `color-mix(in oklab, ${ink} ${active ? "22%" : "12%"}, var(--surface-raised))`,
        color: ink,
        boxShadow: active ? `inset 0 0 0 1px color-mix(in oklab, ${ink} 38%, transparent)` : undefined,
      }}
    >
      <span>{chipLabel}</span>
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
      <WorkFilterForm
        filters={filters}
        filterOptions={model.filterOptions}
        activeTab={model.activeTab}
        sort={model.sort}
        sortOptions={model.sortOptions}
        keepCreateOpen={keepCreateOpen}
        activeFilterCount={chips.length}
        clearFiltersHref={buildWorkHref({ tab: model.activeTab, sort: model.sort, create: keepCreateOpen })}
      />

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

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function stringFromForm(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
