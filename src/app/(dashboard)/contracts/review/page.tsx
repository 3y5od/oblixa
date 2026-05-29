import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, ClipboardCheck, FileText, Gauge, ListChecks } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldReviewWorkspaceActions } from "@/components/contracts/field-review-workspace-actions";
import { RatioChip } from "@/components/ui/ratio-chip";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import type { StatTone } from "@/components/ui/stat-cell";
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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:T[\d:.Z+\-]+)?$/;

function formatSuggestedValue(value: string | null): string {
  if (!value || value.trim().length === 0) return "Unknown";
  const trimmed = value.trim();
  if (ISO_DATE_RE.test(trimmed)) {
    const parsed = new Date(trimmed.length === 10 ? `${trimmed}T00:00:00Z` : trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
    }
  }
  return trimmed;
}

interface ConfidenceMeta {
  pct: number | null;
  label: string;
  status: SemanticStatus;
  tone: StatTone;
  color: string;
}

function confidenceMeta(confidence: number | null): ConfidenceMeta {
  if (confidence == null || Number.isNaN(confidence)) {
    return { pct: null, label: "No signal", status: "empty", tone: "neutral", color: "var(--text-tertiary)" };
  }
  const pct = Math.round(Math.min(1, Math.max(0, confidence)) * 100);
  if (confidence >= 0.85) {
    return { pct, label: "High", status: "healthy", tone: "success", color: "var(--success-ink)" };
  }
  if (confidence >= 0.6) {
    return { pct, label: "Medium", status: "info", tone: "neutral", color: "var(--accent-strong)" };
  }
  return { pct, label: "Low", status: "critical", tone: "danger", color: "var(--danger-ink)" };
}

function sanitizeSnippet(value: string): string {
  return value.replace(/\s+/g, " ").trim().replace(/[.\s]+$/u, "");
}

function renderExcerptWithHighlight(excerpt: string, snippet: string | null): ReactNode {
  if (!snippet) return excerpt;
  const needle = snippet.trim().slice(0, 80).toLowerCase();
  if (needle.length === 0) return excerpt;
  const lower = excerpt.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx === -1) return excerpt;
  return (
    <>
      {excerpt.slice(0, idx)}
      <span className="sr-only">snippet match start </span>
      <mark
        aria-hidden
        className="rounded-[3px] bg-[color:color-mix(in_oklab,var(--accent-soft)_55%,transparent)] px-0.5 text-[var(--text-primary)]"
      >
        {excerpt.slice(idx, idx + needle.length)}
      </mark>
      <span className="sr-only">{excerpt.slice(idx, idx + needle.length)} snippet match end </span>
      {excerpt.slice(idx + needle.length)}
    </>
  );
}

/** Label/value row for the right-rail Contract block — keeps counterparty and
 *  owner near the evidence instead of crowding the decision column (§13). */
function ContractMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="ui-caps-3 shrink-0 text-[10px] text-[var(--text-tertiary)]">{label}</span>
      <span className="min-w-0 truncate text-right text-[12.5px] font-medium text-[var(--text-secondary)]">
        {value}
      </span>
    </div>
  );
}

/** Thin throughput stat for the context bar: caps label + tabular value + caps
 *  unit. Structured (not a floating number) and small enough to read as chrome. */
function ThroughputStat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">{label}</span>
      <span className="text-[15px] font-semibold leading-none tabular-nums text-[var(--text-primary)]">
        {value}
      </span>
      <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">{unit}</span>
    </div>
  );
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
    <div className="ui-page-stack mx-auto w-full max-w-7xl">
      <Link
        href="/contracts"
        className="inline-flex max-w-max items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={2} aria-hidden />
        Back to contracts
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            aria-hidden
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
          >
            <ClipboardCheck className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />
          </span>
          <div className="min-w-0">
            <p>
              <span className="landing-eyebrow-dot text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                {FIELD_REVIEW_EYEBROW}
              </span>
            </p>
            <h1 className="mt-1 text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-[2rem]">
              {FIELD_REVIEW_TITLE}
            </h1>
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-snug text-[var(--text-secondary)]">
              Confirm each AI-suggested field against its source. Approved values become trusted
              data for deadlines, work, and reports.
            </p>
          </div>
        </div>
      </header>

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
            copy="When AI-suggested important fields are waiting on human approval, they appear here with source evidence and review actions."
            action={
              <Link
                href="/contracts"
                className="ui-btn-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px]"
              >
                Open contracts
              </Link>
            }
          />
        </section>
      ) : (
        <section className="ui-card-quiet overflow-hidden" aria-label="Field review workspace">
          {(() => {
            const totalFieldsForContract = model.progress.activeContractTotalFields;
            const pendingForContract = model.progress.activeContractPendingFields;
            const completedForContract = Math.max(0, totalFieldsForContract - pendingForContract);
            const progressPct = Math.round(
              (totalFieldsForContract > 0 ? completedForContract / totalFieldsForContract : 0) * 100
            );
            const allReviewed = totalFieldsForContract > 0 && completedForContract >= totalFieldsForContract;
            const sourceFileCount = activeContract.files.length;
            const noSources = sourceFileCount === 0;
            const targetFilename = documentPreview?.sourceFileNames[0];
            const conf = confidenceMeta(activeField.confidence);
            const showQueue =
              model.queue.length > 1 ||
              (model.queue.length === 1 && model.queue[0]!.id !== activeContract.id);

            return (
              <>
                {/* Throughput context bar — calm app chrome, not a metric dashboard.
                    Confidence moved beside the suggested value it describes (§5). */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Review progress</span>
                    <RatioChip
                      numerator={completedForContract}
                      denominator={totalFieldsForContract}
                      suffix="reviewed"
                      tone={allReviewed ? "success" : "neutral"}
                    />
                    <span
                      className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,var(--surface-muted))] sm:block"
                      role="progressbar"
                      aria-valuenow={progressPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuetext={`${progressPct}% of this contract's fields reviewed`}
                      aria-label={`Review progress: ${completedForContract} of ${totalFieldsForContract} fields reviewed`}
                    >
                      <span
                        aria-hidden
                        className="block h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${progressPct}%` }}
                      />
                    </span>
                  </div>
                  <div className="flex items-center gap-x-5 gap-y-1.5 sm:ml-auto">
                    <ThroughputStat
                      label="Backlog"
                      value={model.progress.fieldsWaiting}
                      unit={model.progress.fieldsWaiting === 1 ? "field" : "fields"}
                    />
                    <ThroughputStat
                      label="Queue"
                      value={model.progress.contractsWaiting}
                      unit={model.progress.contractsWaiting === 1 ? "contract" : "contracts"}
                    />
                  </div>
                </div>

                {/* Two-column body — field decision (left) + source evidence rail (right) */}
                <div className="grid lg:grid-cols-[minmax(0,0.94fr)_minmax(22rem,0.74fr)]">
                  {/* LEFT — the decision surface */}
                  <div className="space-y-5 px-4 py-5 sm:px-5 lg:px-6">
                    <div>
                      <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Field name</p>
                      <h2 className="mt-1 text-[1.25rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]">
                        {activeField.fieldLabel}
                      </h2>
                      <p className="mt-2 truncate text-[13.5px] font-medium text-[var(--text-secondary)]">
                        {activeContract.title}
                      </p>
                    </div>

                    {/* Decision values — suggested (focal) vs current approved */}
                    <dl className="grid gap-4 sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Suggested value</dt>
                        <dd className="mt-1.5 break-words text-[2rem] font-semibold leading-none tracking-[-0.02em] text-[var(--text-primary)]">
                          {formatSuggestedValue(activeField.suggestedValue)}
                        </dd>
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                          <span className="inline-flex items-center rounded-full border border-[color:color-mix(in_oklab,var(--accent)_12%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_10%,var(--surface-raised))] px-2 py-0.5 ui-caps-3 text-[10px] text-[var(--text-secondary)]">
                            {activeField.source === "ai" ? "AI-suggested" : "Manual entry"}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Confidence indicator</span>
                            <StatusBadge status={conf.status} className="inline-flex items-center gap-1">
                              <Gauge className="h-3 w-3" strokeWidth={2} aria-hidden />
                              {conf.label}
                            </StatusBadge>
                            {conf.pct != null ? (
                              <span className="text-[12px] font-semibold tabular-nums text-[var(--text-secondary)]">
                                {conf.pct}%
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <dt className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Current approved value</dt>
                        {activeField.currentApprovedValue ? (
                          <>
                            <dd className="mt-1.5 break-words text-[1.5rem] font-semibold leading-none tracking-[-0.01em] text-[var(--text-primary)]">
                              {formatSuggestedValue(activeField.currentApprovedValue)}
                            </dd>
                            <div className="mt-2.5">
                              <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">
                                Most recent approval
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <dd
                              className="mt-1.5 text-[1.5rem] font-semibold leading-none text-[var(--text-tertiary)]"
                              aria-label="No value"
                            >
                              &mdash;
                            </dd>
                            <div className="mt-2.5">
                              <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">
                                No prior approval
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </dl>

                    {/* Source snippet — functional evidence (not a pull-quote) */}
                    <section aria-label="Source snippet">
                      <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Source snippet</p>
                      {activeField.sourceSnippet ? (
                        <blockquote className="mt-1.5 border-l-2 border-[color:color-mix(in_oklab,var(--accent)_45%,var(--border-subtle))] pl-3">
                          <p className="max-h-28 overflow-y-auto text-[13px] italic leading-relaxed text-[var(--text-secondary)]">
                            {sanitizeSnippet(activeField.sourceSnippet)}
                          </p>
                        </blockquote>
                      ) : (
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="text-[1rem] font-semibold leading-none text-[var(--text-tertiary)]" aria-hidden>
                            &mdash;
                          </span>
                          <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">
                            No source text on this suggestion
                          </span>
                        </div>
                      )}
                    </section>

                    {/* Review decisions */}
                    <div className="pt-1">
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

                  {/* RIGHT — source evidence rail */}
                  <div className="space-y-6 border-t border-[var(--border-subtle)] px-4 py-5 sm:px-5 lg:border-l lg:border-t-0 lg:px-6">
                    <section aria-label="Document preview" id="field-review-document-preview">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                        <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Document preview</p>
                        {noSources ? (
                          <span className="ui-caps-3 inline-flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
                            <FileText className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                            Extracted text &middot; no file
                          </span>
                        ) : (
                          <span className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                            <FileText className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="truncate font-mono">
                              {targetFilename ?? `${sourceFileCount} ${sourceFileCount === 1 ? "file" : "files"}`}
                            </span>
                            {documentPreview && documentPreview.sourceFileNames.length > 1 ? (
                              <span className="shrink-0 tabular-nums">
                                +{documentPreview.sourceFileNames.length - 1}
                              </span>
                            ) : null}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 max-h-[22rem] overflow-y-auto rounded-md bg-[color:color-mix(in_oklab,var(--surface-muted)_30%,var(--surface))] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--text-primary)] ring-1 ring-inset ring-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)]">
                        {documentPreview?.excerpt
                          ? renderExcerptWithHighlight(documentPreview.excerpt, activeField.sourceSnippet)
                          : "No source text is available for this contract."}
                      </div>
                    </section>

                    <section aria-label="Contract">
                      <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Contract</p>
                      <div className="mt-2 space-y-1.5 rounded-md bg-[color:color-mix(in_oklab,var(--surface-muted)_24%,var(--surface))] px-3 py-2.5 ring-1 ring-inset ring-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)]">
                        <ContractMetaRow
                          label="Counterparty"
                          value={activeContract.counterparty ?? "No counterparty"}
                        />
                        <ContractMetaRow label="Owner" value={activeContract.ownerLabel} />
                      </div>
                      <Link
                        href={activeContract.href}
                        className="ui-btn-secondary mt-2.5 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium"
                      >
                        Open contract
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </section>

                    {showQueue ? (
                      <section aria-label="Review queue">
                        <div className="flex items-center gap-2">
                          <ListChecks className="h-3.5 w-3.5 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
                          <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Queue</p>
                          <span className="font-mono text-[10.5px] tabular-nums text-[var(--text-tertiary)]">
                            {model.queue.length}
                          </span>
                        </div>
                        <ul className="mt-2 space-y-1">
                          {model.queue.slice(0, 6).map((item) => {
                            const isActive = item.id === activeContract.id;
                            const pendingTone =
                              item.pendingFields >= 3
                                ? "text-[var(--warning-ink)]"
                                : "text-[var(--text-tertiary)]";
                            return (
                              <li key={item.id}>
                                <Link
                                  href={item.href}
                                  aria-current={isActive ? "page" : undefined}
                                  className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-[12.5px] transition-colors ${
                                    isActive
                                      ? "border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))]"
                                      : "border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))]"
                                  }`}
                                >
                                  <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">
                                    {item.title}
                                  </span>
                                  <span className={`shrink-0 ui-caps-3 text-[10px] ${pendingTone}`}>
                                    <span className="font-mono tabular-nums">{item.pendingFields}</span> pending
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    ) : null}
                  </div>
                </div>
              </>
            );
          })()}
        </section>
      )}

      <div className="sr-only" aria-hidden>
        {FIELD_REVIEW_REQUIRED_CONTENT.join(", ")}
      </div>
    </div>
  );
}
