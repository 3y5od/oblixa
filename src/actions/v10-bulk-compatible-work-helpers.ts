import { createAdminClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { executeV10IdempotentMutation, recordV10AuditEvent } from "@/lib/v10-server-contracts";
import { buildV10MutationResponse } from "@/lib/v10-mutation-envelope";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";
import { getV10CompatibleActionGroup, getV10OwnerState } from "@/lib/v10-work-semantics";
import { V10_WORK_ITEM_TYPES, type V10WorkItemStatus, type V10WorkItemType } from "@/lib/v10-release-contract";

export const MAX_BULK_V10_ITEMS = 50;
export const V10_BULK_WORK_ITEM_SELECT =
  "id, organization_id, type, source_table, source_id, compatible_action_group, status, owner_user_id, owner_state, updated_at, contract_id, blocked_reason, primary_action, last_state_change_at, last_state_change_actor_id, audit_event_id";

const V10_SPECIALIZED_BULK_WORK_ITEM_TYPES = ["contract_task", "obligation"] as const satisfies readonly V10WorkItemType[];
const V10_SPECIALIZED_BULK_WORK_ITEM_TYPE_SET = new Set<string>(V10_SPECIALIZED_BULK_WORK_ITEM_TYPES);
const V10_GENERIC_BULK_WORK_ITEM_TYPES = V10_WORK_ITEM_TYPES.filter(
  (type) => !V10_SPECIALIZED_BULK_WORK_ITEM_TYPE_SET.has(type)
) as readonly V10WorkItemType[];

export type V10BulkWorkRow = {
  id: string;
  organization_id: string;
  type: string;
  source_table: string;
  source_id: string;
  compatible_action_group: string;
  status: string;
  owner_user_id: string | null;
  owner_state?: string | null;
  updated_at: string | null;
  contract_id?: string | null;
  blocked_reason?: string | null;
  primary_action?: string | null;
  last_state_change_at?: string | null;
  last_state_change_actor_id?: string | null;
  audit_event_id?: string | null;
};

export type V10BulkAssignWorkItemOutcome = {
  v10WorkItemId: string;
  outcome: "success" | "no_action" | "validation_failed";
  reason?: string;
};

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

export async function ensureOwnerOrgMember(admin: Admin, orgId: string, ownerUserId: string): Promise<boolean> {
  const { data } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", ownerUserId)
    .maybeSingle();
  return !!data;
}

function isV10WorkItemType(value: string): value is V10WorkItemType {
  return (V10_WORK_ITEM_TYPES as readonly string[]).includes(value);
}

export function isV10GenericBulkWorkItemType(value: string): value is V10WorkItemType {
  return (V10_GENERIC_BULK_WORK_ITEM_TYPES as readonly string[]).includes(value);
}

function getNextV10WorkItemActionGroup(row: V10BulkWorkRow, input: { ownerUserId?: string | null; status?: V10WorkItemStatus }): string {
  return getV10CompatibleActionGroup({
    id: row.source_id || row.id,
    type: row.type as V10WorkItemType,
    status: input.status ?? (row.status as V10WorkItemStatus),
    ownerUserId: input.ownerUserId === undefined ? row.owner_user_id : input.ownerUserId,
  });
}

function getV10GenericBulkCompleteOutcome(row: Pick<V10BulkWorkRow, "type" | "status" | "compatible_action_group">, expectedGroup: string) {
  if (!isV10WorkItemType(row.type)) return { outcome: "validation_failed" as const, reason: "unsupported_work_item_type" };
  if (!isV10GenericBulkWorkItemType(row.type)) return { outcome: "validation_failed" as const, reason: "specialized_work_item_type" };
  if (row.compatible_action_group !== expectedGroup) return { outcome: "validation_failed" as const, reason: "incompatible_action_group" };
  if (row.status === "done") return { outcome: "no_action" as const, reason: "already_done" };
  if (["open", "in_progress", "waiting", "blocked"].includes(row.status)) return { outcome: "success" as const, reason: "eligible" };
  return { outcome: "validation_failed" as const, reason: "transition_not_allowed" };
}

export async function bulkAssignGenericV10WorkItems(input: {
  admin: Admin;
  organizationId: string;
  actorUserId: string;
  workRows: V10BulkWorkRow[];
  ownerUserId: string;
  expectedCompatibleActionGroup: string;
  idempotencyKey: string | null;
  clientRequestId?: string | null;
  expectedVersion?: string | number | null;
}): Promise<{ ok: boolean; error?: string; outcomes?: V10BulkAssignWorkItemOutcome[]; v10?: unknown }> {
  const unsupported = input.workRows.find((row) => !isV10GenericBulkWorkItemType(row.type));
  if (unsupported) return { ok: false, error: `Bulk V10 assign cannot use generic handling for work item type "${unsupported.type}".` };

  const ids = input.workRows.map((row) => row.id);
  const currentVersion = `bulk:${input.workRows.map((row) => row.updated_at).sort().join("|")}`;
  const previousById = new Map(
    input.workRows.map((row) => [
      row.id,
      {
        owner_user_id: row.owner_user_id,
        owner_state: row.owner_state ?? getV10OwnerState({ ownerUserId: row.owner_user_id }),
        compatible_action_group: row.compatible_action_group,
        last_state_change_at: row.last_state_change_at ?? null,
        last_state_change_actor_id: row.last_state_change_actor_id ?? null,
      },
    ])
  );

  const { response, replayed } = await executeV10IdempotentMutation(
    input.admin,
    {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      mutationName: "bulk_assign_compatible_work_items",
      targetType: "work_item",
      targetId: `bulk:v10-generic-assign:${ids.length}`,
      idempotencyKey: input.idempotencyKey,
      clientRequestId: input.clientRequestId ?? null,
      expectedVersion: input.expectedVersion,
      currentVersion,
      payload: { v10WorkItemIds: ids, ownerUserId: input.ownerUserId, expectedCompatibleActionGroup: input.expectedCompatibleActionGroup, kind: "generic_work_item" },
    },
    async () => {
      const { data: freshRows } = await input.admin.from("v10_work_items").select(V10_BULK_WORK_ITEM_SELECT).in("id", ids).eq("organization_id", input.organizationId);
      const fresh = (freshRows ?? []) as V10BulkWorkRow[];
      if (fresh.length !== ids.length) return buildV10MutationResponse({ outcome: "validation_failed", message: "One or more V10 work items were not found in this workspace.", nextDestinationHref: "/work" });

      const invalid = fresh.find((row) => row.compatible_action_group !== input.expectedCompatibleActionGroup || !isV10GenericBulkWorkItemType(row.type));
      if (invalid) {
        return buildV10MutationResponse({
          outcome: "validation_failed",
          message: "One or more V10 work items are no longer compatible with this bulk assign action.",
          nextDestinationHref: "/work",
          validationFailures: [{ field: invalid.id, code: "incompatible_action_group", user_visible_message: "Refresh the Work queue and try again.", self_fixable: true }],
        });
      }

      const eligible = fresh.filter((row) => row.owner_user_id !== input.ownerUserId);
      const now = new Date().toISOString();
      const updatedIds: string[] = [];
      for (const row of eligible) {
        const { error } = await input.admin
          .from("v10_work_items")
          .update({
            owner_user_id: input.ownerUserId,
            owner_state: getV10OwnerState({ ownerUserId: input.ownerUserId }),
            compatible_action_group: getNextV10WorkItemActionGroup(row, { ownerUserId: input.ownerUserId }),
            last_state_change_at: now,
            last_state_change_actor_id: input.actorUserId,
            updated_at: now,
          })
          .eq("id", row.id)
          .eq("organization_id", input.organizationId);
        if (error) {
          return buildV10MutationResponse({ outcome: "server_error", message: mapDataSourceError(error.message), diagnosticId: "v10_bulk_generic_assign_failed", nextDestinationHref: "/work" });
        }
        updatedIds.push(row.id);
      }

      const auditEventId = await recordV10AuditEvent(input.admin, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "work_item.bulk_owner_changed",
        targetType: "work_item",
        targetId: `bulk:v10-generic-assign:${ids.length}`,
        outcome: eligible.length > 0 ? "success" : "no_action",
        safeMetadata: { kind: "generic_work_item", requested_count: ids.length, updated_count: eligible.length, work_item_types: [...new Set(fresh.map((row) => row.type))] },
      });
      if (!auditEventId && updatedIds.length > 0) {
        for (const id of updatedIds) {
          const previous = previousById.get(id);
          if (previous) await input.admin.from("v10_work_items").update(previous).eq("id", id).eq("organization_id", input.organizationId);
        }
        return buildV10MutationResponse({ outcome: "audit_write_failed", message: "Bulk assign could not be recorded in the audit trail.", nextDestinationHref: "/work", diagnosticId: "v10_bulk_generic_assign_audit_missing" });
      }

      return buildV10MutationResponse({
        outcome: eligible.length > 0 ? "success" : "no_action",
        message: eligible.length > 0 ? "V10 work item owners updated." : "No V10 work item owner changes were needed.",
        changedObjectType: "work_item",
        changedObjectId: `bulk:v10-generic-assign:${ids.length}`,
        nextDestinationHref: "/work",
        auditEventId: auditEventId ?? undefined,
        bulkItemOutcomes: fresh.map((row) => ({ target_id: row.id, outcome: row.owner_user_id === input.ownerUserId ? "no_action" : "success", reason: row.owner_user_id === input.ownerUserId ? "already_assigned" : "assigned", compatible_action_group: input.expectedCompatibleActionGroup })),
      });
    }
  );

  return {
    ok: response.outcome === "success" || response.outcome === "no_action",
    v10: { ...response, replayed },
    outcomes: input.workRows.map((row) => {
      const snapshot = response.bulk_item_outcomes?.find((item) => item.target_id === row.id);
      return { v10WorkItemId: row.id, outcome: snapshot?.outcome ?? "validation_failed", reason: snapshot?.reason };
    }),
  };
}

export async function bulkCompleteGenericV10WorkItems(input: {
  admin: Admin;
  organizationId: string;
  actorUserId: string;
  workRows: V10BulkWorkRow[];
  expectedCompatibleActionGroup: string;
  idempotencyKey: string | null;
  clientRequestId?: string | null;
  expectedVersion?: string | number | null;
}): Promise<{ ok: boolean; error?: string; outcomes?: V10BulkAssignWorkItemOutcome[]; v10?: unknown }> {
  const itemOutcomes = input.workRows.map((row) => ({ row, ...getV10GenericBulkCompleteOutcome(row, input.expectedCompatibleActionGroup) }));
  const hardFailure = itemOutcomes.find((item) => item.outcome === "validation_failed" && item.reason === "unsupported_work_item_type");
  if (hardFailure) return { ok: false, error: `Bulk V10 complete cannot use generic handling for work item type "${hardFailure.row.type}".` };

  const ids = input.workRows.map((row) => row.id);
  const currentVersion = `bulk:${input.workRows.map((row) => row.updated_at).sort().join("|")}`;
  const previousById = new Map(
    input.workRows.map((row) => [
      row.id,
      {
        status: row.status,
        blocked_reason: row.blocked_reason ?? null,
        primary_action: row.primary_action ?? "open_source_object",
        compatible_action_group: row.compatible_action_group,
        last_state_change_at: row.last_state_change_at ?? null,
        last_state_change_actor_id: row.last_state_change_actor_id ?? null,
      },
    ])
  );

  const { response, replayed } = await executeV10IdempotentMutation(
    input.admin,
    {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      mutationName: "bulk_complete_compatible_work_items",
      targetType: "work_item",
      targetId: `bulk:v10-generic-complete:${ids.length}`,
      idempotencyKey: input.idempotencyKey,
      clientRequestId: input.clientRequestId ?? null,
      expectedVersion: input.expectedVersion,
      currentVersion,
      payload: { v10WorkItemIds: ids, expectedCompatibleActionGroup: input.expectedCompatibleActionGroup, kind: "generic_work_item" },
    },
    async () => {
      const { data: freshRows } = await input.admin.from("v10_work_items").select(V10_BULK_WORK_ITEM_SELECT).in("id", ids).eq("organization_id", input.organizationId);
      const fresh = (freshRows ?? []) as V10BulkWorkRow[];
      if (fresh.length !== ids.length) return buildV10MutationResponse({ outcome: "validation_failed", message: "One or more V10 work items were not found in this workspace.", nextDestinationHref: "/work" });

      const resolved = fresh.map((row) => ({ row, ...getV10GenericBulkCompleteOutcome(row, input.expectedCompatibleActionGroup) }));
      const eligible = resolved.filter((item) => item.outcome === "success");
      const now = new Date().toISOString();
      const updatedIds: string[] = [];
      for (const item of eligible) {
        const { error } = await input.admin
          .from("v10_work_items")
          .update({
            status: "done",
            blocked_reason: null,
            primary_action: "open_source_object",
            compatible_action_group: getNextV10WorkItemActionGroup(item.row, { status: "done" }),
            last_state_change_at: now,
            last_state_change_actor_id: input.actorUserId,
            updated_at: now,
          })
          .eq("id", item.row.id)
          .eq("organization_id", input.organizationId);
        if (error) {
          return buildV10MutationResponse({ outcome: "server_error", message: mapDataSourceError(error.message), diagnosticId: "v10_bulk_generic_complete_failed", nextDestinationHref: "/work" });
        }
        updatedIds.push(item.row.id);
      }

      const outcome = eligible.length === fresh.length ? "success" : eligible.length > 0 ? "dependency_blocked" : resolved.every((item) => item.outcome === "no_action") ? "no_action" : "validation_failed";
      const auditEventId = await recordV10AuditEvent(input.admin, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "work_item.bulk_completed",
        targetType: "work_item",
        targetId: `bulk:v10-generic-complete:${ids.length}`,
        outcome,
        safeMetadata: { kind: "generic_work_item", requested_count: ids.length, completed_count: eligible.length, work_item_types: [...new Set(fresh.map((row) => row.type))] },
      });
      if (!auditEventId && updatedIds.length > 0) {
        for (const id of updatedIds) {
          const previous = previousById.get(id);
          if (previous) await input.admin.from("v10_work_items").update(previous).eq("id", id).eq("organization_id", input.organizationId);
        }
        return buildV10MutationResponse({ outcome: "audit_write_failed", message: "Bulk complete could not be recorded in the audit trail.", nextDestinationHref: "/work", diagnosticId: "v10_bulk_generic_complete_audit_missing" });
      }

      return buildV10MutationResponse({
        outcome,
        message:
          outcome === "success"
            ? "Bulk-compatible V10 work items completed."
            : outcome === "dependency_blocked"
              ? "Some compatible V10 work items were completed; review item outcomes for blocked rows."
              : outcome === "no_action"
                ? "No V10 work item completion changes were needed."
                : "No compatible V10 work items could be completed.",
        changedObjectType: "work_item",
        changedObjectId: `bulk:v10-generic-complete:${ids.length}`,
        nextDestinationHref: "/work",
        auditEventId: auditEventId ?? undefined,
        validationFailures: resolved.filter((item) => item.outcome === "validation_failed").map((item) => ({ field: item.row.id, code: item.reason, user_visible_message: "This V10 work item is not eligible for the selected bulk action.", self_fixable: item.reason === "incompatible_action_group" })),
        bulkItemOutcomes: resolved.map((item) => ({ target_id: item.row.id, outcome: item.outcome, reason: item.reason, compatible_action_group: item.row.compatible_action_group })),
      });
    }
  );

  return {
    ok: response.outcome === "success" || response.outcome === "dependency_blocked" || response.outcome === "no_action",
    v10: { ...response, replayed },
    outcomes: input.workRows.map((row) => {
      const snapshot = response.bulk_item_outcomes?.find((item) => item.target_id === row.id);
      return { v10WorkItemId: row.id, outcome: snapshot?.outcome ?? "validation_failed", reason: snapshot?.reason };
    }),
  };
}

export async function bulkAssignObligationV10WorkItems(input: {
  admin: Admin;
  organizationId: string;
  actorUserId: string;
  ids: string[];
  workRows: V10BulkWorkRow[];
  obligationIds: string[];
  ownerUserId: string;
  expectedCompatibleActionGroup: string;
  idempotencyKey: string | null;
  clientRequestId?: string | null;
  expectedVersion?: string | number | null;
}): Promise<{ ok: boolean; error?: string; outcomes?: V10BulkAssignWorkItemOutcome[]; v10?: unknown }> {
  const currentVersion = `bulk:${input.workRows.map((r) => r.updated_at).sort().join("|")}`;
  const { response, replayed } = await executeV10IdempotentMutation(
    input.admin,
    {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      mutationName: "bulk_assign_compatible_work_items",
      targetType: "work_item",
      targetId: `bulk:v10:${input.ids.length}`,
      idempotencyKey: input.idempotencyKey,
      clientRequestId: input.clientRequestId ?? null,
      expectedVersion: input.expectedVersion,
      currentVersion,
      payload: { v10WorkItemIds: input.ids, ownerUserId: input.ownerUserId, expectedCompatibleActionGroup: input.expectedCompatibleActionGroup, kind: "obligation" },
    },
    async () => {
      const { data: obRows } = await input.admin.from("contract_obligations").select("id, owner_id, contract_id, updated_at").in("id", input.obligationIds).eq("organization_id", input.organizationId);
      const obs = obRows ?? [];
      if (obs.length !== input.obligationIds.length) {
        return buildV10MutationResponse({ outcome: "validation_failed", message: "One or more obligations were not found in this workspace.", nextDestinationHref: "/work" });
      }
      const prevOwnerById = new Map(obs.map((o) => [o.id as string, o.owner_id as string | null]));
      const eligible = obs.filter((o) => o.owner_id !== input.ownerUserId).map((o) => o.id as string);
      if (eligible.length > 0) {
        const { error } = await input.admin.from("contract_obligations").update({ owner_id: input.ownerUserId }).in("id", eligible).eq("organization_id", input.organizationId);
        if (error) {
          return buildV10MutationResponse({ outcome: "server_error", message: mapDataSourceError(error.message), diagnosticId: "v10_bulk_obligation_assign_failed", nextDestinationHref: "/work" });
        }
      }
      const auditEventId = await recordV10AuditEvent(input.admin, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "work_item.bulk_owner_changed",
        targetType: "work_item",
        targetId: `bulk:v10:${input.ids.length}`,
        outcome: eligible.length > 0 ? "success" : "no_action",
        safeMetadata: { kind: "obligation", requested_count: input.ids.length, updated_count: eligible.length },
      });
      if (!auditEventId && eligible.length > 0) {
        for (const id of eligible) {
          const prev = prevOwnerById.get(id) ?? null;
          await input.admin.from("contract_obligations").update({ owner_id: prev }).eq("id", id).eq("organization_id", input.organizationId);
        }
        return buildV10MutationResponse({ outcome: "audit_write_failed", message: "Bulk assign could not be recorded in the audit trail.", nextDestinationHref: "/work", diagnosticId: "v10_bulk_obligation_audit_missing" });
      }
      await refreshV10ReadModelsForOrganization(input.admin, input.organizationId, { refreshScope: "incremental", reason: "bulk_obligation_owner_mutation" });
      const obByIdForSnapshot = new Map(obs.map((o) => [o.id as string, o]));
      return buildV10MutationResponse({
        outcome: eligible.length > 0 ? "success" : "no_action",
        message: eligible.length > 0 ? "Obligation owners updated." : "No obligation owner changes were needed.",
        changedObjectType: "work_item",
        changedObjectId: `bulk:v10:${input.ids.length}`,
        nextDestinationHref: "/work",
        auditEventId: auditEventId ?? undefined,
        bulkItemOutcomes: input.workRows.map((r) => {
          const ob = obByIdForSnapshot.get(r.source_id as string);
          const wasAlready = ob?.owner_id === input.ownerUserId;
          return { target_id: r.source_id, outcome: wasAlready ? ("no_action" as const) : ("success" as const), compatible_action_group: input.expectedCompatibleActionGroup };
        }),
      });
    }
  );

  const snaps = response.bulk_item_outcomes;
  return {
    ok: response.outcome === "success" || response.outcome === "no_action",
    v10: { ...response, replayed },
    outcomes: input.workRows.map((r) => {
      const s = snaps?.find((x) => x.target_id === r.source_id);
      if (s) return { v10WorkItemId: r.id, outcome: s.outcome, reason: s.reason };
      const rowOutcome: V10BulkAssignWorkItemOutcome["outcome"] = response.outcome === "success" ? "success" : response.outcome === "no_action" ? "no_action" : "validation_failed";
      return { v10WorkItemId: r.id, outcome: rowOutcome, reason: response.outcome === "success" || response.outcome === "no_action" ? undefined : String(response.outcome) };
    }),
  };
}