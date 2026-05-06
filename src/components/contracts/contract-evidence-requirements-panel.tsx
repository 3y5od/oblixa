import { ApiJsonLink } from "@/components/ui/api-json-link";
import { EvidenceSubmissionReviewActions } from "@/components/contracts/evidence-submission-review-actions";
import { EvidenceSubmissionForm } from "@/components/contracts/evidence-submission-form";
import {
  getEvidenceRequirementStatusLabel,
  getEvidenceRequirementTypeLabel,
} from "@/lib/evidence-display";

type ReqRow = {
  id: string;
  title: string;
  requirement_type: string;
  status: string;
  due_at: string | null;
  review_due_at: string | null;
  work_item_type: string;
  work_item_id: string;
};

type LatestSubmission = {
  id: string;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  payload_json: Record<string, unknown> | null;
};

function linkedWorkItemLabel(workItemType: string): string {
  if (workItemType === "approval") return "approval";
  if (workItemType === "obligation") return "obligation";
  return "task";
}

function nextActorLabel(status: string): string {
  if (status === "submitted") return "Reviewer with approval permissions";
  if (status === "rejected") return "Evidence provider or contract owner";
  return "Evidence provider or contract owner";
}

function compactRequirementStatusLabel(status: string): string {
  if (status === "required") return "Requested";
  if (status === "submitted") return "Submitted";
  if (status === "rejected") return "Rejected";
  return getEvidenceRequirementStatusLabel(status);
}

export function ContractEvidenceRequirementsPanel({
  requirements,
  canEdit,
  canReview,
  contractId,
  latestSubmissionByRequirement,
}: {
  requirements: ReqRow[];
  canEdit: boolean;
  canReview?: boolean;
  contractId: string;
  latestSubmissionByRequirement?: Record<string, LatestSubmission | undefined>;
}) {
  if (requirements.length === 0) {
    return (
      <p className="text-sm text-[var(--text-tertiary)]">
        No structured evidence requirements on this contract yet. Apply a program that references{" "}
        <code className="text-xs">evidenceTemplateIds</code> or add templates in Evidence studio.
      </p>
    );
  }

  return (
    <ul className="space-y-3 text-sm">
      {requirements.map((r) => (
        <li
          key={r.id}
          className="rounded-lg border border-[var(--border-subtle)] px-3 py-3"
          data-v9-evidence-req-status={r.status}
        >
          {(() => {
            const latestSubmission = latestSubmissionByRequirement?.[r.id];
            const note =
              latestSubmission?.payload_json && typeof latestSubmission.payload_json.note === "string"
                ? latestSubmission.payload_json.note
                : null;
            const workItemLabel = linkedWorkItemLabel(r.work_item_type);
            const statusLabel = compactRequirementStatusLabel(r.status);
            const requirementTypeLabel = getEvidenceRequirementTypeLabel(r.requirement_type);
            return (
              <>
          <p className="font-medium text-[var(--text-primary)]">{r.title}</p>
          <div className="mt-1 space-y-1 text-xs text-[var(--text-tertiary)]">
            <p>
              {requirementTypeLabel} · {statusLabel}
              {r.due_at ? ` · due ${r.due_at.slice(0, 10)}` : ""}
              {r.review_due_at ? ` · review by ${r.review_due_at.slice(0, 10)}` : ""}
            </p>
            <p>
              Why it matters: this evidence still affects the linked{" "}
              <span className="font-medium text-[var(--text-secondary)]">
                {workItemLabel} {r.work_item_id.slice(0, 8)}…
              </span>
            </p>
            <p>
              Who should act next:{" "}
              <span className="font-medium text-[var(--text-secondary)]">{nextActorLabel(r.status)}</span>
            </p>
            {note ? (
              <p>
                Latest submission: <span className="font-medium text-[var(--text-secondary)]">{note}</span>
              </p>
            ) : null}
            {latestSubmission?.submitted_at ? (
              <p>
                Last submitted {latestSubmission.submitted_at.slice(0, 10)}
                {latestSubmission.reviewed_at ? ` · reviewed ${latestSubmission.reviewed_at.slice(0, 10)}` : ""}
              </p>
            ) : null}
            {r.status === "rejected" ? (
              <>
                <p className="font-medium text-rose-700">
                  Rejected evidence still needs a corrected resubmission.
                </p>
                {latestSubmission?.rejection_reason ? (
                  <p className="font-medium text-rose-700">
                    Rejection reason: {latestSubmission.rejection_reason}
                  </p>
                ) : null}
              </>
            ) : r.status === "submitted" ? (
              <p className="font-medium text-amber-700">
                Submission is waiting for review before the linked work item can clear.
              </p>
            ) : r.status === "required" ? (
              <p className="font-medium text-amber-700">
                This requirement is still blocking completion of the linked work item.
              </p>
            ) : null}
          </div>
          {canEdit && (r.status === "required" || r.status === "rejected") ? (
            <EvidenceSubmissionForm
              requirementId={r.id}
              status={r.status as "required" | "rejected"}
            />
          ) : null}
          {canReview && latestSubmission?.id && latestSubmission.status === "submitted" ? (
            <EvidenceSubmissionReviewActions submissionId={latestSubmission.id} />
          ) : null}
              </>
            );
          })()}
        </li>
      ))}
      <li className="text-xs text-[var(--text-tertiary)]">
        <ApiJsonLink href={`/api/evidence/export/${contractId}`} className="ui-link">
          Export evidence pack (JSON)
        </ApiJsonLink>
      </li>
    </ul>
  );
}
