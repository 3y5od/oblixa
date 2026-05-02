import type {
  V10CancellationState,
  V10JobClass,
  V10JobStatus,
  V10NotificationClass,
  V10SourceObjectType,
} from "./v10-release-contract";
import {
  V10_JOB_CLASSES,
  V10_NOTIFICATION_CLASSES,
} from "./v10-release-contract";

export type V10RetryableDiagnostics = {
  diagnostic_id: string;
  failure_category: string;
  user_visible_summary: string;
  retry_eligible: boolean;
  retry_action: string | null;
  support_safe_detail: string;
};

export type V10JobRunVisibility = {
  job_id: string;
  job_class: V10JobClass;
  status: V10JobStatus;
  cancellation_state: V10CancellationState;
  source_type: V10SourceObjectType;
  source_id: string;
  contract_id: string | null;
  completed_count: number;
  failed_count: number;
  skipped_count: number;
  retryable_count: number;
  diagnostic_id: string | null;
  failure_category: string | null;
  user_visible_detail: string;
  retry_action: string | null;
};

export type V10FailureInjectionScenario =
  | "degraded_job_retryable"
  | "degraded_job_terminal"
  | "partial_output_retryable"
  | "stale_read_model"
  | "denied_access"
  | "provider_failure"
  | "recovery_state";

export type V10JobNotificationRuntimeContract = {
  classKey: V10JobClass | V10NotificationClass;
  kind: "job" | "notification";
  visibilityModel: "v10_job_run_visibility" | "v10_notification_deliveries";
  retryOrCancelPolicy: "retry_cancel" | "retry_only" | "suppression_or_preference";
  diagnosticRequired: boolean;
  deepLinkRequired: boolean;
  auditAction: string;
  workItemType: string | null;
};

export const V10_JOB_NOTIFICATION_RUNTIME_CONTRACTS: readonly V10JobNotificationRuntimeContract[] = [
  ...V10_JOB_CLASSES.map((jobClass) => ({
    classKey: jobClass,
    kind: "job" as const,
    visibilityModel: "v10_job_run_visibility" as const,
    retryOrCancelPolicy: jobClass === "billing_sync" ? "retry_only" as const : "retry_cancel" as const,
    diagnosticRequired: true,
    deepLinkRequired: true,
    auditAction: `${jobClass}.state_changed`,
    workItemType: jobClass === "export"
      ? "export_failure"
      : jobClass === "report_generation" || jobClass === "report_delivery"
        ? "report_failure"
        : jobClass === "contract_import"
          ? "import_failure"
          : jobClass === "extraction" || jobClass === "file_upload"
            ? "extraction_failure"
            : jobClass === "automation_execution"
              ? "automation_approval"
              : null,
  })),
  ...V10_NOTIFICATION_CLASSES.map((notificationClass) => ({
    classKey: notificationClass,
    kind: "notification" as const,
    visibilityModel: "v10_notification_deliveries" as const,
    retryOrCancelPolicy: "suppression_or_preference" as const,
    diagnosticRequired: true,
    deepLinkRequired: true,
    auditAction: `${notificationClass}.delivery_attempted`,
    workItemType: notificationClass.includes("approval")
      ? "approval"
      : notificationClass.includes("evidence")
        ? "evidence_request"
        : notificationClass.includes("exception")
          ? "exception"
          : notificationClass.includes("renewal")
            ? "renewal_checkpoint"
            : notificationClass.includes("import")
              ? "import_failure"
              : notificationClass.includes("export")
                ? "export_failure"
                : notificationClass.includes("report")
                  ? "report_failure"
                  : "contract_task",
  })),
] as const;

export function normalizeV10JobStatus(status: string, counts?: { failed?: number; retryable?: number }): V10JobStatus {
  switch (status) {
    case "pending":
    case "queued":
      return "queued";
    case "processing":
    case "running":
      return "running";
    case "completed":
    case "succeeded":
    case "success":
      return (counts?.failed ?? 0) > 0 ? "partial" : "succeeded";
    case "retrying":
      return "retrying";
    case "canceled":
    case "cancelled":
      return "canceled";
    case "partial":
      return "partial";
    case "failed_retryable":
      return "failed_retryable";
    case "failed_terminal":
      return "failed_terminal";
    case "failed":
      return (counts?.retryable ?? 0) > 0 ? "failed_retryable" : "failed_terminal";
    default:
      return "failed_terminal";
  }
}

export function isV10JobRetryable(status: V10JobStatus, retryableCount = 0): boolean {
  return status === "failed_retryable" || (status === "partial" && retryableCount > 0);
}

export function getV10CancellationState(input: {
  status: V10JobStatus;
  cancelRequested?: boolean;
  cancelable?: boolean;
}): V10CancellationState {
  if (input.status === "canceled") return "canceled";
  if (input.cancelRequested) return "cancel_requested";
  if (input.status === "queued" || input.status === "running" || input.status === "retrying") {
    return input.cancelable === false ? "not_cancelable" : "cancelable";
  }
  return "not_cancelable";
}

export function buildV10RetryableDiagnostics(input: {
  diagnosticId: string;
  failureCategory: string;
  summary: string;
  retryEligible: boolean;
  retryAction?: string | null;
  detail?: string | null;
}): V10RetryableDiagnostics {
  return {
    diagnostic_id: input.diagnosticId,
    failure_category: input.failureCategory,
    user_visible_summary: input.summary,
    retry_eligible: input.retryEligible,
    retry_action: input.retryEligible ? (input.retryAction ?? "retry") : null,
    support_safe_detail: input.detail ?? input.summary,
  };
}

export function buildV10JobRunVisibility(input: Omit<V10JobRunVisibility, "retry_action"> & { retry_action?: string | null }): V10JobRunVisibility {
  return {
    ...input,
    retry_action: input.retry_action ?? (isV10JobRetryable(input.status, input.retryable_count) ? "retry" : null),
  };
}

export function getV10FailureInjectionScenario(input: {
  status?: V10JobStatus | null;
  retryableCount?: number;
  staleReadModel?: boolean;
  deniedAccess?: boolean;
  providerFailure?: boolean;
  recoveryVisible?: boolean;
}): V10FailureInjectionScenario {
  if (input.deniedAccess) return "denied_access";
  if (input.staleReadModel) return "stale_read_model";
  if (input.providerFailure) return "provider_failure";
  if (input.status === "partial" && (input.retryableCount ?? 0) > 0) return "partial_output_retryable";
  if (input.status === "failed_retryable") return "degraded_job_retryable";
  if (input.status === "failed_terminal") return "degraded_job_terminal";
  return "recovery_state";
}

export function validateV10JobNotificationRuntimeContracts(
  rows: readonly V10JobNotificationRuntimeContract[] = V10_JOB_NOTIFICATION_RUNTIME_CONTRACTS
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.kind}:${row.classKey}`;
    if (seen.has(key)) failures.push(`duplicate_runtime_contract:${key}`);
    seen.add(key);
    if (!row.diagnosticRequired) failures.push(`${key}:diagnostic_required`);
    if (!row.deepLinkRequired) failures.push(`${key}:deep_link_required`);
    if (!row.auditAction.includes(".")) failures.push(`${key}:audit_action_required`);
    if (row.kind === "job" && row.visibilityModel !== "v10_job_run_visibility") failures.push(`${key}:job_visibility_required`);
    if (row.kind === "notification" && row.visibilityModel !== "v10_notification_deliveries") {
      failures.push(`${key}:notification_visibility_required`);
    }
    if (row.kind === "notification" && row.retryOrCancelPolicy !== "suppression_or_preference") {
      failures.push(`${key}:notification_preference_policy_required`);
    }
  }
  for (const jobClass of V10_JOB_CLASSES) {
    if (!seen.has(`job:${jobClass}`)) failures.push(`job_runtime_contract_missing:${jobClass}`);
  }
  for (const notificationClass of V10_NOTIFICATION_CLASSES) {
    if (!seen.has(`notification:${notificationClass}`)) failures.push(`notification_runtime_contract_missing:${notificationClass}`);
  }
  return failures;
}
