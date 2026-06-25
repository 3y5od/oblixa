import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, FileWarning } from "lucide-react";
import { RecoverableState } from "@/components/ui/recoverable-state";
import type {
  FieldReviewActiveContract,
  FieldReviewActiveField,
  FieldReviewDocumentPreview,
} from "@/lib/field-review/model";
import { ReviewCitation } from "./review-citation";
import { ReviewFileSwitcher } from "./review-file-switcher";
import { SOURCE_CITATION_ANCHOR, formatStatusLabel, renderExcerptWithHighlight } from "./review-helpers";

const PREVIEW_ANCHOR = "review-source-preview";

/** Stacked evidence object (Citation / Preview / Contract) with a consistent
 *  header row that can carry a trailing status badge. An optional `id` makes the
 *  section a jump target (the decision pane links the value to the citation).
 *  `emphasis="quiet"` shrinks the label so a secondary section (contract context)
 *  visibly yields to the dominant source excerpt. */
function ReviewPaneSection({
  title,
  badge,
  id,
  emphasis = "default",
  hideTitle = false,
  className,
  children,
}: {
  title: string;
  badge?: ReactNode;
  id?: string;
  emphasis?: "default" | "quiet";
  /** Drop the visible heading for a section whose content already identifies
   *  itself (e.g. the source sheet IS the preview). The `aria-label` on the
   *  <section> keeps the name for assistive tech, so the label is demoted
   *  visually without being lost. */
  hideTitle?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-label={title} className={`${id ? "scroll-mt-3 " : ""}${className ?? ""}`.trim() || undefined}>
      {/* Section label — a quiet heading carried by weight + spacing, NOT another
          hairline underline (§4: the column header is the one firm rule in this
          pane; each sub-section yields to space so the source sheet stays the
          focal object). Deliberately not sticky — stacking `top-0` headers in this
          single scrolling pane made a pinned label collide with the text beneath. */}
      {hideTitle ? null : (
        <div className="flex items-center justify-between gap-2 pb-0.5">
          <p
            className={`font-semibold leading-tight ${
              emphasis === "quiet"
                ? "text-[10.5px] uppercase tracking-[0.05em] text-[var(--text-tertiary)]"
                : "text-[12px] text-[var(--text-secondary)]"
            }`}
          >
            {title}
          </p>
          {badge ?? null}
        </div>
      )}
      <div className={hideTitle ? undefined : "mt-2.5"}>{children}</div>
    </section>
  );
}

/** One label/value row in the right-rail Contract context ledger. The reserved
 *  label column keeps values aligned; a long value wraps within its column
 *  (never a meaning-losing "…" truncation); a missing value renders the empty
 *  label as visible muted text, and `tone="warning"` flags an actionable gap. */
function ContractLedgerRow({
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
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 whitespace-nowrap text-[11.5px] font-medium leading-tight text-[var(--text-tertiary)]">
        {label}
      </dt>
      <dd
        className={`flex min-w-0 items-baseline justify-end gap-1.5 text-right text-[12.5px] font-medium ${value ? color : "text-[var(--text-tertiary)]"}`}
      >
        <span className="min-w-0 break-words">{value ?? emptyLabel}</span>
      </dd>
    </div>
  );
}

interface ReviewEvidenceRailProps {
  activeField: FieldReviewActiveField;
  activeContract: FieldReviewActiveContract;
  documentPreview: FieldReviewDocumentPreview | null;
  completedForContract: number;
  totalFieldsForContract: number;
}

/** Source support: the citation, the dominant source excerpt, and contract
 *  context as evidence beside the decision. The excerpt is the hero of this pane
 *  — staged as a source page (document cap, ruled margin, generous leading) with
 *  the suggested value highlighted; the citation is the compact "what supports
 *  this" above it, and contract context is a quiet secondary ledger below. */
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
  // The excerpt highlight marks the located value (or, falling back, the cited
  // clause). Show the legend only when there is something to highlight, so the
  // caption never claims a mark the reader cannot see.
  const hasHighlight =
    previewAvailable && !!(documentPreview?.valueText?.trim() || activeField.sourceSnippet?.trim());

  return (
    <div>
      {/* Column role header — names the right column as the source-evidence area
          (parallel to the decision column's identity). One prominent column label
          over uniformly quiet sub-section labels = two clean hierarchy levels, not
          four competing ones. */}
      <div className="mb-5 border-b border-[var(--border-card)] pb-2.5">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.07em] leading-none text-[var(--text-secondary)]">
          Source evidence
        </p>
      </div>

      <ReviewPaneSection title="Where Oblixa found it" emphasis="quiet" id={SOURCE_CITATION_ANCHOR}>
        <ReviewCitation
          sourceSnippet={activeField.sourceSnippet}
          /* Positive citation framing keys on the value-located trust signal
             (sourceQuality === "located"), not on a clause-only match, so the
             citation never claims source-backed for a value the decision pane
             shows as "Source not found". */
          sourceBacked={activeField.sourceQuality === "located"}
          previewAnchor={PREVIEW_ANCHOR}
        />
      </ReviewPaneSection>

      <ReviewPaneSection title="Source preview" hideTitle className="mt-6">
        <div className="space-y-2.5">
          {/* Single, consolidated source-file state — stated once here where it
              changes how the preview should be read. The contract-context ledger
              below carries the same fact only as quiet secondary metadata, never
              a second warning callout. */}
          {noSources ? (
            <p className="flex items-start gap-1.5 rounded-md border border-[color:color-mix(in_oklab,var(--warning-ink)_16%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--warning-soft)_12%,var(--surface-raised))] px-2.5 py-2 text-[11.5px] leading-snug text-[var(--text-secondary)]">
              <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning-ink)]" strokeWidth={2} aria-hidden />
              <span>
                Original file not attached.{" "}
                {previewAvailable
                  ? "Searchable text is available for review."
                  : "No searchable text is available either."}
              </span>
            </p>
          ) : (
            <ReviewFileSwitcher files={files} />
          )}
          {previewAvailable ? (
            // The source excerpt staged as a contract page: a lifted paper sheet
            // (warm document ground + sheet shadow), a caption strip that names the
            // source document, a legal-pad left margin with a double rule and a
            // pilcrow (a document-margin motif, §7 — not faked line numbers the
            // source text cannot honor), and generous page leading. The value is
            // marked inside and the foot legend ties the mark to it. This is the
            // dominant object of the pane.
            <figure
              id={PREVIEW_ANCHOR}
              className="scroll-mt-3 overflow-hidden rounded-lg border border-[color:color-mix(in_oklab,var(--border-strong)_36%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--surface-inset)_96%,var(--surface-raised))] shadow-[0_1px_2px_rgba(15,23,42,0.05),0_14px_30px_-22px_rgba(15,23,42,0.4),inset_0_1px_0_rgba(255,255,255,0.45)]"
              /* Paper grain confined to the sheet only — a near-imperceptible warm
                 stipple (~4%, 5px) that reads as fibre, not a pattern. Far weaker
                 than the retired full-column weave; tune the alpha to taste. */
              style={{
                backgroundImage:
                  "radial-gradient(circle, color-mix(in oklab, var(--text-tertiary) 4%, transparent) 0.5px, transparent 0.6px)",
                backgroundSize: "5px 5px",
              }}
            >
              {/* No header chrome — a contract page has no toolbar. The page is just
                  margin + text + a foot legend, so the sheet reads as the document,
                  not a UI panel. The source file identity lives in the contract
                  context ledger below. */}
              <div className="flex">
                {/* Legal-pad left margin: a double margin rule near the inner edge
                    with a pilcrow at the first line — a document-margin motif (§7),
                    not faked line numbers the source text cannot honor. Aligns to the
                    body's top padding + leading so it reads as a contract page margin. */}
                <div
                  aria-hidden
                  className="relative w-12 shrink-0 bg-[color:color-mix(in_oklab,var(--surface-contrast)_26%,transparent)]"
                >
                  <span className="absolute inset-y-0 right-[7px] w-px bg-[color:color-mix(in_oklab,var(--warning-ink)_30%,transparent)]" />
                  <span className="absolute inset-y-0 right-[4px] w-px bg-[color:color-mix(in_oklab,var(--warning-ink)_30%,transparent)]" />
                  <span className="block py-8 pl-3 text-[13px] leading-[1.95] text-[color:color-mix(in_oklab,var(--text-tertiary)_70%,transparent)]">
                    ¶
                  </span>
                </div>
                {/* The excerpt is NOT a nested scroll region: the source rail is the
                    single scroll boundary for citation → excerpt → context. Generous,
                    symmetric page margins so the text reads as a contract page. */}
                <div className="min-w-0 flex-1 px-8 py-8 text-[14px] leading-[1.95] text-[var(--text-primary)] sm:px-10">
                  {renderExcerptWithHighlight(
                    documentPreview?.excerpt ?? "",
                    activeField.sourceSnippet,
                    documentPreview?.valueText
                  )}
                </div>
              </div>
              {hasHighlight ? (
                <figcaption className="flex items-center gap-1.5 border-t border-[color:color-mix(in_oklab,var(--border-strong)_30%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_38%,var(--surface-inset))] px-4 py-2 text-[11px] leading-snug text-[var(--text-tertiary)]">
                  <span
                    aria-hidden
                    className="inline-block h-3 w-4 shrink-0 rounded-[2px] border-b-[1.5px] border-[color:color-mix(in_oklab,var(--warning-ink)_65%,transparent)] bg-[color:color-mix(in_oklab,var(--warning-soft)_82%,transparent)]"
                  />
                  Highlighted text is the suggested value, located in the source.
                </figcaption>
              ) : null}
            </figure>
          ) : (
            <RecoverableState
              state="partial"
              density="compact"
              surface="contracts/review"
              section="source-preview"
              title="Source preview unavailable"
              reason={
                documentPreview?.excerpt ??
                "No searchable source text is available for this contract yet. You can still edit this detail or mark it unknown using the decision actions."
              }
              accessibleName="Source preview unavailable"
              nextActionLabel="Open contract record"
              nextAction={
                <Link
                  href={activeContract.href}
                  className="ui-btn-secondary inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px]"
                >
                  Open contract record
                </Link>
              }
            />
          )}
        </div>
      </ReviewPaneSection>

      <ReviewPaneSection title="Contract context" emphasis="quiet" className="mt-8">
        {/* Quiet secondary ledger (not a card-in-a-pane): hairline-ruled rows
            aligned to the pane edge, deliberately subordinate to the source
            excerpt above. Long values wrap rather than truncate into ambiguity. */}
        <dl className="divide-y divide-[var(--border-card)] border-t border-[var(--border-card)]">
          <ContractLedgerRow label="Counterparty" value={activeContract.counterparty} emptyLabel="No counterparty" />
          {activeContract.contractType ? <ContractLedgerRow label="Type" value={activeContract.contractType} /> : null}
          <ContractLedgerRow
            label="Owner"
            value={activeContract.ownerLabel}
            tone={ownerUnassigned ? "warning" : "default"}
          />
          <ContractLedgerRow label="Status" value={formatStatusLabel(activeContract.status)} />
          <ContractLedgerRow
            label="Source file"
            value={files.length > 0 ? `${files.length} ${files.length === 1 ? "file attached" : "files attached"}` : null}
            emptyLabel="Original file not attached"
          />
          <ContractLedgerRow
            label="Confirmed details"
            value={`${completedForContract} of ${totalFieldsForContract} confirmed`}
          />
        </dl>
        <Link
          href={activeContract.href}
          className="ui-chip-focus group mt-2.5 inline-flex items-center gap-1 rounded text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-strong)]"
        >
          Open contract record
          <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden />
        </Link>
      </ReviewPaneSection>
    </div>
  );
}
