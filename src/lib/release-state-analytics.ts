export const RELEASE_STATE_ANALYTICS_EVENTS = [
  "product.v10.access_requested",
  "product.v10.request_qualified",
  "product.v10.tracker_reviewed",
  "product.v10.evaluation_workspace_started",
  "product.v10.calibration_completed",
  "product.v10.first_contract_uploaded",
  "product.v10.extraction_completed",
  "product.v10.field_reviewed",
  "product.v10.owner_assigned",
  "product.v10.key_date_added",
  "product.v10.work_item_created",
  "product.v10.evidence_requested",
  "product.v10.report_exported",
  "product.v10.activation_completed",
  "product.v10.founder_support_time_recorded",
  "product.v10.evaluation_converted",
  "product.v10.evaluation_paused",
  "product.v10.evaluation_closed",
] as const;

export type ReleaseStateAnalyticsEvent = (typeof RELEASE_STATE_ANALYTICS_EVENTS)[number];

export type ReleaseStateActivationInput = {
  uploadedContract: boolean;
  approvedSourceBackedField: boolean;
  assignedOwner: boolean;
  addedKeyDate: boolean;
  dashboardOrWorkUpdated: boolean;
};

export function isReleaseStateActivationComplete(input: ReleaseStateActivationInput): boolean {
  return (
    input.uploadedContract &&
    input.approvedSourceBackedField &&
    (input.assignedOwner || input.addedKeyDate) &&
    input.dashboardOrWorkUpdated
  );
}

export const RELEASE_STATE_METRIC_DEFINITIONS = {
  access_request_to_qualified: {
    numeratorEvent: "product.v10.request_qualified",
    denominatorEvent: "product.v10.access_requested",
    target: 0.3,
  },
  qualified_to_tracker_reviewed: {
    numeratorEvent: "product.v10.tracker_reviewed",
    denominatorEvent: "product.v10.request_qualified",
    target: 0.5,
  },
  evaluation_started_to_calibration_complete: {
    numeratorEvent: "product.v10.calibration_completed",
    denominatorEvent: "product.v10.evaluation_workspace_started",
    target: 0.7,
  },
  calibration_to_first_upload: {
    numeratorEvent: "product.v10.first_contract_uploaded",
    denominatorEvent: "product.v10.calibration_completed",
    target: 0.5,
  },
  first_upload_to_reviewed_field: {
    numeratorEvent: "product.v10.field_reviewed",
    denominatorEvent: "product.v10.first_contract_uploaded",
    target: 0.4,
  },
  activation_complete: {
    numeratorEvent: "product.v10.activation_completed",
    denominatorEvent: "product.v10.evaluation_workspace_started",
    target: 0.25,
  },
  activation_to_evaluation_converted: {
    numeratorEvent: "product.v10.evaluation_converted",
    denominatorEvent: "product.v10.activation_completed",
    target: 0.2,
  },
  activated_workspace_support_burden_recorded: {
    numeratorEvent: "product.v10.founder_support_time_recorded",
    denominatorEvent: "product.v10.activation_completed",
    target: 1,
  },
} as const;
