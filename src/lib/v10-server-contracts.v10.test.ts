import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildV10MutationResponse, validateV10ApiResponseSchema } from "./v10-mutation-envelope";
import {
  buildV10DeniedMutationResponse,
  buildV10IdempotencyRpcClaimArgs,
  executeV10AuditedMutation,
  executeV10StandardMutation,
  recordV10AuditEventStrict,
  V10AuditWriteError,
  getV10ClientRequestIdFromRequest,
  getV10ExpectedVersionFromRequest,
  executeV10IdempotentMutation,
  executeV10IdempotentResponseMutation,
  getV10IdempotencyKeyFromRequest,
  getV10RequestHash,
  sanitizeV10AuditMetadata,
  validateV10IdempotencyRpcClaimRow,
} from "./v10-server-contracts";

function makeIdempotencyAdmin(
  existing: Record<string, unknown> | null = null,
  options: { lookupError?: string; insertError?: string; updateError?: string; claimResult?: string } = {}
) {
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  class Query {
    select() {
      return this;
    }
    eq() {
      return this;
    }
    update(row: Record<string, unknown>) {
      updated.push(row);
      return this;
    }
    then<TResult1 = { error: { message: string } | null }, TResult2 = never>(
      resolve?: ((value: { error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
      reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return Promise.resolve({
        error: options.updateError ? { message: options.updateError } : null,
      }).then(resolve, reject);
    }
    maybeSingle() {
      return Promise.resolve({
        data: existing,
        error: options.lookupError ? { message: options.lookupError } : null,
      });
    }
    insert(row: Record<string, unknown>) {
      if (!existing && !options.insertError) inserted.push(row);
      return Promise.resolve({
        error: options.insertError
          ? { message: options.insertError }
          : existing
            ? { message: "duplicate key value violates unique constraint" }
            : null,
      });
    }
  }
  return {
    inserted,
    updated,
    rpcCalls,
    rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      if (fn === "claim_v10_mutation_idempotency") {
        if (options.insertError || options.lookupError) {
          return Promise.resolve({ data: null, error: { message: options.insertError ?? options.lookupError ?? "claim failed" } });
        }
        if (options.claimResult) {
          return Promise.resolve({
            data: [
              {
                claim_result: options.claimResult,
                request_hash: args.p_request_hash,
                response_json: args.p_pending_response_json,
                claim_status: "in_progress",
              },
            ],
            error: null,
          });
        }
        if (!existing) {
          const row = {
            organization_id: args.p_organization_id,
            actor_user_id: args.p_actor_user_id,
            mutation_name: args.p_mutation_name,
            target_type: args.p_target_type,
            target_id: args.p_target_id,
            idempotency_key: args.p_idempotency_key,
            client_request_id: args.p_client_request_id,
            request_hash: args.p_request_hash,
            response_json: args.p_pending_response_json,
            claim_status: "in_progress",
            claimed_at: new Date().toISOString(),
            claim_expires_at: args.p_claim_expires_at,
          };
          inserted.push(row);
          return Promise.resolve({
            data: [
              {
                claim_result: "claimed",
                request_hash: args.p_request_hash,
                response_json: args.p_pending_response_json,
                claim_status: "in_progress",
              },
            ],
            error: null,
          });
        }
        const claimResult =
          existing.request_hash !== args.p_request_hash
            ? "payload_conflict"
            : existing.claim_status === "completed"
              ? "replay"
              : "in_progress";
        return Promise.resolve({
          data: [
            {
              claim_result: claimResult,
              request_hash: existing.request_hash,
              response_json: existing.response_json,
              claim_status: existing.claim_status,
            },
          ],
          error: null,
        });
      }
      if (fn === "complete_v10_mutation_idempotency") {
        if (options.updateError) return Promise.resolve({ data: false, error: { message: options.updateError } });
        updated.push({
          response_json: args.p_response_json,
          claim_status: "completed",
          completed_at: new Date().toISOString(),
          claim_expires_at: null,
        });
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: { message: `unexpected rpc ${fn}` } });
    },
    from(table: string) {
      expect(table).toBe("v10_mutation_idempotency");
      return new Query();
    },
  };
}

function makeStandardMutationAdmin(options: { auditFails?: boolean } = {}) {
  const base = makeIdempotencyAdmin();
  const auditRows: Record<string, unknown>[] = [];
  class AuditQuery {
    private inserted: Record<string, unknown> | null = null;

    insert(row: Record<string, unknown>) {
      if (!options.auditFails) {
        this.inserted = { ...row, audit_event_id: "audit_standard_1" };
        auditRows.push(this.inserted);
      }
      return this;
    }

    select() {
      return this;
    }

    maybeSingle() {
      return Promise.resolve({
        data: this.inserted,
        error: options.auditFails ? { message: "audit unavailable" } : null,
      });
    }
  }
  return {
    ...base,
    auditRows,
    from(table: string) {
      if (table === "v10_audit_events") return new AuditQuery();
      return base.from(table);
    },
  };
}

const mutationInput = {
  organizationId: "org_1",
  actorUserId: "user_1",
  mutationName: "complete_work_item",
  targetType: "contract_task",
  targetId: "task_1",
  idempotencyKey: "v10-test-key",
  payload: { completion_note: "done" },
  expectedVersion: "version_1",
  currentVersion: "version_1",
};

describe("V10 server mutation contracts", () => {
  it("extracts trimmed idempotency keys from mutation requests", () => {
    expect(
      getV10IdempotencyKeyFromRequest(
        new Request("https://oblixa.test/api/import/contracts", {
          headers: { "x-idempotency-key": "  valid_key_123  " },
        })
      )
    ).toBe("valid_key_123");
    expect(getV10IdempotencyKeyFromRequest(new Request("https://oblixa.test/api/import/contracts"))).toBeNull();
  });

  it("extracts expected versions and client request ids from mutation headers", () => {
    const request = new Request("https://oblixa.test/api/approvals/approval_1/approve", {
      headers: {
        "if-match": '"version_2"',
        "x-client-request-id": " client_req_1 ",
      },
    });

    expect(getV10ExpectedVersionFromRequest(request)).toBe("version_2");
    expect(getV10ClientRequestIdFromRequest(request)).toBe("client_req_1");
    expect(
      getV10ExpectedVersionFromRequest(
        new Request("https://oblixa.test/api/approvals/approval_1/approve", {
          headers: { "x-v10-expected-version": "updated_at:123" },
        })
      )
    ).toBe("updated_at:123");
    expect(getV10ClientRequestIdFromRequest(new Request("https://oblixa.test/api/approvals/approval_1/approve"))).toBeNull();
  });

  it("defines service-role RPC contracts for transaction-safe idempotency claims", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/057_v10_runtime_contracts.sql"), "utf8");
    const pending = buildV10MutationResponse({
      outcome: "conflict",
      message: "Pending.",
      diagnosticId: "v10_pending",
      nextDestinationHref: "/work",
    });
    const args = buildV10IdempotencyRpcClaimArgs(mutationInput, "hash_1", pending);

    expect(args).toMatchObject({
      p_organization_id: "org_1",
      p_actor_user_id: "user_1",
      p_mutation_name: "complete_work_item",
      p_target_type: "contract_task",
      p_target_id: "task_1",
      p_idempotency_key: "v10-test-key",
      p_client_request_id: null,
      p_request_hash: "hash_1",
      p_pending_response_json: pending,
    });
    expect(validateV10IdempotencyRpcClaimRow({ claim_result: "claimed", request_hash: "hash_1", response_json: pending, claim_status: "in_progress" })).toEqual([]);
    expect(validateV10IdempotencyRpcClaimRow({ claim_result: "replay", request_hash: "hash_1", response_json: pending, claim_status: "completed" })).toEqual([]);
    expect(validateV10IdempotencyRpcClaimRow({ claim_result: "claimed", request_hash: "", response_json: null, claim_status: "completed" })).toEqual(
      expect.arrayContaining(["request_hash_required", "response_json_required", "claimed_row_must_be_in_progress"])
    );
    expect(migration).toContain("create or replace function public.claim_v10_mutation_idempotency");
    expect(migration).toContain("create or replace function public.complete_v10_mutation_idempotency");
    expect(migration).toContain("grant execute on function public.claim_v10_mutation_idempotency");
    expect(migration).toContain("grant execute on function public.complete_v10_mutation_idempotency");
  });

  it("stores canonical mutation names in idempotency RPCs even when routes use aliases", async () => {
    const admin = makeIdempotencyAdmin();
    const response = buildV10MutationResponse({
      outcome: "success",
      message: "Report run created.",
      changedObjectType: "report_run",
      changedObjectId: "report_1",
      auditEventId: "audit_1",
    });

    await executeV10IdempotentMutation(
      admin as never,
      {
        ...mutationInput,
        mutationName: "report_pack.create",
        targetType: "report_run",
        targetId: "pending:v10-test-key",
      },
      async () => response
    );

    expect(admin.rpcCalls[0]).toMatchObject({
      fn: "claim_v10_mutation_idempotency",
      args: { p_mutation_name: "create_report_run" },
    });
    expect(admin.rpcCalls[1]).toMatchObject({
      fn: "complete_v10_mutation_idempotency",
      args: { p_mutation_name: "create_report_run" },
    });
  });

  it("persists the first idempotent response and replays matching retries", async () => {
    const firstAdmin = makeIdempotencyAdmin();
    const response = buildV10MutationResponse({
      outcome: "success",
      message: "Completed.",
      changedObjectType: "contract_task",
      changedObjectId: "task_1",
      auditEventId: "audit_1",
    });

    const first = await executeV10IdempotentMutation(firstAdmin as never, mutationInput, async () => response);
    expect(first.replayed).toBe(false);
    expect(first.response).toMatchObject({
      retry_eligible: false,
      replay_state: "not_replayed",
      version_metadata: { expected_version: null, current_version: null, new_version: null },
    });
    expect(firstAdmin.rpcCalls.map((call) => call.fn)).toEqual([
      "claim_v10_mutation_idempotency",
      "complete_v10_mutation_idempotency",
    ]);
    expect(firstAdmin.inserted).toHaveLength(1);
    expect(firstAdmin.updated).toHaveLength(1);
    expect(firstAdmin.inserted[0]).toMatchObject({ client_request_id: null });
    expect(firstAdmin.inserted[0]).toMatchObject({ claim_status: "in_progress" });
    expect(firstAdmin.updated[0]).toMatchObject({ claim_status: "completed" });

    const replayAdmin = makeIdempotencyAdmin({
      request_hash: firstAdmin.inserted[0].request_hash,
      response_json: response,
      claim_status: "completed",
    });
    const replay = await executeV10IdempotentMutation(replayAdmin as never, mutationInput, async () => {
      throw new Error("should not execute replayed mutation");
    });

    expect(replay.replayed).toBe(true);
    expect((replay.response as typeof response).replay_state).toBe("replayed");
    expect(replay.response).toEqual(response);
  });

  it("fails closed when durable idempotency RPCs are unavailable", async () => {
    const result = await executeV10IdempotentMutation({} as never, mutationInput, async () =>
      buildV10MutationResponse({
        outcome: "success",
        message: "Completed.",
        changedObjectType: "contract_task",
        changedObjectId: "task_1",
        auditEventId: "audit_1",
      })
    );

    expect(result.replayed).toBe(false);
    expect(result.response).toMatchObject({
      outcome: "server_error",
      diagnostic_id: "v10_idempotency_claim_failed",
    });
  });

  it("rejects missing idempotency keys and duplicate payload conflicts", async () => {
    const invalidAdmin = makeIdempotencyAdmin();
    const invalid = await executeV10IdempotentMutation(
      invalidAdmin as never,
      { ...mutationInput, idempotencyKey: "short" },
      async () => {
        throw new Error("invalid idempotency key should not execute");
      }
    );

    expect(invalid.replayed).toBe(false);
    expect(invalid.response).toMatchObject({
      outcome: "validation_failed",
      diagnostic_id: "v10_idempotency_key_invalid",
    });
    expect(validateV10ApiResponseSchema(invalid.response)).toEqual([]);
    expect(invalidAdmin.inserted).toHaveLength(0);

    const conflictAdmin = makeIdempotencyAdmin({
      request_hash: "different_hash",
      response_json: buildV10MutationResponse({ outcome: "success", message: "Original." }),
      claim_status: "completed",
    });
    const conflict = await executeV10IdempotentMutation(conflictAdmin as never, mutationInput, async () => {
      throw new Error("conflicting replay should not execute");
    });

    expect(conflict.replayed).toBe(true);
    expect(conflict.response).toMatchObject({
      outcome: "conflict",
      diagnostic_id: "v10_idempotency_payload_conflict",
      next_destination_href: "/work",
      retry_eligible: true,
      replay_state: "payload_conflict",
    });
    expect(validateV10ApiResponseSchema(conflict.response, { replayed: true })).toEqual([]);
  });

  it("replays an in-progress conflict when a reservation already exists", async () => {
    const inProgressAdmin = makeIdempotencyAdmin({
      request_hash: getV10RequestHash(mutationInput.payload),
      response_json: buildV10MutationResponse({ outcome: "conflict", message: "In progress." }),
      claim_status: "in_progress",
    });
    const inProgress = await executeV10IdempotentMutation(inProgressAdmin as never, mutationInput, async () => {
      throw new Error("in-progress mutations should not execute twice");
    });

    expect(inProgress.replayed).toBe(true);
    expect(inProgress.response).toMatchObject({
      outcome: "conflict",
      diagnostic_id: "v10_idempotency_in_progress",
      replay_state: "in_progress",
    });
    expect(validateV10ApiResponseSchema(inProgress.response, { replayed: true })).toEqual([]);
  });

  it("fails closed when durable idempotency lookup or persistence fails", async () => {
    const lookupFailure = await executeV10IdempotentMutation(
      makeIdempotencyAdmin(null, { insertError: "claim failed", lookupError: "connection failed" }) as never,
      mutationInput,
      async () => {
        throw new Error("lookup failures should not execute mutations");
      }
    );

    expect(lookupFailure.replayed).toBe(false);
    expect(lookupFailure.response).toMatchObject({
      outcome: "server_error",
      diagnostic_id: "v10_idempotency_claim_failed",
    });

    const persistenceFailure = await executeV10IdempotentMutation(
      makeIdempotencyAdmin(null, { updateError: "write failed" }) as never,
      mutationInput,
      async () =>
        buildV10MutationResponse({
          outcome: "success",
          message: "Completed.",
          changedObjectType: "contract_task",
          changedObjectId: "task_1",
          auditEventId: "audit_1",
        })
    );

    expect(persistenceFailure.replayed).toBe(false);
    expect(persistenceFailure.response).toMatchObject({
      outcome: "server_error",
      diagnostic_id: "v10_idempotency_persistence_failed",
    });
  });

  it("persists a support-safe failure envelope when execution throws after an idempotency claim", async () => {
    const admin = makeIdempotencyAdmin();
    const result = await executeV10IdempotentMutation(admin as never, mutationInput, async () => {
      throw new Error("provider timeout with private payload");
    });

    expect(result.replayed).toBe(false);
    expect(result.response).toMatchObject({
      outcome: "server_error",
      diagnostic_id: "v10_mutation_execution_failed",
      next_destination_href: "/settings/health",
      replay_state: "not_replayed",
    });
    expect((result.response as { user_visible_message: string }).user_visible_message).not.toContain("private payload");
    expect(admin.rpcCalls.map((call) => call.fn)).toEqual([
      "claim_v10_mutation_idempotency",
      "complete_v10_mutation_idempotency",
    ]);
    expect(admin.updated[0]).toMatchObject({
      claim_status: "completed",
      response_json: expect.objectContaining({ diagnostic_id: "v10_mutation_execution_failed" }),
    });
    expect(validateV10ApiResponseSchema(result.response)).toEqual([]);
  });

  it("returns a supportable diagnostic for rare idempotency claim races", async () => {
    const raceAdmin = makeIdempotencyAdmin(null, { claimResult: "missing_after_conflict" });

    const race = await executeV10IdempotentMutation(raceAdmin as never, mutationInput, async () => {
      throw new Error("claim races should not execute the mutation body");
    });

    expect(race.replayed).toBe(false);
    expect(race.response).toMatchObject({
      outcome: "server_error",
      diagnostic_id: "v10_idempotency_claim_race",
      next_destination_href: "/settings/health",
    });
  });

  it("propagates audit event ids from successful audited transactions", async () => {
    const admin = makeIdempotencyAdmin();

    const result = await executeV10AuditedMutation(
      admin as never,
      { ...mutationInput, auditAction: "work_item.completed" },
      async () => ({
        auditEventId: "audit_from_transaction",
        response: buildV10MutationResponse({
          outcome: "success",
          message: "Completed.",
          changedObjectType: "contract_task",
          changedObjectId: "task_1",
        }),
      })
    );

    expect(result.replayed).toBe(false);
    expect(result.response.audit_event_id).toBe("audit_from_transaction");
  });

  it("standardizes successful mutations with idempotency, strict audit, scoped refresh, and telemetry", async () => {
    const admin = makeStandardMutationAdmin();
    const refreshCalls: unknown[] = [];
    const telemetryCalls: unknown[] = [];

    const result = await executeV10StandardMutation(
      admin as never,
      {
        ...mutationInput,
        auditAction: "work_item.completed",
        targetType: "work_item",
        targetId: "work_1",
        contractId: "contract_1",
        safeMetadata: { result_count: 1, raw_note: "private note" },
        refreshEvent: {
          sourceTable: "contract_tasks",
          sourceId: "work_1",
          contractId: "contract_1",
          mutationKey: "complete_work_item",
          changedAt: new Date("2026-04-25T00:00:00Z"),
        },
        refreshExecutor: async (_admin, organizationId, options) => {
          refreshCalls.push({ organizationId, options });
          return {
            ok: true,
            diagnostics: {
              refresh_job_id: "refresh_1",
            },
          } as never;
        },
        telemetry: (event) => {
          telemetryCalls.push(event);
        },
      },
      async () =>
        buildV10MutationResponse({
          outcome: "success",
          message: "Completed.",
          changedObjectType: "work_item",
          changedObjectId: "work_1",
          expectedVersion: "version_1",
          newVersion: "version_2",
        })
    );

    expect(result.replayed).toBe(false);
    expect(result.response).toMatchObject({
      outcome: "success",
      audit_event_id: "audit_standard_1",
    });
    expect(admin.auditRows[0]).toMatchObject({
      action: "work_item.completed",
      target_type: "work_item",
      target_id: "work_1",
      contract_id: "contract_1",
      before_state_hash: "version_1",
      after_state_hash: "version_2",
      safe_metadata: { result_count: 1, raw_note_state: "redacted" },
    });
    expect(refreshCalls).toEqual([
      {
        organizationId: "org_1",
        options: expect.objectContaining({
          reason: "event:contract_tasks:complete_work_item",
          refreshScope: "one_contract",
          contractId: "contract_1",
          modelKeys: ["work_items", "contract_activity_events", "command_search_index"],
        }),
      },
    ]);
    expect(telemetryCalls).toEqual([
      expect.objectContaining({
        mutationName: "complete_work_item",
        outcome: "success",
        replayed: false,
        auditEventId: "audit_standard_1",
        refreshJobId: "refresh_1",
      }),
    ]);
  });

  it("standard mutation runtime fails closed when strict audit cannot persist", async () => {
    const admin = makeStandardMutationAdmin({ auditFails: true });

    const result = await executeV10StandardMutation(
      admin as never,
      {
        ...mutationInput,
        auditAction: "work_item.completed",
        targetType: "work_item",
        targetId: "work_1",
      },
      async () =>
        buildV10MutationResponse({
          outcome: "success",
          message: "Completed.",
          changedObjectType: "work_item",
          changedObjectId: "work_1",
        })
    );

    expect(result.response).toMatchObject({
      outcome: "audit_write_failed",
      diagnostic_id: "v10_audit_write_failed",
      next_destination_href: "/settings/health",
    });
    expect(validateV10ApiResponseSchema(result.response)).toEqual([]);
  });

  it("persists and replays non-JSON mutation responses", async () => {
    const firstAdmin = makeIdempotencyAdmin();
    const first = await executeV10IdempotentResponseMutation(firstAdmin as never, mutationInput, async () => {
      return new Response("id,title\r\n1,Acme", {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "X-Export-Job-Id": "export_1",
        },
      });
    });

    expect(first.replayed).toBe(false);
    expect(firstAdmin.inserted).toHaveLength(1);
    expect(firstAdmin.updated).toHaveLength(1);
    expect(await first.response.text()).toContain("Acme");

    const replayAdmin = makeIdempotencyAdmin({
      request_hash: firstAdmin.inserted[0].request_hash,
      response_json: firstAdmin.updated[0].response_json,
      claim_status: "completed",
    });
    const replay = await executeV10IdempotentResponseMutation(replayAdmin as never, mutationInput, async () => {
      throw new Error("should not execute replayed response mutation");
    });

    expect(replay.replayed).toBe(true);
    expect(replay.response.headers.get("content-type")).toContain("text/csv");
    expect(replay.response.headers.get("x-export-job-id")).toBe("export_1");
    expect(replay.response.headers.get("x-v10-idempotent-replay")).toBe("true");
    expect(replay.response.headers.get("cache-control")).toBe("private, no-store");
    expect(await replay.response.text()).toContain("Acme");
  });

  it("persists a support-safe failure response when response mutations throw after an idempotency claim", async () => {
    const admin = makeIdempotencyAdmin();

    const result = await executeV10IdempotentResponseMutation(admin as never, mutationInput, async () => {
      throw new Error("export worker unavailable");
    });

    expect(result.replayed).toBe(false);
    expect(admin.inserted).toHaveLength(1);
    expect(admin.updated).toHaveLength(1);
    expect(result.response.status).toBe(500);
    expect(result.response.headers.get("x-v10-idempotent-replay")).toBe("false");
    const body = await result.response.json();
    expect(body).toMatchObject({
      outcome: "server_error",
      diagnostic_id: "v10_mutation_execution_failed",
      replay_state: "not_replayed",
    });
    expect(admin.updated[0].response_json).toMatchObject({
      status: 500,
      body: expect.stringContaining("v10_mutation_execution_failed"),
    });
  });

  it("turns successful mutations without an audit event into audit_write_failed", async () => {
    const admin = makeIdempotencyAdmin();

    const result = await executeV10AuditedMutation(
      admin as never,
      { ...mutationInput, auditAction: "work_item.completed" },
      async () => ({
        auditEventId: null,
        response: buildV10MutationResponse({
          outcome: "success",
          message: "Completed.",
          changedObjectType: "contract_task",
          changedObjectId: "task_1",
        }),
      })
    );

    expect(result.response.outcome).toBe("audit_write_failed");
    expect(result.response.changed_object_type).toBe("contract_task");
  });

  it("rolls back successful source writes when audited mutations cannot persist an audit event", async () => {
    const admin = makeIdempotencyAdmin();
    const rollbackCalls: unknown[] = [];

    const result = await executeV10AuditedMutation(
      admin as never,
      { ...mutationInput, auditAction: "work_item.completed" },
      async () => ({
        auditEventId: null,
        rollback: async (input) => {
          rollbackCalls.push(input);
        },
        response: buildV10MutationResponse({
          outcome: "success",
          message: "Completed.",
          changedObjectType: "contract_task",
          changedObjectId: "task_1",
        }),
      })
    );

    expect(rollbackCalls).toEqual([
      {
        reason: "audit_write_failed",
        diagnosticId: "v10_audit_write_failed",
        targetType: "contract_task",
        targetId: "task_1",
      },
    ]);
    expect(result.response).toMatchObject({
      outcome: "audit_write_failed",
      diagnostic_id: "v10_audit_write_failed",
    });
    expect(validateV10ApiResponseSchema(result.response)).toEqual([]);
  });

  it("surfaces rollback diagnostics when audit-failure rollback needs support", async () => {
    const admin = makeIdempotencyAdmin();

    const result = await executeV10AuditedMutation(
      admin as never,
      { ...mutationInput, auditAction: "work_item.completed" },
      async () => ({
        auditEventId: null,
        rollback: async () => {
          throw new Error("rollback failed");
        },
        response: buildV10MutationResponse({
          outcome: "success",
          message: "Completed.",
          changedObjectType: "contract_task",
          changedObjectId: "task_1",
        }),
      })
    );

    expect(result.response).toMatchObject({
      outcome: "audit_write_failed",
      diagnostic_id: "v10_audit_write_failed_rollback_failed",
      next_destination_href: "/settings/health",
    });
    expect(validateV10ApiResponseSchema(result.response)).toEqual([]);
  });

  it("fails stale expected versions before executing or storing an idempotency row", async () => {
    const admin = makeIdempotencyAdmin();
    const result = await executeV10IdempotentMutation(
      admin as never,
      {
        ...mutationInput,
        expectedVersion: "version_1",
        currentVersion: "version_2",
      },
      async () => {
        throw new Error("stale mutations should not execute");
      }
    );

    expect(result.replayed).toBe(false);
    expect(result.response).toMatchObject({
      outcome: "stale_version",
      diagnostic_id: "v10_expected_version_stale",
      next_destination_href: "/work",
      retry_eligible: true,
    });
    expect(validateV10ApiResponseSchema(result.response)).toEqual([]);
    expect(admin.inserted).toHaveLength(0);
  });

  it("fails closed when a versioned mutation omits the expected version", async () => {
    const admin = makeIdempotencyAdmin();
    const result = await executeV10IdempotentMutation(
      admin as never,
      {
        ...mutationInput,
        expectedVersion: undefined,
        currentVersion: "version_2",
      },
      async () => {
        throw new Error("missing expected version should not execute");
      }
    );

    expect(result.replayed).toBe(false);
    expect(result.response).toMatchObject({
      outcome: "validation_failed",
      diagnostic_id: "v10_expected_version_required",
      validation_failures: [
        expect.objectContaining({
          field: "expected_version",
          code: "required",
          self_fixable: true,
        }),
      ],
    });
    expect(validateV10ApiResponseSchema(result.response)).toEqual([]);
    expect(admin.inserted).toHaveLength(0);
  });

  it("allows external evidence mutations to opt out of expected-version enforcement", async () => {
    const admin = makeIdempotencyAdmin();
    const result = await executeV10IdempotentMutation(
      admin as never,
      {
        ...mutationInput,
        mutationName: "submit_external_evidence",
        targetType: "external_evidence_submission",
        targetId: "submission_1",
        expectedVersion: undefined,
        currentVersion: undefined,
      },
      async () =>
        buildV10MutationResponse({
          outcome: "success",
          message: "Evidence submitted.",
          changedObjectType: "external_evidence_submission",
          changedObjectId: "submission_1",
          auditEventId: "audit_1",
        })
    );

    expect(result.response.outcome).toBe("success");
    expect(admin.inserted).toHaveLength(1);
  });

  it("persists optional client request ids with durable idempotency rows", async () => {
    const admin = makeIdempotencyAdmin();
    await executeV10IdempotentMutation(
      admin as never,
      { ...mutationInput, clientRequestId: "client_req_123" },
      async () =>
        buildV10MutationResponse({
          outcome: "success",
          message: "Completed.",
          changedObjectType: "contract_task",
          changedObjectId: "task_1",
          auditEventId: "audit_1",
        })
    );

    expect(admin.inserted[0]).toMatchObject({ client_request_id: "client_req_123" });
  });

  it("throws from strict audit persistence when no audit event is recorded", async () => {
    const admin = {
      from(table: string) {
        expect(table).toBe("v10_audit_events");
        return {
          insert: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: null, error: { message: "insert failed" } }),
            }),
          }),
        };
      },
    };

    await expect(
      recordV10AuditEventStrict(admin as never, {
        organizationId: "org_1",
        actorUserId: "user_1",
        action: "work_item.completed",
        targetType: "contract_task",
        targetId: "task_1",
        outcome: "success",
      })
    ).rejects.toBeInstanceOf(V10AuditWriteError);
  });

  it("builds reusable denial envelopes with diagnostics", () => {
    const response = buildV10DeniedMutationResponse({
      outcome: "hidden_module",
      message: "This module is hidden for the workspace.",
      diagnosticId: "v10_hidden_module",
      nextDestinationHref: "/settings/health",
    });

    expect(response).toMatchObject({
      outcome: "hidden_module",
      diagnostic_id: "v10_hidden_module",
      next_destination_href: "/settings/health",
    });
    expect(validateV10ApiResponseSchema(response)).toEqual([]);
  });

  it("binds idempotency keys to canonical request hashes (body mismatch detection)", () => {
    expect(getV10RequestHash({ action: "start", id: "a" })).not.toEqual(getV10RequestHash({ action: "pause", id: "a" }));
    expect(getV10RequestHash({ b: 2, a: 1 })).toEqual(getV10RequestHash({ a: 1, b: 2 }));
  });

  it("redacts unsafe audit metadata before V10 audit persistence", () => {
    expect(
      sanitizeV10AuditMetadata({
        approval_type: "renewal_decision",
        decision_note: "contains private text",
        responder_email: "person@example.com",
        evidence_url: "https://private.example/evidence",
        retryable: true,
        nested: {
          raw_clause_text: "private clause",
          safe_count: 2,
        },
      })
    ).toEqual({
      approval_type: "renewal_decision",
      decision_note_state: "redacted",
      responder_email_state: "redacted",
      evidence_url_state: "redacted",
      retryable: true,
      nested: {
        raw_clause_text_state: "redacted",
        safe_count: 2,
      },
    });
  });
});
