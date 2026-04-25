/**
 * Resolve actionable hrefs for `internal_notifications` rows (Core collaboration inbox).
 * Uses entity joins from the caller — the table stores `entity_type` / `entity_id` only.
 */
export function resolveCollaborationInternalNotificationHref(input: {
  notification_type: string;
  entity_type: string | null;
  entity_id: string | null;
  contractIdByApprovalId: ReadonlyMap<string, string>;
  contractIdByCommentId: ReadonlyMap<string, string>;
}): string {
  const { notification_type, entity_type, entity_id } = input;
  if (notification_type === "approval_requested" || entity_type === "contract_approval") {
    if (entity_id) {
      const cid = input.contractIdByApprovalId.get(entity_id);
      if (cid) return `/contracts/${cid}#renewal-approvals`;
    }
    return "/work#approvals";
  }
  if (notification_type === "mention" || entity_type === "field_comment") {
    if (entity_id) {
      const cid = input.contractIdByCommentId.get(entity_id);
      if (cid) return `/contracts/${cid}#field-comments`;
    }
    return "/contracts/collaboration";
  }
  if (notification_type === "task_assigned") {
    if (entity_id) {
      const fromApproval = input.contractIdByApprovalId.get(entity_id);
      if (fromApproval) return `/contracts/${fromApproval}#renewal-approvals`;
      const fromComment = input.contractIdByCommentId.get(entity_id);
      if (fromComment) return `/contracts/${fromComment}#field-comments`;
    }
    return "/work?lens=assigned";
  }
  return "/contracts/collaboration";
}
