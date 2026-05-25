import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, ClipboardPen, FileText } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldReviewWorkspaceActions } from "@/components/contracts/field-review-workspace-actions";
import {
  FIELD_REVIEW_EMPTY_STATE,
  FIELD_REVIEW_EYEBROW,
  FIELD_REVIEW_REQUIRED_CONTENT,
  FIELD_REVIEW_TITLE,
} from "@/lib/field-review/spec-strings";
import { loadFieldReviewWorkspaceModel } from "@/lib/field-review/model";
import { isUuid } from "@/lib/security/validation";

export const metadata = { title: FIELD_REVIEW_TITLE };

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function safeUuid(value: string | undefined): string | null {
  return value && isUuid(value) ? value : null;
}

function displayValue(value: string | null): string {
  return value && value.trim().length > 0 ? value : "Unknown";
}

export default async function ContractReviewQueuePage(props: {
  searchParams: Promise<{ page?: string; contract?: string; field?: string }>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) {
    return (
      <WorkspaceRequiredState
        title="Workspace required for review"
        message="Review field access depends on a workspace context. Refresh this page, then ask a workspace admin to restore your contract access if the review workspace still does not load."
      />
    );
  }

  const model = await loadFieldReviewWorkspaceModel(ctx.admin, ctx.orgId, {
    page: parsePage(searchParams.page),
    contract: safeUuid(searchParams.contract),
    field: safeUuid(searchParams.field),
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
    <div className="ui-page-stack mx-auto max-w-7xl">
      <DashboardPageHeader
        icon={<ClipboardPen className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow={FIELD_REVIEW_EYEBROW}
        title={FIELD_REVIEW_TITLE}
        actions={
          <Link
            href="/contracts"
            className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
          >
            All contracts
            <ArrowUpRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </Link>
        }
      />

      {model.warnings.length > 0 ? (
        <div className="ui-alert-warning" role="status">
          {model.warnings[0]}
        </div>
      ) : null}

      {!activeField || !activeContract ? (
        <section className="ui-card-raised rounded-2xl border p-5 sm:p-6 lg:p-7">
          <EmptyState
            eyebrow="Review clear"
            title={FIELD_REVIEW_EMPTY_STATE}
            copy="When AI-suggested important fields are waiting on human approval, they appear here with source evidence and review actions."
            action={
              <Link href="/contracts" className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px]">
                Open contracts
              </Link>
            }
          />
        </section>
      ) : (
        <section className="ui-card-raised overflow-hidden rounded-2xl border" aria-label="Field review workspace">
          <div className="grid gap-0 border-b border-[var(--border-subtle)] md:grid-cols-4">
            <div className="border-b border-[var(--border-subtle)] px-4 py-4 md:border-b-0 md:border-r sm:px-5">
              <p className="ui-caps-3 text-[var(--text-tertiary)]">Review progress</p>
              <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-[var(--text-primary)]">
                {model.progress.activeFieldPosition}/{model.progress.activeContractPendingFields}
              </p>
            </div>
            <div className="border-b border-[var(--border-subtle)] px-4 py-4 md:border-b-0 md:border-r sm:px-5">
              <p className="ui-caps-3 text-[var(--text-tertiary)]">Backlog</p>
              <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-[var(--text-primary)]">
                {model.progress.fieldsWaiting}
              </p>
            </div>
            <div className="border-b border-[var(--border-subtle)] px-4 py-4 md:border-b-0 md:border-r sm:px-5">
              <p className="ui-caps-3 text-[var(--text-tertiary)]">Contract</p>
              <p className="mt-2 truncate text-[14px] font-semibold text-[var(--text-primary)]">
                {activeContract.title}
              </p>
              <p className="mt-1 truncate text-[12px] text-[var(--text-secondary)]">
                {activeContract.counterparty ?? "No counterparty"} — {activeContract.ownerLabel}
              </p>
            </div>
            <div className="px-4 py-4 sm:px-5">
              <p className="ui-caps-3 text-[var(--text-tertiary)]">Source files</p>
              <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-[var(--text-primary)]">
                {activeContract.files.length}
              </p>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,0.94fr)_minmax(22rem,0.74fr)]">
            <div className="space-y-6 px-4 py-5 sm:px-5 lg:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="ui-caps-3 text-[var(--text-tertiary)]">Field name</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-normal text-[var(--text-primary)]">
                    {activeField.fieldLabel}
                  </h2>
                </div>
                <Link href={activeContract.href} className="ui-btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px]">
                  Open contract
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>

              <dl className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_34%,transparent)] px-4 py-3">
                  <dt className="ui-caps-3 text-[var(--text-tertiary)]">Suggested value</dt>
                  <dd className="mt-2 break-words text-[15px] font-semibold text-[var(--text-primary)]">
                    {displayValue(activeField.suggestedValue)}
                  </dd>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_34%,transparent)] px-4 py-3">
                  <dt className="ui-caps-3 text-[var(--text-tertiary)]">Current approved value</dt>
                  <dd className="mt-2 break-words text-[15px] font-semibold text-[var(--text-primary)]">
                    {activeField.currentApprovedValue ?? "None"}
                  </dd>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_34%,transparent)] px-4 py-3">
                  <dt className="ui-caps-3 text-[var(--text-tertiary)]">Confidence indicator</dt>
                  <dd className="mt-2 font-mono text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">
                    {activeField.confidenceLabel}
                  </dd>
                </div>
              </dl>

              <div className="border-t border-[var(--border-subtle)] pt-5">
                <FieldReviewWorkspaceActions
                  fieldId={activeField.id}
                  fieldLabel={activeField.fieldLabel}
                  suggestedValue={activeField.suggestedValue}
                  canEdit={ctx.role !== "viewer"}
                  needsCitation={activeField.needsCitation}
                  nextHref={model.nextHref}
                  skipHref={model.skipHref}
                />
              </div>
            </div>

            <aside className="border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_28%,transparent)] lg:border-l lg:border-t-0">
              <div className="space-y-5 px-4 py-5 sm:px-5 lg:px-6">
                <section aria-label="Source snippet">
                  <p className="ui-caps-3 text-[var(--text-tertiary)]">Source snippet</p>
                  {activeField.sourceSnippet ? (
                    <blockquote className="ui-source-quote mt-2 max-h-44 overflow-y-auto rounded-r-lg text-[13px] leading-relaxed">
                      <span className="italic text-[var(--text-secondary)]">
                        &ldquo;{activeField.sourceSnippet}&rdquo;
                      </span>
                    </blockquote>
                  ) : (
                    <p className="mt-2 rounded-xl border border-[var(--border-subtle)] px-3 py-3 text-[13px] text-[var(--text-secondary)]">
                      No source snippet is attached to this suggestion.
                    </p>
                  )}
                </section>

                <section aria-label="Document preview">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[var(--accent)]" aria-hidden />
                    <p className="ui-caps-3 text-[var(--text-tertiary)]">Document preview</p>
                  </div>
                  <div className="mt-2 rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_68%,transparent)] px-3 py-3">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                      {documentPreview?.title ?? "Document preview unavailable"}
                    </p>
                    <p className="mt-2 max-h-48 overflow-y-auto text-[13px] leading-relaxed text-[var(--text-secondary)]">
                      {documentPreview?.excerpt ?? "No source text is available for this contract."}
                    </p>
                  </div>
                  {documentPreview?.sourceFileNames.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {documentPreview.sourceFileNames.map((name) => (
                        <span key={name} className="ui-chip max-w-full truncate">
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </section>
              </div>
            </aside>
          </div>

          <div className="border-t border-[var(--border-subtle)] px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="ui-caps-3 text-[var(--text-tertiary)]">Queue</p>
                <span className="ui-chip">
                  <span className="font-mono tabular-nums">{model.queue.length}</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {model.queue.slice(0, 5).map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`ui-btn-secondary inline-flex items-center gap-2 px-3 py-2 text-[12.5px] ${
                      item.id === activeContract.id ? "ring-1 ring-[var(--focus-ring)]" : ""
                    }`}
                  >
                    <span className="max-w-[13rem] truncate">{item.title}</span>
                    <span className="text-[var(--text-tertiary)]">
                      <span className="font-mono tabular-nums">{item.pendingFields}</span> pending
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="sr-only" aria-hidden>
        {FIELD_REVIEW_REQUIRED_CONTENT.join(", ")}
      </div>
    </div>
  );
}
