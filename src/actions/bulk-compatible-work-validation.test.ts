import { beforeEach, describe, expect, it, vi } from "vitest";

const bulkMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createAdminClient: vi.fn(),
  getOrgMemberRole: vi.fn(),
  canEditContracts: vi.fn(() => true),
  bulkAssignCompatibleContractTasks: vi.fn(),
  bulkCompleteCompatibleContractTasks: vi.fn(),
  executeV10IdempotentMutation: vi.fn(),
  recordV10AuditEvent: vi.fn(),
  refreshV10ReadModelsForOrganization: vi.fn(),
  recomputeContractSignals: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: bulkMocks.getUser,
    },
  })),
  createAdminClient: bulkMocks.createAdminClient,
}));

vi.mock("@/lib/permissions", () => ({
  getOrgMemberRole: bulkMocks.getOrgMemberRole,
  canEditContracts: bulkMocks.canEditContracts,
}));

vi.mock("@/actions/tasks", () => ({
  bulkAssignCompatibleContractTasks: bulkMocks.bulkAssignCompatibleContractTasks,
  bulkCompleteCompatibleContractTasks: bulkMocks.bulkCompleteCompatibleContractTasks,
}));

vi.mock("@/lib/server-contracts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server-contracts")>();
  return {
    ...actual,
    executeV10IdempotentMutation: bulkMocks.executeV10IdempotentMutation,
    recordV10AuditEvent: bulkMocks.recordV10AuditEvent,
  };
});

vi.mock("@/lib/read-model-refresh", () => ({
  refreshV10ReadModelsForOrganization: bulkMocks.refreshV10ReadModelsForOrganization,
}));

vi.mock("@/lib/workflow-signals", () => ({
  recomputeContractSignals: bulkMocks.recomputeContractSignals,
}));

const WORK_ID = "11111111-1111-1111-1111-111111111111";
const WORK_ID_2 = "22222222-2222-2222-2222-222222222222";
const SOURCE_ID = "33333333-3333-3333-3333-333333333333";
const OWNER_ID = "44444444-4444-4444-4444-444444444444";
const GROUP = "field_review:open:unassigned";

type WorkRow = {
  id: string;
  organization_id: string;
  type: string;
  source_table: string;
  source_id: string;
  compatible_action_group: string;
  status: string;
  owner_user_id: string | null;
  updated_at: string | null;
  contract_id?: string | null;
};

function workRow(overrides: Partial<WorkRow> = {}): WorkRow {
  return {
    id: WORK_ID,
    organization_id: "org-1",
    type: "field_review",
    source_table: "extracted_fields",
    source_id: SOURCE_ID,
    compatible_action_group: GROUP,
    status: "open",
    owner_user_id: null,
    updated_at: "2026-06-02T00:00:00.000Z",
    contract_id: "55555555-5555-5555-5555-555555555555",
    ...overrides,
  };
}

function queryResult(result: Record<string, unknown>) {
  const query: Record<string, unknown> = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    update: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

function makeAdmin(input: {
  workRows?: WorkRow[];
  ownerMember?: boolean;
  updateError?: string | null;
  obligationRows?: Array<{ id: string; owner_id: string | null; contract_id: string; updated_at: string | null }>;
} = {}) {
  const from = vi.fn((table: string) => {
    if (table === "v10_work_items") {
      return queryResult({ data: input.workRows ?? [workRow()], error: null });
    }
    if (table === "organization_members") {
      return queryResult({ data: input.ownerMember === false ? null : { id: "member-1" }, error: null });
    }
    if (table === "contract_obligations") {
      const result = input.updateError
        ? { data: null, error: { message: input.updateError } }
        : {
            data: input.obligationRows ?? [
              {
                id: SOURCE_ID,
                owner_id: null,
                contract_id: "55555555-5555-5555-5555-555555555555",
                updated_at: "2026-06-02T00:00:00.000Z",
              },
            ],
            error: null,
          };
      return queryResult(result);
    }
    return queryResult({ data: null, error: input.updateError ? { message: input.updateError } : null });
  });
  return { from };
}

describe("bulk-compatible V10 work actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bulkMocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    bulkMocks.createAdminClient.mockResolvedValue(makeAdmin());
    bulkMocks.getOrgMemberRole.mockResolvedValue("admin");
    bulkMocks.canEditContracts.mockReturnValue(true);
    bulkMocks.bulkAssignCompatibleContractTasks.mockResolvedValue({
      success: true,
      itemOutcomes: [{ taskId: SOURCE_ID, outcome: "success", reason: "assigned" }],
      v10: { outcome: "success" },
    });
    bulkMocks.bulkCompleteCompatibleContractTasks.mockResolvedValue({
      success: true,
      itemOutcomes: [{ taskId: SOURCE_ID, outcome: "success", reason: "completed" }],
      v10: { outcome: "success" },
    });
    bulkMocks.executeV10IdempotentMutation.mockImplementation(async (_admin, _meta, run) => ({
      response: await run(),
      replayed: false,
    }));
    bulkMocks.recordV10AuditEvent.mockResolvedValue("audit-1");
  });

  it.each([
    [
      "assign",
      async (actions: typeof import("@/actions/bulk-compatible-work")) =>
        actions.bulkAssignCompatibleV10WorkItems({
          v10WorkItemIds: [WORK_ID],
          ownerUserId: OWNER_ID,
          expectedCompatibleActionGroup: GROUP,
          idempotencyKey: null,
        }),
    ],
    [
      "complete",
      async (actions: typeof import("@/actions/bulk-compatible-work")) =>
        actions.bulkCompleteCompatibleV10WorkItems({
          v10WorkItemIds: [WORK_ID],
          expectedCompatibleActionGroup: GROUP,
          idempotencyKey: null,
        }),
    ],
  ])("%s rejects unauthenticated users", async (_name, callAction) => {
    bulkMocks.getUser.mockResolvedValue({ data: { user: null } });
    const actions = await import("@/actions/bulk-compatible-work");
    await expect(callAction(actions)).resolves.toMatchObject({ ok: false, error: "Not authenticated" });
  });

  it.each([
    [
      "assign invalid work ids",
      async (actions: typeof import("@/actions/bulk-compatible-work")) =>
        actions.bulkAssignCompatibleV10WorkItems({
          v10WorkItemIds: ["bad-id"],
          ownerUserId: OWNER_ID,
          expectedCompatibleActionGroup: GROUP,
          idempotencyKey: null,
        }),
      "Invalid work item ids",
    ],
    [
      "assign invalid owner",
      async (actions: typeof import("@/actions/bulk-compatible-work")) =>
        actions.bulkAssignCompatibleV10WorkItems({
          v10WorkItemIds: [WORK_ID],
          ownerUserId: "bad-owner",
          expectedCompatibleActionGroup: GROUP,
          idempotencyKey: null,
        }),
      "Invalid owner",
    ],
    [
      "assign missing group",
      async (actions: typeof import("@/actions/bulk-compatible-work")) =>
        actions.bulkAssignCompatibleV10WorkItems({
          v10WorkItemIds: [WORK_ID],
          ownerUserId: OWNER_ID,
          expectedCompatibleActionGroup: "  ",
          idempotencyKey: null,
        }),
      "Compatible action group is required",
    ],
    [
      "complete invalid work ids",
      async (actions: typeof import("@/actions/bulk-compatible-work")) =>
        actions.bulkCompleteCompatibleV10WorkItems({
          v10WorkItemIds: ["bad-id"],
          expectedCompatibleActionGroup: GROUP,
          idempotencyKey: null,
        }),
      "Invalid work item ids",
    ],
    [
      "complete missing group",
      async (actions: typeof import("@/actions/bulk-compatible-work")) =>
        actions.bulkCompleteCompatibleV10WorkItems({
          v10WorkItemIds: [WORK_ID],
          expectedCompatibleActionGroup: "  ",
          idempotencyKey: null,
        }),
      "Compatible action group is required",
    ],
  ])("%s validates request shape before reads", async (_name, callAction, error) => {
    const actions = await import("@/actions/bulk-compatible-work");
    await expect(callAction(actions)).resolves.toMatchObject({ ok: false, error });
  });

  it("fails assign when selected work rows are missing", async () => {
    bulkMocks.createAdminClient.mockResolvedValue(makeAdmin({ workRows: [] }));
    const { bulkAssignCompatibleV10WorkItems } = await import("@/actions/bulk-compatible-work");
    await expect(
      bulkAssignCompatibleV10WorkItems({
        v10WorkItemIds: [WORK_ID],
        ownerUserId: OWNER_ID,
        expectedCompatibleActionGroup: GROUP,
        idempotencyKey: null,
      })
    ).resolves.toMatchObject({ ok: false, error: "One or more V10 work items were not found." });
  });

  it("fails assign when rows span organizations or the viewer cannot edit", async () => {
    const { bulkAssignCompatibleV10WorkItems } = await import("@/actions/bulk-compatible-work");
    bulkMocks.createAdminClient.mockResolvedValue(
      makeAdmin({
        workRows: [workRow(), workRow({ id: WORK_ID_2, organization_id: "org-2" })],
      })
    );
    await expect(
      bulkAssignCompatibleV10WorkItems({
        v10WorkItemIds: [WORK_ID, WORK_ID_2],
        ownerUserId: OWNER_ID,
        expectedCompatibleActionGroup: GROUP,
        idempotencyKey: null,
      })
    ).resolves.toMatchObject({ ok: false, error: "Bulk work must belong to one organization." });

    bulkMocks.createAdminClient.mockResolvedValue(makeAdmin());
    bulkMocks.canEditContracts.mockReturnValue(false);
    await expect(
      bulkAssignCompatibleV10WorkItems({
        v10WorkItemIds: [WORK_ID],
        ownerUserId: OWNER_ID,
        expectedCompatibleActionGroup: GROUP,
        idempotencyKey: null,
      })
    ).resolves.toMatchObject({ ok: false, error: "Viewers cannot bulk-assign work." });
  });

  it("fails assign when the owner is not a workspace member", async () => {
    bulkMocks.createAdminClient.mockResolvedValue(makeAdmin({ ownerMember: false }));
    const { bulkAssignCompatibleV10WorkItems } = await import("@/actions/bulk-compatible-work");
    await expect(
      bulkAssignCompatibleV10WorkItems({
        v10WorkItemIds: [WORK_ID],
        ownerUserId: OWNER_ID,
        expectedCompatibleActionGroup: GROUP,
        idempotencyKey: null,
      })
    ).resolves.toMatchObject({ ok: false, error: "Owner must be an active member of this workspace." });
  });

  it("fails assign and complete for incompatible or mixed work rows", async () => {
    const actions = await import("@/actions/bulk-compatible-work");
    bulkMocks.createAdminClient.mockResolvedValue(makeAdmin({ workRows: [workRow({ compatible_action_group: "other" })] }));
    await expect(
      actions.bulkAssignCompatibleV10WorkItems({
        v10WorkItemIds: [WORK_ID],
        ownerUserId: OWNER_ID,
        expectedCompatibleActionGroup: GROUP,
        idempotencyKey: null,
      })
    ).resolves.toMatchObject({ ok: false, error: "Incompatible action group for one or more selected work items." });
    await expect(
      actions.bulkCompleteCompatibleV10WorkItems({
        v10WorkItemIds: [WORK_ID],
        expectedCompatibleActionGroup: GROUP,
        idempotencyKey: null,
      })
    ).resolves.toMatchObject({ ok: false, error: "Incompatible action group for one or more selected work items." });

    bulkMocks.createAdminClient.mockResolvedValue(
      makeAdmin({
        workRows: [workRow(), workRow({ id: WORK_ID_2, type: "approval" })],
      })
    );
    await expect(
      actions.bulkCompleteCompatibleV10WorkItems({
        v10WorkItemIds: [WORK_ID, WORK_ID_2],
        expectedCompatibleActionGroup: GROUP,
        idempotencyKey: null,
      })
    ).resolves.toMatchObject({ ok: false, error: "Bulk V10 complete supports a single work item type per request." });
  });

  it("delegates contract task assign and complete batches to task actions", async () => {
    bulkMocks.createAdminClient.mockResolvedValue(
      makeAdmin({
        workRows: [workRow({ type: "contract_task", source_table: "contract_tasks", compatible_action_group: "task:open" })],
      })
    );
    const actions = await import("@/actions/bulk-compatible-work");

    await expect(
      actions.bulkAssignCompatibleV10WorkItems({
        v10WorkItemIds: [WORK_ID],
        ownerUserId: OWNER_ID,
        expectedCompatibleActionGroup: "task:open",
        idempotencyKey: null,
      })
    ).resolves.toMatchObject({ ok: true });
    await expect(
      actions.bulkCompleteCompatibleV10WorkItems({
        v10WorkItemIds: [WORK_ID],
        expectedCompatibleActionGroup: "task:open",
        idempotencyKey: null,
      })
    ).resolves.toMatchObject({ ok: true });
    expect(bulkMocks.bulkAssignCompatibleContractTasks).toHaveBeenCalledWith(
      expect.objectContaining({ taskIds: [SOURCE_ID], ownerUserId: OWNER_ID })
    );
    expect(bulkMocks.bulkCompleteCompatibleContractTasks).toHaveBeenCalledWith(
      expect.objectContaining({ taskIds: [SOURCE_ID] })
    );
  });

  it("uses generic completion outcomes for eligible and already-done rows", async () => {
    const { bulkCompleteGenericV10WorkItems } = await import("@/actions/bulk-compatible-work-helpers");
    const rows = [
      workRow({ id: WORK_ID, status: "open" }),
      workRow({ id: WORK_ID_2, source_id: "66666666-6666-6666-6666-666666666666", status: "done" }),
    ];
    const admin = makeAdmin({ workRows: rows });

    const result = await bulkCompleteGenericV10WorkItems({
      admin: admin as never,
      organizationId: "org-1",
      actorUserId: "user-1",
      workRows: rows,
      expectedCompatibleActionGroup: GROUP,
      idempotencyKey: null,
    });

    expect(result.ok).toBe(true);
    expect(result.outcomes).toEqual([
      { v10WorkItemId: WORK_ID, outcome: "success", reason: "eligible" },
      { v10WorkItemId: WORK_ID_2, outcome: "no_action", reason: "already_done" },
    ]);
  });

  it("fails generic helpers for unsupported work item types", async () => {
    const helpers = await import("@/actions/bulk-compatible-work-helpers");
    expect(helpers.isV10GenericBulkWorkItemType("field_review")).toBe(true);
    expect(helpers.isV10GenericBulkWorkItemType("contract_task")).toBe(false);

    const row = workRow({ type: "contract_task" });
    await expect(
      helpers.bulkAssignGenericV10WorkItems({
        admin: makeAdmin() as never,
        organizationId: "org-1",
        actorUserId: "user-1",
        workRows: [row],
        ownerUserId: OWNER_ID,
        expectedCompatibleActionGroup: GROUP,
        idempotencyKey: null,
      })
    ).resolves.toMatchObject({
      ok: false,
      error: 'Bulk V10 assign cannot use generic handling for work item type "contract_task".',
    });
    await expect(
      helpers.bulkCompleteGenericV10WorkItems({
        admin: makeAdmin() as never,
        organizationId: "org-1",
        actorUserId: "user-1",
        workRows: [workRow({ type: "unknown" })],
        expectedCompatibleActionGroup: GROUP,
        idempotencyKey: null,
      })
    ).resolves.toMatchObject({
      ok: false,
      error: 'Bulk V10 complete cannot use generic handling for work item type "unknown".',
    });
  });

  it("checks owner membership through the helper query", async () => {
    const { ensureOwnerOrgMember } = await import("@/actions/bulk-compatible-work-helpers");
    await expect(ensureOwnerOrgMember(makeAdmin({ ownerMember: true }) as never, "org-1", OWNER_ID)).resolves.toBe(true);
    await expect(ensureOwnerOrgMember(makeAdmin({ ownerMember: false }) as never, "org-1", OWNER_ID)).resolves.toBe(false);
  });
});
