import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, ClipboardCheck, FileText, ListChecks } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldReviewWorkspaceActions } from "@/components/contracts/field-review-workspace-actions";
import { RatioChip } from "@/components/ui/ratio-chip";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { ChipPair } from "@/components/ui/chip-pair";
import { ActionChip } from "@/components/ui/action-chip";
import { CountChip } from "@/components/ui/count-chip";
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

const QUEUE_VISIBLE = 12;

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
  tone: StatTone;
}

/** Confidence is a model extraction score, not a trust verdict. Only LOW (< 0.6)
 *  draws a warning tone (it materially affects review attention); medium/high stay
 *  neutral so color is not read as "this value is authoritative" (AI boundary). */
function confidenceMeta(confidence: number | null): ConfidenceMeta {
  if (confidence == null || Number.isNaN(confidence)) {
    return { pct: null, tone: "neutral" };
  }
  const pct = Math.round(Math.min(1, Math.max(0, confidence)) * 100);
  return { pct, tone: confidence >= 0.6 ? "neutral" : "warning" };
}

function sanitizeSnippet(value: string): string {
  return value.replace(/\s+/g, " ").trim().replace(/[.\s]+$/u, "");
}

function fieldTypeLabel(fieldName: string): string {
  const n = fieldName.toLowerCase();
  if (/(date|deadline|window|term|expiry|expiration|renewal)/.test(n)) return "Date";
  if (/(value|fee|amount|price|cost|payment|rate)/.test(n)) return "Amount";
  if (/(counterparty|owner|party|vendor|customer|supplier)/.test(n)) return "Party";
  return "Text";
}

function renderExcerptWithHighlight(excerpt: string, snippet: string | null): ReactNode {
  if (!snippet) return excerpt;
  // Normalize whitespace the same way buildDocumentPreview does, so the visual
  // highlight and the model's snippetLocated caption are computed from identical
  // inputs (PDF-extracted snippets often carry irregular internal whitespace).
  const needle = snippet.replace(/\s+/g, " ").trim().slice(0, 80).toLowerCase();
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

/** One label/value pair in the right-rail Contract definition list. Returns the
 *  dt+dd fragment so the parent `<dl>` owns a tight two-column grid — keeps the
 *  label-to-value distance short and the values left-aligned (§7.5). */
function ContractMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="ui-caps-3 self-baseline whitespace-nowrap text-[10px] leading-none text-[var(--text-tertiary)]">
        {label}
      </dt>
      <dd className="min-w-0 truncate text-[12.5px] font-medium text-[var(--text-secondary)]">{value}</dd>
    </>
  );
}

/** Prev/next field navigation inside the progress-strip stepper. Renders a
 *  disabled, muted control (not an opacity wash) at the ends of the queue so the
 *  cluster keeps a stable width (§10.9). Carries hover/focus/pressed states. */
function FieldNavButton({ href, direction }: { href: string | null; direction: "prev" | "next" }) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const label = direction === "prev" ? "Previous field" : "Next field";
  const base = "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors";
  if (!href) {
    return (
      <span aria-hidden className={`${base} text-[color:color-mix(in_oklab,var(--text-tertiary)_55%,transparent)]`}>
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={`${base} text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_32%,var(--surface-raised))] hover:text-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] motion-safe:active:scale-90`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
    </Link>
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
      {/* Frame: back-link + page identity grouped tightly so the surface starts
          close to the top instead of floating in loose whitespace. */}
      <div className="flex flex-col gap-2.5">
        <Link
          href="/contracts"
          className="ui-btn-ghost inline-flex max-w-max items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
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
                Confirm source-backed suggestions before they become trusted operational data.
              </p>
            </div>
          </div>
        </header>
      </div>

      {model.warnings.length > 0 ? (
        <div className="ui-alert-warning" role="status">
          {model.warnings[0]}
        </div>
      ) : null}

      {!activeField || !activeContract ? (
        <section className="ui-card-raised rounded-2xl border p-6 sm:p-8">
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
        <section className="ui-card-raised overflow-hidden rounded-2xl" aria-label="Field review workspace">
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
            // Source-support state drives the value chip AND the approve gate.
            // "Source-backed" requires the snippet to be LOCATED in the source —
            // otherwise it is "Needs verification" (never both, §trust).
            const sourceUnverified =
              activeField.source === "ai" &&
              !!activeField.sourceSnippet &&
              !documentPreview?.snippetLocated;
            const sourceState: { label: string; status: SemanticStatus } =
              activeField.source !== "ai"
                ? { label: "Manual entry", status: "info" }
                : !activeField.sourceSnippet
                  ? { label: "Needs citation", status: "warning" }
                  : documentPreview?.snippetLocated
                    ? { label: "Source-backed", status: "healthy" }
                    : { label: "Needs verification", status: "warning" };
            // Always surface queue context when anything is waiting — fills the
            // tray and orients the reviewer instead of leaving empty canvas.
            const showQueue = model.queue.length > 0;
            const visibleQueue = model.queue.slice(0, QUEUE_VISIBLE);
            const hiddenQueueCount = model.queue.length - visibleQueue.length;
            const hasNextQueuePage = model.page < model.totalPages;

            return (
              <>
                {/* Control bar — review progress + field stepper + queue counts.
                    A quiet header wash sets it apart from the decision body. */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_34%,transparent)] px-5 py-3 sm:px-6">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]">Review progress</span>
                    <RatioChip
                      numerator={completedForContract}
                      denominator={totalFieldsForContract}
                      suffix="reviewed"
                      tone={allReviewed ? "success" : "neutral"}
                    />
                    <span
                      className="h-1.5 w-24 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--border-strong)_60%,transparent)] sm:w-32"
                      role="progressbar"
                      aria-valuenow={progressPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuetext={`${progressPct}% of this contract's fields reviewed`}
                      aria-label={`Review progress: ${completedForContract} of ${totalFieldsForContract} fields reviewed`}
                    >
                      <span
                        aria-hidden
                        className="block h-full rounded-full transition-[width] duration-500 ease-out"
                        style={{
                          width: `${progressPct}%`,
                          background: allReviewed ? "var(--success-ink)" : "var(--accent)",
                        }}
                      />
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 sm:ml-auto">
                    <div
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] p-0.5"
                      aria-label="Field navigation"
                    >
                      <FieldNavButton href={model.prevHref} direction="prev" />
                      <span className="ui-caps-3 px-1 text-[10px] leading-none tabular-nums text-[var(--text-tertiary)]">
                        Field <span className="text-[var(--text-secondary)]">{model.progress.activeFieldPosition}</span> of{" "}
                        {model.progress.activeContractPendingFields}
                      </span>
                      <FieldNavButton href={model.nextHref} direction="next" />
                    </div>
                    <KeyValueChip label="Backlog" value={model.progress.fieldsWaiting} />
                    <KeyValueChip label="Queue" value={model.progress.contractsWaiting} />
                  </div>
                </div>

                {/* Two-column body — field decision (left) + source evidence rail
                    (right). A single hairline divides them; no background band. */}
                <div className="grid lg:grid-cols-[minmax(0,0.94fr)_minmax(22rem,0.74fr)]">
                  {/* LEFT — the decision surface */}
                  <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
                    <div>
                      <p className="ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]">Field</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                        <h2 className="text-[1.25rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.4rem]">
                          {activeField.fieldLabel}
                        </h2>
                        <ChipPair primary={fieldTypeLabel(activeField.fieldName)} />
                      </div>
                      <Link
                        href={activeContract.href}
                        title={activeContract.title}
                        className="mt-2 inline-block max-w-full truncate rounded text-[13.5px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-strong)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                      >
                        {activeContract.title}
                      </Link>
                    </div>

                    {/* Decision values — suggested (focal) vs current approved,
                        parted by a hairline so they read as parallel data slots. */}
                    <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]">Suggested value</dt>
                        <dd className="mt-2">
                          <span className="block break-words text-[1.75rem] font-semibold leading-none tracking-[-0.01em] tabular-nums text-[var(--text-primary)]">
                            {formatSuggestedValue(activeField.suggestedValue)}
                          </span>
                          <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                            <StatusBadge status={sourceState.status} className="inline-flex items-center gap-1">
                              {sourceState.status === "warning" ? (
                                <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden />
                              ) : sourceState.status === "healthy" ? (
                                <Check className="h-3 w-3" strokeWidth={2} aria-hidden />
                              ) : null}
                              {sourceState.label}
                            </StatusBadge>
                            {/* Confidence is quiet supporting metadata (caps label + mono value),
                                not a status pill — color stays neutral so it never reads as a
                                trust verdict (AI boundary); the StatusBadge carries real state. */}
                            <span className="inline-flex items-baseline gap-1.5">
                              <span className="ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]">Confidence</span>
                              <span className="font-mono text-[11.5px] leading-none tabular-nums text-[var(--text-secondary)]">
                                {conf.pct != null ? `${conf.pct}%` : "—"}
                              </span>
                            </span>
                          </span>
                        </dd>
                      </div>

                      <div className="min-w-0">
                        <dt className="ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]">Current approved value</dt>
                        {activeField.currentApprovedValue ? (
                          <dd className="mt-2">
                            <span className="block break-words text-[1.5rem] font-semibold leading-none tracking-[-0.01em] tabular-nums text-[var(--text-primary)]">
                              {formatSuggestedValue(activeField.currentApprovedValue)}
                            </span>
                            <span className="mt-3 flex flex-wrap items-center gap-2">
                              {activeField.approvedConflict ? (
                                <ChipPair primary="Differs" secondary="from suggestion" tone="warning" />
                              ) : (
                                <span className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]">
                                  Most recent approval
                                </span>
                              )}
                            </span>
                          </dd>
                        ) : (
                          <dd className="mt-2">
                            <span
                              aria-hidden
                              className="block text-[1.5rem] font-semibold leading-none text-[color:color-mix(in_oklab,var(--text-tertiary)_50%,transparent)]"
                            >
                              &mdash;
                            </span>
                            <span className="mt-3 flex flex-wrap items-center gap-2">
                              <StatusBadge status="empty">No approved value</StatusBadge>
                            </span>
                          </dd>
                        )}
                      </div>
                    </dl>

                    {/* Source snippet — the cited evidence, tied to the preview. */}
                    <section aria-label="Source snippet">
                      <p className="ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]">Source snippet</p>
                      {activeField.sourceSnippet ? (
                        <>
                          <blockquote className="mt-2 overflow-hidden rounded-r-lg border-l-[3px] border-[color:color-mix(in_oklab,var(--accent)_60%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_14%,var(--surface-muted))]">
                            <p className="max-h-28 overflow-y-auto px-4 py-3 text-[13px] italic leading-relaxed text-[var(--text-secondary)]">
                              {sanitizeSnippet(activeField.sourceSnippet)}
                            </p>
                          </blockquote>
                          {documentPreview?.snippetLocated ? (
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                              <p className="ui-caps-3 inline-flex items-center gap-1.5 text-[10px] leading-none text-[var(--accent-strong)]">
                                <span
                                  aria-hidden
                                  className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
                                  style={{ boxShadow: "0 0 0 3px color-mix(in oklab, var(--accent-soft) 42%, transparent)" }}
                                />
                                Highlighted in source preview
                              </p>
                              <ActionChip verb="View source" href="#field-review-source-preview" className="ui-chip-focus" />
                            </div>
                          ) : (
                            // Warning banner carries the optional action inline — keeps
                            // "View source" tied to the snippet, never floating above it.
                            <div
                              role="status"
                              className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-[color:color-mix(in_oklab,var(--warning)_32%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_30%,var(--surface))] px-3 py-2"
                            >
                              <span className="inline-flex items-center gap-2">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--warning-ink)]" strokeWidth={2} aria-hidden />
                                <span className="ui-caps-3 text-[10px] leading-none text-[var(--warning-ink)]">
                                  Snippet not found in source text
                                </span>
                              </span>
                              <ActionChip
                                verb="View source"
                                href="#field-review-source-preview"
                                tone="warning"
                                className="ui-chip-focus"
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[1rem] font-semibold leading-none text-[var(--text-tertiary)]" aria-hidden>
                            &mdash;
                          </span>
                          <span className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]">
                            No source text on this suggestion
                          </span>
                        </div>
                      )}
                    </section>

                    {/* Review decisions */}
                    <div className="pt-1">
                      <FieldReviewWorkspaceActions
                        key={activeField.id}
                        fieldId={activeField.id}
                        fieldLabel={activeField.fieldLabel}
                        suggestedValue={activeField.suggestedValue}
                        canEdit={ctx.role !== "viewer"}
                        needsCitation={activeField.needsCitation}
                        sourceUnverified={sourceUnverified}
                        nextHref={model.nextHref}
                        skipHref={model.skipHref}
                      />
                    </div>
                  </div>

                  {/* RIGHT — source evidence rail, subordinate to the decision */}
                  <div className="space-y-6 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] px-5 py-5 sm:px-6 sm:py-6 lg:border-l lg:border-t-0">
                    <section aria-label="Source preview" id="field-review-source-preview">
                      <p className="ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]">Source preview</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {noSources ? (
                          <StatusBadge status="warning" className="gap-1.5">
                            <FileText className="h-3 w-3 shrink-0" strokeWidth={1.85} aria-hidden />
                            No file attached
                          </StatusBadge>
                        ) : (
                          <>
                            <span className="inline-flex max-w-[15rem] items-center gap-1.5 rounded-md border border-[var(--border-card)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10.5px] text-[var(--text-secondary)]">
                              <FileText className="h-3 w-3 shrink-0" strokeWidth={1.85} aria-hidden />
                              <span className="truncate font-mono">
                                {targetFilename ?? `${sourceFileCount} ${sourceFileCount === 1 ? "file" : "files"}`}
                              </span>
                            </span>
                            {documentPreview && documentPreview.sourceFileNames.length > 1 ? (
                              <span className="inline-flex items-center rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums text-[var(--text-tertiary)]">
                                +{documentPreview.sourceFileNames.length - 1}
                              </span>
                            ) : null}
                          </>
                        )}
                      </div>
                      <div className="mt-2 overflow-hidden rounded-lg border border-[var(--border-card)] bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,var(--surface))]">
                        <div className="max-h-[19rem] overflow-y-auto px-4 py-3 text-[13px] leading-relaxed text-[var(--text-primary)]">
                          {documentPreview?.excerpt
                            ? renderExcerptWithHighlight(documentPreview.excerpt, activeField.sourceSnippet)
                            : "No source text is available for this contract."}
                        </div>
                      </div>
                      {noSources ? (
                        <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-tertiary)]">
                          Source text is available; the original file is not attached.
                        </p>
                      ) : null}
                    </section>

                    <section aria-label="Contract">
                      <p className="ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]">Contract</p>
                      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 border-t border-[var(--border-card)] pt-2.5">
                        <ContractMetaRow
                          label="Counterparty"
                          value={activeContract.counterparty ?? "No counterparty"}
                        />
                        {activeContract.contractType ? (
                          <ContractMetaRow label="Type" value={activeContract.contractType} />
                        ) : null}
                        <ContractMetaRow label="Owner" value={activeContract.ownerLabel} />
                      </dl>
                      <div className="mt-3">
                        <ActionChip verb="Open contract" href={activeContract.href} className="ui-chip-focus" />
                      </div>
                    </section>
                  </div>
                </div>

                {showQueue ? (
                  <section
                    aria-label="Review queue"
                    className="border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_34%,transparent)] px-5 py-4 sm:px-6 sm:py-5"
                  >
                    <div className="flex items-center gap-2">
                      <ListChecks className="h-3.5 w-3.5 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
                      <p className="ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]">Contracts to review</p>
                      <CountChip value={model.queue.length} emphasis="subtle" />
                    </div>
                    <ul className="mt-3 grid max-h-[12.5rem] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                      {visibleQueue.map((item) => {
                        const isActive = item.id === activeContract.id;
                        return (
                          <li key={item.id}>
                            <Link
                              href={item.href}
                              title={item.title}
                              aria-current={isActive ? "page" : undefined}
                              className={`ui-chip-focus group flex items-center justify-between gap-2 rounded-lg border border-l-2 px-3 py-2 text-[12.5px] transition-colors ${
                                isActive
                                  ? "border-[var(--border-subtle)] border-l-[var(--accent)] bg-[color:color-mix(in_oklab,var(--accent-soft)_26%,var(--surface-raised))]"
                                  : "border-[var(--border-card)] border-l-transparent bg-[var(--surface-raised)] hover:border-[var(--border-strong)] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_10%,var(--surface-raised))]"
                              }`}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  aria-hidden
                                  className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full"
                                  style={{ background: isActive ? "var(--accent)" : "transparent" }}
                                />
                                <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">
                                  {item.title}
                                </span>
                              </span>
                              <KeyValueChip label="Pending" value={item.pendingFields} className="shrink-0" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                    {hiddenQueueCount > 0 || hasNextQueuePage ? (
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-2.5">
                        <span className="inline-flex items-baseline gap-1.5">
                          <span className="ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]">Showing</span>
                          <span className="font-mono text-[11px] leading-none tabular-nums text-[var(--text-secondary)]">
                            {visibleQueue.length}
                          </span>
                          <span className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]">of</span>
                          <span className="font-mono text-[11px] leading-none tabular-nums text-[var(--text-secondary)]">
                            {model.queue.length}
                          </span>
                        </span>
                        {hasNextQueuePage ? (
                          <ActionChip
                            verb="More to review"
                            href={`/contracts/review?page=${model.page + 1}`}
                            className="ui-chip-focus"
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </section>
                ) : null}
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
