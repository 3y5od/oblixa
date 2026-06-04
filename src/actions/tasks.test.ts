import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
const taskAutomationMocks = vi.hoisted(() => ({
  autoTransitionTasksForApproval: vi.fn(async (input: unknown) => ({
    source: "approval",
    input,
  })),
  autoTransitionTasksForField: vi.fn(async (input: unknown) => ({
    source: "field",
    input,
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: getUserMock,
    },
  })),
  createAdminClient: vi.fn(async () => ({})),
}));

vi.mock("@/actions/tasks-automation", () => taskAutomationMocks);

const VALID_CONTRACT_ID = "11111111-1111-1111-1111-111111111111";
const VALID_TASK_ID = "22222222-2222-2222-2222-222222222222";
const VALID_OWNER_ID = "33333333-3333-3333-3333-333333333333";
const VALID_COMMENT_ID = "44444444-4444-4444-4444-444444444444";
const VALID_ITEM_ID = "55555555-5555-5555-5555-555555555555";
const VALID_CHECKPOINT_ID = "77777777-7777-7777-7777-777777777777";

describe("createContractTask", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    taskAutomationMocks.autoTransitionTasksForApproval.mockClear();
    taskAutomationMocks.autoTransitionTasksForField.mockClear();
  });

  function authenticate() {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  }

  it("returns not authenticated when user is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { createContractTask } = await import("@/actions/tasks");
    const result = await createContractTask({
      contractId: VALID_CONTRACT_ID,
      title: "Follow up",
    });
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("rejects invalid contract ids before data writes", async () => {
    authenticate();
    const { createContractTask } = await import("@/actions/tasks");
    const result = await createContractTask({
      contractId: "bad-id",
      title: "Follow up",
    });
    expect(result).toEqual({ error: "Invalid contract" });
  });

  it("rejects invalid ISO due dates before data writes", async () => {
    authenticate();
    const { createContractTask } = await import("@/actions/tasks");
    const result = await createContractTask({
      contractId: VALID_CONTRACT_ID,
      title: "Follow up",
      dueDate: "2026-02-30",
    });
    expect(result).toEqual({ error: "Invalid due date" });
  });

  it.each([
    ["blank title", { title: "   " }, "Task title is required"],
    ["long title", { title: "x".repeat(241) }, "Task title is too long"],
    ["long details", { details: "x".repeat(4001) }, "Task details are too long"],
    ["invalid assignee", { assigneeId: "bad-id" }, "Invalid assignee"],
    ["invalid priority", { priority: "urgent" }, "Invalid task priority"],
    ["long team key", { teamKey: "x".repeat(81) }, "Team key is too long"],
    ["invalid blocked-by task", { blockedByTaskId: "bad-id" }, "Invalid blocked-by task"],
    ["long blocked reason", { blockedReason: "x".repeat(401) }, "Blocked reason is too long"],
    ["invalid recurrence anchor", { recurrenceAnchorDate: "not-a-date" }, "Invalid recurrence anchor date"],
    ["invalid SLA due date", { slaDueAt: "not-a-date" }, "Invalid SLA due date"],
    ["long checklist item", { checklistItems: ["x".repeat(241)] }, "Checklist item is too long"],
    ["invalid dependency", { dependsOnTaskIds: ["bad-id"] }, "Invalid dependency task id"],
    ["invalid source", { createdVia: "spreadsheet" }, "Invalid task source"],
  ])("rejects %s before data writes", async (_name, overrides, error) => {
    authenticate();
    const { createContractTask } = await import("@/actions/tasks");
    const result = await createContractTask({
      contractId: VALID_CONTRACT_ID,
      title: "Follow up",
      ...overrides,
    } as never);
    expect(result).toEqual({ error });
  });

  it("delegates task automation wrappers without mutating the payload", async () => {
    const tasks = await import("@/actions/tasks");

    await expect(tasks.autoTransitionTasksForApproval({ approvalId: "approval-1" } as never)).resolves.toEqual({
      source: "approval",
      input: { approvalId: "approval-1" },
    });
    await expect(tasks.autoTransitionTasksForField({ fieldId: "field-1" } as never)).resolves.toEqual({
      source: "field",
      input: { fieldId: "field-1" },
    });
    expect(taskAutomationMocks.autoTransitionTasksForApproval).toHaveBeenCalledWith({ approvalId: "approval-1" });
    expect(taskAutomationMocks.autoTransitionTasksForField).toHaveBeenCalledWith({ fieldId: "field-1" });
  });

  it("requires clarification notes before creating task records", async () => {
    const {
      createClarificationTask,
      createClarificationTaskForm,
      createObligationClarificationTaskForm,
    } = await import("@/actions/tasks");

    await expect(
      createClarificationTask({
        contractId: VALID_CONTRACT_ID,
        requesterNote: "  ",
      })
    ).resolves.toEqual({ error: "Clarification note is required." });

    const formData = new FormData();
    formData.set("contractId", VALID_CONTRACT_ID);
    formData.set("requesterNote", "  ");
    await expect(createClarificationTaskForm(formData)).resolves.toEqual({
      error: "Clarification note is required.",
    });
    await expect(createObligationClarificationTaskForm(formData)).resolves.toEqual({
      error: "Clarification note is required.",
    });
  });

  it("validates checkpoint clarification identifiers before task creation", async () => {
    const { createCheckpointClarificationTask, createCheckpointClarificationTaskForm } = await import("@/actions/tasks");

    await expect(
      createCheckpointClarificationTask({
        contractId: "bad-contract",
        checkpointId: VALID_CHECKPOINT_ID,
        requesterNote: "What changed?",
      })
    ).resolves.toEqual({ error: "Invalid contract" });
    await expect(
      createCheckpointClarificationTask({
        contractId: VALID_CONTRACT_ID,
        checkpointId: "bad-checkpoint",
        requesterNote: "What changed?",
      })
    ).resolves.toEqual({ error: "Invalid checkpoint" });

    const formData = new FormData();
    formData.set("contractId", VALID_CONTRACT_ID);
    formData.set("checkpointId", "bad-checkpoint");
    formData.set("requesterNote", "What changed?");
    await expect(createCheckpointClarificationTaskForm(formData)).resolves.toEqual({
      error: "Invalid checkpoint",
    });
  });

  it("applies rule-generated task source while preserving create validation", async () => {
    authenticate();
    const { createRuleGeneratedTask } = await import("@/actions/tasks");
    await expect(
      createRuleGeneratedTask({
        contractId: "bad-contract",
        title: "Generated follow-up",
      })
    ).resolves.toEqual({ error: "Invalid contract" });
  });

  it.each([
    [
      "assignWorkItemOwner",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.assignWorkItemOwner({
          taskId: VALID_TASK_ID,
          ownerUserId: VALID_OWNER_ID,
          idempotencyKey: null,
        }),
      "Not authenticated",
    ],
    [
      "bulkAssignCompatibleContractTasks",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.bulkAssignCompatibleContractTasks({
          taskIds: [VALID_TASK_ID],
          ownerUserId: VALID_OWNER_ID,
          expectedCompatibleActionGroup: "open:unassigned",
          idempotencyKey: null,
        }),
      "Not authenticated",
    ],
    [
      "completeWorkItem",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.completeWorkItem({
          taskId: VALID_TASK_ID,
          idempotencyKey: null,
        }),
      "Not authenticated",
    ],
    [
      "updateContractTaskStatus",
      async (tasks: typeof import("@/actions/tasks")) => tasks.updateContractTaskStatus(VALID_TASK_ID, "done"),
      "Not authenticated",
    ],
    [
      "bulkCompleteCompatibleContractTasks",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.bulkCompleteCompatibleContractTasks({
          taskIds: [VALID_TASK_ID],
          expectedCompatibleActionGroup: "open:assigned",
          idempotencyKey: null,
        }),
      "Not authenticated",
    ],
  ])("%s rejects unauthenticated users", async (_name, callAction, error) => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const tasks = await import("@/actions/tasks");
    const result = await callAction(tasks);
    expect(result).toMatchObject({ error });
  });

  it.each([
    [
      "assignWorkItemOwner invalid ids",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.assignWorkItemOwner({
          taskId: "bad-task",
          ownerUserId: VALID_OWNER_ID,
          idempotencyKey: null,
        }),
      "A valid work item and owner are required.",
    ],
    [
      "bulkAssignCompatibleContractTasks invalid tasks",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.bulkAssignCompatibleContractTasks({
          taskIds: ["bad-task"],
          ownerUserId: VALID_OWNER_ID,
          expectedCompatibleActionGroup: "open:unassigned",
          idempotencyKey: null,
        }),
      "Invalid tasks",
    ],
    [
      "bulkAssignCompatibleContractTasks invalid owner",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.bulkAssignCompatibleContractTasks({
          taskIds: [VALID_TASK_ID],
          ownerUserId: "bad-owner",
          expectedCompatibleActionGroup: "open:unassigned",
          idempotencyKey: null,
        }),
      "Invalid owner",
    ],
    [
      "bulkAssignCompatibleContractTasks missing action group",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.bulkAssignCompatibleContractTasks({
          taskIds: [VALID_TASK_ID],
          ownerUserId: VALID_OWNER_ID,
          expectedCompatibleActionGroup: "  ",
          idempotencyKey: null,
        }),
      "Compatible action group is required",
    ],
    [
      "completeWorkItem invalid task",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.completeWorkItem({
          taskId: "bad-task",
          idempotencyKey: null,
        }),
      "A valid work item is required.",
    ],
    [
      "completeWorkItem long note",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.completeWorkItem({
          taskId: VALID_TASK_ID,
          completionNote: "x".repeat(4001),
          idempotencyKey: null,
        }),
      "Completion note is too long.",
    ],
    [
      "updateContractTaskStatus invalid task",
      async (tasks: typeof import("@/actions/tasks")) => tasks.updateContractTaskStatus("bad-task", "done"),
      "Invalid task",
    ],
    [
      "updateContractTaskStatus invalid status",
      async (tasks: typeof import("@/actions/tasks")) => tasks.updateContractTaskStatus(VALID_TASK_ID, "waiting" as never),
      "Invalid status",
    ],
    [
      "bulkCompleteCompatibleContractTasks invalid tasks",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.bulkCompleteCompatibleContractTasks({
          taskIds: ["bad-task"],
          expectedCompatibleActionGroup: "open:assigned",
          idempotencyKey: null,
        }),
      "Invalid tasks",
    ],
    [
      "bulkCompleteCompatibleContractTasks missing action group",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.bulkCompleteCompatibleContractTasks({
          taskIds: [VALID_TASK_ID],
          expectedCompatibleActionGroup: "  ",
          idempotencyKey: null,
        }),
      "Compatible action group is required",
    ],
  ])("%s fails closed before database mutation", async (_name, callAction, error) => {
    authenticate();
    const tasks = await import("@/actions/tasks");
    const result = await callAction(tasks);
    expect(result).toMatchObject({ error });
  });

  it.each([
    [
      "addContractTaskComment invalid task",
      async (tasks: typeof import("@/actions/tasks")) => tasks.addContractTaskComment({ taskId: "bad-task", body: "Note" }),
      "Invalid task",
    ],
    [
      "addContractTaskComment blank body",
      async (tasks: typeof import("@/actions/tasks")) => tasks.addContractTaskComment({ taskId: VALID_TASK_ID, body: "  " }),
      "Comment is required",
    ],
    [
      "addContractTaskComment long body",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.addContractTaskComment({ taskId: VALID_TASK_ID, body: "x".repeat(4001) }),
      "Comment is too long",
    ],
    [
      "addContractTaskComment invalid parent",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.addContractTaskComment({ taskId: VALID_TASK_ID, body: "Note", parentCommentId: "bad-comment" }),
      "Invalid parent comment",
    ],
    [
      "updateContractTaskComment invalid comment",
      async (tasks: typeof import("@/actions/tasks")) => tasks.updateContractTaskComment({ commentId: "bad-comment", body: "Note" }),
      "Invalid comment",
    ],
    [
      "updateContractTaskComment blank body",
      async (tasks: typeof import("@/actions/tasks")) => tasks.updateContractTaskComment({ commentId: VALID_COMMENT_ID, body: "  " }),
      "Comment is required",
    ],
    [
      "updateContractTaskComment long body",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.updateContractTaskComment({ commentId: VALID_COMMENT_ID, body: "x".repeat(4001) }),
      "Comment is too long",
    ],
    [
      "deleteContractTaskComment invalid comment",
      async (tasks: typeof import("@/actions/tasks")) => tasks.deleteContractTaskComment({ commentId: "bad-comment" }),
      "Invalid comment",
    ],
    [
      "addContractTaskChecklistItem invalid task",
      async (tasks: typeof import("@/actions/tasks")) => tasks.addContractTaskChecklistItem({ taskId: "bad-task", label: "Item" }),
      "Invalid task",
    ],
    [
      "addContractTaskChecklistItem blank label",
      async (tasks: typeof import("@/actions/tasks")) => tasks.addContractTaskChecklistItem({ taskId: VALID_TASK_ID, label: "  " }),
      "Checklist item label is required",
    ],
    [
      "addContractTaskChecklistItem long label",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.addContractTaskChecklistItem({ taskId: VALID_TASK_ID, label: "x".repeat(241) }),
      "Checklist item is too long",
    ],
    [
      "addContractTaskDependency invalid ids",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.addContractTaskDependency({ taskId: "bad-task", dependsOnTaskId: VALID_TASK_ID }),
      "Invalid task dependency request",
    ],
    [
      "addContractTaskDependency self dependency",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.addContractTaskDependency({ taskId: VALID_TASK_ID, dependsOnTaskId: VALID_TASK_ID }),
      "A task cannot depend on itself.",
    ],
    [
      "toggleContractTaskChecklistItem invalid item",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.toggleContractTaskChecklistItem({ checklistItemId: "bad-item", done: true }),
      "Invalid checklist item",
    ],
    [
      "updateContractTaskChecklistItem invalid item",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.updateContractTaskChecklistItem({ checklistItemId: "bad-item", label: "Item" }),
      "Invalid checklist item",
    ],
    [
      "updateContractTaskChecklistItem blank label",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.updateContractTaskChecklistItem({ checklistItemId: VALID_ITEM_ID, label: "  " }),
      "Checklist label is required",
    ],
    [
      "updateContractTaskChecklistItem long label",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.updateContractTaskChecklistItem({ checklistItemId: VALID_ITEM_ID, label: "x".repeat(241) }),
      "Checklist item is too long",
    ],
    [
      "deleteContractTaskChecklistItem invalid item",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.deleteContractTaskChecklistItem({ checklistItemId: "bad-item" }),
      "Invalid checklist item",
    ],
    [
      "reorderContractTaskChecklistItem invalid item",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.reorderContractTaskChecklistItem({ checklistItemId: "bad-item", direction: "up" }),
      "Invalid checklist item",
    ],
    [
      "addContractTaskArtifact invalid task",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.addContractTaskArtifact({ taskId: "bad-task", label: "Runbook", url: "https://example.com" }),
      "Invalid task",
    ],
    [
      "addContractTaskArtifact blank fields",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.addContractTaskArtifact({ taskId: VALID_TASK_ID, label: "  ", url: "https://example.com" }),
      "Artifact label and URL are required",
    ],
    [
      "addContractTaskArtifact long label",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.addContractTaskArtifact({ taskId: VALID_TASK_ID, label: "x".repeat(241), url: "https://example.com" }),
      "Artifact label is too long",
    ],
    [
      "addContractTaskArtifact long URL",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.addContractTaskArtifact({ taskId: VALID_TASK_ID, label: "Runbook", url: `https://example.com/${"x".repeat(2000)}` }),
      "Artifact URL is too long",
    ],
    [
      "addContractTaskArtifact bad URL",
      async (tasks: typeof import("@/actions/tasks")) =>
        tasks.addContractTaskArtifact({ taskId: VALID_TASK_ID, label: "Runbook", url: "javascript:alert(1)" }),
      "Invalid artifact URL",
    ],
    [
      "deleteContractTaskArtifact invalid artifact",
      async (tasks: typeof import("@/actions/tasks")) => tasks.deleteContractTaskArtifact({ artifactId: "bad-artifact" }),
      "Invalid artifact",
    ],
    [
      "deleteContractTask invalid task",
      async (tasks: typeof import("@/actions/tasks")) => tasks.deleteContractTask("bad-task"),
      "Invalid task",
    ],
  ])("%s validates user input before writes", async (_name, callAction, error) => {
    authenticate();
    const tasks = await import("@/actions/tasks");
    const result = await callAction(tasks);
    expect(result).toMatchObject({ error });
  });
});
