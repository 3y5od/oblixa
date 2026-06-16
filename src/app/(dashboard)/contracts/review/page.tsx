import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, FileUp, Import } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldReviewWorkspaceActions } from "@/components/contracts/field-review-workspace-actions";
import { ReviewWorkbenchShell } from "@/components/contracts/review/review-workbench-shell";
import { isDateField } from "@/components/contracts/review/review-helpers";
import { ChipPair } from "@/components/ui/chip-pair";
import {
  FIELD_REVIEW_EMPTY_STATE,
  FIELD_REVIEW_EYEBROW,
  FIELD_REVIEW_TITLE,
} from "@/lib/field-review/spec-strings";
import {
  loadFieldReviewWorkspaceModel,
  normalizeReviewQueueFilter,
  REVIEW_QUEUE_FILTERS,
} from "@/lib/field-review/model";
import { isUuid } from "@/lib/security/validation";

export const metadata = { title: FIELD_REVIEW_TITLE };

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function safeUuid(value: string | undefined): string | null {
  return value && isUuid(value) ? value : null;
}

/** One labeled cell in the header workspace-progress strip. The visible label
 *  names the counted object; the accessible label restates it with the unit so
 *  the number is never bare to assistive tech. */
function HeaderMetric({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <span className="flex flex-col gap-1 px-3.5 py-2" aria-label={`${label}: ${value} ${unit}`}>
      <span className="ui-caps-3 text-[9px] leading-none text-[var(--text-tertiary)]">{label}</span>
      <span className="text-[15px] font-semibold leading-none tabular-nums text-[var(--text-primary)]">{value}</span>
    </span>
  );
}

export default async function ContractReviewQueuePage(props: {
  searchParams: Promise<{ page?: string; contract?: string; field?: string; qf?: string; q?: string }>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) {
    return (
      <WorkspaceRequiredState
        title="Workspace required for the review queue"
        message="The review queue depends on a workspace context. Refresh this page, then ask a workspace admin to restore your contract access if this surface still does not load."
      />
    );
  }

  // Queue-rail filter + search (bounded: unknown filter → "all"; search capped).
  const queueFilter = normalizeReviewQueueFilter(searchParams.qf);
  const queueSearch =
    typeof searchParams.q === "string" ? searchParams.q.slice(0, 120).trim() : "";
  const queueIsFiltered = queueFilter !== "all" || queueSearch.length > 0;
  const activeFilterLabel = REVIEW_QUEUE_FILTERS.find((f) => f.key === queueFilter)?.label ?? "All";

  const model = await loadFieldReviewWorkspaceModel(ctx.admin, ctx.orgId, {
    page: parsePage(searchParams.page),
    contract: safeUuid(searchParams.contract),
    field: safeUuid(searchParams.field),
    viewerId: ctx.user.id,
  });

  if (model.totalContracts > 0 && model.page > model.totalPages) {
    const next = new URLSearchParams();
    next.set("page", String(model.totalPages));
    redirect(`/contracts/review?${next.toString()}`);
  }

  const activeField = model.activeField;
  const activeContract = model.activeContract;
  const documentPreview = model.documentPreview;

  return (
    <div className="ui-page-stack-dense mx-auto w-full max-w-7xl">
      {/* Frame: quiet breadcrumb above the page identity, so the surface reads as
          an inspection desk reached from contracts rather than a standalone app. */}
      <div className="flex flex-col gap-2">
        <Link
          href="/contracts"
          className="ui-chip-focus inline-flex max-w-max items-center gap-1.5 rounded text-[12px] font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Back to contracts
        </Link>

        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]">{FIELD_REVIEW_EYEBROW}</p>
            <h1 className="mt-1.5 text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-[2rem]">
              {FIELD_REVIEW_TITLE}
            </h1>
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-snug text-[var(--text-secondary)]">
              Review suggested contract dates, owners, and terms against source text before Oblixa uses them in reminders, tasks, and reports.
            </p>
          </div>
          {activeField ? (
            <div className="flex shrink-0 flex-col items-end gap-1.5 self-end">
              {queueIsFiltered ? (
                <ChipPair primary="Filtered" secondary={queueFilter === "all" ? "Search" : activeFilterLabel} />
              ) : null}
              {/* Workspace-scope progress strip — labels name the counted object so
                  no bare number is left to interpretation (§19). Per-contract
                  "details confirmed" lives in the contract rail to avoid a
                  duplicate count with an ambiguous scope. */}
              <div
                className="inline-flex items-stretch divide-x divide-[var(--border-card)] overflow-hidden rounded-xl border border-[var(--border-card)] bg-[var(--surface-raised)]"
                role="group"
                aria-label="Workspace review progress"
              >
                <HeaderMetric label="Details to review" value={model.progress.fieldsWaiting} unit="details" />
                <HeaderMetric
                  label="Contracts needing review"
                  value={model.progress.contractsWaiting}
                  unit="contracts"
                />
              </div>
            </div>
          ) : null}
        </header>
      </div>

      {model.warnings.length > 0 ? (
        <div className="ui-alert-warning" role="status">
          {model.warnings[0]}
        </div>
      ) : null}

      {!activeField || !activeContract ? (
        <section className="ui-card rounded-2xl border p-6 sm:p-8">
          <EmptyState
            eyebrow="Review clear"
            title={FIELD_REVIEW_EMPTY_STATE}
            copy="Every suggested contract detail has been reviewed. When new uploads or imports add source-backed suggestions, they appear here with evidence and review actions."
            icon={<Check className="h-7 w-7 text-[var(--success-ink)]" strokeWidth={1.85} aria-hidden />}
            action={
              <>
                <Link
                  href="/contracts"
                  className="ui-btn-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px]"
                >
                  Open contracts
                </Link>
                <Link
                  href="/contracts/new"
                  className="ui-btn-secondary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px]"
                >
                  <FileUp className="h-4 w-4" strokeWidth={2} aria-hidden />
                  Upload contract
                </Link>
                <Link
                  href="/contracts/bulk"
                  className="ui-btn-ghost inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px]"
                >
                  <Import className="h-4 w-4" strokeWidth={2} aria-hidden />
                  Import contracts
                </Link>
              </>
            }
          />
        </section>
      ) : (
        <ReviewWorkbenchShell
          model={model}
          activeContract={activeContract}
          activeField={activeField}
          documentPreview={documentPreview}
          viewerId={ctx.user.id}
          queueFilter={queueFilter}
          queueSearch={queueSearch}
          actions={
            <FieldReviewWorkspaceActions
              key={activeField.id}
              fieldId={activeField.id}
              fieldLabel={activeField.fieldLabel}
              suggestedValue={activeField.suggestedValue}
              canEdit={ctx.role !== "viewer"}
              hasValue={!!activeField.suggestedValue?.trim()}
              isDate={isDateField(activeField.fieldName)}
              needsCitation={activeField.needsCitation}
              sourceUnverified={
                activeField.source === "ai" &&
                !!activeField.sourceSnippet &&
                !documentPreview?.snippetLocated
              }
              approveIsPrimary={
                !!activeField.suggestedValue?.trim() &&
                !activeField.needsCitation &&
                (activeField.sourceQuality === "located" || activeField.sourceQuality === "manual")
              }
              nextHref={model.nextHref}
              skipHref={model.skipHref}
              variant="flat"
            />
          }
        />
      )}
    </div>
  );
}
