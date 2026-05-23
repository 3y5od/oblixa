import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ReactNode } from "react";
import { ArrowUpRight, ListTodo, Plus } from "lucide-react";
import { createContractTask } from "@/actions/tasks";
import { WorkReleaseActions } from "@/components/work/work-release-actions";
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
import { buildWorkHref, loadWorkPageModel, WORK_EMPTY_STATE } from "@/lib/work/model";
import {
  WORK_FILTER_LABELS,
  WORK_PAGE_TITLE,
  WORK_PARTIAL_DATA_REASON,
  WORK_PARTIAL_DATA_TITLE,
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
  const canMutate = canEditContracts(ctx.role as OrgRole);
  const createHref = buildWorkHref({ tab: model.activeTab, filters: model.filters, create: true });
  const error = firstParam(searchParams.error);

  return (
    <div className="ui-page-stack mx-auto max-w-7xl">
      <DashboardPageHeader
        icon={<ListTodo className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow={model.eyebrow}
        title={WORK_PAGE_TITLE}
        actions={
          <Link href={createHref} className="ui-btn-primary inline-flex items-center gap-2 px-4 py-2">
            <Plus className="h-4 w-4" aria-hidden />
            {model.primaryCta}
          </Link>
        }
      />

      {model.warnings.length > 0 ? (
        <V10RecoverableState
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

      <section className="ui-card overflow-hidden p-0" aria-labelledby="work-surface-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
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
            <ArrowUpRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
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
          className="px-5"
        />

        <WorkFilters filters={model.filters} model={model} keepCreateOpen={model.create.open} />

        {model.create.open ? (
          <div className="border-y border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_26%,transparent)] px-5 py-4">
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

        <WorkRows rows={model.rows} canMutate={canMutate} />
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
    <form method="get" className="grid gap-3 px-5 py-4 md:grid-cols-5 lg:grid-cols-[1fr_1fr_1.35fr_1fr_1fr_auto_auto]">
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

function WorkRows({ rows, canMutate }: { rows: WorkItemRow[]; canMutate: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <p className="mx-auto max-w-xl text-[1.05rem] font-semibold text-[var(--text-primary)]">
          {WORK_EMPTY_STATE}
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)]">
      {rows.map((row) => (
        <article
          key={row.key}
          className="grid gap-4 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-5 py-4 last:border-b-0 lg:grid-cols-[minmax(12rem,0.9fr)_minmax(0,1.7fr)_minmax(10rem,auto)]"
        >
          <div className="min-w-0 space-y-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
                {row.display.state.type.value}
              </p>
              <Link
                href={row.display.identity.title.href ?? row.href}
                className="mt-1.5 block break-words text-[14px] font-medium leading-snug tracking-[-0.011em] text-[var(--text-primary)] hover:text-[var(--accent-strong)]"
              >
                {row.display.identity.title.value}
              </Link>
            </div>
            <div className="min-w-0">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                {row.display.identity.linkedContract.label}
              </p>
              {row.display.identity.linkedContract.href ? (
                <Link
                  href={row.display.identity.linkedContract.href}
                  className="ui-link mt-1.5 inline-block break-words text-[13px]"
                >
                  {row.display.identity.linkedContract.value}
                </Link>
              ) : (
                <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
                  {row.display.identity.linkedContract.value}
                </p>
              )}
            </div>
          </div>

          <dl className="grid min-w-0 gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
            <WorkFact label={row.display.ownership.owner.label} value={row.display.ownership.owner.value} />
            <WorkFact label={row.display.ownership.dueDate.label}>
              <span className="tabular-nums">{row.display.ownership.dueDate.value}</span>
            </WorkFact>
            <WorkFact label={row.display.ownership.lastUpdate.label}>
              <span className="tabular-nums">{row.display.ownership.lastUpdate.value}</span>
            </WorkFact>
            <WorkFact label={row.display.state.status.label}>
              <StatusBadge status={row.statusTone}>{row.display.state.status.value}</StatusBadge>
            </WorkFact>
            <WorkFact label={row.display.state.type.label} value={row.display.state.type.value} />
            <WorkFact label={row.display.state.blocker.label} value={row.display.state.blocker.value} />
          </dl>

          <div className="min-w-0 lg:justify-self-end">
            <WorkReleaseActions row={row} mutationsEnabled={canMutate} />
          </div>
        </article>
      ))}
    </div>
  );
}

const EMPTY_FACT_VALUES = new Set(["None", "—", ""]);

function WorkFact({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  const isEmpty = children == null && value != null && EMPTY_FACT_VALUES.has(value);
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
        {label}
      </dt>
      <dd
        className={`mt-1.5 break-words text-[13px] leading-snug ${
          isEmpty ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"
        }`}
      >
        {children ?? value}
      </dd>
    </div>
  );
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
