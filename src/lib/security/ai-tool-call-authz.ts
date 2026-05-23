import { redactSensitiveLogString } from "@/lib/observability/log-redaction";

type MaybePromise<T> = T | PromiseLike<T>;

type AuditInsertResult = {
  error?: { message?: string } | null;
};

export type AiToolAuditClient = {
  from(table: string): {
    insert(row: Record<string, unknown>): MaybePromise<AuditInsertResult>;
  };
};

export type AiToolMutationAuthContext = {
  admin: AiToolAuditClient;
  orgId: string;
  userId: string | null;
  role?: string | null;
  capabilities?: readonly string[];
};

export type AiToolArgumentParseResult<T> =
  | { success: true; data: T }
  | { success: false; error?: unknown };

export type AiToolAuthorizationFailureCode =
  | "ai_tool_auth_required"
  | "ai_tool_name_invalid"
  | "ai_tool_arguments_invalid"
  | "ai_tool_cross_org_arguments"
  | "ai_tool_role_required"
  | "ai_tool_capability_required"
  | "ai_tool_target_forbidden";

export type AiToolAuthorizationFailure = {
  ok: false;
  status: 400 | 401 | 403;
  code: AiToolAuthorizationFailureCode;
  message: string;
};

export type AiToolAuthorizationSuccess<T> = {
  ok: true;
  ctx: AiToolMutationAuthContext;
  args: T;
  toolName: string;
};

export type AiToolAuthorizationResult<T> =
  | AiToolAuthorizationSuccess<T>
  | AiToolAuthorizationFailure;

export type AiToolAuditStatus = "authorized" | "executed" | "denied";

type PrimitiveAuditDetail = string | number | boolean | null;

const AI_TOOL_NAME_RE = /^[A-Za-z0-9_.:-]{1,96}$/;
const SENSITIVE_AUDIT_DETAIL_KEY_RE = /authorization|cookie|password|private|secret|token|api[_-]?key/i;

function errorMessage(error: unknown): string {
  if (!error) return "AI tool arguments are invalid.";
  if (error instanceof Error && error.message) return redactSensitiveLogString(error.message, 300);
  if (typeof error === "object" && "message" in error && typeof error.message === "string") {
    return redactSensitiveLogString(error.message, 300);
  }
  return "AI tool arguments are invalid.";
}

function failure(
  status: AiToolAuthorizationFailure["status"],
  code: AiToolAuthorizationFailureCode,
  message: string
): AiToolAuthorizationFailure {
  return { ok: false, status, code, message };
}

function isPrimitiveAuditDetail(value: unknown): value is PrimitiveAuditDetail {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function sanitizeAuditDetails(details: Record<string, unknown> | undefined): Record<string, PrimitiveAuditDetail> {
  const safe: Record<string, PrimitiveAuditDetail> = {};
  for (const [key, value] of Object.entries(details ?? {})) {
    if (SENSITIVE_AUDIT_DETAIL_KEY_RE.test(key)) continue;
    if (!isPrimitiveAuditDetail(value)) continue;
    safe[key.slice(0, 80)] = typeof value === "string" ? redactSensitiveLogString(value, 500).slice(0, 500) : value;
  }
  return safe;
}

function hasRequiredRole(ctx: AiToolMutationAuthContext, requiredRole?: string | readonly string[]): boolean {
  if (!requiredRole) return true;
  const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return Boolean(ctx.role && allowed.includes(ctx.role));
}

function hasRequiredCapability(ctx: AiToolMutationAuthContext, requiredCapability?: string): boolean {
  if (!requiredCapability) return true;
  return Boolean(ctx.capabilities?.includes(requiredCapability));
}

export function normalizeAiToolName(toolName: string): string | null {
  const trimmed = toolName.trim();
  if (!AI_TOOL_NAME_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function verifyAiToolMutationRequest<T>(input: {
  ctx: AiToolMutationAuthContext | null | undefined;
  toolName: string;
  rawArguments: unknown;
  parseArguments: (raw: unknown) => AiToolArgumentParseResult<T>;
  getArgumentOrgId?: (args: T) => string | null | undefined;
  requiredRole?: string | readonly string[];
  requiredCapability?: string;
}): AiToolAuthorizationResult<T> {
  const normalizedToolName = normalizeAiToolName(input.toolName);
  if (!normalizedToolName) {
    return failure(400, "ai_tool_name_invalid", "AI tool name is invalid.");
  }

  if (!input.ctx?.orgId || !input.ctx.userId) {
    return failure(401, "ai_tool_auth_required", "AI tool mutation requires authenticated organization context.");
  }

  if (!hasRequiredRole(input.ctx, input.requiredRole)) {
    return failure(403, "ai_tool_role_required", "AI tool mutation requires a permitted workspace role.");
  }

  if (!hasRequiredCapability(input.ctx, input.requiredCapability)) {
    return failure(403, "ai_tool_capability_required", "AI tool mutation requires a permitted capability.");
  }

  const parsed = input.parseArguments(input.rawArguments);
  if (!parsed.success) {
    return failure(400, "ai_tool_arguments_invalid", errorMessage(parsed.error));
  }

  const argumentOrgId = input.getArgumentOrgId?.(parsed.data);
  if (argumentOrgId && argumentOrgId !== input.ctx.orgId) {
    return failure(403, "ai_tool_cross_org_arguments", "AI tool arguments reference a different organization.");
  }

  return { ok: true, ctx: input.ctx, args: parsed.data, toolName: normalizedToolName };
}

export async function recordAiToolAuditEvent(
  admin: AiToolAuditClient,
  input: {
    organizationId: string;
    userId: string | null;
    toolName: string;
    status: AiToolAuditStatus;
    targetType?: string;
    targetId?: string;
    reason?: string;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  const toolName = normalizeAiToolName(input.toolName) ?? "unknown";
  const details = sanitizeAuditDetails(input.details);
  const auditRow = {
    organization_id: input.organizationId,
    user_id: input.userId,
    action: `ai.tool_call.${input.status}`,
    details: {
      ...details,
      tool_name: toolName,
      status: input.status,
      target_type: input.targetType ? redactSensitiveLogString(input.targetType, 80).slice(0, 80) : null,
      target_id: input.targetId ? redactSensitiveLogString(input.targetId, 120).slice(0, 120) : null,
      reason: input.reason ? redactSensitiveLogString(input.reason, 160).slice(0, 160) : null,
    },
  };

  const result = await admin.from("audit_events").insert(auditRow);
  if (result.error) {
    console.error(
      "[ai-tool-call-authz] audit_events insert failed:",
      redactSensitiveLogString(result.error.message ?? "unknown", 4000)
    );
  }
}

export async function authorizeAiToolMutation<T>(input: {
  ctx: AiToolMutationAuthContext | null | undefined;
  toolName: string;
  rawArguments: unknown;
  parseArguments: (raw: unknown) => AiToolArgumentParseResult<T>;
  getArgumentOrgId?: (args: T) => string | null | undefined;
  targetType?: string;
  targetId?: (args: T) => string | null | undefined;
  requiredRole?: string | readonly string[];
  requiredCapability?: string;
  authorizeTarget?: (args: T, ctx: AiToolMutationAuthContext) => MaybePromise<boolean>;
  auditDetails?: (args: T) => Record<string, unknown>;
}): Promise<AiToolAuthorizationResult<T>> {
  const result = verifyAiToolMutationRequest(input);
  if (!result.ok) {
    if (input.ctx?.orgId) {
      await recordAiToolAuditEvent(input.ctx.admin, {
        organizationId: input.ctx.orgId,
        userId: input.ctx.userId,
        toolName: input.toolName,
        status: "denied",
        reason: result.code,
      });
    }
    return result;
  }

  if (input.authorizeTarget && !(await input.authorizeTarget(result.args, result.ctx))) {
    const denied = failure(403, "ai_tool_target_forbidden", "AI tool target is outside the authorized scope.");
    await recordAiToolAuditEvent(result.ctx.admin, {
      organizationId: result.ctx.orgId,
      userId: result.ctx.userId,
      toolName: result.toolName,
      status: "denied",
      targetType: input.targetType,
      targetId: input.targetId?.(result.args) ?? undefined,
      reason: denied.code,
    });
    return denied;
  }

  const targetId = input.targetId?.(result.args) ?? undefined;
  await recordAiToolAuditEvent(result.ctx.admin, {
    organizationId: result.ctx.orgId,
    userId: result.ctx.userId,
    toolName: result.toolName,
    status: "authorized",
    targetType: input.targetType,
    targetId,
    details: input.auditDetails?.(result.args),
  });

  return result;
}
