import type { ReactNode } from "react";
import { AlertTriangle, Check, CircleHelp, Quote } from "lucide-react";
import { ChipPair } from "@/components/ui/chip-pair";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import type { FieldReviewActiveField, FieldReviewMiniQueueItem } from "@/lib/field-review/model";
import { ReviewActionBar } from "./review-action-bar";
import { ReviewFieldMiniQueue } from "./review-field-mini-queue";
import {
  FieldTypeMedallion,
  SOURCE_CITATION_ANCHOR,
  confidencePct,
  fieldDrivesRenewals,
  fieldTypeLabel,
  formatSuggestedValue,
  isDateField,
  isIsoDate,
} from "./review-helpers";

const CONFIDENCE_TOOLTIP = "Suggestion metadata — a model score, not a trust signal. Confirm the value before relying on it.";

/** Source-support badge derived from the model's centralized `sourceQuality`,
 *  with specific copy for each failure mode. */
function sourceStateFor(field: FieldReviewActiveField): { label: string; status: SemanticStatus } {
  switch (field.sourceQuality) {
    case "manual":
      return { label: "Manual entry", status: "info" };
    case "located":
      return { label: "Source found", status: "healthy" };
    case "preview-unavailable":
      return { label: "Source preview unavailable", status: "warning" };
    case "snippet-missing":
    default:
      return field.sourceSnippet
        ? { label: "Source not found", status: "warning" }
        : { label: "Needs source", status: "warning" };
  }
}

interface ReviewDecisionPaneProps {
  activeField: FieldReviewActiveField;
  fieldQueue: FieldReviewMiniQueueItem[];
  actions: ReactNode;
}

/** The focal surface: contract-detail identity, an in-contract detail mini-queue, the
 *  suggested value, extraction metadata, a current→suggested comparison when
 *  confirming would overwrite trusted data, and the decision zone. */
export function ReviewDecisionPane({ activeField, fieldQueue, actions }: ReviewDecisionPaneProps) {
  const sourceState = sourceStateFor(activeField);
  const confPct = confidencePct(activeField.confidence);
  const valueIsDate = isDateField(activeField.fieldName);
  const showExtractedDate = valueIsDate && isIsoDate(activeField.suggestedValue);

  return (
    <div className="space-y-5">
      <div className="border-b border-[var(--border-subtle)] pb-4">
        <p className="ui-caps-2 text-[10px] leading-none text-[var(--accent-strong)]">Detail to review</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <h2 className="min-w-0 text-[1.3rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.45rem]">
            {activeField.fieldLabel}
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <ChipPair primary={fieldTypeLabel(activeField.fieldName)} />
            {activeField.importantLabel ? <ChipPair primary="Key detail" /> : null}
            {fieldDrivesRenewals(activeField.fieldName) ? <ChipPair primary="Drives renewals" /> : null}
            <StatusBadge status={sourceState.status} className="inline-flex items-center gap-1">
              {sourceState.status === "warning" ? (
                <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden />
              ) : sourceState.status === "healthy" ? (
                <Check className="h-3 w-3" strokeWidth={2} aria-hidden />
              ) : null}
              {sourceState.label}
            </StatusBadge>
          </div>
        </div>
      </div>

      <ReviewFieldMiniQueue items={fieldQueue} />

      <div className="rounded-xl border-l-[3px] border-l-[color:color-mix(in_oklab,var(--accent)_55%,var(--border-subtle))] border-y border-r border-y-[var(--border-card)] border-r-[var(--border-card)] bg-[color:color-mix(in_oklab,var(--accent-soft)_16%,var(--surface-raised))] px-4 py-3">
        <p className="ui-caps-2 text-[10px] leading-none text-[var(--accent-strong)]">Where this is used</p>
        <p className="mt-1.5 text-[13px] font-medium leading-snug text-[var(--text-secondary)]">
          {activeField.impactCopy}
        </p>
      </div>

      {/* Suggested detail — focal value anchored by a type medallion, with its
          trust state stated immediately beneath and model metadata kept apart. */}
      <div>
        <p className="ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]">Suggested detail</p>
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-[var(--border-card)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--surface))] px-4 py-3">
          <FieldTypeMedallion fieldName={activeField.fieldName} />
          <span className="min-w-0 flex-1 break-words text-[1.625rem] font-semibold leading-none tracking-[-0.01em] tabular-nums text-[var(--text-primary)] sm:text-[1.75rem]">
            {formatSuggestedValue(activeField.suggestedValue, { month: "long" })}
          </span>
        </div>

        {/* Trust state — stated directly under the value. A suggestion is never
            trusted until confirmed; a located citation makes it source-backed and
            links straight to the supporting source text. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className="inline-flex items-center rounded-full border border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] leading-none text-[var(--accent-strong)]">
            Suggested detail, not confirmed
          </span>
          {activeField.sourceQuality === "located" ? (
            <a
              href={`#${SOURCE_CITATION_ANCHOR}`}
              className="ui-chip-focus inline-flex items-center gap-1 rounded text-[11.5px] font-medium text-[var(--success-ink)]"
            >
              <Quote className="h-3 w-3" strokeWidth={2} aria-hidden />
              Source-backed suggestion
            </a>
          ) : null}
        </div>

        {/* Model + source metadata — split from the trust row by a hairline so the
            model's own score never reads as a trust verdict (AI boundary). */}
        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-2">
          {showExtractedDate ? (
            <span className="inline-flex items-baseline gap-1.5">
              <span className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]">Source value</span>
              <span className="font-mono text-[11px] leading-none tabular-nums text-[var(--text-secondary)]">
                {activeField.suggestedValue}
              </span>
            </span>
          ) : null}
          <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5" title={CONFIDENCE_TOOLTIP}>
            <span className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]">Suggestion metadata</span>
            {confPct != null ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="font-mono text-[11.5px] leading-none tabular-nums text-[var(--text-secondary)]">
                  {confPct}%
                </span>
                <span className="text-[10.5px] leading-none text-[var(--text-tertiary)]">model confidence</span>
                <CircleHelp className="h-3 w-3 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
                <span className="sr-only">{CONFIDENCE_TOOLTIP}</span>
              </span>
            ) : (
              <span className="text-[10.5px] leading-none text-[var(--text-tertiary)]">no model signal</span>
            )}
          </span>
        </div>

        {/* Confirmed detail — a Confirmed → Suggested comparison when confirming
            would overwrite a different trusted value; the confirmation status
            otherwise, with an explicit note that a suggestion is not yet trusted. */}
        {activeField.currentApprovedValue && activeField.approvedConflict ? (
          <div className="mt-3 rounded-lg border border-[color:color-mix(in_oklab,var(--warning)_30%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_22%,var(--surface))] p-3">
            <p className="ui-caps-3 inline-flex items-center gap-1.5 text-[10px] leading-none text-[var(--warning-ink)]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              Confirming overwrites the confirmed detail
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <p className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]">Confirmed detail</p>
                <p className="mt-1 truncate text-[14px] font-semibold tabular-nums text-[var(--text-secondary)]">
                  {formatSuggestedValue(activeField.currentApprovedValue, { month: "long" })}
                </p>
              </div>
              <div className="min-w-0">
                <p className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]">Suggested detail</p>
                <p className="mt-1 truncate text-[14px] font-semibold tabular-nums text-[var(--text-primary)]">
                  {formatSuggestedValue(activeField.suggestedValue, { month: "long" })}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="ui-caps-2 shrink-0 text-[10px] leading-none text-[var(--text-tertiary)]">
                Confirmed detail
              </span>
              {activeField.currentApprovedValue ? (
                <>
                  <span className="text-[14px] font-semibold tabular-nums text-[var(--text-primary)]">
                    {formatSuggestedValue(activeField.currentApprovedValue, { month: "long" })}
                  </span>
                  <span className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]">
                    Most recent confirmation
                  </span>
                </>
              ) : (
                <span className="text-[12.5px] font-medium text-[var(--text-tertiary)]">none yet</span>
              )}
            </div>
            {!activeField.currentApprovedValue ? (
              <p className="mt-1.5 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
                This detail will not appear in reminders or reports until someone confirms it.
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* Detail decisions — sticky action zone on lg. */}
      <ReviewActionBar>{actions}</ReviewActionBar>
    </div>
  );
}
