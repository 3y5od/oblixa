import {
  V10_MUTATION_CATALOG,
  V10_MUTATION_OUTCOMES,
  type V10MutationOutcome,
} from "./v10-release-contract";

export const V10_NULL_NEXT_DESTINATION = "null_no_next_destination" as const;

export type V10MutationRequest = {
  organization_id: string;
  target_type: string;
  target_id: string;
  expected_version: string | number;
  idempotency_key: string;
  client_request_id: string;
};

export type V10ValidationFailure = {
  field: string;
  code: string;
  user_visible_message: string;
  self_fixable: boolean;
};

/** Serialized per-target outcomes for bulk mutations so idempotent replays return stable item rows. */
export type V10BulkItemOutcomeSnapshot = {
  target_id: string;
  outcome: "success" | "no_action" | "validation_failed";
  reason?: string;
  compatible_action_group?: string;
};

export type V10MutationResponse = {
  outcome: V10MutationOutcome;
  user_visible_message: string;
  changed_object_type: string | null;
  changed_object_id: string | null;
  new_version: string | number | null;
  version_metadata: {
    expected_version: string | number | null;
    current_version: string | number | null;
    new_version: string | number | null;
  };
  next_destination_href: string | typeof V10_NULL_NEXT_DESTINATION;
  audit_event_id: string | null;
  diagnostic_id: string | null;
  retry_eligible: boolean;
  replay_state: "not_replayed" | "replayed" | "in_progress" | "payload_conflict";
  validation_failures?: V10ValidationFailure[];
  bulk_item_outcomes?: readonly V10BulkItemOutcomeSnapshot[];
};

export type V10ApiResponseClass =
  | "success"
  | "denial"
  | "validation"
  | "partial"
  | "retryable"
  | "terminal"
  | "stale"
  | "idempotent"
  | "no_action";

export type V10BulkMutationItemResult = {
  target_type: string;
  target_id: string;
  outcome: V10MutationOutcome;
  user_visible_message: string;
  changed_object_id: string | null;
  audit_event_id: string | null;
  diagnostic_id: string | null;
};

export type V10RequiredMutationContract = {
  key: string;
  targetType: string;
  sourceObjectType: string;
  auditAction: string;
  minimumRole: string;
  requiresIdempotency: boolean;
  requiresAudit: boolean;
  requiresExpectedVersion: boolean;
  responseShape: "v10_mutation_envelope" | "v10_bulk_mutation_envelope";
  runtimeArtifact: string;
};

type V10RequiredMutationContractRow = readonly [
  key: string,
  targetType: string,
  sourceObjectType: string,
  requiresIdempotency: boolean,
  requiresAudit: boolean,
  requiresExpectedVersion: boolean,
  runtimeArtifact: string,
  responseShape?: V10RequiredMutationContract["responseShape"],
];

export const V10_EXPECTED_VERSION_EXEMPT_MUTATIONS = ["submit_external_evidence", "create_export_job"] as const;

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9:_-]{8,200}$/;

export const V10_MUTATION_HTTP_STATUS_BY_OUTCOME: Record<V10MutationOutcome, number> = {
  success: 200,
  validation_failed: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  stale_version: 409,
  plan_required: 403,
  mode_required: 403,
  hidden_module: 404,
  rate_limited: 429,
  dependency_blocked: 424,
  job_not_retryable: 409,
  external_link_expired: 410,
  external_link_revoked: 410,
  audit_write_failed: 500,
  no_action: 200,
  server_error: 500,
};

const V10_REQUIRED_MUTATION_CONTRACT_ROWS = [
  ["create_contract_import", "import_job", "import_job", true, true, true, "src/app/api/import/contracts/route.ts"],
  ["assign_work_item_owner", "work_item", "work_item", true, true, true, "src/actions/tasks.ts"],
  ["complete_work_item", "work_item", "work_item", true, true, true, "src/actions/tasks.ts"],
  ["bulk_assign_compatible_work_items", "work_item", "work_item", true, true, true, "src/actions/tasks.ts", "v10_bulk_mutation_envelope"],
  ["bulk_complete_compatible_work_items", "work_item", "work_item", true, true, true, "src/actions/tasks.ts", "v10_bulk_mutation_envelope"],
  ["approve_field", "field", "field", true, true, true, "src/actions/contracts.ts"],
  ["reject_field", "field", "field", true, true, true, "src/actions/contracts.ts"],
  ["edit_and_approve_field", "field", "field", true, true, true, "src/actions/contracts.ts"],
  ["retry_failed_job", "job", "import_job", true, true, true, "src/app/api/import/contracts/[jobId]/route.ts"],
  ["create_evidence_request", "evidence_request", "evidence_request", true, true, true, "src/app/api/evidence/requests/route.ts"],
  ["submit_external_evidence", "external_evidence_submission", "external_evidence_submission", true, true, false, "src/app/api/evidence/submit/route.ts"],
  ["accept_evidence", "evidence_request", "evidence_request", true, true, true, "src/app/api/evidence/[id]/[action]/route.ts"],
  ["reject_evidence", "evidence_request", "evidence_request", true, true, true, "src/app/api/evidence/[id]/[action]/route.ts"],
  ["approve_approval_request", "approval", "approval", true, true, true, "src/app/api/approvals/[id]/[action]/route.ts"],
  ["reject_approval_request", "approval", "approval", true, true, true, "src/app/api/approvals/[id]/[action]/route.ts"],
  ["request_approval_changes", "approval", "approval", true, true, true, "src/app/api/approvals/[id]/[action]/route.ts"],
  ["delegate_approval_request", "approval", "approval", true, true, true, "src/app/api/approvals/[id]/[action]/route.ts"],
  ["escalate_approval_request", "approval", "approval", true, true, true, "src/app/api/approvals/[id]/[action]/route.ts"],
  ["assign_exception_owner", "exception", "exception", true, true, true, "src/app/api/exceptions/[id]/[action]/route.ts"],
  ["resolve_exception", "exception", "exception", true, true, true, "src/app/api/exceptions/[id]/[action]/route.ts"],
  ["reopen_exception", "exception", "exception", true, true, true, "src/app/api/exceptions/[id]/[action]/route.ts"],
  ["change_renewal_posture", "renewal_checkpoint", "renewal_checkpoint", true, true, true, "src/app/api/renewals/[id]/[action]/route.ts"],
  ["generate_renewal_decision_packet", "renewal_checkpoint", "renewal_checkpoint", true, true, true, "src/app/api/renewals/[id]/[action]/route.ts"],
  ["record_renewal_recommendation", "renewal_checkpoint", "renewal_checkpoint", true, true, true, "src/app/api/renewals/[id]/[action]/route.ts"],
  ["create_report_run", "report_run", "report_run", true, true, true, "src/app/api/report-packs/route.ts"],
  ["create_export_job", "export_job", "export_job", true, true, false, "src/app/api/export/contracts/route.ts"],
  ["update_notification_preferences", "setting", "setting", true, true, true, "src/actions/product-surface-settings.ts"],
  ["update_module_visibility", "setting", "setting", true, true, true, "src/actions/product-surface-settings.ts"],
  ["update_workspace_mode", "setting", "setting", true, true, true, "src/actions/product-surface-settings.ts"],
] as const satisfies readonly V10RequiredMutationContractRow[];

function buildV10RequiredMutationContract(row: V10RequiredMutationContractRow): V10RequiredMutationContract {
  const [key, targetType, sourceObjectType, requiresIdempotency, requiresAudit, requiresExpectedVersion, runtimeArtifact, responseShape] = row;
  const catalogEntry = V10_MUTATION_CATALOG.find((mutation) => mutation.name === key);
  if (!catalogEntry) {
    throw new Error(`V10 required mutation contract is missing from catalog: ${key}`);
  }
  return {
    key,
    targetType,
    sourceObjectType,
    auditAction: catalogEntry.auditAction,
    minimumRole: catalogEntry.minimumRole,
    requiresIdempotency,
    requiresAudit,
    requiresExpectedVersion,
    responseShape: responseShape ?? "v10_mutation_envelope",
    runtimeArtifact,
  };
}

export const V10_REQUIRED_MUTATION_CONTRACTS: readonly V10RequiredMutationContract[] =
  V10_REQUIRED_MUTATION_CONTRACT_ROWS.map(buildV10RequiredMutationContract);

export function isV10MutationOutcome(value: string): value is V10MutationOutcome {
  return (V10_MUTATION_OUTCOMES as readonly string[]).includes(value);
}

export function validateV10IdempotencyKey(value: string): boolean {
  return IDEMPOTENCY_KEY_RE.test(value);
}

export function validateV10MutationRequest(request: V10MutationRequest): V10ValidationFailure[] {
  const failures: V10ValidationFailure[] = [];
  for (const field of ["organization_id", "target_type", "target_id", "client_request_id"] as const) {
    if (!request[field]?.trim()) {
      failures.push(buildV10ValidationFailure(field, "required", `${field} is required.`, false));
    }
  }
  if (request.expected_version === null || request.expected_version === undefined || request.expected_version === "") {
    failures.push(buildV10ValidationFailure("expected_version", "required", "Expected version is required.", true));
  }
  if ((request as V10MutationRequest & { actor_user_id?: unknown }).actor_user_id !== undefined) {
    failures.push(
      buildV10ValidationFailure(
        "actor_user_id",
        "server_derived",
        "Actor identity is derived from the authenticated server session.",
        false
      )
    );
  }
  if (!validateV10IdempotencyKey(request.idempotency_key)) {
    failures.push(
      buildV10ValidationFailure(
        "idempotency_key",
        "invalid_format",
        "Idempotency key must be 8-200 characters and contain only letters, numbers, colon, underscore, or dash.",
        true
      )
    );
  }
  return failures;
}

export function buildV10ValidationFailure(
  field: string,
  code: string,
  userVisibleMessage: string,
  selfFixable: boolean
): V10ValidationFailure {
  return {
    field,
    code,
    user_visible_message: userVisibleMessage,
    self_fixable: selfFixable,
  };
}

export function buildV10MutationResponse(input: {
  outcome: V10MutationOutcome;
  message: string;
  changedObjectType?: string | null;
  changedObjectId?: string | null;
  newVersion?: string | number | null;
  expectedVersion?: string | number | null;
  currentVersion?: string | number | null;
  nextDestinationHref?: string | null;
  auditEventId?: string | null;
  diagnosticId?: string | null;
  retryEligible?: boolean;
  replayState?: V10MutationResponse["replay_state"];
  validationFailures?: V10ValidationFailure[];
  bulkItemOutcomes?: readonly V10BulkItemOutcomeSnapshot[];
}): V10MutationResponse {
  const retryEligible =
    input.retryEligible ??
    ["conflict", "stale_version", "rate_limited", "dependency_blocked", "job_not_retryable", "server_error"].includes(input.outcome);
  return {
    outcome: input.outcome,
    user_visible_message: input.message,
    changed_object_type: input.changedObjectType ?? null,
    changed_object_id: input.changedObjectId ?? null,
    new_version: input.newVersion ?? null,
    version_metadata: {
      expected_version: input.expectedVersion ?? null,
      current_version: input.currentVersion ?? null,
      new_version: input.newVersion ?? null,
    },
    next_destination_href: input.nextDestinationHref ?? V10_NULL_NEXT_DESTINATION,
    audit_event_id: input.auditEventId ?? null,
    diagnostic_id: input.diagnosticId ?? null,
    retry_eligible: retryEligible,
    replay_state: input.replayState ?? "not_replayed",
    ...(input.validationFailures ? { validation_failures: input.validationFailures } : {}),
    ...(input.bulkItemOutcomes?.length ? { bulk_item_outcomes: input.bulkItemOutcomes } : {}),
  };
}

export function getV10MutationHttpStatus(response: V10MutationResponse): number {
  return V10_MUTATION_HTTP_STATUS_BY_OUTCOME[response.outcome];
}

export function buildV10MutationResponseInit(
  response: V10MutationResponse,
  options: { replayed?: boolean; headers?: HeadersInit } = {}
): ResponseInit {
  const headers = new Headers(options.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-V10-Idempotent-Replay", options.replayed ? "true" : "false");
  return {
    status: getV10MutationHttpStatus(response),
    headers,
  };
}

export function classifyV10MutationResponse(response: V10MutationResponse, replayed = false): V10ApiResponseClass {
  if (replayed) return "idempotent";
  if (response.outcome === "success") return "success";
  if (response.outcome === "validation_failed") return "validation";
  if (response.outcome === "unauthorized" || response.outcome === "forbidden" || response.outcome === "not_found") return "denial";
  if (response.outcome === "stale_version") return "stale";
  if (response.outcome === "no_action") return "no_action";
  if (response.outcome === "conflict" || response.outcome === "rate_limited" || response.outcome === "job_not_retryable") return "retryable";
  if (response.outcome === "dependency_blocked" || response.outcome === "audit_write_failed") return "partial";
  return "terminal";
}

export function validateV10ApiResponseSchema(response: V10MutationResponse, options?: { replayed?: boolean }): string[] {
  const failures: string[] = [];
  const responseClass = classifyV10MutationResponse(response, options?.replayed);
  if (!response.user_visible_message.trim()) failures.push("user_visible_message_required");
  if (responseClass === "success") {
    if (!response.changed_object_type || !response.changed_object_id) failures.push("changed_object_required");
    if (!response.audit_event_id) failures.push("audit_event_required");
  }
  if (responseClass === "validation" && (response.validation_failures?.length ?? 0) === 0) {
    failures.push("validation_failures_required");
  }
  if ((responseClass === "denial" || responseClass === "terminal" || responseClass === "retryable" || responseClass === "partial") && !response.diagnostic_id) {
    failures.push("diagnostic_id_required");
  }
  if (typeof response.retry_eligible !== "boolean") failures.push("retry_eligible_required");
  if (!["not_replayed", "replayed", "in_progress", "payload_conflict"].includes(response.replay_state)) {
    failures.push("replay_state_required");
  }
  if (!response.version_metadata || typeof response.version_metadata !== "object") failures.push("version_metadata_required");
  if (responseClass === "stale" && response.next_destination_href === V10_NULL_NEXT_DESTINATION) {
    failures.push("refresh_destination_required");
  }
  if (responseClass === "retryable" && response.next_destination_href === V10_NULL_NEXT_DESTINATION) {
    failures.push("retry_destination_required");
  }
  if (responseClass === "no_action" && !/no action|already|unchanged/i.test(response.user_visible_message)) {
    failures.push("no_action_explanation_required");
  }
  if (responseClass === "idempotent" && !options?.replayed) failures.push("idempotent_replay_flag_required");
  return failures;
}

export function validateV10BulkMutationItemResults(items: readonly V10BulkMutationItemResult[]): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    const itemKey = `${item.target_type}:${item.target_id}`;
    if (!item.target_type.trim()) failures.push(`item_${index}_target_type_required`);
    if (!item.target_id.trim()) failures.push(`item_${index}_target_id_required`);
    if (seen.has(itemKey)) failures.push(`item_${index}_duplicate_target`);
    seen.add(itemKey);
    if (!item.user_visible_message.trim()) failures.push(`item_${index}_message_required`);
    if (classifyV10MutationResponse(buildV10MutationResponse({ outcome: item.outcome, message: item.user_visible_message })) !== "success") {
      if (!item.diagnostic_id) failures.push(`item_${index}_diagnostic_required`);
    }
    if (item.outcome === "success" && !item.audit_event_id) failures.push(`item_${index}_audit_required`);
  }
  return failures;
}

export function validateV10RequiredMutationContracts(
  contracts: readonly V10RequiredMutationContract[] = V10_REQUIRED_MUTATION_CONTRACTS
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const contract of contracts) {
    if (seen.has(contract.key)) failures.push(`duplicate_required_mutation:${contract.key}`);
    seen.add(contract.key);
    if (!contract.targetType) failures.push(`${contract.key}:target_type_required`);
    if (!contract.sourceObjectType) failures.push(`${contract.key}:source_object_type_required`);
    if (!contract.auditAction.includes(".")) failures.push(`${contract.key}:audit_action_required`);
    if (!contract.minimumRole) failures.push(`${contract.key}:minimum_role_required`);
    if (!contract.requiresAudit) failures.push(`${contract.key}:audit_required`);
    if (!contract.requiresIdempotency) failures.push(`${contract.key}:idempotency_required`);
    if (
      !contract.requiresExpectedVersion &&
      !(V10_EXPECTED_VERSION_EXEMPT_MUTATIONS as readonly string[]).includes(contract.key)
    ) {
      failures.push(`${contract.key}:expected_version_required`);
    }
    if (!contract.runtimeArtifact) failures.push(`${contract.key}:runtime_artifact_required`);
    if (!["v10_mutation_envelope", "v10_bulk_mutation_envelope"].includes(contract.responseShape)) {
      failures.push(`${contract.key}:response_shape_invalid`);
    }
  }
  for (const key of V10_REQUIRED_MUTATION_CONTRACTS.map((contract) => contract.key)) {
    if (!seen.has(key)) failures.push(`missing_required_mutation:${key}`);
  }
  for (const contract of contracts) {
    if (!V10_MUTATION_CATALOG.some((mutation) => mutation.name === contract.key)) {
      failures.push(`required_mutation_not_in_catalog:${contract.key}`);
    }
  }
  for (const mutation of V10_MUTATION_CATALOG) {
    if (!seen.has(mutation.name)) failures.push(`catalog_mutation_missing_required_contract:${mutation.name}`);
  }
  return failures;
}

export function getV10VersionedMutationOutcome(input: {
  expectedVersion: string | number | null | undefined;
  currentVersion: string | number | null | undefined;
  changed?: boolean;
}): V10MutationOutcome {
  if (input.expectedVersion === null || input.expectedVersion === undefined || input.expectedVersion === "") {
    return "validation_failed";
  }
  if (String(input.expectedVersion) !== String(input.currentVersion)) return "stale_version";
  return input.changed === false ? "no_action" : "success";
}
