import { describe, expect, it } from "vitest";
import {
  RELEASE_STATE_ANALYTICS_EVENTS,
  RELEASE_STATE_METRIC_DEFINITIONS,
  isReleaseStateActivationComplete,
} from "@/lib/release-state-analytics";
import { PRODUCT_TELEMETRY_ACTIONS } from "@/lib/product-telemetry";

describe("release-state analytics", () => {
  it("defines the launch funnel events in the product telemetry allowlist", () => {
    for (const event of RELEASE_STATE_ANALYTICS_EVENTS) {
      expect(PRODUCT_TELEMETRY_ACTIONS).toContain(event);
    }
  });

  it("requires upload, reviewed source-backed field, owner or date, and updated state for activation", () => {
    expect(
      isReleaseStateActivationComplete({
        uploadedContract: true,
        approvedSourceBackedField: true,
        assignedOwner: true,
        addedKeyDate: false,
        dashboardOrWorkUpdated: true,
      })
    ).toBe(true);
    expect(
      isReleaseStateActivationComplete({
        uploadedContract: true,
        approvedSourceBackedField: true,
        assignedOwner: false,
        addedKeyDate: true,
        dashboardOrWorkUpdated: true,
      })
    ).toBe(true);
    expect(
      isReleaseStateActivationComplete({
        uploadedContract: true,
        approvedSourceBackedField: true,
        assignedOwner: false,
        addedKeyDate: false,
        dashboardOrWorkUpdated: true,
      })
    ).toBe(false);
  });

  it("pins release-state metric targets without requiring an external analytics provider", () => {
    expect(RELEASE_STATE_METRIC_DEFINITIONS.access_request_to_qualified.target).toBe(0.3);
    expect(RELEASE_STATE_METRIC_DEFINITIONS.qualified_to_tracker_reviewed.target).toBe(0.5);
    expect(RELEASE_STATE_METRIC_DEFINITIONS.evaluation_started_to_calibration_complete.target).toBe(0.7);
    expect(RELEASE_STATE_METRIC_DEFINITIONS.calibration_to_first_upload.target).toBe(0.5);
    expect(RELEASE_STATE_METRIC_DEFINITIONS.first_upload_to_reviewed_field.target).toBe(0.4);
    expect(RELEASE_STATE_METRIC_DEFINITIONS.activation_complete.target).toBe(0.25);
    expect(RELEASE_STATE_METRIC_DEFINITIONS.activation_to_evaluation_converted.target).toBe(0.2);
    expect(RELEASE_STATE_METRIC_DEFINITIONS.activated_workspace_support_burden_recorded.target).toBe(1);
  });
});
