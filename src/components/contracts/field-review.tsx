"use client";

import { useMemo, useState } from "react";
import {
  buildFieldReviewStatusMessage,
  getCriticalFieldReviewSummary,
  sortFieldsForReview,
} from "@/lib/review-feedback";
import type { ExtractedField } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";
import { CriticalDateReviewNotice } from "./critical-date-review-notice";
import { FieldRow, ROW_GRID } from "./field-review-row";

const CRITICAL_DATE_REVIEW_COPY = "Key date coverage still needs review";

interface FieldReviewProps {
  fields: ExtractedField[];
  /** When false, hide approve/edit/mark unknown (viewer role). */
  canEdit?: boolean;
  emptyTitle?: string;
  emptyCopy?: string;
}

export function FieldReview({
  fields,
  canEdit = true,
  emptyTitle = "No contract details to confirm",
  emptyCopy = "Upload a text-based PDF or DOCX so Oblixa can suggest dates, owners, and other contract details.",
}: FieldReviewProps) {
  const [reviewState, setReviewState] = useState(() => ({
    sourceFields: fields,
    rows: fields,
  }));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const currentFields = reviewState.sourceFields === fields ? reviewState.rows : fields;

  const pendingCount = currentFields.filter((f) => f.status === "pending").length;
  const hasPending = pendingCount > 0;
  const orderedFields = useMemo(() => sortFieldsForReview(currentFields), [currentFields]);
  const criticalSummary = useMemo(
    () => getCriticalFieldReviewSummary(currentFields),
    [currentFields]
  );

  if (currentFields.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        copy={emptyCopy}
        size="compact"
        className="min-h-40 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_34%,transparent)] px-4 py-5"
      />
    );
  }

  return (
    <div className="space-y-4">
      {statusMessage ? (
        <div className="ui-alert-success" role="status" aria-live="polite">
          {statusMessage}
        </div>
      ) : null}
      {canEdit && hasPending && (
        <div className="ui-toolbar text-[11px]">
          <span className="ui-caps-3 text-[var(--text-tertiary)]">Shortcuts</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <kbd className="ui-kbd">A</kbd> confirm
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="ui-kbd">E</kbd> edit
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="ui-kbd">M</kbd> mark unknown
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="ui-kbd">S</kbd> skip
            </span>
          </span>
          <span className="ml-auto text-[var(--text-tertiary)]">
            <span className="font-mono tabular-nums">{pendingCount}</span> pending
          </span>
        </div>
      )}
      {criticalSummary.pendingLabels.length > 0 && (
        <CriticalDateReviewNotice
          pendingLabels={criticalSummary.pendingLabels}
          missingLabels={criticalSummary.missingLabels}
          canEdit={canEdit}
          summaryCopy={CRITICAL_DATE_REVIEW_COPY}
        />
      )}
      <div>
        <div className={`hidden px-3 pb-2 sm:px-4 ${ROW_GRID}`} aria-hidden>
          <span className="ui-caps-3 text-[var(--text-tertiary)]">Contract detail</span>
          <span className="ui-caps-3 text-[var(--text-tertiary)]">Value</span>
          <span className="ui-caps-3 text-[var(--text-tertiary)]">Source</span>
          <span />
        </div>
        <div
          className="border-t border-[var(--border-subtle)]"
          role="list"
          aria-label="Contract details to confirm"
        >
          <div className="divide-y divide-[var(--border-subtle)]">
            {orderedFields.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                canEdit={canEdit}
                onUpdated={(nextField, action) => {
                  const next = currentFields.map((candidate) =>
                    candidate.id === nextField.id ? nextField : candidate
                  );
                  const nextPendingCount = next.filter(
                    (candidate) => candidate.status === "pending"
                  ).length;
                  setReviewState({ sourceFields: fields, rows: next });
                  setStatusMessage(
                    buildFieldReviewStatusMessage({
                      pendingCount: nextPendingCount,
                      action,
                      fieldLabel: nextField.field_name.replace(/_/g, " "),
                    })
                  );
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
