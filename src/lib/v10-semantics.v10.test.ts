import { describe, expect, it } from "vitest";
import {
  buildV10ActivationEvidenceSummary,
  buildV10FirstWorkGenerationMetric,
  deriveV10ActivationState,
  findV10DuplicateImportCandidates,
  getV10ActivationBlockedReason,
  isV10ActivationComplete,
  isV10ValidImport,
  isV10ValidUpload,
  validateV10ImportCandidate,
  validateV10UploadCandidate,
} from "./v10-activation-state";
import {
  buildV10ContractNextActionDestination,
  calculateV10ContractHealth,
  getV10ContractNextAction,
  getV10HealthBand,
} from "./v10-contract-health";
import {
  compareV10WorkItems,
  compareV10WorkReadModelRows,
  getV10DeterministicSortKey,
  getV10CompatibleActionGroup,
  getV10DueState,
  getV10OwnerState,
  getV10WorkLensMembership,
  v10WorkReadModelMatchesLens,
} from "./v10-work-semantics";
import { buildV10RenewalReminderSloEvidence, deriveV10RenewalPosture, getV10ReminderEligibility, getV10RenewalCriticalDateDiagnostic, getV10RenewalHorizon } from "./v10-renewal-posture";
import {
  buildV10EvidenceFollowUpSloEvidence,
  getV10EvidenceAccountabilityState,
  getV10EvidenceFollowUpStage,
  getV10EvidenceFollowUpSchedule,
  getV10ExternalLinkState,
  redactV10ExternalResponderState,
  validateV10ExternalEvidenceSubmission,
} from "./v10-evidence-collaboration";
import {
  buildV10JobRunVisibility,
  buildV10RetryableDiagnostics,
  getV10CancellationState,
  getV10FailureInjectionScenario,
  normalizeV10JobStatus,
  isV10JobRetryable,
} from "./v10-job-visibility";
import {
  buildV10ReportExportArtifactManifest,
  describeV10Truncation,
  getV10ReportExportDeliveryState,
  getV10ReportExportReliabilityState,
  isV10AsyncReportOrExportRequired,
  isV10CoreReportFamily,
  neutralizeV10CsvFormulaCell,
  validateV10ReportExportArtifactContract,
} from "./v10-report-export";
import { buildV10SettingsHealthDiagnostics, evaluateV10Eligibility, getV10EligibleFallbackDestination, getV10GovernanceHealthState } from "./v10-governance";
import {
  buildV10MutationResponse,
  buildV10MutationResponseInit,
  classifyV10MutationResponse,
  getV10MutationHttpStatus,
  getV10VersionedMutationOutcome,
  isV10MutationOutcome,
  validateV10ApiResponseSchema,
  validateV10BulkMutationItemResults,
  validateV10IdempotencyKey,
  validateV10MutationRequest,
  validateV10RequiredMutationContracts,
  V10_REQUIRED_MUTATION_CONTRACTS,
} from "./v10-mutation-envelope";
import { canonicalizeV10MutationName, V10_MUTATION_RUNTIME_ALIASES } from "./v10-mutation-rollout";
import { getV10RequestHash } from "./v10-server-contracts";
import {
  canTransitionV10FieldState,
  buildV10DataQualityRemediationWork,
  classifyV10DataQualityGap,
  getV10FieldReviewNextAction,
  getV10CriticalDateBlockers,
  getV10SaveAndNextOutcome,
  isV10RequiredActivationField,
  rankV10ReviewQueueItem,
} from "./v10-field-provenance";
import {
  deriveV10ApprovalSlaState,
  getV10ApprovalExceptionContinuityTarget,
  validateV10ApprovalDecision,
  validateV10ExceptionResolution,
} from "./v10-approval-exception";

const now = new Date("2026-04-25T12:00:00Z");

describe("V10 autonomous semantics", () => {
  it("validates activation upload and import definitions", () => {
    expect(
      isV10ValidUpload({
        fileType: "pdf",
        sizeBytes: 1024,
        textContentLength: 10,
        malwareScanStatus: "passed",
        authenticatedUploader: true,
      })
    ).toBe(true);
    expect(isV10ValidUpload({ fileType: "exe", sizeBytes: 1024, textContentLength: 10, authenticatedUploader: true })).toBe(false);
    expect(isV10ValidUpload({ fileType: "pdf", sizeBytes: 25 * 1024 * 1024, textContentLength: 10, authenticatedUploader: true })).toBe(false);
    expect(isV10ValidUpload({ fileType: "docx", sizeBytes: 1024, textContentLength: 10, malwareScanStatus: "failed", authenticatedUploader: true })).toBe(false);
    expect(
      validateV10UploadCandidate({
        fileType: "zip",
        sizeBytes: 0,
        textContentLength: 0,
        malwareScanStatus: "pending",
        authenticatedUploader: false,
      }).map((failure) => failure.code)
    ).toEqual(expect.arrayContaining(["unauthenticated", "unsupported", "empty", "no_extractable_text", "pending"]));
    expect(isV10ValidImport({ columns: ["title", "counterparty"], rowCount: 100, parseErrorRows: 5, encoding: "utf-8" })).toBe(true);
    expect(isV10ValidImport({ columns: ["title"], rowCount: 100, parseErrorRows: 0, encoding: "utf-8" })).toBe(false);
    expect(
      validateV10ImportCandidate({ columns: ["title"], rowCount: 10_000, parseErrorRows: 501, encoding: "latin1" }).map(
        (failure) => failure.code
      )
    ).toEqual(expect.arrayContaining(["required_column", "too_many_rows", "unsupported", "parse_error_rate"]));
    expect(validateV10ImportCandidate({ columns: ["title", "counterparty"], rowCount: 0, parseErrorRows: 0, encoding: "utf-8" }).map((failure) => failure.code)).toEqual(
      expect.arrayContaining(["empty", "parse_error_rate"])
    );
    expect(
      validateV10ImportCandidate({
        columns: ["title", "counterparty"],
        rowCount: 10,
        parseErrorRows: 0,
        duplicateRecordCount: 2,
        encoding: "utf-8",
      }).map((failure) => failure.code)
    ).toEqual(["duplicate_records"]);
    expect(
      findV10DuplicateImportCandidates([
        { rowId: "1", title: " Master Services Agreement ", counterparty: "Acme", effectiveDate: "2026-04-25" },
        { rowId: "2", title: "master services agreement", counterparty: " ACME ", effectiveDate: "2026-04-25" },
        { rowId: "3", title: "Order Form", counterparty: "Acme", effectiveDate: "2026-04-25" },
      ])
    ).toEqual([
      {
        duplicate_key: "master services agreement|acme|2026-04-25",
        row_ids: ["1", "2"],
        title: "master services agreement",
        counterparty: "acme",
        effective_date: "2026-04-25",
      },
    ]);
  });

  it("derives activation state and blockers", () => {
    const input = {
      acceptedAt: "2026-04-25T12:00:00Z",
      durableJobId: "job_1",
      requiredFieldsTotal: 3,
      requiredFieldsApproved: 2,
      ownerState: "unassigned" as const,
    };
    expect(deriveV10ActivationState(input)).toBe("required_field_review_ready");
    expect(getV10ActivationBlockedReason(input)).toBe("required_fields_unapproved");
    expect(isV10ActivationComplete({ ...input, requiredFieldsApproved: 3, ownerState: "assigned", firstGeneratedWorkItemId: "w1", firstGeneratedWorkItemAt: "2026-04-25T12:01:00Z", dashboardUpdatedAt: "2026-04-25T12:02:00Z" })).toBe(true);
    expect(deriveV10ActivationState({ requiredFieldsTotal: 0, requiredFieldsApproved: 0, ownerState: "unassigned" })).toBe(
      "workspace_prepared"
    );
    expect(deriveV10ActivationState({ acceptedAt: "2026-04-25T12:00:00Z", requiredFieldsTotal: 0, requiredFieldsApproved: 0, ownerState: "unassigned" })).toBe("contract_uploaded_or_imported");
    expect(deriveV10ActivationState({ durableJobId: "job_1", requiredFieldsTotal: 0, requiredFieldsApproved: 0, ownerState: "unassigned" })).toBe("extraction_queued");
    expect(deriveV10ActivationState({ durableJobId: "job_1", extractionStartedAt: "2026-04-25T12:00:00Z", requiredFieldsTotal: 0, requiredFieldsApproved: 0, ownerState: "unassigned" })).toBe("extraction_running");
    expect(deriveV10ActivationState({ extractionPartial: true, requiredFieldsTotal: 0, requiredFieldsApproved: 0, ownerState: "unassigned" })).toBe("extraction_partially_complete");
    expect(deriveV10ActivationState({ extractionFailed: true, requiredFieldsTotal: 0, requiredFieldsApproved: 0, ownerState: "unassigned" })).toBe("extraction_failed");
    expect(deriveV10ActivationState({ acceptedAt: "2026-04-25T12:00:00Z", durableJobId: "job_1", requiredFieldsTotal: 3, requiredFieldsApproved: 3, ownerState: "unassigned" })).toBe("required_fields_approved");
    expect(deriveV10ActivationState({ acceptedAt: "2026-04-25T12:00:00Z", durableJobId: "job_1", requiredFieldsTotal: 3, requiredFieldsApproved: 3, ownerState: "assigned" })).toBe("owner_assigned");
    expect(
      deriveV10ActivationState({
        acceptedAt: "2026-04-25T12:00:00Z",
        durableJobId: "job_1",
        requiredFieldsTotal: 3,
        requiredFieldsApproved: 3,
        ownerState: "assigned",
        firstGeneratedWorkItemId: "work_1",
        firstGeneratedWorkItemAt: "2026-04-25T12:01:00Z",
      })
    ).toBe("first_work_item_generated");
    expect(getV10ActivationBlockedReason({ requiredFieldsTotal: 0, requiredFieldsApproved: 0, ownerState: "assigned" })).toBe("file_acceptance_missing");
    expect(getV10ActivationBlockedReason({ acceptedAt: "2026-04-25T12:00:00Z", durableJobId: "job_1", extractionFailed: true, requiredFieldsTotal: 0, requiredFieldsApproved: 0, ownerState: "assigned" })).toBe("extraction_failed");
    expect(getV10ActivationBlockedReason({ acceptedAt: "2026-04-25T12:00:00Z", durableJobId: "job_1", requiredFieldsTotal: 1, requiredFieldsApproved: 1, ownerState: "unassigned" })).toBe("owner_unassigned");
    expect(getV10ActivationBlockedReason({ acceptedAt: "2026-04-25T12:00:00Z", durableJobId: "job_1", requiredFieldsTotal: 1, requiredFieldsApproved: 1, ownerState: "assigned" })).toBe("first_generated_work_item_missing");
    expect(
      getV10ActivationBlockedReason({
        acceptedAt: "2026-04-25T12:00:00Z",
        durableJobId: "job_1",
        requiredFieldsTotal: 1,
        requiredFieldsApproved: 1,
        ownerState: "assigned",
        firstGeneratedWorkItemId: "work_1",
        dashboardUpdatedAt: "2026-04-25T12:02:00Z",
      })
    ).toBeNull();
    expect(
      buildV10ActivationEvidenceSummary({
        acceptedAt: "2026-04-25T12:00:00Z",
        durableJobId: "job_1",
        requiredFieldsTotal: 1,
        requiredFieldsApproved: 1,
        ownerState: "assigned",
        firstGeneratedWorkItemId: "work_1",
        firstGeneratedWorkItemAt: "2026-04-25T12:01:00Z",
        dashboardUpdatedAt: "2026-04-25T12:02:00Z",
      })
    ).toMatchObject({
      state: "dashboard_updated",
      durable_job_id: "job_1",
      blocked_reason: null,
      next_action: "open_daily_brief",
      ready_for_release_measurement: true,
    });
    expect(
      buildV10FirstWorkGenerationMetric({
        acceptedAt: "2026-04-25T12:00:00Z",
        firstGeneratedWorkItemAt: "2026-04-25T12:09:30Z",
      })
    ).toEqual({
      included: true,
      elapsed_minutes: 9.5,
      within_10_minutes: true,
      exclusion_reason: null,
    });
    expect(buildV10FirstWorkGenerationMetric({ acceptedAt: "bad", firstGeneratedWorkItemAt: "2026-04-25T12:09:30Z" })).toMatchObject({
      included: false,
      exclusion_reason: "invalid_activation_timing",
    });
    expect(buildV10FirstWorkGenerationMetric({ exclusionReason: "duplicate_import" })).toMatchObject({
      included: false,
      exclusion_reason: "duplicate_import",
    });
  });

  it("computes due, owner, lens, compatible group, and sorting semantics", () => {
    expect(getV10DueState("2026-04-25T18:00:00Z", { now })).toBe("due_today");
    expect(getV10DueState("2026-04-24", { now, dateOnly: true })).toBe("overdue");
    expect(getV10DueState("2026-05-03", { now, dateOnly: true })).toBe("due_soon");
    expect(getV10DueState("2026-05-04", { now, dateOnly: true })).toBe("none");
    expect(getV10OwnerState({ ownerUserId: null }, now)).toBe("unassigned");
    expect(getV10OwnerState({ ownerUserId: "u1", ownerLastSignedInAt: "2025-12-01T00:00:00Z" }, now)).toBe("stale");
    const item = {
      id: "w1",
      type: "approval" as const,
      status: "blocked" as const,
      ownerUserId: null,
      dueAt: "2026-04-24",
      dateOnlyDue: true,
      severity: "critical" as const,
      blockedReason: "missing approved date",
      updatedAt: "2026-04-25T11:00:00Z",
    };
    expect(getV10WorkLensMembership(item, now)).toEqual(expect.arrayContaining(["unassigned", "overdue", "blocked", "high_risk"]));
    expect(getV10WorkLensMembership({ ...item, ownerUserId: "team-user", assignedToCurrentTeam: true }, now)).toEqual(
      expect.arrayContaining(["assigned_to_my_team"])
    );
    expect(getV10CompatibleActionGroup(item)).toContain("approval:blocked");
    expect(compareV10WorkItems(item, { ...item, id: "w2", status: "open", blockedReason: null }, now)).toBeLessThan(0);
    expect(
      compareV10WorkReadModelRows(
        {
          type: "approval",
          status: "blocked",
          owner_user_id: null,
          owner_state: "unassigned",
          due_state: "overdue",
          priority: "high",
          severity: "critical",
          source_id: "approval_1",
          updated_at: "2026-04-25T11:00:00Z",
        },
        {
          type: "contract_task",
          status: "open",
          owner_user_id: "user_2",
          owner_state: "assigned",
          due_state: "due_soon",
          priority: "normal",
          severity: "none",
          source_id: "task_1",
          updated_at: "2026-04-25T12:00:00Z",
        }
      )
    ).toBeLessThan(0);
    expect(
      v10WorkReadModelMatchesLens(
        {
          type: "contract_task",
          status: "open",
          owner_user_id: "user_2",
          owner_state: "assigned",
          due_state: "none",
          priority: "normal",
          severity: "none",
          source_id: "task_1",
          updated_at: "2026-04-25T12:00:00Z",
        },
        "user_1",
        "assigned_to_team"
      )
    ).toBe(true);
    expect(
      v10WorkReadModelMatchesLens(
        {
          type: "evidence_request",
          status: "open",
          owner_user_id: "user_2",
          owner_state: "assigned",
          due_state: "overdue",
          priority: "normal",
          severity: "none",
          source_id: "evidence_1",
          updated_at: "2026-04-25T12:00:00Z",
        },
        "user_1",
        "high_risk"
      )
    ).toBe(true);
    expect(
      [
        getV10DeterministicSortKey({ kind: "work", rank: 2, priority: "normal", dueState: "due_soon", sourceId: "b" }),
        getV10DeterministicSortKey({ kind: "work", rank: 2, priority: "normal", dueState: "due_soon", sourceId: "a" }),
      ].sort()
    ).toEqual([
      getV10DeterministicSortKey({ kind: "work", rank: 2, priority: "normal", dueState: "due_soon", sourceId: "a" }),
      getV10DeterministicSortKey({ kind: "work", rank: 2, priority: "normal", dueState: "due_soon", sourceId: "b" }),
    ]);
  });

  it("computes health score and next action deterministically", () => {
    expect(getV10HealthBand(85)).toBe("healthy");
    expect(getV10HealthBand(84)).toBe("watch");
    expect(getV10HealthBand(70)).toBe("watch");
    expect(getV10HealthBand(69)).toBe("at_risk");
    expect(getV10HealthBand(60)).toBe("at_risk");
    expect(getV10HealthBand(59)).toBe("critical");
    const health = calculateV10ContractHealth({
      missingRequiredFieldCount: 1,
      missingCriticalDateCount: 1,
      ownerMissingOrStale: true,
      missingRecommendedFieldCount: 1,
    });
    expect(health.score).toBe(50);
    expect(health.band).toBe("critical");
    expect(getV10ContractNextAction({ overdueApproval: true, unassignedOwner: true })).toBe("overdue_approval");
    expect(
      calculateV10ContractHealth({
        missingRequiredFieldCount: 1,
        missingCriticalDateCount: 1,
        overdueLinkedWorkCount: 1,
        openHighOrCriticalExceptionCount: 1,
        outstandingEvidenceCount: 1,
        renewalNoticeDeadlineInside30Days: true,
        ownerMissingOrStale: true,
        failedOrPartialRetryableJobCount: 1,
        missingRecommendedFieldCount: 1,
      }).deductions.map((deduction) => deduction.key)
    ).toEqual([
      "missing_required_activation_field",
      "missing_or_unapproved_critical_date",
      "overdue_linked_work",
      "open_high_or_critical_exception",
      "outstanding_evidence_not_overdue",
      "renewal_notice_deadline_inside_30_days",
      "missing_or_stale_owner",
      "failed_or_partial_retryable_job",
      "missing_recommended_fields",
    ]);
    expect(calculateV10ContractHealth({ outstandingEvidenceCount: 1, outstandingEvidenceOverdueCount: 1 }).deductions).toEqual([]);
    expect(getV10ContractNextAction({ failedImportOrExtractionBlockingRecordCreation: true, overdueApproval: true })).toBe(
      "failed_import_or_extraction_blocking_record_creation"
    );
    expect(getV10ContractNextAction({ missingRecommendedField: true })).toBe("missing_recommended_field");
    expect(getV10ContractNextAction({})).toBe("no_action_required");
    expect(buildV10ContractNextActionDestination("contract 1", "overdue_evidence_request")).toMatchObject({
      action: "overdue_evidence_request",
      sourceObjectType: "evidence_request",
      href: "/contracts/contract%201?tab=overview#contract-evidence",
      ctaLabel: "Open evidence request",
      recoveryState: "actionable",
    });
    expect(buildV10ContractNextActionDestination("contract_1", "failed_import_or_extraction_blocking_record_creation")).toMatchObject({
      sourceObjectType: "import_job",
      href: "/settings/health#v10-jobs",
      recoveryState: "recoverable",
    });
    expect(buildV10ContractNextActionDestination("contract_1", "no_action_required")).toMatchObject({
      sourceObjectType: "contract",
      href: "/contracts/contract_1",
      recoveryState: "complete",
    });
  });

  it("derives renewal posture from approved dates only", () => {
    expect(getV10ReminderEligibility({ now }).blockedReason).toBe("missing_approved_dates");
    expect(deriveV10RenewalPosture({ now })).toBe("blocked_missing_approved_dates");
    expect(deriveV10RenewalPosture({ currentPosture: "renewed", now })).toBe("completed");
    expect(getV10RenewalHorizon({ approvedRenewalDate: "2026-04-26T12:00:00Z", now })).toBe("1_day");
    expect(getV10RenewalHorizon({ approvedRenewalDate: "2026-05-02T12:00:00Z", now })).toBe("7_days");
    expect(getV10RenewalHorizon({ approvedRenewalDate: "2026-05-09T12:00:00Z", now })).toBe("14_days");
    expect(getV10RenewalHorizon({ approvedNoticeDeadline: "2026-05-20T00:00:00Z", now })).toBe("30_days");
    expect(getV10RenewalHorizon({ approvedRenewalDate: "2026-06-24T12:00:00Z", now })).toBe("60_days");
    expect(getV10RenewalHorizon({ approvedRenewalDate: "2026-07-24T12:00:00Z", now })).toBe("90_days");
    expect(getV10RenewalHorizon({ approvedRenewalDate: "2026-10-22T12:00:00Z", now })).toBe("180_days");
    expect(getV10RenewalHorizon({ approvedRenewalDate: "2027-04-25T12:00:00Z", now })).toBe("365_days");
    expect(deriveV10RenewalPosture({ approvedNoticeDeadline: "2026-05-20T00:00:00Z", now })).toBe("notice_deadline_approaching");
    expect(deriveV10RenewalPosture({ approvedRenewalDate: "2026-06-24T12:00:00Z", now })).toBe("plan");
    expect(deriveV10RenewalPosture({ approvedRenewalDate: "2026-10-22T12:00:00Z", now })).toBe("monitor");
    expect(deriveV10RenewalPosture({ approvedRenewalDate: "2026-04-24T12:00:00Z", now })).toBe("renewal_overdue");
    expect(getV10RenewalCriticalDateDiagnostic({ now })).toBe("missing_approved_dates");
    expect(getV10RenewalCriticalDateDiagnostic({ approvedNoticeDeadline: "2026-04-24T00:00:00Z", now })).toBe("notice_overdue");
    expect(
      getV10RenewalCriticalDateDiagnostic({
        approvedNoticeDeadline: "2026-05-20T00:00:00Z",
        nextCheckpointWorkItemId: "work_1",
        now,
      })
    ).toBe("checkpoint_work_ready");
    expect(getV10RenewalCriticalDateDiagnostic({ approvedRenewalDate: "2026-06-24T12:00:00Z", reminderEligible: false, now })).toBe(
      "monitor_only"
    );
    expect(
      buildV10RenewalReminderSloEvidence({
        approvedNoticeDeadline: "2026-05-20T00:00:00Z",
        nextCheckpointWorkItemId: "work_1",
        now,
      })
    ).toEqual({
      measurement_key: "renewal_reminders",
      included: true,
      reminder_eligible: true,
      diagnostic_id: "checkpoint_work_ready",
      objective_window: "pre_ga_release_candidate",
      next_action: "create_checkpoint_work",
    });
    expect(buildV10RenewalReminderSloEvidence({ now })).toMatchObject({
      included: false,
      diagnostic_id: "missing_approved_dates",
      next_action: "collect_approved_dates",
    });
  });

  it("derives field review next actions from provenance and confidence", () => {
    expect(getV10FieldReviewNextAction({ state: "extracted", confidenceState: "high" })).toBe("approve_high_confidence");
    expect(getV10FieldReviewNextAction({ state: "ambiguous", confidenceState: "low" })).toBe("request_clarification");
    expect(getV10FieldReviewNextAction({ state: "missing" })).toBe("supply_missing_value");
    expect(getV10FieldReviewNextAction({ state: "stale_source" })).toBe("review_stale_source");
    expect(getV10FieldReviewNextAction({ state: "approved" })).toBe("no_action_required");
  });

  it("classifies field provenance gaps, transitions, and review queue priority", () => {
    expect(isV10RequiredActivationField("title")).toBe(true);
    expect(isV10RequiredActivationField("internal_notes")).toBe(false);
    expect(
      classifyV10DataQualityGap({
        required: true,
        dateConflict: true,
        staleSource: true,
        ownerMissing: true,
        reminderBlocked: true,
        reportBlocked: true,
      })
    ).toEqual([
      "missing_required_field",
      "conflicting_dates",
      "stale_extracted_value",
      "no_owner",
      "reminder_blocking_date_gap",
      "report_blocking_data_gap",
    ]);
    expect(canTransitionV10FieldState("extracted", "approved")).toBe(true);
    expect(canTransitionV10FieldState("approved", "rejected")).toBe(false);
    expect(canTransitionV10FieldState("approved", "user_supplied")).toBe(true);
    expect(
      rankV10ReviewQueueItem({
        missingCriticalDates: 1,
        pendingRequiredFields: 2,
        valueUsd: 250_000,
        renewalNoticeDeadlineInside30Days: true,
        openBlockers: 3,
      })
    ).toBe(275);
    expect(
      getV10CriticalDateBlockers({
        effectiveDate: "2026-04-25",
        endDate: "2026-04-24",
        renewalDate: "2026-05-01",
        noticeDeadline: "2026-05-02",
      })
    ).toEqual(["end_before_effective", "notice_after_renewal", "renewal_after_end"]);
    expect(getV10CriticalDateBlockers({})).toEqual(["effective_date_missing", "end_date_missing"]);
    expect(
      buildV10DataQualityRemediationWork({
        contractId: "contract_1",
        gaps: ["duplicate_candidate", "report_blocking_data_gap"],
        auditEventId: "audit_1",
      })
    ).toEqual({
      contract_id: "contract_1",
      work_type: "data_quality_remediation",
      gaps: ["duplicate_candidate", "report_blocking_data_gap"],
      primary_action: "review_duplicate_candidate",
      audit_event_id: "audit_1",
      visible_in_work: true,
    });
    expect(buildV10DataQualityRemediationWork({ contractId: "contract_1", gaps: [] })).toBeNull();
    expect(getV10SaveAndNextOutcome({ currentIndex: 0, totalItems: 3, mutationOutcome: "success", elapsedMs: 450 })).toMatchObject({
      next_index: 1,
      completed_current: true,
      performance_budget_ok: true,
    });
    expect(getV10SaveAndNextOutcome({ currentIndex: 2, totalItems: 3, mutationOutcome: "no_action", elapsedMs: 701 })).toMatchObject({
      next_index: null,
      queue_complete: true,
      performance_budget_ok: false,
      diagnostic_id: "v10_save_and_next_latency_budget_exceeded",
    });
  });

  it("routes approval, decision, and exception continuity targets", () => {
    expect(getV10ApprovalExceptionContinuityTarget({ recordType: "approval", status: "pending", contractId: "c1" })).toBe(
      "/contracts/c1?tab=overview#renewal-approvals"
    );
    expect(getV10ApprovalExceptionContinuityTarget({ recordType: "exception", status: "resolved", contractId: "c1" })).toBe(
      "/contracts/c1?tab=audit"
    );
    expect(getV10ApprovalExceptionContinuityTarget({ recordType: "decision", status: "open" })).toBe("/decisions");
  });

  it("validates approval SLA, decisions, and exception resolution rules", () => {
    expect(deriveV10ApprovalSlaState({ dueState: "overdue", overdueDays: 8 })).toBe("breached");
    expect(deriveV10ApprovalSlaState({ dueState: "overdue", overdueDays: 2 })).toBe("overdue");
    expect(deriveV10ApprovalSlaState({ dueState: "due_soon" })).toBe("due_soon");
    expect(deriveV10ApprovalSlaState({ dueState: "none" })).toBe("none");
    expect(validateV10ApprovalDecision({ status: "pending", decision: "approved" })).toEqual([]);
    expect(validateV10ApprovalDecision({ status: "approved", decision: "approved" })).toEqual(["approval_not_pending"]);
    expect(validateV10ApprovalDecision({ status: "pending", decision: "rejected" })).toEqual(["decision_note_required"]);
    expect(validateV10ApprovalDecision({ status: "pending", decision: "changes_requested", note: "Add evidence." })).toEqual([]);
    expect(validateV10ExceptionResolution({ resolutionAction: "invalid", severity: "high" })).toEqual([
      "resolution_action_invalid",
      "resolution_note_required_for_high_risk",
    ]);
    expect(validateV10ExceptionResolution({ resolutionAction: "fixed", severity: "critical", note: "Mitigated." })).toEqual([]);
  });

  it("validates external evidence privacy and follow-up contracts", () => {
    expect(getV10ExternalLinkState({ tokenValid: false, now })).toBe("invalid");
    expect(getV10ExternalLinkState({ tokenValid: true, expiresAt: "2026-04-24T00:00:00Z", now })).toBe("expired");
    expect(getV10ExternalLinkState({ tokenValid: true, revokedAt: "2026-04-24T00:00:00Z", now })).toBe("revoked");
    expect(validateV10ExternalEvidenceSubmission({ linkState: "invalid", requiredNote: false, fileTypes: ["PDF", "pdf"], allowedFileTypes: ["pdf"] })).toEqual([
      "external_link_invalid",
    ]);
    expect(validateV10ExternalEvidenceSubmission({ linkState: "active", requiredNote: true, note: "", fileTypes: ["exe"], allowedFileTypes: ["pdf"] })).toEqual([
      "required_note_missing",
      "file_type_not_allowed",
    ]);
    expect(validateV10ExternalEvidenceSubmission({ linkState: "revoked", requiredNote: false, fileTypes: ["exe", "exe"], allowedFileTypes: ["pdf"] })).toEqual([
      "external_link_revoked",
      "file_type_not_allowed",
    ]);
    expect(redactV10ExternalResponderState("responder@example.com", true)).toBe("redacted");
    expect(redactV10ExternalResponderState("responder@example.com")).toBe("provided");
    expect(redactV10ExternalResponderState("")).toBe("not_provided");
    expect(getV10EvidenceFollowUpSchedule("2026-04-26T12:00:00Z", now).dueMinus3DaysAt).toBe("2026-04-23T12:00:00.000Z");
    expect(getV10EvidenceFollowUpSchedule("2026-04-26T12:00:00Z", now).overdueStateAt).toBe("2026-04-26T12:05:00.000Z");
    expect(getV10EvidenceFollowUpSchedule("2026-04-26T12:00:00Z", now).ownerNotificationAt).toBe("2026-04-26T13:00:00.000Z");
    expect(getV10EvidenceFollowUpStage(null, now)).toMatchObject({
      overdue: false,
      diagnosticId: "v10_evidence_due_date_missing",
    });
    expect(getV10EvidenceFollowUpStage("2026-04-28T12:00:00Z", now)).toMatchObject({
      dueMinus3DaysReminderDue: true,
      dueDateReminderDue: false,
      overdueStateDue: false,
      diagnosticId: "v10_evidence_due_minus_3_reminder_due",
    });
    expect(getV10EvidenceFollowUpStage("2026-04-25T12:00:00Z", now)).toMatchObject({
      dueMinus3DaysReminderDue: true,
      dueDateReminderDue: true,
      overdueStateDue: false,
      diagnosticId: "v10_evidence_due_date_reminder_due",
    });
    expect(getV10EvidenceFollowUpStage("2026-04-25T11:30:00Z", now)).toMatchObject({
      overdue: true,
      overdueStateDue: true,
      ownerNotificationDue: false,
      escalationWorkItemDue: false,
      diagnosticId: "v10_evidence_overdue",
    });
    expect(getV10EvidenceFollowUpStage("2026-04-25T10:30:00Z", now)).toMatchObject({
      ownerNotificationDue: true,
      escalationWorkItemDue: false,
      diagnosticId: "v10_evidence_owner_notification_due",
    });
    expect(getV10EvidenceFollowUpStage("2026-04-24T12:00:00Z", now)).toMatchObject({
      overdue: true,
      ownerNotificationDue: true,
      escalationWorkItemDue: true,
      diagnosticId: "v10_evidence_escalation_due",
    });
    expect(getV10EvidenceAccountabilityState({})).toBe("no_request");
    expect(getV10EvidenceAccountabilityState({ status: "accepted" })).toBe("accepted");
    expect(getV10EvidenceAccountabilityState({ status: "required", externalLinkState: "active" })).toBe("awaiting_external");
    expect(getV10EvidenceAccountabilityState({ status: "submitted", submissionCount: 1 })).toBe("ready_for_review");
    expect(getV10EvidenceAccountabilityState({ status: "rejected", resubmissionAllowed: true })).toBe("rejected_resubmission_allowed");
    expect(getV10EvidenceAccountabilityState({ status: "required", externalLinkState: "expired" })).toBe("blocked_link_expired");
    expect(getV10EvidenceAccountabilityState({ status: "required", externalLinkState: "revoked" })).toBe("blocked_link_revoked");
    expect(getV10EvidenceAccountabilityState({ status: "required", dueAt: "2026-04-24T12:00:00Z", now })).toBe("overdue_follow_up");
    expect(buildV10EvidenceFollowUpSloEvidence({ dueAt: "2026-04-24T12:00:00Z", now })).toEqual({
      measurement_key: "evidence_follow_up",
      included: true,
      owner_notification_due: true,
      escalation_work_item_due: true,
      retryable_diagnostic_id: "v10_evidence_escalation_due",
      objective_window: "pre_ga_release_candidate",
    });
    expect(buildV10EvidenceFollowUpSloEvidence({ dueAt: "2026-04-24T12:00:00Z", accepted: true, now })).toMatchObject({
      included: false,
      retryable_diagnostic_id: "v10_evidence_escalation_due",
    });
  });

  it("normalizes jobs, exports, governance, and mutation envelopes", () => {
    expect(normalizeV10JobStatus("failed", { retryable: 1 })).toBe("failed_retryable");
    expect(isV10JobRetryable("partial", 1)).toBe(true);
    expect(getV10CancellationState({ status: "running" })).toBe("cancelable");
    expect(getV10CancellationState({ status: "running", cancelable: false })).toBe("not_cancelable");
    expect(getV10CancellationState({ status: "running", cancelRequested: true })).toBe("cancel_requested");
    expect(getV10CancellationState({ status: "canceled" })).toBe("canceled");
    expect(getV10FailureInjectionScenario({ status: "partial", retryableCount: 1 })).toBe("partial_output_retryable");
    expect(getV10FailureInjectionScenario({ staleReadModel: true })).toBe("stale_read_model");
    expect(getV10FailureInjectionScenario({ deniedAccess: true })).toBe("denied_access");
    expect(isV10AsyncReportOrExportRequired({ rowCount: 51 })).toBe(true);
    expect(getV10ReportExportReliabilityState({ rowCount: 51 })).toBe("async_handoff_required");
    expect(getV10ReportExportReliabilityState({ status: "succeeded", selectedRowCount: 10, generatedRowCount: 8 })).toBe("partial_retryable");
    expect(getV10ReportExportReliabilityState({ status: "failed", retryableCount: 1 })).toBe("failed_retryable");
    expect(getV10ReportExportDeliveryState({ deliveryRequested: true })).toBe("queued");
    expect(getV10ReportExportDeliveryState({ deliveryRequested: true, deliveredAt: "2026-04-25T12:00:00Z" })).toBe("sent");
    expect(getV10ReportExportDeliveryState({ deliveryRequested: true, failureCategory: "smtp_timeout" })).toBe("failed_retryable");
    expect(getV10ReportExportDeliveryState({ deliveryRequested: true, failureCategory: "revoked", retryable: false })).toBe("failed_terminal");
    expect(
      buildV10ReportExportArtifactManifest({
        artifactId: "artifact_1",
        family: "renewal_horizon_report",
        selectedRowCount: 10,
        generatedRowCount: 8,
        checksum: "sha256:abc",
        expiresAt: "2026-04-26T00:00:00Z",
        scopedDownloadHref: "/api/export/contracts/job_1",
        retryAction: "retry",
        cancelAction: null,
        revokeAction: "revoke",
        redactionApplied: true,
        csvFormulaNeutralized: true,
        deliveryRequested: true,
        failureCategory: "smtp_timeout",
        now,
      })
    ).toEqual({
      artifact_id: "artifact_1",
      family: "renewal_horizon_report",
      selected_row_count: 10,
      generated_row_count: 8,
      truncation_summary: "8 of 10 selected rows were exported before the row limit was reached.",
      delivery_state: "failed_retryable",
      operational_review_due: true,
      checksum: "sha256:abc",
      scoped_download_href: "/api/export/contracts/job_1",
      expires_at: "2026-04-26T00:00:00Z",
    });
    expect(neutralizeV10CsvFormulaCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    const denied = evaluateV10Eligibility({
      workspaceMode: "core",
      requiredMode: "advanced",
      role: "viewer",
      requiredRole: "viewer",
      plan: "core",
      requiredPlan: "core",
    });
    expect(denied.outcome).toBe("mode_required");
    expect(getV10EligibleFallbackDestination(denied)).toBe("/settings/product");
    expect(getV10GovernanceHealthState({ eligibility: denied })).toBe("configuration_required");
    expect(getV10GovernanceHealthState({ failedJobCount: 1 })).toBe("recovery_visible");
    expect(getV10GovernanceHealthState({})).toBe("healthy");
    expect(
      buildV10SettingsHealthDiagnostics({
        failedJobCount: 2,
        staleReadModelCount: 1,
        notificationFailureCount: 11,
        releaseBlockerCount: 1,
      }).map((row) => row.key)
    ).toEqual(["failed_jobs", "stale_read_models", "notification_failures", "governance_configuration"]);
    expect(validateV10IdempotencyKey("abc_12345")).toBe(true);
    expect(getV10VersionedMutationOutcome({ expectedVersion: null, currentVersion: 1 })).toBe("validation_failed");
    expect(getV10VersionedMutationOutcome({ expectedVersion: "", currentVersion: 1 })).toBe("validation_failed");
    expect(getV10VersionedMutationOutcome({ expectedVersion: 3, currentVersion: 4 })).toBe("stale_version");
    expect(getV10VersionedMutationOutcome({ expectedVersion: 3, currentVersion: 3, changed: false })).toBe("no_action");
    expect(validateV10MutationRequest({ organization_id: "org", target_type: "work_item", target_id: "w1", expected_version: 1, idempotency_key: "bad", client_request_id: "c1" })).toHaveLength(1);
    expect(
      validateV10MutationRequest({
        organization_id: "org",
        target_type: "work_item",
        target_id: "w1",
        expected_version: "",
        idempotency_key: "valid_key_123",
        client_request_id: "c1",
        actor_user_id: "client-forged",
      } as never)
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "expected_version", code: "required" }),
        expect.objectContaining({ field: "actor_user_id", code: "server_derived" }),
      ])
    );
    expect(buildV10MutationResponse({ outcome: "success", message: "Done" }).next_destination_href).toBe("null_no_next_destination");
    expect(getV10RequestHash({ b: 2, a: 1 })).toBe(getV10RequestHash({ a: 1, b: 2 }));
  });

  it("builds support-safe job diagnostics and report/export edge states", () => {
    expect(
      buildV10RetryableDiagnostics({
        diagnosticId: "diag_retry",
        failureCategory: "provider_outage",
        summary: "Provider failed before completion.",
        retryEligible: true,
      })
    ).toEqual({
      diagnostic_id: "diag_retry",
      failure_category: "provider_outage",
      user_visible_summary: "Provider failed before completion.",
      retry_eligible: true,
      retry_action: "retry",
      support_safe_detail: "Provider failed before completion.",
    });
    expect(
      buildV10RetryableDiagnostics({
        diagnosticId: "diag_terminal",
        failureCategory: "invalid_configuration",
        summary: "Configuration blocks retry.",
        retryEligible: false,
        retryAction: "retry",
      }).retry_action
    ).toBeNull();
    expect(
      buildV10JobRunVisibility({
        job_id: "job_1",
        job_class: "contract_import",
        status: "partial",
        cancellation_state: "not_cancelable",
        source_type: "import_job",
        source_id: "import_1",
        contract_id: null,
        completed_count: 5,
        failed_count: 1,
        skipped_count: 0,
        retryable_count: 1,
        diagnostic_id: "diag_partial",
        failure_category: "row_validation",
        user_visible_detail: "Some rows need review.",
      }).retry_action
    ).toBe("retry");
    expect(isV10CoreReportFamily("contract_portfolio_summary")).toBe(true);
    expect(isV10CoreReportFamily("advanced_custom_report")).toBe(false);
    expect(describeV10Truncation({ selectedRowCount: 100, exportedRowCount: 100 })).toBeNull();
    expect(describeV10Truncation({ selectedRowCount: 100, exportedRowCount: 75 })).toContain("75 of 100");
    expect(describeV10Truncation({ selectedRowCount: 100, exportedRowCount: 75, reason: "Async handoff required." })).toBe(
      "Async handoff required."
    );
    expect(
      validateV10ReportExportArtifactContract({
        artifactId: "artifact_1",
        family: "workspace_health_report",
        selectedRowCount: 100,
        generatedRowCount: 75,
        checksum: "sha256:abc",
        expiresAt: "2026-05-25T00:00:00Z",
        scopedDownloadHref: "/api/export/contracts/job_1",
        retryAction: "retry",
        cancelAction: null,
        revokeAction: "revoke",
        redactionApplied: true,
        csvFormulaNeutralized: true,
      })
    ).toEqual([]);
    expect(
      validateV10ReportExportArtifactContract({
        artifactId: "",
        family: "workspace_health_report",
        selectedRowCount: 1,
        generatedRowCount: 2,
        checksum: null,
        expiresAt: null,
        scopedDownloadHref: "https://example.test/private.csv",
        retryAction: null,
        cancelAction: null,
        revokeAction: null,
        redactionApplied: false,
        csvFormulaNeutralized: false,
      })
    ).toEqual(
      expect.arrayContaining([
        "artifact_id_required",
        "generated_count_exceeds_selected",
        "checksum_required",
        "expiry_required",
        "scoped_download_required",
        "redaction_required",
        "csv_formula_neutralization_required",
        "artifact_revoke_required",
      ])
    );
  });

  it("fails closed for cross-org, archived, deleted, plan, role, and hidden-module eligibility", () => {
    const base = {
      workspaceMode: "assurance" as const,
      requiredMode: "core" as const,
      role: "admin" as const,
      requiredRole: "viewer" as const,
      plan: "enterprise" as const,
      requiredPlan: "trial" as const,
    };
    expect(evaluateV10Eligibility({ ...base, sameOrganization: false })).toMatchObject({
      allowed: false,
      outcome: "not_found",
      reason: "wrong_organization",
      visibilityState: "hidden_by_role",
    });
    expect(evaluateV10Eligibility({ ...base, deleted: true })).toMatchObject({
      allowed: false,
      visibilityState: "deleted",
    });
    expect(evaluateV10Eligibility({ ...base, deleted: true, action: "audit_read" })).toMatchObject({
      allowed: true,
      visibilityState: "visible",
    });
    expect(evaluateV10Eligibility({ ...base, archived: true })).toMatchObject({
      allowed: false,
      visibilityState: "archived",
    });
    expect(
      evaluateV10Eligibility({
        ...base,
        role: "viewer",
        requiredRole: "manager",
      })
    ).toMatchObject({ outcome: "forbidden", reason: "role_required" });
    expect(
      evaluateV10Eligibility({
        ...base,
        plan: "core",
        requiredPlan: "advanced",
      })
    ).toMatchObject({ outcome: "plan_required", visibilityState: "hidden_by_plan" });
    expect(evaluateV10Eligibility({ ...base, moduleHidden: true })).toMatchObject({
      outcome: "hidden_module",
      visibilityState: "hidden_by_module",
    });
  });

  it("validates V10 API and server-action response schemas by outcome class", () => {
    const success = buildV10MutationResponse({
      outcome: "success",
      message: "Saved.",
      changedObjectType: "work_item",
      changedObjectId: "w1",
      auditEventId: "audit_1",
    });
    expect(classifyV10MutationResponse(success)).toBe("success");
    expect(validateV10ApiResponseSchema(success)).toEqual([]);
    expect(
      validateV10ApiResponseSchema(
        buildV10MutationResponse({
          outcome: "validation_failed",
          message: "Fix fields.",
        })
      )
    ).toEqual(["validation_failures_required"]);
    expect(
      validateV10ApiResponseSchema(
        buildV10MutationResponse({
          outcome: "stale_version",
          message: "Record changed.",
          diagnosticId: "v10_stale",
        })
      )
    ).toEqual(["refresh_destination_required"]);
    expect(
      validateV10ApiResponseSchema(
        buildV10MutationResponse({
          outcome: "no_action",
          message: "Already up to date. No action was needed.",
        })
      )
    ).toEqual([]);
    expect(validateV10ApiResponseSchema(success, { replayed: true })).toEqual([]);
  });

  it("covers mutation outcome vocabulary and non-success response classes", () => {
    expect(isV10MutationOutcome("success")).toBe(true);
    expect(isV10MutationOutcome("unsupported_outcome")).toBe(false);
    const forbidden = buildV10MutationResponse({ outcome: "forbidden", message: "Access denied." });
    expect(classifyV10MutationResponse(forbidden)).toBe("denial");
    expect(validateV10ApiResponseSchema(forbidden)).toEqual(["diagnostic_id_required"]);
    const retryable = buildV10MutationResponse({
      outcome: "conflict",
      message: "Conflict detected.",
      diagnosticId: "diag_conflict",
      nextDestinationHref: "/work?retry=1",
    });
    expect(classifyV10MutationResponse(retryable)).toBe("retryable");
    expect(validateV10ApiResponseSchema(retryable)).toEqual([]);
    expect(
      validateV10ApiResponseSchema(
        buildV10MutationResponse({
          outcome: "conflict",
          message: "Conflict detected.",
          diagnosticId: "diag_conflict",
        })
      )
    ).toEqual(["retry_destination_required"]);
    const partial = buildV10MutationResponse({
      outcome: "dependency_blocked",
      message: "Some dependencies remain blocked.",
      diagnosticId: "diag_partial",
    });
    expect(classifyV10MutationResponse(partial)).toBe("partial");
    expect(validateV10ApiResponseSchema(partial)).toEqual([]);
    const terminal = buildV10MutationResponse({ outcome: "server_error", message: "Try support diagnostics." });
    expect(classifyV10MutationResponse(terminal)).toBe("terminal");
    expect(validateV10ApiResponseSchema(terminal)).toEqual(["diagnostic_id_required"]);
  });

  it("normalizes V10 mutation HTTP status, replay headers, and bulk item outcomes", () => {
    const stale = buildV10MutationResponse({
      outcome: "stale_version",
      message: "Record changed. Refresh and try again.",
      diagnosticId: "v10_stale",
      nextDestinationHref: "/work?refresh=1",
    });
    const responseInit = buildV10MutationResponseInit(stale, { replayed: true, headers: { "X-Trace-Id": "trace_1" } });

    expect(getV10MutationHttpStatus(stale)).toBe(409);
    expect(responseInit.status).toBe(409);
    expect(new Headers(responseInit.headers).get("cache-control")).toBe("private, no-store");
    expect(new Headers(responseInit.headers).get("x-v10-idempotent-replay")).toBe("true");
    expect(new Headers(responseInit.headers).get("x-trace-id")).toBe("trace_1");
    expect(
      validateV10BulkMutationItemResults([
        {
          target_type: "work_item",
          target_id: "task_1",
          outcome: "success",
          user_visible_message: "Completed.",
          changed_object_id: "task_1",
          audit_event_id: "audit_1",
          diagnostic_id: null,
        },
        {
          target_type: "work_item",
          target_id: "task_2",
          outcome: "stale_version",
          user_visible_message: "Task changed. Refresh and try again.",
          changed_object_id: null,
          audit_event_id: null,
          diagnostic_id: "v10_task_stale",
        },
      ])
    ).toEqual([]);
    expect(
      validateV10BulkMutationItemResults([
        {
          target_type: "work_item",
          target_id: "task_1",
          outcome: "success",
          user_visible_message: "Completed.",
          changed_object_id: "task_1",
          audit_event_id: null,
          diagnostic_id: null,
        },
        {
          target_type: "work_item",
          target_id: "task_1",
          outcome: "forbidden",
          user_visible_message: "Access denied.",
          changed_object_id: null,
          audit_event_id: null,
          diagnostic_id: null,
        },
      ])
    ).toEqual(["item_0_audit_required", "item_1_duplicate_target", "item_1_diagnostic_required"]);
  });

  it("catalogs required V10 mutations with idempotency, audit, and envelope contracts", () => {
    expect(validateV10RequiredMutationContracts()).toEqual([]);
    expect(V10_REQUIRED_MUTATION_CONTRACTS.map((contract) => contract.key)).toEqual(
      expect.arrayContaining([
        "assign_work_item_owner",
        "complete_work_item",
        "bulk_complete_compatible_work_items",
        "approve_field",
        "retry_failed_job",
        "accept_evidence",
        "approve_approval_request",
        "resolve_exception",
        "create_report_run",
        "create_export_job",
        "update_workspace_mode",
      ])
    );
    expect(
      V10_REQUIRED_MUTATION_CONTRACTS.filter((contract) => contract.responseShape === "v10_bulk_mutation_envelope").map(
        (contract) => contract.key
      )
    ).toEqual(expect.arrayContaining(["bulk_assign_compatible_work_items", "bulk_complete_compatible_work_items"]));
    expect(V10_MUTATION_RUNTIME_ALIASES.assign_owner).toBe("assign_work_item_owner");
    expect(canonicalizeV10MutationName("assign_owner")).toBe("assign_work_item_owner");
    expect(canonicalizeV10MutationName("approval.approve")).toBe("approve_approval_request");
    expect(V10_REQUIRED_MUTATION_CONTRACTS.find((contract) => contract.key === "approve_approval_request")).toMatchObject({
      auditAction: "approval.approved",
      minimumRole: "viewer",
    });
    expect(
      validateV10RequiredMutationContracts([
        {
          key: "assign_work_item_owner",
          targetType: "",
          sourceObjectType: "",
          auditAction: "",
          minimumRole: "",
          requiresIdempotency: false,
          requiresAudit: false,
          requiresExpectedVersion: true,
          responseShape: "v10_mutation_envelope",
          runtimeArtifact: "",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "assign_work_item_owner:target_type_required",
        "assign_work_item_owner:source_object_type_required",
        "assign_work_item_owner:audit_action_required",
        "assign_work_item_owner:minimum_role_required",
        "assign_work_item_owner:audit_required",
        "assign_work_item_owner:idempotency_required",
        "assign_work_item_owner:runtime_artifact_required",
        "missing_required_mutation:complete_work_item",
      ])
    );
  });
});
