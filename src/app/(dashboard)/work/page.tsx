import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ChevronRight, ListTodo, Plus, Sparkles } from "lucide-react";
import { createContractTask } from "@/actions/tasks";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { RecoverableState } from "@/components/ui/recoverable-state";
import { canEditContracts } from "@/lib/permissions";
import { isAdvancedModuleHidden, loadProductSurfaceContext } from "@/lib/product-surface";
import { getAuthContext } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import type { OrgRole } from "@/lib/types";
import { buildWorkHref, loadWorkPageModel } from "@/lib/work/model";
import {
  WORK_LEAD,
  WORK_PAGE_TITLE,
  WORK_PARTIAL_DATA_REASON,
  WORK_PARTIAL_DATA_TITLE,
} from "@/lib/work/spec-strings";
import { ActiveWorkFilterChipList, activeFilterChips } from "./work-filter-chips";
import { WorkCreateForm } from "./work-create-form";
import { WorkFilterForm } from "./work-filter-form";
import { WorkQueueOverview, WorkViewTabs } from "./work-queue-surface";
import { WorkTable } from "./work-table";

export const metadata = { title: WORK_PAGE_TITLE };

type WorkModel = Awaited<ReturnType<typeof loadWorkPageModel>>;

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
  const ctx = await getWorkContext();
  if (!ctx) return <WorkspaceRequiredState />;

  const model = await loadWorkPageModel(ctx.admin, ctx.orgId, {
    userId: ctx.userId,
    role: ctx.role,
    workspaceMode: ctx.workspaceMode,
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
    (ctx.workspaceMode === "advanced" || ctx.workspaceMode === "assurance") &&
    !isAdvancedModuleHidden(ctx.productSurface, "decisions");
  const createHref = buildWorkHref({ tab: model.activeTab, filters: model.filters, create: true });
  const error = firstParam(searchParams.error);
  const hasAnyFilter = Boolean(
    model.filters.owner ||
      model.filters.dueDate ||
      model.filters.contract ||
      model.filters.status ||
      model.filters.type
  );
  const isFilteredView = hasAnyFilter || model.activeTab !== "all";

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
          <WorkCreateForm model={model} error={error} action={createWorkItemAction} />
        ) : null}

        <WorkPaginationSummary model={model} />

        <WorkTable
          rows={model.rows}
          mutationsEnabled={workQueueMutationsEnabled}
          pagination={model.pagination}
          pageHref={(page) =>
            buildWorkHref({ tab: model.activeTab, filters: model.filters, sort: model.sort, page })
          }
          isFiltered={isFilteredView}
          clearHref={buildWorkHref({})}
        />
      </section>
    </div>
  );
}

async function getWorkContext() {
  const authContext = await getAuthContext();
  if (!authContext) {
    return null;
  }

  const productSurface = await loadProductSurfaceContext(
    authContext.admin,
    authContext.orgId,
    authContext.role as WorkspaceRole
  );

  return {
    admin: authContext.admin,
    orgId: authContext.orgId,
    role: authContext.role,
    userId: authContext.user.id,
    productSurface,
    workspaceMode: productSurface.mode,
  };
}

function WorkFilters({
  model,
  keepCreateOpen,
}: {
  model: WorkModel;
  keepCreateOpen: boolean;
}) {
  const chips = activeFilterChips(model);

  return (
    <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3.5">
      <WorkFilterForm
        filters={model.filters}
        filterOptions={model.filterOptions}
        activeTab={model.activeTab}
        sort={model.sort}
        sortOptions={model.sortOptions}
        keepCreateOpen={keepCreateOpen}
        activeFilterCount={chips.length}
        clearFiltersHref={buildWorkHref({ tab: model.activeTab, sort: model.sort, create: keepCreateOpen })}
      />
      <ActiveWorkFilterChipList model={model} />
    </div>
  );
}

function WorkPaginationSummary({ model }: { model: WorkModel }) {
  if (model.pagination.total === 0) {
    return null;
  }

  return (
    <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-2">
      <p className="text-[12px] text-[var(--text-tertiary)]">
        Showing{" "}
        <span className="font-semibold tabular-nums text-[var(--text-secondary)]">
          {model.pagination.total}
        </span>{" "}
        {model.pagination.total === 1 ? "active task" : "active tasks"}
        {model.visibleContractCount > 0 ? (
          <>
            {" "}
            across{" "}
            <span className="font-semibold tabular-nums text-[var(--text-secondary)]">
              {model.visibleContractCount}
            </span>{" "}
            {model.visibleContractCount === 1 ? "contract" : "contracts"}
          </>
        ) : null}
        .
      </p>
    </div>
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
