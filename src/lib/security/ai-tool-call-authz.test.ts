import { describe, expect, it, vi } from "vitest";
import {
  authorizeAiToolMutation,
  recordAiToolAuditEvent,
  verifyAiToolMutationRequest,
  type AiToolMutationAuthContext,
} from "@/lib/security/ai-tool-call-authz";

type DirectTaskInput = {
  organizationId?: string;
  contractId: string;
  title: string;
};

function parseDirectTaskInput(raw: unknown) {
  const value = raw as Partial<DirectTaskInput>;
  if (!value || typeof value !== "object") {
    return { success: false as const, error: new Error("expected object") };
  }
  if (typeof value.contractId !== "string" || typeof value.title !== "string") {
    return { success: false as const, error: new Error("invalid direct task input") };
  }
  return {
    success: true as const,
    data: {
      organizationId: typeof value.organizationId === "string" ? value.organizationId : undefined,
      contractId: value.contractId,
      title: value.title,
    },
  };
}

function mockCtx(orgId = "org_1"): AiToolMutationAuthContext & { insert: ReturnType<typeof vi.fn> } {
  const insert = vi.fn(async () => ({ error: null }));
  return {
    orgId,
    userId: "user_1",
    role: "admin",
    capabilities: ["tasks:write", "contracts:read"],
    insert,
    admin: {
      from: vi.fn(() => ({ insert })),
    },
  };
}

describe("AI tool-call authorization", () => {
  it("rejects AI tool calls without authenticated org context", () => {
    const parseArguments = vi.fn(parseDirectTaskInput);
    const result = verifyAiToolMutationRequest({
      ctx: null,
      toolName: "task.create",
      rawArguments: { contractId: "contract_1", title: "Review" },
      parseArguments,
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      code: "ai_tool_auth_required",
      message: "AI tool mutation requires authenticated organization context.",
    });
    expect(parseArguments).not.toHaveBeenCalled();
  });

  it("validates AI tool arguments with the direct user input parser", () => {
    const ctx = mockCtx();
    const result = verifyAiToolMutationRequest({
      ctx,
      toolName: "task.create",
      rawArguments: { contractId: "contract_1" },
      parseArguments: parseDirectTaskInput,
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      status: 400,
      code: "ai_tool_arguments_invalid",
      message: "invalid direct task input",
    });
  });

  it("rejects cross-org AI tool arguments", () => {
    const ctx = mockCtx("org_1");
    const result = verifyAiToolMutationRequest({
      ctx,
      toolName: "task.create",
      rawArguments: { organizationId: "org_2", contractId: "contract_1", title: "Review" },
      parseArguments: parseDirectTaskInput,
      getArgumentOrgId: (args) => args.organizationId,
    });

    expect(result).toEqual({
      ok: false,
      status: 403,
      code: "ai_tool_cross_org_arguments",
      message: "AI tool arguments reference a different organization.",
    });
  });

  it("records an audit event for authorized AI-assisted actions", async () => {
    const ctx = mockCtx("org_1");
    const result = await authorizeAiToolMutation({
      ctx,
      toolName: "Task.Create",
      rawArguments: { organizationId: "org_1", contractId: "contract_1", title: "Review" },
      parseArguments: parseDirectTaskInput,
      getArgumentOrgId: (args) => args.organizationId,
      targetType: "contract",
      targetId: (args) => args.contractId,
      auditDetails: (args) => ({
        title_len: args.title.length,
        safe_note: "Generated with Bearer should-not-leak-123456",
        apiToken: "must_not_be_recorded",
        nested: { unsafe: true },
      }),
    });

    expect(result.ok).toBe(true);
    expect(ctx.insert).toHaveBeenCalledWith({
      organization_id: "org_1",
      user_id: "user_1",
      action: "ai.tool_call.authorized",
      details: {
        title_len: 6,
        safe_note: "Generated with [redacted]",
        tool_name: "task.create",
        status: "authorized",
        target_type: "contract",
        target_id: "contract_1",
        reason: null,
      },
    });
  });

  it("requires role, capability, and target scope before authorizing AI tools", async () => {
    const wrongRole = await authorizeAiToolMutation({
      ctx: { ...mockCtx("org_1"), role: "viewer" },
      toolName: "task.create",
      rawArguments: { organizationId: "org_1", contractId: "contract_1", title: "Review" },
      parseArguments: parseDirectTaskInput,
      getArgumentOrgId: (args) => args.organizationId,
      requiredRole: ["admin", "editor"],
    });
    expect(wrongRole).toMatchObject({ ok: false, code: "ai_tool_role_required" });

    const missingCapability = await authorizeAiToolMutation({
      ctx: { ...mockCtx("org_1"), capabilities: ["contracts:read"] },
      toolName: "task.create",
      rawArguments: { organizationId: "org_1", contractId: "contract_1", title: "Review" },
      parseArguments: parseDirectTaskInput,
      getArgumentOrgId: (args) => args.organizationId,
      requiredCapability: "tasks:write",
    });
    expect(missingCapability).toMatchObject({ ok: false, code: "ai_tool_capability_required" });

    const forbiddenTarget = await authorizeAiToolMutation({
      ctx: mockCtx("org_1"),
      toolName: "task.create",
      rawArguments: { organizationId: "org_1", contractId: "contract_2", title: "Review" },
      parseArguments: parseDirectTaskInput,
      getArgumentOrgId: (args) => args.organizationId,
      targetType: "contract",
      targetId: (args) => args.contractId,
      authorizeTarget: (args) => args.contractId === "contract_1",
    });
    expect(forbiddenTarget).toMatchObject({ ok: false, code: "ai_tool_target_forbidden" });
  });

  it("records denied audit events when org context exists but arguments are unsafe", async () => {
    const ctx = mockCtx("org_1");
    const result = await authorizeAiToolMutation({
      ctx,
      toolName: "task.create",
      rawArguments: { organizationId: "org_2", contractId: "contract_1", title: "Review" },
      parseArguments: parseDirectTaskInput,
      getArgumentOrgId: (args) => args.organizationId,
    });

    expect(result.ok).toBe(false);
    expect(ctx.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org_1",
        user_id: "user_1",
        action: "ai.tool_call.denied",
        details: expect.objectContaining({
          tool_name: "task.create",
          status: "denied",
          reason: "ai_tool_cross_org_arguments",
        }),
      })
    );
  });

  it("allows explicit execution audit events without raw tool arguments", async () => {
    const ctx = mockCtx("org_1");
    await recordAiToolAuditEvent(ctx.admin, {
      organizationId: "org_1",
      userId: "user_1",
      toolName: "task.create",
      status: "executed",
      targetType: "task",
      targetId: "task_1",
      details: { result: "created", cookie: "must_not_be_recorded" },
    });

    expect(ctx.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai.tool_call.executed",
        details: {
          result: "created",
          tool_name: "task.create",
          status: "executed",
          target_type: "task",
          target_id: "task_1",
          reason: null,
        },
      })
    );
  });
});
