import type { ReactNode } from "react";
import type {
  FieldReviewActiveContract,
  FieldReviewActiveField,
  FieldReviewDocumentPreview,
  FieldReviewWorkspaceModel,
  ReviewQueueFilter,
} from "@/lib/field-review/model";
import { ReviewActionBar } from "./review-action-bar";
import { ReviewControlBar } from "./review-control-bar";
import { ReviewDecisionPane } from "./review-decision-pane";
import { ReviewEvidenceRail } from "./review-evidence-rail";
import { ReviewQueueRail } from "./review-queue-rail";

interface ReviewWorkbenchShellProps {
  model: FieldReviewWorkspaceModel;
  activeContract: FieldReviewActiveContract;
  activeField: FieldReviewActiveField;
  documentPreview: FieldReviewDocumentPreview | null;
  viewerId: string;
  queueFilter: ReviewQueueFilter;
  queueSearch: string;
  actions: ReactNode;
}

/** The contract-detail inspection desk. A fixed contract band sits above a queue
 *  rail and a single review unit: the suggested detail (cool inspection register)
 *  and the source proof (warm paper) side by side, with the decision actions as a
 *  formal section spanning both beneath them — so detail · proof · decision read
 *  as one surface rather than three adjacent panes.
 *
 *  Full-height workbench: at `xl` the grid fills the workbench and uses two rows —
 *  `minmax(0,1fr)` for the detail+proof panes (each scrolls internally) and `auto`
 *  for the decision section. The source column is widened so the excerpt reads as
 *  a contract page, not a narrow note. The queue rail is column 1 and spans both
 *  rows. Between `lg` and `xl` the review unit is two panes with the decision
 *  section and queue stacked below; under `lg` everything stacks in DOM order
 *  (detail → proof → decision → queue). */
export function ReviewWorkbenchShell({
  model,
  activeContract,
  activeField,
  documentPreview,
  viewerId,
  queueFilter,
  queueSearch,
  actions,
}: ReviewWorkbenchShellProps) {
  const totalFieldsForContract = model.progress.activeContractTotalFields;
  // "Confirmed" = reviewed (approved/edited) only. Details marked unknown are
  // decided but not trusted, so they are excluded from the confirmed count to
  // match the per-detail "Confirmed detail" state and the reports surface.
  const completedForContract = model.progress.activeContractSegments.reviewed;
  const noSourceFile = activeContract.files.length === 0;

  return (
    <section
      className="ui-card flex flex-col overflow-hidden rounded-lg border-[var(--border-subtle)] xl:min-h-0 xl:flex-1"
      aria-label="Contract review queue workspace"
    >
      <ReviewControlBar
        contractTitle={activeContract.title}
        counterparty={activeContract.counterparty}
        ownerLabel={activeContract.ownerLabel}
        segments={model.progress.activeContractSegments}
        noSourceFile={noSourceFile}
        previewAvailable={documentPreview?.status === "available"}
        activeContractPosition={model.progress.activeContractPosition}
        contractsWaiting={model.progress.contractsWaiting}
        activeFieldPosition={model.progress.activeFieldPosition}
        activeContractPendingFields={model.progress.activeContractPendingFields}
        prevHref={model.prevHref}
        nextHref={model.nextHref}
      />

      {/* Review unit grid: queue (col 1, full height) | the decision region (col 2)
          + the source document (col 3) on the panes row | decision actions spanning
          cols 2-3 on the `auto` row. Two register temperatures separate the columns
          (§13): the decision region is a COOL inspection ground (where you read the
          suggestion and decide) and the source region is WARM document paper (the
          legal basis). The source is the DOMINANT column (it takes the 1fr flex
          while the decision region is capped) because the contract text backs the
          decision; the vertical rules between columns are the firm region
          boundaries. */}
      <div className="grid xl:min-h-0 xl:flex-1 xl:grid-rows-[minmax(0,1fr)_auto] xl:overflow-hidden lg:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)] xl:grid-cols-[minmax(13rem,16rem)_minmax(23rem,33rem)_minmax(26rem,1fr)]">
        {/* DECISION REGION — the suggested detail + trust read on a cool inspection
            ground; the white detail card and the trust panel sit on top as the
            focal layer. A wider max track + a firmer cool ground give the decision
            more weight against the source document opposite. Scrolls internally at xl. */}
        <div className="flex min-h-0 flex-col bg-[color:color-mix(in_oklab,var(--surface-cool)_55%,var(--surface-raised))] lg:col-start-1 lg:row-start-1 xl:col-start-2 xl:row-start-1 xl:h-full xl:border-x xl:border-[var(--border-subtle)]">
          <ReviewDecisionPane activeField={activeField} fieldQueue={model.activeFieldQueue} />
        </div>

        {/* SOURCE DOCUMENT — the dominant region: citation, the wide source excerpt,
            and contract context, on a warm document ground so the region reads as
            the contract source and its internal scroll is an obvious boundary.
            Scrolls internally at xl. */}
        {/* The evidence column reads as paper from TONE + document framing, not a
            surface pattern: the warm inset ground, the staged source sheet, and the
            margin/¶ motifs carry the legal-paper character. (An earlier diagonal
            grain on this ground read as wallpaper at any visible strength; any paper
            texture now lives confined to the source sheet itself, very faint.) */}
        <div className="ui-scroll-subtle border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-inset)_72%,var(--surface-raised))] px-5 pb-9 pt-6 sm:px-7 sm:pb-10 sm:pt-7 lg:col-start-2 lg:row-start-1 lg:border-l lg:border-[var(--border-subtle)] lg:border-t-0 xl:col-start-3 xl:row-start-1 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:border-l-0">
          <ReviewEvidenceRail
            activeField={activeField}
            activeContract={activeContract}
            documentPreview={documentPreview}
            completedForContract={completedForContract}
            totalFieldsForContract={totalFieldsForContract}
          />
        </div>

        {/* DECISION SECTION — the formal review decision, spanning the detail and
            proof so the confirm / edit / mark-unknown / skip controls read as one
            decision for the whole unit rather than a footer bolted to the detail.
            Carries the active suggested value so the primary action sits beside the
            datum it commits. */}
        <div className="lg:col-span-2 lg:row-start-2 xl:col-start-2 xl:col-span-2 xl:row-start-2 xl:border-l xl:border-[var(--border-subtle)]">
          <ReviewActionBar fieldLabel={activeField.fieldLabel} suggestedValue={activeField.suggestedValue}>
            {actions}
          </ReviewActionBar>
        </div>

        {/* QUEUE rail — persistent "what's next" list. Full-width strip below the
            unit up to lg; a left sidebar column spanning both rows at xl. */}
        <ReviewQueueRail
          queue={model.queue}
          page={model.page}
          pageSize={model.pageSize}
          activeContractId={activeContract.id}
          activeFieldId={activeField.id}
          viewerId={viewerId}
          queueFilter={queueFilter}
          queueSearch={queueSearch}
        />
      </div>
    </section>
  );
}
