"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { isUuid } from "@/lib/security/validation";
import { executeV10IdempotentMutation, recordV10AuditEvent } from "@/lib/v10-server-contracts";
import { buildV10MutationResponse, type V10MutationResponse } from "@/lib/v10-mutation-envelope";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";
import { getV10CompatibleActionGroup } from "@/lib/v10-work-semantics";
import type { V10WorkItemStatus } from "@/lib/v10-release-contract";
import { recomputeContractSignals } from "@/lib/workflow-signals";
import { bulkAssignCompatibleContractTasks, bulkCompleteCompatibleContractTasks } from "./tasks";

const MAX_BULK_V10_ITEMS = 50;

async function ensureOwnerOrgMember(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  orgId: string,
  ownerUserId: string
): Promise<boolean> {
  const { data } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", ownerUserId)
    .maybeSingle();
  return !!data;
}

export type V10BulkAssignWorkItemOutcome = {
  v10WorkItemId: string;
  outcome: "success" | "no_action" | "validation_failed";
  reason?: string;
};

/**
 * Bulk-assign owners for rows in `v10_work_items` that share the same `compatible_action_group`.
 * Homogeneous batches only: all `contract_task` or all `obligation` (mixed types return validation_failed).
 * Contract tasks delegate to `bulkAssignCompatibleContractTasks`; obligations update `contract_obligations.owner_id`.
 */
export async function bulkAssignCompatibleV10WorkItems(input: {
  v10WorkItemIds: string[];
  ownerUserId: string;
  expectedCompatibleActionGroup: string;
  idempotencyKey: string | null;
  clientRequestId?: string | null;
  expectedVersion?: string | number | null;
}): Promise<{
  ok: boolean;
  error?: string;
  outcomes?: V10BulkAssignWorkItemOutcome[];
  v10?: unknown;
}> {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const ids = [...new Set(input.v10WorkItemIds.map((id) => id.trim()).filter(Boolean))].slice(0, MAX_BULK_V10_ITEMS);
  const ownerUserId = input.ownerUserId.trim();
  const group = input.expectedCompatibleActionGroup.trim();
  if (ids.length === 0 || ids.some((id) => !isUuid(id))) return { ok: false, error: "Invalid work item ids" };
  if (!isUuid(ownerUserId)) return { ok: false, error: "Invalid owner" };
  if (!group) return { ok: false, error: "Compatible action group is required" };

  const { data: rows } = await admin
    .from("v10_work_items")
    .select("id, organization_id, type, source_table, source_id, compatible_action_group, status, owner_user_id, updated_at")
    .in("id", ids);
  const workRows = rows ?? [];
  if (workRows.length !== ids.length) return { ok: false, error: "One or more V10 work items were not found." };

  const orgIds = [...new Set(workRows.map((r) => r.organization_id))];
  if (orgIds.length !== 1) return { ok: false, error: "Bulk work must belong to one organization." };
  const organizationId = orgIds[0] as string;

  const role = await getOrgMemberRole(admin, user.id, organizationId);
  if (!canEditContracts(role)) {
    return { ok: false, error: "Viewers cannot bulk-assign work." };
  }
  if (!(await ensureOwnerOrgMember(admin, organizationId, ownerUserId))) {
    return { ok: false, error: "Owner must be an active member of this workspace." };
  }

  for (const row of workRows) {
    if (row.compatible_action_group !== group) {
      return {
        ok: false,
        error: "Incompatible action group for one or more selected work items.",
        outcomes: workRows.map((r) => ({
          v10WorkItemId: r.id,
          outcome: "validation_failed" as const,
          reason: r.compatible_action_group !== group ? "incompatible_action_group" : "batch_aborted",
        })),
      };
    }
  }

  const types = new Set(workRows.map((r) => r.type as string));
  if (types.size !== 1) {
    return { ok: false, error: "Bulk V10 assign supports a single work item type per request." };
  }
  const onlyType = [...types][0];

  if (onlyType === "contract_task") {
    const taskIds = workRows.map((r) => r.source_id).filter(isUuid);
    if (taskIds.length !== workRows.length) return { ok: false, error: "Invalid task source ids." };
    const res = await bulkAssignCompatibleContractTasks({
      taskIds,
      ownerUserId,
      expectedCompatibleActionGroup: group,
      idempotencyKey: input.idempotencyKey,
      clientRequestId: input.clientRequestId ?? null,
      expectedVersion: input.expectedVersion ?? null,
    });
    if ("error" in res && res.error) return { ok: false, error: res.error };
    if (!res.success) {
      return {
        ok: false,
        error:
          typeof res.v10 === "object" &&
          res.v10 &&
          "user_visible_message" in res.v10 &&
          typeof (res.v10 as V10MutationResponse).user_visible_message === "string"
            ? (res.v10 as V10MutationResponse).user_visible_message
            : "Bulk assign failed.",
        v10: res.v10,
      };
    }
    return {
      ok: true,
      v10: res.v10,
      outcomes: workRows.map((r) => {
        const taskOutcome = res.itemOutcomes?.find((o) => o.taskId === r.source_id);
        const o = taskOutcome?.outcome;
        return {
          v10WorkItemId: r.id,
          outcome: o === "validation_failed" ? ("validation_failed" as const) : o === "no_action" ? ("no_action" as const) : ("success" as const),
          reason: taskOutcome?.reason,
        };
      }),
    };
  }

  if (onlyType === "obligation" && workRows.every((r) => r.source_table === "contract_obligations")) {
    const obligationIds = workRows.map((r) => r.source_id).filter(isUuid);
    const currentVersion = `bulk:${workRows.map((r) => r.updated_at).sort().join("|")}`;
    const { response, replayed } = await executeV10IdempotentMutation(
      admin,
      {
        organizationId,
        actorUserId: user.id,
        mutationName: "bulk_assign_compatible_work_items",
        targetType: "work_item",
        targetId: `bulk:v10:${ids.length}`,
        idempotencyKey: input.idempotencyKey,
        clientRequestId: input.clientRequestId ?? null,
        expectedVersion: input.expectedVersion,
        currentVersion,
        payload: { v10WorkItemIds: ids, ownerUserId, expectedCompatibleActionGroup: group, kind: "obligation" },
      },
      async () => {
        const { data: obRows } = await admin
          .from("contract_obligations")
          .select("id, owner_id, contract_id, updated_at")
          .in("id", obligationIds)
          .eq("organization_id", organizationId);
        const obs = obRows ?? [];
        if (obs.length !== obligationIds.length) {
          return buildV10MutationResponse({
            outcome: "validation_failed",
            message: "One or more obligations were not found in this workspace.",
            nextDestinationHref: "/work",
          });
        }
        const prevOwnerById = new Map(obs.map((o) => [o.id as string, o.owner_id as string | null]));
        const eligible = obs.filter((o) => o.owner_id !== ownerUserId).map((o) => o.id as string);
        if (eligible.length > 0) {
          const { error } = await admin
            .from("contract_obligations")
            .update({ owner_id: ownerUserId })
            .in("id", eligible)
            .eq("organization_id", organizationId);
          if (error) {
            return buildV10MutationResponse({
              outcome: "server_error",
              message: mapDataSourceError(error.message),
              diagnosticId: "v10_bulk_obligation_assign_failed",
              nextDestinationHref: "/work",
            });
          }
        }
        const auditEventId = await recordV10AuditEvent(admin, {
          organizationId,
          actorUserId: user.id,
          action: "work_item.bulk_owner_changed",
          targetType: "work_item",
          targetId: `bulk:v10:${ids.length}`,
          outcome: eligible.length > 0 ? "success" : "no_action",
          safeMetadata: {
            kind: "obligation",
            requested_count: ids.length,
            updated_count: eligible.length,
          },
        });
        if (!auditEventId && eligible.length > 0) {
          for (const id of eligible) {
            const prev = prevOwnerById.get(id) ?? null;
            await admin.from("contract_obligations").update({ owner_id: prev }).eq("id", id).eq("organization_id", organizationId);
          }
          return buildV10MutationResponse({
            outcome: "audit_write_failed",
            message: "Bulk assign could not be recorded in the audit trail.",
            nextDestinationHref: "/work",
            diagnosticId: "v10_bulk_obligation_audit_missing",
          });
        }
        await refreshV10ReadModelsForOrganization(admin, organizationId, {
          refreshScope: "incremental",
          reason: "bulk_obligation_owner_mutation",
        });
        const obByIdForSnapshot = new Map(obs.map((o) => [o.id as string, o]));
        return buildV10MutationResponse({
          outcome: eligible.length > 0 ? "success" : "no_action",
          message: eligible.length > 0 ? "Obligation owners updated." : "No obligation owner changes were needed.",
          changedObjectType: "work_item",
          changedObjectId: `bulk:v10:${ids.length}`,
          nextDestinationHref: "/work",
          auditEventId: auditEventId ?? undefined,
          bulkItemOutcomes: workRows.map((r) => {
            const ob = obByIdForSnapshot.get(r.source_id as string);
            const wasAlready = ob?.owner_id === ownerUserId;
            return {
              target_id: r.source_id,
              outcome: wasAlready ? ("no_action" as const) : ("success" as const),
              compatible_action_group: group,
            };
          }),
        });
      }
    );
    const snaps = response.bulk_item_outcomes;
    return {
      ok: response.outcome === "success" || response.outcome === "no_action",
      v10: { ...response, replayed },
      outcomes: workRows.map((r) => {
        const s = snaps?.find((x) => x.target_id === r.source_id);
        if (s) {
          return {
            v10WorkItemId: r.id,
            outcome: s.outcome,
            reason: s.reason,
          };
        }
        const rowOutcome: V10BulkAssignWorkItemOutcome["outcome"] =
          response.outcome === "success"
            ? "success"
            : response.outcome === "no_action"
              ? "no_action"
              : "validation_failed";
        return {
          v10WorkItemId: r.id,
          outcome: rowOutcome,
          reason: response.outcome === "success" || response.outcome === "no_action" ? undefined : String(response.outcome),
        };
      }),
    };
  }

  return {
    ok: false,
    error: `Bulk V10 assign is not yet implemented for work item type "${onlyType}".`,
  };
}

/**
 * Bulk-complete work backed by `v10_work_items` (homogeneous `contract_task` or `obligation` batches).
 */
export async function bulkCompleteCompatibleV10WorkItems(input: {
  v10WorkItemIds: string[];
  expectedCompatibleActionGroup: string;
  idempotencyKey: string | null;
  clientRequestId?: string | null;
  expectedVersion?: string | number | null;
}): Promise<{
  ok: boolean;
  error?: string;
  outcomes?: V10BulkAssignWorkItemOutcome[];
  v10?: unknown;
}> {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const ids = [...new Set(input.v10WorkItemIds.map((id) => id.trim()).filter(Boolean))].slice(0, MAX_BULK_V10_ITEMS);
  const group = input.expectedCompatibleActionGroup.trim();
  if (ids.length === 0 || ids.some((id) => !isUuid(id))) return { ok: false, error: "Invalid work item ids" };
  if (!group) return { ok: false, error: "Compatible action group is required" };

  const { data: rows } = await admin
    .from("v10_work_items")
    .select("id, organization_id, type, source_table, source_id, compatible_action_group, status, owner_user_id, updated_at")
    .in("id", ids);
  const workRows = rows ?? [];
  if (workRows.length !== ids.length) return { ok: false, error: "One or more V10 work items were not found." };

  const orgIds = [...new Set(workRows.map((r) => r.organization_id))];
  if (orgIds.length !== 1) return { ok: false, error: "Bulk work must belong to one organization." };
  const organizationId = orgIds[0] as string;

  const role = await getOrgMemberRole(admin, user.id, organizationId);
  if (!canEditContracts(role)) {
    return { ok: false, error: "Viewers cannot bulk-complete work." };
  }

  for (const row of workRows) {
    if (row.compatible_action_group !== group) {
      return {
        ok: false,
        error: "Incompatible action group for one or more selected work items.",
        outcomes: workRows.map((r) => ({
          v10WorkItemId: r.id,
          outcome: "validation_failed" as const,
          reason: r.compatible_action_group !== group ? "incompatible_action_group" : "batch_aborted",
        })),
      };
    }
  }

  const types = new Set(workRows.map((r) => r.type as string));
  if (types.size !== 1) {
    return { ok: false, error: "Bulk V10 complete supports a single work item type per request." };
  }
  const onlyType = [...types][0];

  if (onlyType === "contract_task") {
    const taskIds = workRows.map((r) => r.source_id).filter(isUuid);
    if (taskIds.length !== workRows.length) return { ok: false, error: "Invalid task source ids." };
    const res = await bulkCompleteCompatibleContractTasks({
      taskIds,
      expectedCompatibleActionGroup: group,
      idempotencyKey: input.idempotencyKey,
      clientRequestId: input.clientRequestId ?? null,
      expectedVersion: input.expectedVersion ?? null,
    });
    if ("error" in res && res.error) return { ok: false, error: res.error };
    if (!res.success) {
      return {
        ok: false,
        error:
          typeof res.v10 === "object" &&
          res.v10 &&
          "user_visible_message" in res.v10 &&
          typeof (res.v10 as V10MutationResponse).user_visible_message === "string"
            ? (res.v10 as V10MutationResponse).user_visible_message
            : "Bulk complete failed.",
        v10: res.v10,
      };
    }
    return {
      ok: true,
      v10: res.v10,
      outcomes: workRows.map((r) => {
        const taskOutcome = res.itemOutcomes?.find((o) => o.taskId === r.source_id);
        const o = taskOutcome?.outcome;
        return {
          v10WorkItemId: r.id,
          outcome: o === "validation_failed" ? ("validation_failed" as const) : o === "no_action" ? ("no_action" as const) : ("success" as const),
          reason: taskOutcome?.reason,
        };
      }),
    };
  }

  if (onlyType === "obligation" && workRows.every((r) => r.source_table === "contract_obligations")) {
    const obligationIds = workRows.map((r) => r.source_id).filter(isUuid);
    const { data: obRows } = await admin
      .from("contract_obligations")
      .select("id, contract_id, organization_id, status, owner_id, due_date, updated_at, completed_at")
      .in("id", obligationIds)
      .eq("organization_id", organizationId);
    const obs = obRows ?? [];
    if (obs.length !== obligationIds.length) {
      return { ok: false, error: "One or more obligations were not found in this workspace." };
    }
    const obById = new Map(obs.map((o) => [o.id as string, o]));

    type OblOutcomeRow = {
      obligation: (typeof obs)[number];
      compatibleActionGroup: string;
      outcome: "success" | "no_action" | "validation_failed";
      reason: string;
    };

    const itemOutcomes: OblOutcomeRow[] = workRows.map((wr) => {
      const ob = obById.get(wr.source_id as string)!;
      const statusStr = String(ob.status);
      const compatibleActionGroup = getV10CompatibleActionGroup({
        id: String(ob.id),
        type: "obligation",
        status: statusStr as V10WorkItemStatus,
        ownerUserId: ob.owner_id as string | null | undefined,
        updatedAt: ob.updated_at as string | null | undefined,
      });
      const compatible = compatibleActionGroup === group;
      const transitionAllowed = statusStr === "open" || statusStr === "in_progress";
      const outcome: OblOutcomeRow["outcome"] =
        statusStr === "done"
          ? "no_action"
          : compatible && transitionAllowed
            ? "success"
            : "validation_failed";
      const reason =
        statusStr === "done"
          ? "already_done"
          : !compatible
            ? "incompatible_action_group"
            : "transition_not_allowed";
      return { obligation: ob, compatibleActionGroup, outcome, reason };
    });

    const eligibleIds = itemOutcomes.filter((i) => i.outcome === "success").map((i) => i.obligation.id as string);
    const currentVersion = `bulk:${workRows.map((r) => r.updated_at).sort().join("|")}`;

    const { response, replayed } = await executeV10IdempotentMutation(
      admin,
      {
        organizationId,
        actorUserId: user.id,
        mutationName: "bulk_complete_compatible_work_items",
        targetType: "work_item",
        targetId: `bulk:v10-complete:${ids.length}`,
        idempotencyKey: input.idempotencyKey,
        clientRequestId: input.clientRequestId ?? null,
        expectedVersion: input.expectedVersion,
        currentVersion,
        payload: { v10WorkItemIds: ids, expectedCompatibleActionGroup: group, kind: "obligation" },
      },
      async () => {
        const prevById = new Map(
          itemOutcomes.map((i) => [
            i.obligation.id as string,
            {
              status: String(i.obligation.status),
              completed_at: (i.obligation.completed_at as string | null | undefined) ?? null,
            },
          ])
        );
        const { data: freshObs } = await admin
          .from("contract_obligations")
          .select("id, status, completed_at")
          .in("id", obligationIds)
          .eq("organization_id", organizationId);
        const fresh = freshObs ?? [];
        if (fresh.length !== obligationIds.length) {
          return buildV10MutationResponse({
            outcome: "validation_failed",
            message: "One or more obligations were not found in this workspace.",
            nextDestinationHref: "/work",
          });
        }
        const eligible = eligibleIds.filter((id) => fresh.some((o) => o.id === id && o.status !== "done"));
        if (eligible.length > 0) {
          const now = new Date().toISOString();
          const { error } = await admin
            .from("contract_obligations")
            .update({ status: "done", completed_at: now })
            .in("id", eligible)
            .eq("organization_id", organizationId);
          if (error) {
            return buildV10MutationResponse({
              outcome: "server_error",
              message: mapDataSourceError(error.message),
              diagnosticId: "v10_bulk_obligation_complete_failed",
              nextDestinationHref: "/work",
            });
          }
        }
        const auditEventId = await recordV10AuditEvent(admin, {
          organizationId,
          actorUserId: user.id,
          action: "work_item.bulk_completed",
          targetType: "work_item",
          targetId: `bulk:v10-complete:${ids.length}`,
          outcome: eligibleIds.length === obligationIds.length ? "success" : eligibleIds.length > 0 ? "dependency_blocked" : "validation_failed",
          safeMetadata: {
            kind: "obligation",
            requested_count: ids.length,
            completed_count: eligibleIds.length,
          },
        });
        if (!auditEventId && eligibleIds.length > 0 && eligible.length > 0) {
          for (const id of eligible) {
            const prev = prevById.get(id);
            if (prev) {
              await admin
                .from("contract_obligations")
                .update({ status: prev.status, completed_at: prev.completed_at })
                .eq("id", id)
                .eq("organization_id", organizationId);
            }
          }
          return buildV10MutationResponse({
            outcome: "audit_write_failed",
            message: "Bulk complete could not be recorded in the audit trail.",
            nextDestinationHref: "/work",
            diagnosticId: "v10_bulk_obligation_complete_audit_missing",
          });
        }
        for (const contractId of [...new Set(obs.map((o) => o.contract_id).filter(Boolean))]) {
          await recomputeContractSignals(admin, contractId as string);
        }
        await refreshV10ReadModelsForOrganization(admin, organizationId, {
          refreshScope: "incremental",
          reason: "bulk_obligation_complete_mutation",
        });
        return buildV10MutationResponse({
          outcome: eligibleIds.length === obligationIds.length ? "success" : eligibleIds.length > 0 ? "dependency_blocked" : "validation_failed",
          message:
            eligibleIds.length === obligationIds.length
              ? "Bulk-compatible obligations completed."
              : eligibleIds.length > 0
                ? "Some compatible obligations were completed; review item outcomes for blocked rows."
                : "No compatible obligations could be completed.",
          changedObjectType: "work_item",
          changedObjectId: `bulk:v10-complete:${ids.length}`,
          nextDestinationHref: "/work",
          auditEventId: auditEventId ?? undefined,
          validationFailures: itemOutcomes
            .filter((item) => item.outcome === "validation_failed")
            .map((item) => ({
              field: String(item.obligation.id),
              code: item.reason,
              user_visible_message: "This obligation is not eligible for the selected bulk action.",
              self_fixable: item.reason === "incompatible_action_group",
            })),
          bulkItemOutcomes: itemOutcomes.map((item) => ({
            target_id: String(item.obligation.id),
            outcome: item.outcome,
            reason: item.reason,
            compatible_action_group: item.compatibleActionGroup,
          })),
        });
      }
    );

    const snaps = response.bulk_item_outcomes;
    const resolved =
      snaps && snaps.length > 0
        ? itemOutcomes.map((item) => {
            const s = snaps.find((x) => x.target_id === String(item.obligation.id));
            if (!s) return item;
            return {
              ...item,
              compatibleActionGroup: s.compatible_action_group ?? item.compatibleActionGroup,
              outcome: s.outcome,
              reason: s.reason ?? item.reason,
            };
          })
        : itemOutcomes;

    const ok = response.outcome === "success" || response.outcome === "dependency_blocked";
    return {
      ok,
      v10: { ...response, replayed },
      outcomes: workRows.map((r) => {
        const row = resolved.find((i) => String(i.obligation.id) === r.source_id);
        const o = row?.outcome ?? "validation_failed";
        return {
          v10WorkItemId: r.id,
          outcome: o,
          reason: row?.reason,
        };
      }),
    };
  }

  return {
    ok: false,
    error: `Bulk V10 complete is not yet implemented for work item type "${onlyType}".`,
  };
}
