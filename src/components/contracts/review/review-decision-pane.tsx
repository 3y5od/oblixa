import { AlertTriangle, Check, CircleHelp, FileText } from "lucide-react";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import type { FieldReviewActiveField, FieldReviewMiniQueueItem } from "@/lib/field-review/model";
import { ReviewFieldMiniQueue } from "./review-field-mini-queue";
import {
  FieldTypeMedallion,
  confidencePct,
  fieldDrivesRenewals,
  fieldTypeLabel,
  formatSuggestedValue,
  isDateField,
  isIsoDate,
} from "./review-helpers";

const CONFIDENCE_TOOLTIP = "An extraction score from the model, not a trust signal. Confirm the value before relying on it.";

/** Source-support state derived from the model's centralized `sourceQuality`. The
 *  source signal — kept distinct from the value's confirmation (trust) state. */
function sourceStateFor(field: FieldReviewActiveField): { label: string; status: SemanticStatus } {
  switch (field.sourceQuality) {
    case "manual":
      return { label: "Manual entry", status: "info" };
    case "located":
      return { label: "Source text found", status: "healthy" };
    case "preview-unavailable":
      return { label: "Source preview unavailable", status: "warning" };
    case "snippet-missing":
    default:
      return field.sourceSnippet
        ? { label: "Source not found", status: "warning" }
        : { label: "Needs source text", status: "warning" };
  }
}

/** The source signal as a small semantic badge — the single source-support signal
 *  in the decision pane (the right-rail citation carries the located clause). */
function SourceSignalBadge({ state }: { state: { label: string; status: SemanticStatus } }) {
  return (
    <StatusBadge status={state.status} className="inline-flex items-center gap-1">
      {state.status === "warning" ? (
        <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden />
      ) : state.status === "healthy" ? (
        <Check className="h-3 w-3" strokeWidth={2} aria-hidden />
      ) : (
        <FileText className="h-3 w-3" strokeWidth={1.85} aria-hidden />
      )}
      {state.label}
    </StatusBadge>
  );
}

interface ReviewDecisionPaneProps {
  activeField: FieldReviewActiveField;
  fieldQueue: FieldReviewMiniQueueItem[];
}

/** The detail-and-trust half of the review unit (the source proof sits beside it,
 *  the decision actions below it). Detail identity, an in-contract detail
 *  mini-queue, ONE decision record — the suggested value staged as the dominant
 *  datum, the trust read beneath it as a verdict plus two inline status facts, and
 *  quiet model metadata at the foot — then the operational consequence of
 *  confirming. The pane scrolls internally inside the full-height workbench; the
 *  decision actions are owned by the shell so they can span the detail and proof
 *  together. */
export function ReviewDecisionPane({ activeField, fieldQueue }: ReviewDecisionPaneProps) {
  const sourceState = sourceStateFor(activeField);
  const sourceTone =
    sourceState.status === "healthy"
      ? "text-[var(--success-ink)]"
      : sourceState.status === "warning"
        ? "text-[var(--warning-ink)]"
        : "text-[var(--text-secondary)]";
  const drivesRenewals = fieldDrivesRenewals(activeField.fieldName);
  const confPct = confidencePct(activeField.confidence);
  const valueIsDate = isDateField(activeField.fieldName);
  const showExtractedDate = valueIsDate && isIsoDate(activeField.suggestedValue);
  const hasConfirmed = !!activeField.currentApprovedValue;
  const showConflict = hasConfirmed && activeField.approvedConflict;

  return (
    <div className="ui-scroll-subtle min-h-0 flex-1 overflow-y-auto xl:h-full">
      {/* Sticky local state line — a quiet trust trail, NOT a second title. The
          field name stays the single dominant heading below; this line keeps the
          trust state (suggested · not confirmed · source support) anchored once the
          heading scrolls away. The control band above (z-10) casts over this seam. */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-cool)_72%,var(--surface-raised))] px-5 py-2 shadow-[0_4px_8px_-7px_rgba(15,23,42,0.3)] sm:px-6">
        <span className="text-[11px] leading-none text-[var(--text-tertiary)]">Suggested detail</span>
        <span aria-hidden className="text-[var(--border-strong)]">·</span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold leading-none text-[var(--warning-ink)]">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--warning-ink)]" />
          Not confirmed
        </span>
        <span aria-hidden className="text-[var(--border-strong)]">·</span>
        <span className={`text-[11px] font-medium leading-none ${sourceTone}`}>{sourceState.label}</span>
      </div>

      <div className="space-y-7 px-5 pb-9 pt-6 sm:px-6">
        {/* Detail identity — the hero of the decision pane: a quiet "Detail to
            review" label over the detail name and one compact metadata line. */}
        <div>
          <p className="text-[11.5px] font-semibold leading-none text-[var(--text-tertiary)]">Detail to review</p>
          <h2 className="mt-2 text-[1.4rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-[1.55rem]">
            {activeField.fieldLabel}
          </h2>
          <p className="mt-2 text-[12px] leading-snug text-[var(--text-tertiary)]">
            <span className="font-medium text-[var(--text-secondary)]">{fieldTypeLabel(activeField.fieldName)}</span>
            {" · Used in reminders, tasks, reports, and search"}
          </p>
        </div>

        <ReviewFieldMiniQueue items={fieldQueue} />

        {/* The decision record — the heaviest artifact in this pane: the eyebrow
            over the dominant value datum, then the trust verdict on a cool inset,
            then quiet model metadata. Carries the decision's weight against the
            source document opposite. */}
        <section
          aria-label="Suggested detail"
          className="overflow-hidden rounded-xl border border-[color:color-mix(in_oklab,var(--border-strong)_42%,var(--border-card))] bg-[var(--surface-raised)] shadow-[0_1px_3px_rgba(15,23,42,0.07),0_12px_26px_-18px_rgba(15,23,42,0.34)]"
        >
          {/* Record header — labels the artifact and, when the detail drives
              renewal/notice timing, classifies it, so the card reads as a record
              with a header rather than a card with an eyebrow. */}
          <div className="flex items-center justify-between gap-2 border-b border-[color:color-mix(in_oklab,var(--border-card)_75%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_30%,var(--surface-raised))] px-5 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] leading-none text-[var(--text-tertiary)]">
              Suggested detail
            </p>
            {drivesRenewals ? (
              <span className="inline-flex shrink-0 items-center rounded border border-[var(--border-card)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10px] font-medium leading-none text-[var(--text-secondary)]">
                Drives renewals
              </span>
            ) : null}
          </div>
          <div className="px-5 py-5">
            <div className="flex items-center gap-4">
              <FieldTypeMedallion fieldName={activeField.fieldName} />
              <div className="min-w-0 flex-1">
                <span className="block break-words text-[1.85rem] font-semibold leading-[1.04] tracking-[-0.01em] tabular-nums text-[var(--text-primary)] sm:text-[2.1rem]">
                  {formatSuggestedValue(activeField.suggestedValue, { month: "long" })}
                </span>
                {showExtractedDate ? (
                  <span className="mt-1.5 block font-mono text-[11px] leading-none tabular-nums text-[var(--text-tertiary)]">
                    {activeField.suggestedValue}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Trust read — the dominant verdict (not trusted until confirmed) and,
              beneath it, the two facts a reviewer needs as a labeled ledger.
              Separated from the value by tone + space. */}
          <div className="border-t border-[color:color-mix(in_oklab,var(--border-card)_60%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-cool)_55%,var(--surface-raised))] px-5 py-4">
          {showConflict ? (
            <div className="mb-3 rounded-md border border-[color:color-mix(in_oklab,var(--warning-ink)_30%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--warning-soft)_24%,var(--surface-raised))] px-3 py-2.5">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] leading-none text-[var(--warning-ink)]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                Confirming overwrites the confirmed detail
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <p className="text-[10.5px] font-medium leading-none text-[var(--text-tertiary)]">Confirmed detail</p>
                  <p className="mt-1.5 truncate text-[14px] font-semibold tabular-nums text-[var(--text-secondary)]">
                    {formatSuggestedValue(activeField.currentApprovedValue, { month: "long" })}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10.5px] font-medium leading-none text-[var(--text-tertiary)]">Suggested value</p>
                  <p className="mt-1.5 truncate text-[14px] font-semibold tabular-nums text-[var(--text-primary)]">
                    {formatSuggestedValue(activeField.suggestedValue, { month: "long" })}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex items-start gap-2.5">
            <span
              aria-hidden
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--warning-ink)] ring-[3px] ring-[color:color-mix(in_oklab,var(--warning-soft)_55%,transparent)]"
            />
            <div className="min-w-0">
              <p className="text-[14.5px] font-semibold leading-snug text-[var(--text-primary)]">
                Suggested detail, not confirmed
              </p>
              <p className="mt-1 text-[12.5px] leading-snug text-[var(--text-secondary)]">
                Oblixa will not use this value in reminders, tasks, or reports until someone confirms it.
              </p>
            </div>
          </div>

          {/* The two trust facts as a labeled inspection ledger (source support +
              the current confirmed value) — read as deliberate facts under the
              verdict, not an inline run hanging off it. Label left / value right so
              a long source badge takes the full row instead of overflowing a fixed
              column; a hairline above sets them apart from the verdict without a
              heavy box. */}
          <dl className="mt-4 space-y-2.5 border-t border-[color:color-mix(in_oklab,var(--border-card)_55%,transparent)] pt-3.5">
            <div className="flex items-center justify-between gap-3">
              <dt className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.05em] leading-none text-[var(--text-tertiary)]">
                Source
              </dt>
              <dd className="flex min-w-0 justify-end">
                <SourceSignalBadge state={sourceState} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.05em] leading-none text-[var(--text-tertiary)]">
                Confirmed detail
              </dt>
              <dd
                className={`min-w-0 truncate text-right text-[13px] leading-none tabular-nums ${hasConfirmed ? "font-semibold text-[var(--text-primary)]" : "font-medium text-[var(--text-tertiary)]"}`}
              >
                {hasConfirmed ? formatSuggestedValue(activeField.currentApprovedValue, { month: "long" }) : "None yet"}
              </dd>
            </div>
          </dl>
        </div>

          {/* Operational effect — what confirming does, kept inside the record so
              the decision reads as one inspection unit (verdict → facts →
              consequence) rather than an annotation floating above the action bar. */}
          <div className="border-t border-[color:color-mix(in_oklab,var(--border-card)_60%,transparent)] px-5 py-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.05em] leading-none text-[var(--text-tertiary)]">
              Where this confirmed detail is used
            </p>
            <p className="mt-2 text-[13px] leading-[1.55] text-[var(--text-secondary)]">{activeField.impactCopy}</p>
          </div>

        {/* Extraction metadata — the quietest line in the record, framed so the
            model's own score never reads as a trust verdict (AI boundary). */}
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[color:color-mix(in_oklab,var(--border-card)_50%,transparent)] px-5 py-2.5 text-[10px] leading-none text-[var(--text-tertiary)]"
          title={CONFIDENCE_TOOLTIP}
        >
          <span className="font-medium">Extraction metadata</span>
          <span aria-hidden className="text-[var(--border-strong)]">·</span>
          {showExtractedDate ? (
            <>
              <span>
                Source value:{" "}
                <span className="font-mono tabular-nums text-[var(--text-secondary)]">{activeField.suggestedValue}</span>
              </span>
              <span aria-hidden className="text-[var(--border-strong)]">·</span>
            </>
          ) : null}
          <span>
            Model score:{" "}
            {confPct != null ? (
              <span className="font-mono tabular-nums text-[var(--text-secondary)]">{confPct}%</span>
            ) : (
              <span className="text-[var(--text-tertiary)]">no signal</span>
            )}
          </span>
          <span aria-hidden className="text-[var(--border-strong)]">·</span>
          <span className="inline-flex items-center gap-1 font-medium text-[var(--text-secondary)]">
            Not a trust signal
            <CircleHelp className="h-3 w-3 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
          </span>
          <span className="sr-only">{CONFIDENCE_TOOLTIP}</span>
        </div>
      </section>
      </div>
    </div>
  );
}
