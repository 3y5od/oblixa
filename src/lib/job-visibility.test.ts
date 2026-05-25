import { describe, expect, it } from "vitest";
import { V10_JOB_CLASSES, V10_NOTIFICATION_CLASSES } from "./release-contract";
import {
  V10_JOB_NOTIFICATION_RUNTIME_CONTRACTS,
  validateV10JobNotificationRuntimeContracts,
} from "./job-visibility";

describe("V10 job and notification visibility contracts", () => {
  it("covers every job and notification class with recovery, diagnostics, deep links, and audit", () => {
    expect(validateV10JobNotificationRuntimeContracts()).toEqual([]);
    expect(V10_JOB_NOTIFICATION_RUNTIME_CONTRACTS.filter((row) => row.kind === "job").map((row) => row.classKey).sort()).toEqual(
      [...V10_JOB_CLASSES].sort()
    );
    expect(
      V10_JOB_NOTIFICATION_RUNTIME_CONTRACTS.filter((row) => row.kind === "notification").map((row) => row.classKey).sort()
    ).toEqual([...V10_NOTIFICATION_CLASSES].sort());
    expect(V10_JOB_NOTIFICATION_RUNTIME_CONTRACTS.find((row) => row.classKey === "export")).toMatchObject({
      visibilityModel: "v10_job_run_visibility",
      retryOrCancelPolicy: "retry_cancel",
      workItemType: "export_failure",
    });
    expect(V10_JOB_NOTIFICATION_RUNTIME_CONTRACTS.find((row) => row.classKey === "evidence_request")).toMatchObject({
      visibilityModel: "v10_notification_deliveries",
      retryOrCancelPolicy: "suppression_or_preference",
      workItemType: "evidence_request",
    });
  });

  it("rejects incomplete runtime recovery contracts", () => {
    expect(
      validateV10JobNotificationRuntimeContracts([
        {
          classKey: "export",
          kind: "job",
          visibilityModel: "v10_notification_deliveries",
          retryOrCancelPolicy: "retry_only",
          diagnosticRequired: false,
          deepLinkRequired: false,
          auditAction: "export_state_changed",
          workItemType: null,
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "job:export:diagnostic_required",
        "job:export:deep_link_required",
        "job:export:audit_action_required",
        "job:export:job_visibility_required",
        "job_runtime_contract_missing:contract_import",
        "notification_runtime_contract_missing:due_work",
      ])
    );
  });
});
