export const RELEASE_STATE_ANALYTICS_EVENTS = [
  "product.v10.signup_completed",
  "product.v10.calibration_completed",
  "product.v10.first_contract_uploaded",
  "product.v10.extraction_completed",
  "product.v10.field_reviewed",
  "product.v10.owner_assigned",
  "product.v10.key_date_added",
  "product.v10.work_item_created",
  "product.v10.evidence_requested",
  "product.v10.report_exported",
  "product.v10.trial_converted",
  "product.v10.pilot_converted",
  "product.v10.cancellation_recorded",
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
  signup_to_calibration_complete: {
    numeratorEvent: "product.v10.calibration_completed",
    denominatorEvent: "product.v10.signup_completed",
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
    denominatorEvent: "product.v10.signup_completed",
    target: 0.25,
  },
  self_serve_trial_to_paid: {
    numeratorEvent: "product.v10.trial_converted",
    denominatorEvent: "product.v10.signup_completed",
    target: 0.05,
  },
  guided_pilot_to_paid: {
    numeratorEvent: "product.v10.pilot_converted",
    denominatorEvent: "product.v10.calibration_completed",
    target: 0.3,
  },
  first_month_paid_retention: {
    numeratorEvent: "product.v10.release_check_recorded",
    denominatorEvent: "product.v10.trial_converted",
    target: 0.85,
  },
  support_response_same_business_day: {
    numeratorEvent: "product.v10.release_check_recorded",
    denominatorEvent: "product.v10.release_check_recorded",
    target: 1,
  },
} as const;
