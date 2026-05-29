import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowRight, ChevronRight, ListTodo, Plus, Sparkles } from "lucide-react";
import { createContractTask } from "@/actions/tasks";
import { WorkReleaseActions } from "@/components/work/work-release-actions";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { TimeChip } from "@/components/ui/time-chip";
import { UiSelect, type UiSelectOption } from "@/components/ui/ui-select";
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
  WORK_PAGE_TITLE,
  WORK_PARTIAL_DATA_REASON,
  WORK_PARTIAL_DATA_TITLE,
  WORK_ROW_LABELS,
} from "@/lib/work/spec-strings";
import type { WorkFilterState, WorkItemRow } from "@/lib/work/types";

export const metadata = { title: WORK_PAGE_TITLE };

type WorkPageSearchParams = {
  tab?: string | string[];
  lens?: string | string[];
  owner?: string | string[];
  due?: string | string[];
  contract?: string | string[];
  status?: string | string[];
  type?: string | string[];
  create?: string | string[];
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
  });
  const workQueueMutationsEnabled = canEditContracts(ctx.role as OrgRole);
  const showDecisionsCta =
    (productSurface.mode === "advanced" || productSurface.mode === "assurance") &&
    !isAdvancedModuleHidden(productSurface, "decisions");
  const createHref = buildWorkHref({ tab: model.activeTab, filters: model.filters, create: true });
  const error = firstParam(searchParams.error);

  return (
    <div className="ui-page-stack mx-auto max-w-7xl">
      <DashboardPageHeader
        icon={<ListTodo className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow={model.eyebrow}
        title={WORK_PAGE_TITLE}
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

      <section
        className="overflow-hidden rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_90%,transparent)] bg-[var(--surface-raised)] shadow-[var(--shadow-1)]"
        aria-labelledby="work-surface-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <h2 id="work-surface-title" className="sr-only">
              {model.title}
            </h2>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              Active work
            </p>
            <span className="ui-chip">
              <span className="font-mono tabular-nums">{model.totalVisibleRows}</span>
            </span>
          </div>
          <Link href="/contracts" className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
            All contracts
            <ArrowRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </Link>
        </div>

        <UiTabs
          ariaLabel="Work tabs"
          items={model.tabs.map((tab) => ({
            href: tab.href,
            label: tab.label,
            active: tab.active,
            count: tab.count,
          }))}
          className="px-4"
        />

        <WorkFilters filters={model.filters} model={model} keepCreateOpen={model.create.open} />

        {model.create.open ? (
          <div className="border-y border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_26%,transparent)] px-4 py-4">
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

        <WorkTable rows={model.rows} mutationsEnabled={workQueueMutationsEnabled} />
      </section>
    </div>
  );
}

function WorkFilters({
  filters,
  model,
  keepCreateOpen,
}: {
  filters: WorkFilterState;
  model: Awaited<ReturnType<typeof loadWorkPageModel>>;
  keepCreateOpen: boolean;
}) {
  const hasFilters = hasActiveFilters(filters);

  return (
    <form method="get" className="grid gap-3 px-4 py-4 md:grid-cols-5 lg:grid-cols-[1fr_1fr_1.35fr_1fr_1fr_auto_auto]">
      {model.activeTab !== "all" ? <input type="hidden" name="tab" value={model.activeTab} /> : null}
      {keepCreateOpen ? <input type="hidden" name="create" value="1" /> : null}
      <FilterSelect name="owner" label={WORK_FILTER_LABELS.owner} value={filters.owner} options={model.filterOptions.owners} />
      <FilterSelect name="due" label={WORK_FILTER_LABELS.dueDate} value={filters.dueDate} options={model.filterOptions.dueDates} />
      <FilterSelect name="contract" label={WORK_FILTER_LABELS.contract} value={filters.contract} options={model.filterOptions.contracts} />
      <FilterSelect name="status" label={WORK_FILTER_LABELS.status} value={filters.status} options={model.filterOptions.statuses} />
      <FilterSelect name="type" label={WORK_FILTER_LABELS.type} value={filters.type} options={model.filterOptions.types} />
      <div className="flex items-end">
        <button type="submit" className="ui-btn-secondary h-10 w-full px-4">
          Apply
        </button>
      </div>
      {hasFilters ? (
        <div className="flex items-end">
          <Link
            href={buildWorkHref({ tab: model.activeTab, create: keepCreateOpen })}
            className="ui-btn-ghost h-10 px-3"
          >
            Clear filters
          </Link>
        </div>
      ) : null}
    </form>
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
        placeholder={uiOptions[0]?.label ?? `Any ${label.toLowerCase()}`}
        ariaLabel={label}
      />
    </div>
  );
}

function WorkTable({
  rows,
  mutationsEnabled,
}: {
  rows: WorkItemRow[];
  mutationsEnabled: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-4 py-12 text-center">
        <p className="mx-auto max-w-xl text-[1.05rem] font-semibold text-[var(--text-primary)]">
          {WORK_EMPTY_STATE}
        </p>
      </div>
    );
  }

  const headerCellClass =
    "px-3 py-1.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)] whitespace-nowrap";
  const bodyCellClass = "px-3 py-2.5 align-middle";

  return (
    <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)]">
      <table className="w-full border-collapse text-[12.5px]" aria-label="Work items in this workspace">
        <thead className="bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--surface-raised))]">
          <tr className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)]">
            <th scope="col" className={`${headerCellClass} w-full pl-4 pr-3`}>
              Work item
            </th>
            <th scope="col" className={`${headerCellClass} hidden md:table-cell`}>
              {WORK_ROW_LABELS.owner}
            </th>
            <th scope="col" className={headerCellClass}>
              {WORK_ROW_LABELS.dueDate}
            </th>
            <th scope="col" className={headerCellClass}>
              {WORK_ROW_LABELS.status}
            </th>
            <th scope="col" className={`${headerCellClass} hidden lg:table-cell`}>
              {WORK_ROW_LABELS.lastUpdate}
            </th>
            <th scope="col" className="py-1.5 pl-3 pr-4">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            // Risk styling reads from the freshly derived dueState (see
            // deriveDueMeta) rather than the read model's stored due_state,
            // which goes stale and can leave an overdue row untoned.
            const atRisk = row.dueState === "overdue" || row.status === "blocked";
            const dueInk =
              row.dueState === "overdue"
                ? "var(--danger-ink)"
                : row.dueState === "due_today" || row.dueState === "due_soon"
                  ? "var(--warning-ink)"
                  : "var(--text-primary)";
            const descriptor = dueDescriptor(row.dueInDays);
            const titleHref = row.display.identity.title.href ?? row.href;
            return (
              <tr key={row.key} className="ui-table-row group">
                <td
                  className={`${bodyCellClass} pl-4 pr-3`}
                  style={
                    atRisk
                      ? {
                          boxShadow:
                            "inset 3px 0 0 0 color-mix(in oklab, var(--danger-ink) 60%, transparent)",
                        }
                      : undefined
                  }
                >
                  <div className="min-w-0">
                    {/* Neutral metadata, not status — stays tertiary, not accent. */}
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      {row.typeLabel}
                    </p>
                    <Link
                      href={titleHref}
                      title={row.title}
                      className="mt-0.5 block max-w-[28rem] truncate font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)]"
                    >
                      {row.display.identity.title.value}
                    </Link>
                    {row.display.identity.linkedContract.href ? (
                      <Link
                        href={row.display.identity.linkedContract.href}
                        title={row.display.identity.linkedContract.value}
                        className="mt-0.5 block max-w-[28rem] truncate text-[11.5px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
                      >
                        {row.display.identity.linkedContract.value}
                      </Link>
                    ) : (
                      <span className="mt-0.5 block text-[11.5px] text-[var(--text-tertiary)]">
                        {row.display.identity.linkedContract.value}
                      </span>
                    )}
                  </div>
                </td>
                <td className={`${bodyCellClass} hidden md:table-cell`}>
                  <span
                    className={
                      row.ownerLabel === "Unassigned"
                        ? "text-[var(--text-tertiary)]"
                        : "text-[var(--text-primary)]"
                    }
                  >
                    {row.ownerLabel}
                  </span>
                </td>
                <td className={`${bodyCellClass} tabular-nums`}>
                  {row.dueAt ? (
                    <div className="min-w-0">
                      <span className="block font-medium" style={{ color: dueInk }}>
                        {formatDueCompact(row.dueAt)}
                      </span>
                      {descriptor ? (
                        <span className="block text-[11px] text-[var(--text-tertiary)]">
                          {descriptor}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-[var(--text-tertiary)]">—</span>
                  )}
                </td>
                <td className={bodyCellClass}>
                  <div className="flex flex-col gap-1">
                    {/* Dot + halo gives a non-color shape cue so status isn't tone alone (§7.7). */}
                    <StatusBadge status={row.statusTone} className="gap-1.5 self-start">
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full bg-current"
                        style={{
                          boxShadow:
                            "0 0 0 2px color-mix(in oklab, currentColor 22%, transparent)",
                        }}
                      />
                      {row.statusLabel}
                    </StatusBadge>
                    {/* Blocker reason sits under the badge so the cause travels with the state. */}
                    {row.blocker !== "—" ? (
                      <span className="max-w-[18rem] text-[11px] leading-snug text-[var(--text-tertiary)]">
                        {row.blocker}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td
                  className={`${bodyCellClass} hidden tabular-nums lg:table-cell`}
                  suppressHydrationWarning
                >
                  {row.lastUpdateAt ? (
                    <TimeChip date={row.lastUpdateAt} />
                  ) : (
                    <span className="text-[var(--text-tertiary)]">—</span>
                  )}
                </td>
                <td className={`${bodyCellClass} pl-3 pr-4`}>
                  <WorkReleaseActions row={row} mutationsEnabled={mutationsEnabled} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function dueDescriptor(dueInDays: number | null): string | null {
  if (dueInDays == null) return null;
  if (dueInDays < 0) return `Overdue ${Math.abs(dueInDays)}d`;
  if (dueInDays === 0) return "Due today";
  if (dueInDays === 1) return "Due tomorrow";
  return `In ${dueInDays}d`;
}

function formatDueCompact(dueAt: string): string {
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return dueAt;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function hasActiveFilters(filters: WorkFilterState) {
  return Boolean(filters.owner || filters.dueDate || filters.contract || filters.status || filters.type);
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function stringFromForm(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
