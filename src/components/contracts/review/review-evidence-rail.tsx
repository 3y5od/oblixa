import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { RecoverableState } from "@/components/ui/recoverable-state";
import type {
  FieldReviewActiveContract,
  FieldReviewActiveField,
  FieldReviewDocumentPreview,
} from "@/lib/field-review/model";
import { ReviewCitation } from "./review-citation";
import { ReviewFileSwitcher } from "./review-file-switcher";
import { formatStatusLabel, renderExcerptWithHighlight } from "./review-helpers";

const PREVIEW_ANCHOR = "review-source-preview";

/** Stacked evidence object (Citation / Preview / Contract) with a consistent caps
 *  header row that can carry a trailing status badge. */
function ReviewPaneSection({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <p className="ui-caps-2 text-[10px] leading-none text-[var(--text-tertiary)]">{title}</p>
        {badge ?? null}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** One label/value pair in the right-rail Contract definition list. Reserved
 *  label column keeps values aligned; a missing value renders an em-dash with an
 *  accessible label, and `tone="warning"` flags an actionable gap (e.g. no owner). */
function ContractMetaRow({
  label,
  value,
  emptyLabel = "Not set",
  tone = "default",
}: {
  label: string;
  value: string | null;
  emptyLabel?: string;
  tone?: "default" | "warning";
}) {
  const color = tone === "warning" ? "text-[var(--warning-ink)]" : "text-[var(--text-secondary)]";
  return (
    <>
      <dt className="ui-caps-3 self-baseline whitespace-nowrap text-[10px] leading-none text-[var(--text-tertiary)]">
        {label}
      </dt>
      <dd className={`min-w-0 truncate text-[12.5px] font-medium ${color}`}>
        {value ? (
          value
        ) : (
          <>
            <span aria-hidden>&mdash;</span>
            <span className="sr-only">{emptyLabel}</span>
          </>
        )}
      </dd>
    </>
  );
}

interface ReviewEvidenceRailProps {
  activeField: FieldReviewActiveField;
  activeContract: FieldReviewActiveContract;
  documentPreview: FieldReviewDocumentPreview | null;
  completedForContract: number;
  totalFieldsForContract: number;
}

/** Citation, source preview, and contract context as first-class objects beside
 *  the decision. */
export function ReviewEvidenceRail({
  activeField,
  activeContract,
  documentPreview,
  completedForContract,
  totalFieldsForContract,
}: ReviewEvidenceRailProps) {
  const files = activeContract.files;
  const noSources = files.length === 0;
  const previewAvailable = documentPreview?.status === "available";
  const ownerUnassigned = activeContract.ownerLabel === "Unassigned";

  return (
    <div className="space-y-6">
      <ReviewPaneSection title="Where Oblixa found it">
        <ReviewCitation
          sourceSnippet={activeField.sourceSnippet}
          snippetLocated={!!documentPreview?.snippetLocated}
          previewAnchor={PREVIEW_ANCHOR}
        />
      </ReviewPaneSection>

      <ReviewPaneSection
        title="Source preview"
        badge={
          noSources ? (
            <StatusBadge status="warning" className="gap-1">
              <FileText className="h-3 w-3 shrink-0" strokeWidth={1.85} aria-hidden />
              No file
            </StatusBadge>
          ) : null
        }
      >
        <div className="space-y-2">
          <ReviewFileSwitcher files={files} />
          {previewAvailable ? (
            <>
              <div className="overflow-hidden rounded-lg border border-[var(--border-card)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--surface))] shadow-[inset_0_1px_2px_color-mix(in_oklab,var(--text-primary)_6%,transparent)]">
                <div
                  id={PREVIEW_ANCHOR}
                  className="max-h-[26rem] overflow-y-auto px-4 py-3 text-[13px] leading-relaxed text-[var(--text-primary)] lg:max-h-[32rem]"
                >
                  {renderExcerptWithHighlight(documentPreview?.excerpt ?? "", activeField.sourceSnippet)}
                </div>
              </div>
              {noSources ? (
                <p className="text-[11px] leading-snug text-[var(--text-tertiary)]">
                  Showing searchable text — the original file is not attached.
                </p>
              ) : null}
            </>
          ) : (
            <RecoverableState
              state="partial"
              density="compact"
              surface="contracts/review"
              section="source-preview"
              title="Source preview unavailable"
              reason={
                documentPreview?.excerpt ?? "No searchable source text is available for this contract yet."
              }
              accessibleName="Source preview unavailable"
              nextActionLabel="Open contract"
              nextAction={
                <Link
                  href={activeContract.href}
                  className="ui-btn-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px]"
                >
                  Open contract
                </Link>
              }
            />
          )}
        </div>
      </ReviewPaneSection>

      <ReviewPaneSection title="Contract context">
        <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 border-t border-[var(--border-card)] pt-2.5">
          <ContractMetaRow label="Counterparty" value={activeContract.counterparty} emptyLabel="No counterparty" />
          {activeContract.contractType ? <ContractMetaRow label="Type" value={activeContract.contractType} /> : null}
          <ContractMetaRow
            label="Owner"
            value={activeContract.ownerLabel}
            tone={ownerUnassigned ? "warning" : "default"}
          />
          <ContractMetaRow label="Status" value={formatStatusLabel(activeContract.status)} />
          <ContractMetaRow
            label="Files"
            value={files.length > 0 ? `${files.length} ${files.length === 1 ? "file" : "files"}` : null}
            emptyLabel="No files"
          />
          <ContractMetaRow
            label="Confirmed"
            value={`${completedForContract} of ${totalFieldsForContract} details`}
          />
        </dl>
        <Link
          href={activeContract.href}
          className="ui-chip-focus group mt-3 flex items-center justify-between gap-2 rounded-lg border border-[var(--border-card)] bg-[var(--surface-raised)] px-3 py-2 text-[12.5px] font-semibold text-[var(--accent-strong)] transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-card))] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_12%,var(--surface-raised))]"
        >
          Open contract
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden />
        </Link>
      </ReviewPaneSection>
    </div>
  );
}
