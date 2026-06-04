import { recordV10AuditEvent, recordV10AuditEventStrict, type V10AuditInput } from "@/lib/server-contracts";
import type { V10SourceObjectType } from "@/lib/release-contract";
import type { createAdminClient } from "@/lib/supabase/server";
import type { SecurityAuditAction } from "@/lib/security/audit-actions";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;
export type { SecurityAuditAction } from "@/lib/security/audit-actions";

const SECURITY_TARGET_TYPE_TO_V10_SOURCE_OBJECT: Partial<Record<string, V10SourceObjectType>> = {
  auth_session: "account",
  user: "account",
  organization: "account",
  integration_connection: "runtime_artifact",
  integration_api_key: "runtime_artifact",
  integration_oauth: "runtime_artifact",
  maintenance_campaign: "automation_run",
  diagnostic: "workspace_health_diagnostic",
};

function toV10CompatibleSecurityAuditInput(
  input: Omit<V10AuditInput, "action"> & { action: SecurityAuditAction }
): V10AuditInput & { action: SecurityAuditAction } {
  const targetType = SECURITY_TARGET_TYPE_TO_V10_SOURCE_OBJECT[input.targetType] ?? input.targetType;
  if (targetType === input.targetType) return input;
  return {
    ...input,
    targetType,
    safeMetadata: {
      ...input.safeMetadata,
      security_target_type: input.targetType,
    },
  };
}

export async function recordSecurityAuditEvent(
  admin: Admin,
  input: Omit<V10AuditInput, "action"> & { action: SecurityAuditAction }
): Promise<string | null> {
  return recordV10AuditEvent(admin, toV10CompatibleSecurityAuditInput(input));
}

export async function recordSecurityAuditEventStrict(
  admin: Admin,
  input: Omit<V10AuditInput, "action"> & { action: SecurityAuditAction }
): Promise<string> {
  return recordV10AuditEventStrict(admin, toV10CompatibleSecurityAuditInput(input));
}
