import type { V10DueState, V10Severity } from "./release-contract";

export type V10ApprovalDecision = "approved" | "rejected" | "changes_requested";
export type V10ApprovalSlaState = "none" | "due_today" | "due_soon" | "overdue" | "breached";
export type V10ExceptionResolutionAction =
  | "accepted_risk"
  | "fixed"
  | "converted_to_task"
  | "evidence_requested"
  | "escalated_to_approval"
  | "campaign_created"
  | "finding_linked";
export type V10ApprovalExceptionRecordType = "approval" | "exception" | "decision";
export type V10ExceptionResolutionActionFeatureKey = "campaigns" | "findings";
export type V10ExceptionResolutionActionOption = {
  value: V10ExceptionResolutionAction;
  label: string;
  requiredFeature?: V10ExceptionResolutionActionFeatureKey;
};

export const V10_EXCEPTION_RESOLUTION_ACTION_OPTIONS: readonly V10ExceptionResolutionActionOption[] = [
  { value: "fixed", label: "Mark fixed" },
  { value: "accepted_risk", label: "Accept risk" },
  { value: "converted_to_task", label: "Convert to task" },
  { value: "evidence_requested", label: "Request evidence" },
  { value: "escalated_to_approval", label: "Escalate to approval" },
  { value: "campaign_created", label: "Create campaign", requiredFeature: "campaigns" },
  { value: "finding_linked", label: "Link finding", requiredFeature: "findings" },
];

export function getV10ExceptionResolutionActionFeature(
  action: V10ExceptionResolutionAction
): V10ExceptionResolutionActionFeatureKey | null {
  return V10_EXCEPTION_RESOLUTION_ACTION_OPTIONS.find((option) => option.value === action)?.requiredFeature ?? null;
}

export function getV10ExceptionResolutionActionLabel(action: V10ExceptionResolutionAction): string {
  return V10_EXCEPTION_RESOLUTION_ACTION_OPTIONS.find((option) => option.value === action)?.label ?? action;
}

export function getV10ExceptionResolutionActionOptions(input?: {
  campaignsEnabled?: boolean;
  findingsEnabled?: boolean;
}): V10ExceptionResolutionActionOption[] {
  return V10_EXCEPTION_RESOLUTION_ACTION_OPTIONS.filter((option) => {
    if (option.requiredFeature === "campaigns") return input?.campaignsEnabled === true;
    if (option.requiredFeature === "findings") return input?.findingsEnabled === true;
    return true;
  });
}

export function deriveV10ApprovalSlaState(input: {
  dueState: V10DueState;
  overdueDays?: number;
}): V10ApprovalSlaState {
  if (input.dueState === "overdue" && (input.overdueDays ?? 0) > 7) return "breached";
  if (input.dueState === "overdue") return "overdue";
  if (input.dueState === "due_today") return "due_today";
  if (input.dueState === "due_soon") return "due_soon";
  return "none";
}

export function validateV10ApprovalDecision(input: {
  status: string;
  decision: V10ApprovalDecision;
  note?: string | null;
}): string[] {
  const failures: string[] = [];
  if (input.status !== "pending") failures.push("approval_not_pending");
  if ((input.decision === "rejected" || input.decision === "changes_requested") && !input.note?.trim()) {
    failures.push("decision_note_required");
  }
  return failures;
}

export function validateV10ExceptionResolution(input: {
  resolutionAction: string;
  severity?: V10Severity;
  note?: string | null;
}): string[] {
  const allowed = new Set<V10ExceptionResolutionAction>([
    "accepted_risk",
    "fixed",
    "converted_to_task",
    "evidence_requested",
    "escalated_to_approval",
    "campaign_created",
    "finding_linked",
  ]);
  const failures: string[] = [];
  if (!allowed.has(input.resolutionAction as V10ExceptionResolutionAction)) failures.push("resolution_action_invalid");
  if ((input.severity === "critical" || input.severity === "high") && !input.note?.trim()) {
    failures.push("resolution_note_required_for_high_risk");
  }
  return failures;
}

export function getV10ApprovalExceptionContinuityTarget(input: {
  recordType: V10ApprovalExceptionRecordType;
  status: string;
  contractId?: string | null;
}): string {
  const contractBase = input.contractId ? `/contracts/${input.contractId}` : null;
  if (input.recordType === "decision") return contractBase ? `${contractBase}?tab=overview#renewal-decision` : "/decisions";
  if (input.recordType === "approval") {
    if (input.status === "pending" || input.status === "blocked") {
      return contractBase ? `${contractBase}?tab=overview#renewal-approvals` : "/work?lens=automation_approvals";
    }
    return contractBase ? `${contractBase}?tab=audit` : "/contracts/approvals";
  }
  if (input.status === "resolved" || input.status === "closed") {
    return contractBase ? `${contractBase}?tab=audit` : "/contracts/exceptions?status=resolved";
  }
  return contractBase ? `${contractBase}?tab=overview#contract-exceptions` : "/contracts/exceptions?status=open";
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { deriveV10ApprovalSlaState as deriveApprovalSlaState };
export { getV10ApprovalExceptionContinuityTarget as getApprovalExceptionContinuityTarget };
export { getV10ExceptionResolutionActionFeature as getExceptionResolutionActionFeature };
export { getV10ExceptionResolutionActionLabel as getExceptionResolutionActionLabel };
export { getV10ExceptionResolutionActionOptions as getExceptionResolutionActionOptions };
export { V10_EXCEPTION_RESOLUTION_ACTION_OPTIONS as EXCEPTION_RESOLUTION_ACTION_OPTIONS };
export { validateV10ApprovalDecision as validateApprovalDecision };
export { validateV10ExceptionResolution as validateExceptionResolution };
export type { V10ApprovalDecision as ApprovalDecision };
export type { V10ApprovalExceptionRecordType as ApprovalExceptionRecordType };
export type { V10ApprovalSlaState as ApprovalSlaState };
export type { V10ExceptionResolutionAction as ExceptionResolutionAction };
export type { V10ExceptionResolutionActionFeatureKey as ExceptionResolutionActionFeatureKey };
export type { V10ExceptionResolutionActionOption as ExceptionResolutionActionOption };
// End version-name compatibility aliases.
