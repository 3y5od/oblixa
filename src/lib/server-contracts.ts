import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/server";
import {
  V10_EXPECTED_VERSION_EXEMPT_MUTATIONS,
  buildV10ValidationFailure,
  buildV10MutationResponse,
  buildV10MutationResponseInit,
  getV10VersionedMutationOutcome,
  validateV10IdempotencyKey,
  type V10MutationResponse,
} from "./mutation-envelope";
import { canonicalizeV10MutationName } from "./mutation-rollout";
import type { AuditAction } from "@/lib/security/audit-actions";
import { redactPersistenceString } from "@/lib/security/persistence-redaction";
import {
  buildV10ReadModelRefreshEventPlan,
  refreshV10ReadModelsForOrganization,
  type V10ReadModelRefreshEvent,
  type V10ReadModelRefreshOptions,
  type V10ReadModelRefreshResult,
} from "./read-model-refresh";
import type { V10MutationOutcome, V10SourceObjectType } from "./release-contract";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;
type V10AuditMetadataValue =
  | string
  | number
  | boolean
  | null
  | V10AuditMetadataValue[]
  | { [key: string]: V10AuditMetadataValue };
type V10AuditMetadata = Record<string, V10AuditMetadataValue>;
export type V10AuditWriteMode = "best_effort" | "blocking";

function recoverableErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "Unknown error");
}

export type V10IdempotentMutationInput = {
  organizationId: string;
  actorUserId: string;
  mutationName: string;
  targetType: V10SourceObjectType | string;
  targetId: string;
  idempotencyKey: string | null;
  clientRequestId?: string | null;
  payload: unknown;
  expectedVersion?: string | number | null;
  expectedVersionRequired?: boolean;
  currentVersion?: string | number | null;
  changed?: boolean;
};

export type V10AuditInput = {
  organizationId: string;
  actorUserId: string | null;
  actorType?: "user" | "system" | "external";
  action: AuditAction;
  targetType: V10SourceObjectType | string;
  targetId: string;
  contractId?: string | null;
  outcome: V10MutationOutcome | string;
  beforeStateHash?: string | null;
  afterStateHash?: string | null;
  safeMetadata?: V10AuditMetadata;
  clientRequestId?: string | null;
  diagnosticId?: string | null;
  writeMode?: V10AuditWriteMode;
};

export type V10AuditedMutationTransactionResult<T extends V10MutationResponse> = {
  response: T;
  auditEventId: string | null;
  rollback?: (input: V10AuditedMutationRollbackInput) => Promise<void>;
};

export type V10AuditedMutationInput = V10IdempotentMutationInput & {
  auditAction: AuditAction;
};

export type V10AuditedMutationRollbackInput = {
  reason: "audit_write_failed";
  diagnosticId: string;
  targetType: string;
  targetId: string;
};

export type V10StandardMutationRuntimeInput = V10AuditedMutationInput & {
  contractId?: string | null;
  safeMetadata?: V10AuditMetadata;
  refreshEvent?: Omit<V10ReadModelRefreshEvent, "organizationId"> | null;
  refreshExecutor?: (
    admin: Admin,
    organizationId: string,
    options: V10ReadModelRefreshOptions
  ) => Promise<Pick<V10ReadModelRefreshResult, "ok" | "diagnostics">>;
  telemetry?: (event: {
    mutationName: string;
    outcome: V10MutationOutcome;
    replayed: boolean;
    auditEventId: string | null;
    refreshJobId: string | null;
    diagnosticId: string | null;
  }) => Promise<void> | void;
};

export type V10IdempotentResponseSnapshot = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

type V10IdempotencyClaimStatus = "in_progress" | "completed";

export type V10IdempotencyRpcClaimResult =
  | "claimed"
  | "replay"
  | "in_progress"
  | "payload_conflict"
  | "missing_after_conflict";

export type V10IdempotencyRpcClaimRow = {
  claim_result: V10IdempotencyRpcClaimResult | string;
  request_hash: string;
  response_json: unknown;
  claim_status: V10IdempotencyClaimStatus | string;
};

export type V10IdempotencyRpcClaimArgs = {
  p_organization_id: string;
  p_actor_user_id: string;
  p_mutation_name: string;
  p_target_type: string;
  p_target_id: string;
  p_idempotency_key: string;
  p_client_request_id: string | null;
  p_request_hash: string;
  p_pending_response_json: unknown;
  p_claim_expires_at?: string;
};

export class V10AuditWriteError extends Error {
  readonly diagnosticId = "v10_audit_write_failed";

  constructor(message = "V10 audit event could not be recorded.") {
    super(message);
    this.name = "V10AuditWriteError";
  }
}

const FORBIDDEN_AUDIT_METADATA_KEY_RE = /(^|_)(email|phone|address|token|secret|password|note|comment|text|body|url|file_name|file_url|signed_link|raw_clause|contract_text)(_|$)/i;
const MAX_AUDIT_METADATA_ARRAY_ITEMS = 20;
const MAX_AUDIT_METADATA_STRING_LENGTH = 500;

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJson(entryValue)}`).join(",")}}`;
}

export function getV10RequestHash(payload: unknown): string {
  return createHash("sha256").update(stableJson(payload)).digest("hex");
}

export function getV10IdempotencyKeyFromRequest(request: Request): string | null {
  return request.headers.get("x-idempotency-key")?.trim() || null;
}

export function getV10ExpectedVersionFromRequest(request: Request): string | number | undefined {
  const value = request.headers.get("x-v10-expected-version") ?? request.headers.get("if-match");
  const trimmed = value?.replace(/^W\//, "").replace(/^"|"$/g, "").trim();
  return trimmed || undefined;
}

export function getV10ClientRequestIdFromRequest(request: Request): string | null {
  return request.headers.get("x-client-request-id")?.trim() || request.headers.get("x-request-id")?.trim() || null;
}

export function sanitizeV10AuditMetadata(
  metadata: V10AuditMetadata = {}
): V10AuditMetadata {
  const sanitizeValue = (key: string, value: V10AuditMetadataValue): V10AuditMetadataValue => {
    if (value == null || typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "string") {
      return redactPersistenceString(value, MAX_AUDIT_METADATA_STRING_LENGTH);
    }
    if (Array.isArray(value)) {
      return value.slice(0, MAX_AUDIT_METADATA_ARRAY_ITEMS).map((item) => sanitizeValue(key, item));
    }
    const nested: V10AuditMetadata = {};
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      if (FORBIDDEN_AUDIT_METADATA_KEY_RE.test(nestedKey)) {
        nested[`${nestedKey}_state`] = nestedValue == null || nestedValue === "" ? "not_provided" : "redacted";
        continue;
      }
      nested[nestedKey] = sanitizeValue(nestedKey, nestedValue);
    }
    return nested;
  };

  const safe: V10AuditMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_AUDIT_METADATA_KEY_RE.test(key)) {
      safe[`${key}_state`] = value == null || value === "" ? "not_provided" : "redacted";
      continue;
    }
    safe[key] = sanitizeValue(key, value);
  }
  return safe;
}

export async function recordV10AuditEvent(admin: Admin, input: V10AuditInput): Promise<string | null> {
  try {
    const safeMetadata = input.clientRequestId
      ? sanitizeV10AuditMetadata({
          ...input.safeMetadata,
          request_id: input.clientRequestId,
          audit_write_mode: input.writeMode ?? "best_effort",
        })
      : sanitizeV10AuditMetadata({
          ...input.safeMetadata,
          audit_write_mode: input.writeMode ?? "best_effort",
        });
    const { data, error } = await admin
      .from("v10_audit_events")
      .insert({
        organization_id: input.organizationId,
        actor_user_id: input.actorUserId,
        actor_type: input.actorType ?? "user",
        action: input.action,
        target_type: input.targetType,
        target_id: input.targetId,
        contract_id: input.contractId ?? null,
        outcome: input.outcome,
        before_state_hash: input.beforeStateHash ?? null,
        after_state_hash: input.afterStateHash ?? null,
        safe_metadata: safeMetadata,
        diagnostic_id: input.diagnosticId ?? null,
      })
      .select("audit_event_id")
      .maybeSingle();

    if (error) {
      console.error("[v10-audit] insert failed:", error.message);
      return null;
    }
    return (data?.audit_event_id as string | undefined) ?? null;
  } catch (error) {
    console.error("[v10-audit] insert threw:", error);
    return null;
  }
}

export async function recordV10AuditEventStrict(admin: Admin, input: V10AuditInput): Promise<string> {
  const auditEventId = await recordV10AuditEvent(admin, { ...input, writeMode: "blocking" });
  if (!auditEventId) {
    throw new V10AuditWriteError();
  }
  return auditEventId;
}

export function buildV10DeniedMutationResponse(input: {
  outcome: Extract<
    V10MutationOutcome,
    | "unauthorized"
    | "forbidden"
    | "not_found"
    | "plan_required"
    | "mode_required"
    | "hidden_module"
    | "rate_limited"
    | "external_link_expired"
    | "external_link_revoked"
  >;
  message: string;
  diagnosticId: string;
  nextDestinationHref?: string | null;
}): V10MutationResponse {
  return buildV10MutationResponse({
    outcome: input.outcome,
    message: input.message,
    diagnosticId: input.diagnosticId,
    nextDestinationHref: input.nextDestinationHref,
  });
}

export function buildV10MutationJsonResponse(
  response: V10MutationResponse,
  options: { replayed?: boolean; headers?: HeadersInit } = {}
): Response {
  return Response.json(response, buildV10MutationResponseInit(response, options));
}

function buildV10IdempotencyInProgressResponse(input: V10IdempotentMutationInput): V10MutationResponse {
  return buildV10MutationResponse({
    outcome: "conflict",
    message: "This retry key is already processing a V10 mutation. Wait for the first request to finish, then retry.",
    changedObjectType: input.targetType,
    changedObjectId: input.targetId,
    nextDestinationHref: "/work",
    diagnosticId: "v10_idempotency_in_progress",
    replayState: "in_progress",
  });
}

function buildV10PendingMutationResponse(input: V10IdempotentMutationInput): V10MutationResponse {
  return buildV10MutationResponse({
    outcome: "conflict",
    message: "This V10 mutation was reserved and is still in progress.",
    changedObjectType: input.targetType,
    changedObjectId: input.targetId,
    nextDestinationHref: "/work",
    diagnosticId: "v10_idempotency_in_progress",
    replayState: "in_progress",
  });
}

export function buildV10IdempotencyRpcClaimArgs(
  input: V10IdempotentMutationInput,
  requestHash: string,
  pendingResponse: unknown
): V10IdempotencyRpcClaimArgs {
  const mutationName = canonicalizeV10MutationName(input.mutationName) ?? input.mutationName;
  return {
    p_organization_id: input.organizationId,
    p_actor_user_id: input.actorUserId,
    p_mutation_name: mutationName,
    p_target_type: String(input.targetType),
    p_target_id: input.targetId,
    p_idempotency_key: input.idempotencyKey ?? "",
    p_client_request_id: input.clientRequestId ?? null,
    p_request_hash: requestHash,
    p_pending_response_json: pendingResponse,
  };
}

export function validateV10IdempotencyRpcClaimRow(row: V10IdempotencyRpcClaimRow | null): string[] {
  const failures: string[] = [];
  if (!row) return ["claim_row_required"];
  if (!["claimed", "replay", "in_progress", "payload_conflict", "missing_after_conflict"].includes(row.claim_result)) {
    failures.push("claim_result_invalid");
  }
  if (!row.request_hash?.trim()) failures.push("request_hash_required");
  if (row.response_json === null || row.response_json === undefined) failures.push("response_json_required");
  if (!["in_progress", "completed"].includes(row.claim_status)) failures.push("claim_status_invalid");
  if (row.claim_result === "claimed" && row.claim_status !== "in_progress") failures.push("claimed_row_must_be_in_progress");
  if (row.claim_result === "replay" && row.claim_status !== "completed") failures.push("replay_row_must_be_completed");
  return failures;
}

function idempotencyClaimExpiresAt(now = Date.now()): string {
  return new Date(now + 5 * 60 * 1000).toISOString();
}

function v10ExpectedVersionRequired(input: V10IdempotentMutationInput): boolean {
  if (input.expectedVersionRequired !== undefined) return input.expectedVersionRequired;
  const mutationName = canonicalizeV10MutationName(input.mutationName);
  return Boolean(mutationName && !(V10_EXPECTED_VERSION_EXEMPT_MUTATIONS as readonly string[]).includes(mutationName));
}

function firstRpcRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T | undefined) ?? null;
  return (data as T | null) ?? null;
}

async function claimV10IdempotencyRpc(
  admin: Admin,
  input: V10IdempotentMutationInput,
  requestHash: string,
  pendingResponse: unknown
): Promise<{ row: V10IdempotencyRpcClaimRow | null; error: { message: string } | null }> {
  type RpcAdmin = Admin & {
    rpc?: (
      fn: "claim_v10_mutation_idempotency",
      args: V10IdempotencyRpcClaimArgs
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const client = admin as RpcAdmin;
  if (typeof client.rpc !== "function") {
    return {
      row: null,
      error: { message: "claim_v10_mutation_idempotency RPC is unavailable" },
    };
  }
  // Must call via client.rpc(...) so SupabaseClient keeps correct `this` (rpc uses this.rest).
  let result: { data: unknown; error: { message: string } | null };
  try {
    result = await client.rpc("claim_v10_mutation_idempotency", {
      ...buildV10IdempotencyRpcClaimArgs(input, requestHash, pendingResponse),
      p_claim_expires_at: idempotencyClaimExpiresAt(),
    });
  } catch (error) {
    return {
      row: null,
      error: { message: recoverableErrorMessage(error) },
    };
  }
  const { data, error } = result;
  return {
    row: firstRpcRow<V10IdempotencyRpcClaimRow>(data),
    error: error ? { message: error.message } : null,
  };
}

async function completeV10IdempotencyClaim(
  admin: Admin,
  input: V10IdempotentMutationInput,
  requestHash: string,
  responseJson: unknown
): Promise<{ error: { message: string } | null }> {
  type CompleteRpcAdmin = Admin & {
    rpc?: (
      fn: "complete_v10_mutation_idempotency",
      args: {
        p_organization_id: string;
        p_actor_user_id: string;
        p_mutation_name: string;
        p_target_type: string;
        p_target_id: string;
        p_idempotency_key: string;
        p_request_hash: string;
        p_response_json: unknown;
      }
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const client = admin as CompleteRpcAdmin;
  if (typeof client.rpc !== "function") {
    return { error: { message: "complete_v10_mutation_idempotency RPC is unavailable" } };
  }
  let result: { data: unknown; error: { message: string } | null };
  try {
    result = await client.rpc("complete_v10_mutation_idempotency", {
      p_organization_id: input.organizationId,
      p_actor_user_id: input.actorUserId,
      p_mutation_name: canonicalizeV10MutationName(input.mutationName) ?? input.mutationName,
      p_target_type: String(input.targetType),
      p_target_id: input.targetId,
      p_idempotency_key: input.idempotencyKey ?? "",
      p_request_hash: requestHash,
      p_response_json: responseJson,
    });
  } catch (error) {
    return { error: { message: recoverableErrorMessage(error) } };
  }
  const { data, error } = result;
  if (error) return { error: { message: error.message } };
  return { error: data === true ? null : { message: "idempotency completion did not update a claimed row" } };
}

export async function executeV10IdempotentMutation<T extends V10MutationResponse>(
  admin: Admin,
  input: V10IdempotentMutationInput,
  execute: () => Promise<T>
): Promise<{ response: T; replayed: boolean }> {
  if (!input.idempotencyKey || !validateV10IdempotencyKey(input.idempotencyKey)) {
    return {
      replayed: false,
      response: buildV10MutationResponse({
        outcome: "validation_failed",
        message: "A valid x-idempotency-key header is required for this V10 mutation.",
        changedObjectType: null,
        changedObjectId: null,
        diagnosticId: "v10_idempotency_key_invalid",
        validationFailures: [
          buildV10ValidationFailure(
            "x-idempotency-key",
            "invalid_format",
            "Use a unique 8-200 character retry key for this change.",
            true
          ),
        ],
      }) as T,
    };
  }

  if (input.expectedVersion !== undefined || v10ExpectedVersionRequired(input)) {
    const versionOutcome = getV10VersionedMutationOutcome({
      expectedVersion: input.expectedVersion,
      currentVersion: input.currentVersion,
      changed: input.changed,
    });
    if (versionOutcome === "stale_version") {
      return {
        replayed: false,
        response: buildV10MutationResponse({
          outcome: "stale_version",
          message: "This record changed before the mutation could be applied. Refresh and retry.",
          changedObjectType: input.targetType,
          changedObjectId: input.targetId,
          expectedVersion: input.expectedVersion,
          currentVersion: input.currentVersion,
          nextDestinationHref: "/work",
          diagnosticId: "v10_expected_version_stale",
        }) as T,
      };
    }
    if (versionOutcome === "validation_failed") {
      return {
        replayed: false,
        response: buildV10MutationResponse({
          outcome: "validation_failed",
          message: "Expected version is required for this V10 mutation.",
          changedObjectType: input.targetType,
          changedObjectId: input.targetId,
          diagnosticId: "v10_expected_version_required",
          validationFailures: [
            buildV10ValidationFailure(
              "expected_version",
              "required",
              "Refresh the record and retry with the latest version.",
              true
            ),
          ],
        }) as T,
      };
    }
  }

  const requestHash = getV10RequestHash(input.payload);
  const pendingResponse = buildV10PendingMutationResponse(input);
  const claim = await claimV10IdempotencyRpc(admin, input, requestHash, pendingResponse);

  if (claim.error || validateV10IdempotencyRpcClaimRow(claim.row).length > 0) {
    console.error("[v10-idempotency] claim failed:", claim.error?.message ?? validateV10IdempotencyRpcClaimRow(claim.row).join(","));
    return {
      replayed: false,
      response: buildV10MutationResponse({
        outcome: "server_error",
        message: "The change could not be started because retry protection could not reserve the request.",
        changedObjectType: input.targetType,
        changedObjectId: input.targetId,
        diagnosticId: "v10_idempotency_claim_failed",
      }) as T,
    };
  }

  if (claim.row?.claim_result === "payload_conflict" || claim.row?.request_hash !== requestHash) {
    return {
      replayed: true,
      response: buildV10MutationResponse({
        outcome: "conflict",
        message: "This idempotency key was already used with a different payload.",
        nextDestinationHref: "/work",
        diagnosticId: "v10_idempotency_payload_conflict",
        replayState: "payload_conflict",
      }) as T,
    };
  }
  if (claim.row?.claim_result === "replay") {
    const response = claim.row.response_json as T;
    if (response && typeof response === "object") {
      (response as V10MutationResponse).replay_state = "replayed";
    }
    return { replayed: true, response };
  }
  if (claim.row?.claim_result === "missing_after_conflict") {
    return {
      replayed: false,
      response: buildV10MutationResponse({
        outcome: "server_error",
        message: "The change could not be started because retry protection observed a claim race.",
        changedObjectType: input.targetType,
        changedObjectId: input.targetId,
        nextDestinationHref: "/settings/health",
        diagnosticId: "v10_idempotency_claim_race",
      }) as T,
    };
  }
  if (claim.row?.claim_result !== "claimed") {
    return { replayed: true, response: buildV10IdempotencyInProgressResponse(input) as T };
  }

  let response: T;
  try {
    response = await execute();
  } catch (error) {
    console.error("[v10-idempotency] execution failed after claim:", error);
    const failureResponse = buildV10MutationResponse({
      outcome: "server_error",
      message: "The change failed before it could be completed. Retry from the recovery surface or contact support with the diagnostic id.",
      changedObjectType: input.targetType,
      changedObjectId: input.targetId,
      nextDestinationHref: "/settings/health",
      diagnosticId: "v10_mutation_execution_failed",
    }) as T;
    const completion = await completeV10IdempotencyClaim(admin, input, requestHash, failureResponse);
    if (completion.error) {
      console.error("[v10-idempotency] failure completion failed:", completion.error.message);
    }
    return { replayed: false, response: failureResponse };
  }
  const { error } = await completeV10IdempotencyClaim(admin, input, requestHash, response);
  if (error) {
    console.error("[v10-idempotency] completion failed:", error.message);
    return {
      replayed: false,
      response: buildV10MutationResponse({
        outcome: "server_error",
        message: "The change could not be completed safely because retry protection was not recorded.",
        changedObjectType: input.targetType,
        changedObjectId: input.targetId,
        diagnosticId: "v10_idempotency_persistence_failed",
      }) as T,
    };
  }
  return { replayed: false, response };
}

export async function executeV10AuditedMutation<T extends V10MutationResponse>(
  admin: Admin,
  input: V10AuditedMutationInput,
  executeTransaction: () => Promise<V10AuditedMutationTransactionResult<T>>
): Promise<{ response: T; replayed: boolean }> {
  return executeV10IdempotentMutation(admin, input, async () => {
    let result: V10AuditedMutationTransactionResult<T>;
    try {
      result = await executeTransaction();
    } catch (error) {
      if (error instanceof V10AuditWriteError) {
        return buildV10MutationResponse({
          outcome: "audit_write_failed",
          message: "The change was not completed because an audit event could not be recorded.",
          changedObjectType: input.targetType,
          changedObjectId: input.targetId,
          nextDestinationHref: null,
          diagnosticId: error.diagnosticId,
        }) as T;
      }
      throw error;
    }
    if (result.response.outcome !== "success") return result.response;
    if (result.auditEventId) {
      return {
        ...result.response,
        audit_event_id: result.response.audit_event_id ?? result.auditEventId,
      };
    }
    if (result.rollback) {
      try {
        await result.rollback({
          reason: "audit_write_failed",
          diagnosticId: "v10_audit_write_failed",
          targetType: input.targetType,
          targetId: input.targetId,
        });
      } catch (error) {
        console.error("[v10-audit] rollback after audit failure failed:", error);
        return buildV10MutationResponse({
          outcome: "audit_write_failed",
          message: "The change could not be completed because audit persistence failed and rollback needs support review.",
          changedObjectType: input.targetType,
          changedObjectId: input.targetId,
          nextDestinationHref: "/settings/health",
          diagnosticId: "v10_audit_write_failed_rollback_failed",
        }) as T;
      }
    }
    return buildV10MutationResponse({
      outcome: "audit_write_failed",
      message: "The change was not completed because an audit event could not be recorded.",
      changedObjectType: input.targetType,
      changedObjectId: input.targetId,
      nextDestinationHref: null,
      diagnosticId: "v10_audit_write_failed",
    }) as T;
  });
}

export async function executeV10StandardMutation<T extends V10MutationResponse>(
  admin: Admin,
  input: V10StandardMutationRuntimeInput,
  executeMutation: () => Promise<T>
): Promise<{ response: T; replayed: boolean }> {
  const result = await executeV10IdempotentMutation(admin, input, async () => {
    const response = await executeMutation();
    if (response.outcome !== "success") return response;

    let auditEventId: string;
    try {
      auditEventId = await recordV10AuditEventStrict(admin, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: input.auditAction,
        targetType: input.targetType,
        targetId: input.targetId,
        contractId: input.contractId ?? null,
        outcome: response.outcome,
        beforeStateHash: input.currentVersion == null ? null : String(input.currentVersion),
        afterStateHash: response.new_version == null ? null : String(response.new_version),
        safeMetadata: input.safeMetadata,
        clientRequestId: input.clientRequestId,
        diagnosticId: response.diagnostic_id,
      });
    } catch (error) {
      if (error instanceof V10AuditWriteError) {
        return buildV10MutationResponse({
          outcome: "audit_write_failed",
          message: "The change was not completed because an audit event could not be recorded.",
          changedObjectType: input.targetType,
          changedObjectId: input.targetId,
          nextDestinationHref: "/settings/health",
          diagnosticId: error.diagnosticId,
        }) as T;
      }
      throw error;
    }

    let refreshJobId: string | null = null;
    if (input.refreshEvent) {
      const plan = buildV10ReadModelRefreshEventPlan({
        ...input.refreshEvent,
        organizationId: input.organizationId,
      });
      const refreshExecutor = input.refreshExecutor ?? refreshV10ReadModelsForOrganization;
      const refresh = await refreshExecutor(admin, input.organizationId, plan.refreshOptions);
      refreshJobId = refresh.diagnostics.refresh_job_id;
      if (!refresh.ok) {
        return {
          ...response,
          audit_event_id: response.audit_event_id ?? auditEventId,
          diagnostic_id: response.diagnostic_id ?? "v10_read_model_refresh_after_mutation_failed",
        };
      }
    }

    await input.telemetry?.({
      mutationName: input.mutationName,
      outcome: response.outcome,
      replayed: false,
      auditEventId,
      refreshJobId,
      diagnosticId: response.diagnostic_id,
    });

    return {
      ...response,
      audit_event_id: response.audit_event_id ?? auditEventId,
    };
  });

  if (result.replayed) {
    await input.telemetry?.({
      mutationName: input.mutationName,
      outcome: result.response.outcome,
      replayed: true,
      auditEventId: result.response.audit_event_id,
      refreshJobId: null,
      diagnosticId: result.response.diagnostic_id,
    });
  }
  return result;
}

function buildV10IdempotencyFailureResponse(
  input: V10IdempotentMutationInput,
  diagnosticId: string,
  message: string,
  status = 500
): Response {
  const response = buildV10MutationResponse({
    outcome: status === 400 ? "validation_failed" : "server_error",
    message,
    changedObjectType: input.targetType,
    changedObjectId: input.targetId,
    diagnosticId,
  });
  return buildV10MutationJsonResponse(response, { headers: { "X-V10-Diagnostic-Id": diagnosticId } });
}

function buildV10IdempotencyConflictResponse(): Response {
  const response = buildV10MutationResponse({
    outcome: "conflict",
    message: "This idempotency key was already used with a different payload.",
    nextDestinationHref: "/work",
    diagnosticId: "v10_idempotency_payload_conflict",
  });
  return buildV10MutationJsonResponse(response, {
    replayed: true,
    headers: { "X-V10-Diagnostic-Id": "v10_idempotency_payload_conflict" },
  });
}

function snapshotResponse(response: Response): Promise<V10IdempotentResponseSnapshot> {
  return response.clone().text().then((body) => ({
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  }));
}

function restoreResponse(snapshot: V10IdempotentResponseSnapshot, options: { replayed?: boolean } = {}): Response {
  const headers = new Headers(snapshot.headers);
  headers.set("Cache-Control", headers.get("Cache-Control") ?? "private, no-store");
  headers.set("X-V10-Idempotent-Replay", options.replayed ? "true" : "false");
  return new Response(snapshot.body, {
    status: snapshot.status,
    headers,
  });
}

export async function executeV10IdempotentResponseMutation(
  admin: Admin,
  input: V10IdempotentMutationInput,
  execute: () => Promise<Response>
): Promise<{ response: Response; replayed: boolean }> {
  if (!input.idempotencyKey || !validateV10IdempotencyKey(input.idempotencyKey)) {
    const response = buildV10MutationResponse({
      outcome: "validation_failed",
      message: "A valid x-idempotency-key header is required for this V10 mutation.",
      changedObjectType: null,
      changedObjectId: null,
      diagnosticId: "v10_idempotency_key_invalid",
    });
    return {
      replayed: false,
      response: buildV10MutationJsonResponse(response, {
        headers: { "X-V10-Diagnostic-Id": "v10_idempotency_key_invalid" },
      }),
    };
  }

  if (input.expectedVersion !== undefined || v10ExpectedVersionRequired(input)) {
    const versionOutcome = getV10VersionedMutationOutcome({
      expectedVersion: input.expectedVersion,
      currentVersion: input.currentVersion,
      changed: input.changed,
    });
    if (versionOutcome === "stale_version") {
      const response = buildV10MutationResponse({
        outcome: "stale_version",
        message: "This record changed before the mutation could be applied. Refresh and retry.",
        changedObjectType: input.targetType,
        changedObjectId: input.targetId,
        expectedVersion: input.expectedVersion,
        currentVersion: input.currentVersion,
        nextDestinationHref: "/work",
        diagnosticId: "v10_expected_version_stale",
      });
      return {
        replayed: false,
        response: buildV10MutationJsonResponse(response, {
          headers: { "X-V10-Diagnostic-Id": "v10_expected_version_stale" },
        }),
      };
    }
    if (versionOutcome === "validation_failed") {
      const response = buildV10MutationResponse({
        outcome: "validation_failed",
        message: "Expected version is required for this V10 mutation.",
        changedObjectType: input.targetType,
        changedObjectId: input.targetId,
        expectedVersion: input.expectedVersion,
        currentVersion: input.currentVersion,
        diagnosticId: "v10_expected_version_required",
      });
      return {
        replayed: false,
        response: buildV10MutationJsonResponse(response, {
          headers: { "X-V10-Diagnostic-Id": "v10_expected_version_required" },
        }),
      };
    }
  }

  const requestHash = getV10RequestHash(input.payload);
  const pendingResponse = await snapshotResponse(buildV10MutationJsonResponse(buildV10PendingMutationResponse(input)));
  const claim = await claimV10IdempotencyRpc(admin, input, requestHash, pendingResponse);

  if (claim.error || validateV10IdempotencyRpcClaimRow(claim.row).length > 0) {
    console.error("[v10-idempotency] response claim failed:", claim.error?.message ?? validateV10IdempotencyRpcClaimRow(claim.row).join(","));
    return {
      replayed: false,
      response: buildV10IdempotencyFailureResponse(
        input,
        "v10_idempotency_claim_failed",
        "The change could not be started because retry protection could not reserve the request."
      ),
    };
  }

  if (claim.row?.claim_result === "payload_conflict" || claim.row?.request_hash !== requestHash) {
    return { replayed: true, response: buildV10IdempotencyConflictResponse() };
  }
  if (claim.row?.claim_result === "replay") {
    return {
      replayed: true,
      response: restoreResponse(claim.row.response_json as V10IdempotentResponseSnapshot, { replayed: true }),
    };
  }
  if (claim.row?.claim_result !== "claimed") {
    return {
      replayed: true,
      response: buildV10MutationJsonResponse(buildV10IdempotencyInProgressResponse(input), {
        replayed: true,
        headers: { "X-V10-Diagnostic-Id": "v10_idempotency_in_progress" },
      }),
    };
  }

  let response: Response;
  try {
    response = await execute();
  } catch (error) {
    console.error("[v10-idempotency] response execution failed after claim:", error);
    const failureResponse = buildV10IdempotencyFailureResponse(
      input,
      "v10_mutation_execution_failed",
      "The change failed before it could be completed. Retry from the recovery surface or contact support with the diagnostic id."
    );
    const failureSnapshot = await snapshotResponse(failureResponse);
    const completion = await completeV10IdempotencyClaim(admin, input, requestHash, failureSnapshot);
    if (completion.error) {
      console.error("[v10-idempotency] response failure completion failed:", completion.error.message);
    }
    return { replayed: false, response: restoreResponse(failureSnapshot, { replayed: false }) };
  }
  const responseSnapshot = await snapshotResponse(response);
  const { error } = await completeV10IdempotencyClaim(admin, input, requestHash, responseSnapshot);
  if (error) {
    console.error("[v10-idempotency] response completion failed:", error.message);
    return {
      replayed: false,
      response: buildV10IdempotencyFailureResponse(
        input,
        "v10_idempotency_persistence_failed",
        "The change could not be completed safely because retry protection was not recorded."
      ),
    };
  }

  return { replayed: false, response: restoreResponse(responseSnapshot, { replayed: false }) };
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { buildV10DeniedMutationResponse as buildDeniedMutationResponse };
export { buildV10IdempotencyRpcClaimArgs as buildIdempotencyRpcClaimArgs };
export { buildV10MutationJsonResponse as buildMutationJsonResponse };
export { executeV10AuditedMutation as executeAuditedMutation };
export { executeV10IdempotentMutation as executeIdempotentMutation };
export { executeV10IdempotentResponseMutation as executeIdempotentResponseMutation };
export { executeV10StandardMutation as executeStandardMutation };
export { getV10ClientRequestIdFromRequest as getClientRequestIdFromRequest };
export { getV10ExpectedVersionFromRequest as getExpectedVersionFromRequest };
export { getV10IdempotencyKeyFromRequest as getIdempotencyKeyFromRequest };
export { getV10RequestHash as getRequestHash };
export { recordV10AuditEvent as recordAuditEvent };
export { recordV10AuditEventStrict as recordAuditEventStrict };
export { sanitizeV10AuditMetadata as sanitizeAuditMetadata };
export { V10AuditWriteError as AuditWriteError };
export { validateV10IdempotencyRpcClaimRow as validateIdempotencyRpcClaimRow };
export type { V10AuditedMutationInput as AuditedMutationInput };
export type { V10AuditedMutationRollbackInput as AuditedMutationRollbackInput };
export type { V10AuditedMutationTransactionResult as AuditedMutationTransactionResult };
export type { V10AuditInput as AuditInput };
export type { V10AuditWriteMode as AuditWriteMode };
export type { V10IdempotencyRpcClaimArgs as IdempotencyRpcClaimArgs };
export type { V10IdempotencyRpcClaimResult as IdempotencyRpcClaimResult };
export type { V10IdempotencyRpcClaimRow as IdempotencyRpcClaimRow };
export type { V10IdempotentMutationInput as IdempotentMutationInput };
export type { V10IdempotentResponseSnapshot as IdempotentResponseSnapshot };
export type { V10StandardMutationRuntimeInput as StandardMutationRuntimeInput };
// End version-name compatibility aliases.
