import { recordV10AuditEvent } from "@/lib/server-contracts";
import type { ApiAuditAction } from "@/lib/security/audit-actions";

type AuditAdmin = Parameters<typeof recordV10AuditEvent>[0];

export async function recordApiRouteAuditEvent(
  admin: AuditAdmin,
  input: {
    organizationId: string;
    actorUserId: string | null;
    actorType?: "user" | "system" | "external";
    route: string;
    method: string;
    action?: ApiAuditAction;
  }
): Promise<string | null> {
  const method = input.method.toUpperCase();
  return recordV10AuditEvent(admin, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorType: input.actorType ?? "user",
    action: input.action ?? "api.route_authorized",
    targetType: "api_route",
    targetId: `${method} ${input.route}`,
    outcome: "authorized",
    safeMetadata: {
      method,
      route: input.route,
    },
  });
}

export async function recordApiMutationAuditEvent(
  admin: AuditAdmin,
  input: {
    organizationId: string;
    actorUserId: string | null;
    actorType?: "user" | "system" | "external";
    route: string;
    method: string;
  }
): Promise<string | null> {
  return recordApiRouteAuditEvent(admin, {
    ...input,
    action: "api.mutation_authorized",
  });
}
