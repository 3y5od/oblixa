import type { ReactNode } from "react";
import type {
  FieldReviewActiveContract,
  FieldReviewActiveField,
  FieldReviewDocumentPreview,
  FieldReviewWorkspaceModel,
  ReviewQueueFilter,
} from "@/lib/field-review/model";
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

/** The detail confirmation workbench: one bordered frame holding the persistent control bar
 *  and three coordinated panes — queue rail (col 1) | decision (col 2, focal) |
 *  evidence (col 3). On lg the body fills the viewport and each pane scrolls
 *  internally; md drops to decision + evidence with the queue below; mobile
 *  stacks decision → evidence → queue. */
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
  const pendingForContract = model.progress.activeContractPendingFields;
  // "Confirmed" in the contract context = decided (anything not still pending).
  const completedForContract = Math.max(0, totalFieldsForContract - pendingForContract);

  return (
    <section
      className="ui-card overflow-hidden rounded-2xl lg:flex lg:h-[calc(100vh-13rem)] lg:min-h-[32rem] lg:flex-col"
      aria-label="Contract review queue workspace"
    >
      <ReviewControlBar
        contractTitle={activeContract.title}
        segments={model.progress.activeContractSegments}
        activeContractPosition={model.progress.activeContractPosition}
        contractsWaiting={model.progress.contractsWaiting}
        activeFieldPosition={model.progress.activeFieldPosition}
        activeContractPendingFields={model.progress.activeContractPendingFields}
        prevHref={model.prevHref}
        nextHref={model.nextHref}
      />

      {/* Columns: queue 20rem, evidence 22rem, decision flexes. The decision min
          stays minmax(0,1fr) — a hard min (e.g. 30rem) pushes the 3-col total to
          72rem, which overflows the dashboard content box (sidebar steals ~345px)
          and clips the evidence rail until ~1680px. minmax(0,1fr) never overflows
          and the decision is comfortable at 1280px+. */}
      <div className="grid md:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-cols-[20rem_minmax(0,1fr)_22rem]">
        {/* DECISION — the focal surface */}
        <div className="px-5 py-5 sm:px-6 sm:py-6 md:col-start-1 md:row-start-1 lg:col-start-2 lg:min-h-0 lg:overflow-y-auto lg:pb-0">
          <ReviewDecisionPane activeField={activeField} fieldQueue={model.activeFieldQueue} actions={actions} />
        </div>

        {/* EVIDENCE — citation, preview, and contract context beside the decision */}
        <div className="border-t border-[var(--border-subtle)] px-5 py-5 sm:px-6 sm:py-6 md:col-start-2 md:row-start-1 md:border-l md:border-t-0 lg:col-start-3 lg:min-h-0 lg:overflow-y-auto">
          <ReviewEvidenceRail
            activeField={activeField}
            activeContract={activeContract}
            documentPreview={documentPreview}
            completedForContract={completedForContract}
            totalFieldsForContract={totalFieldsForContract}
          />
        </div>

        {/* QUEUE rail — persistent "what's next" list */}
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
