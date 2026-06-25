import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, FileUp, Import, ListChecks } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { FieldReviewWorkspaceActions } from "@/components/contracts/field-review-workspace-actions";
import { ReviewWorkbenchShell } from "@/components/contracts/review/review-workbench-shell";
import { isDateField } from "@/components/contracts/review/review-helpers";
import {
  FIELD_REVIEW_EMPTY_STATE,
  FIELD_REVIEW_TITLE,
} from "@/lib/field-review/spec-strings";
import {
  loadFieldReviewWorkspaceModel,
  normalizeReviewQueueFilter,
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

/** Workspace-scope review summary, rendered as an integrated header meta line
 *  (not a disconnected right-floating figure). Each number names its object type
 *  inline (§19 count semantics) so neither count is ambiguous; the accessible
 *  sentence restates the whole scope. Per-contract progress lives in the contract
 *  band, so this stays scoped to the workspace. */
function ReviewProgressSummary({
  details,
  contracts,
  filtered,
}: {
  details: number;
  contracts: number;
  filtered: boolean;
}) {
  const detailWord = details === 1 ? "detail" : "details";
  const contractWord = contracts === 1 ? "contract" : "contracts";
  // Keep the verb agreeing with the detail count ("details need" / "detail
  // needs") so the token never reads as a singular noun beside a plural verb.
  const needWord = details === 1 ? "needs" : "need";
  return (
    <p
      className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 leading-none"
      aria-label={`${details} suggested contract ${detailWord} ${needWord} confirmation; ${contracts} ${contractWord} in review${filtered ? ", filtered view" : ""}`}
    >
      {/* Two scoped count tokens (dominant number + quiet label), not an
          incidental sentence. No "Review queue:" prefix — the page title already
          names the surface. Each token names its object type (§19). */}
      <span aria-hidden className="inline-flex items-baseline gap-1.5">
        <span className="text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">{details}</span>
        <span className="text-[12.5px] text-[var(--text-secondary)]">
          {`suggested contract ${detailWord} ${needWord} confirmation`}
        </span>
      </span>
      <span aria-hidden className="text-[var(--border-strong)]">·</span>
      <span aria-hidden className="inline-flex items-baseline gap-1.5">
        <span className="text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">{contracts}</span>
        <span className="text-[12.5px] text-[var(--text-secondary)]">{`${contractWord} in review`}</span>
      </span>
      {filtered ? (
        <span className="ml-0.5 inline-flex items-center rounded border border-[var(--border-card)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[11px] font-medium leading-none text-[var(--text-tertiary)]">
          Filtered view
        </span>
      ) : null}
    </p>
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
  const hasWorkbench = !!activeField && !!activeContract;

  return (
    // Full-height workbench (xl): the page becomes a fixed-height flex column
    // sized to main's content box (viewport − app top bar − footer − padding =
    // 100dvh − 156px) and clips its own overflow, so the page never scrolls. The
    // route header is pinned (shrink-0) and the workbench fills the rest with the
    // panes scrolling internally — the title can never slide under the sticky top
    // bar and the action footer is always visible. Below xl it is normal flow.
    <div
      className={`ui-page-stack-dense w-full ${
        hasWorkbench ? "xl:flex xl:h-[calc(100dvh-156px)] xl:flex-col xl:overflow-hidden" : ""
      }`}
    >
      {/* Route header — the canonical DashboardPageHeader (icon medallion +
          eyebrow + title + lead) shared across the contracts surface. A hairline
          divider separates it from the workbench; the workspace-scope review
          progress sits beneath the lead in the title column. */}
      <div className="border-b border-[var(--border-subtle)] pb-4 xl:shrink-0">
        <DashboardPageHeader
          icon={<ListChecks className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
          eyebrow="Contracts"
          title={FIELD_REVIEW_TITLE}
          lead="Review suggested contract dates, owners, and terms against source text before Oblixa uses them in reminders, tasks, and reports."
          belowLead={
            activeField ? (
              <ReviewProgressSummary
                details={model.progress.fieldsWaiting}
                contracts={model.progress.contractsWaiting}
                filtered={queueIsFiltered}
              />
            ) : undefined
          }
        />
      </div>

      {model.warnings.length > 0 ? (
        <div className="ui-alert-warning xl:shrink-0" role="status">
          {model.warnings[0]}
        </div>
      ) : null}

      {!activeField || !activeContract ? (
        <section className="ui-card rounded-lg border p-6 sm:p-8">
          <EmptyState
            eyebrow="Review clear"
            title={FIELD_REVIEW_EMPTY_STATE}
            copy="Every suggested contract detail has been reviewed. When new uploads or imports add source-backed suggestions, they appear here with evidence and review actions."
            icon={<Check className="h-7 w-7 text-[var(--success-ink)]" strokeWidth={1.85} aria-hidden />}
            action={
              <>
                <Link
                  href="/contracts"
                  className="ui-btn-primary inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px]"
                >
                  Open contracts
                </Link>
                <Link
                  href="/contracts/new"
                  className="ui-btn-secondary inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px]"
                >
                  <FileUp className="h-4 w-4" strokeWidth={2} aria-hidden />
                  Upload contract
                </Link>
                <Link
                  href="/contracts/bulk"
                  className="ui-btn-ghost inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px]"
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
                // The "confirm anyway" guard must match the displayed source
                // state, which keys on the *value* being located (sourceQuality
                // "located"), not just the surrounding clause. Gating on the
                // clause (snippetLocated) let a value the pane labels "Source not
                // found" confirm in one click without the warning.
                activeField.source === "ai" &&
                !!activeField.sourceSnippet &&
                !documentPreview?.valueLocated
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
