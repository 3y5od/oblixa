import { recordV10AuditEvent, recordV10AuditEventStrict, type V10AuditInput } from "@/lib/server-contracts";
import type { createAdminClient } from "@/lib/supabase/server";
import type { SecurityAuditAction } from "@/lib/security/audit-actions";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;
export type { SecurityAuditAction } from "@/lib/security/audit-actions";

export async function recordSecurityAuditEvent(
  admin: Admin,
  input: Omit<V10AuditInput, "action"> & { action: SecurityAuditAction }
): Promise<string | null> {
  return recordV10AuditEvent(admin, input);
}

export async function recordSecurityAuditEventStrict(
  admin: Admin,
  input: Omit<V10AuditInput, "action"> & { action: SecurityAuditAction }
): Promise<string> {
  return recordV10AuditEventStrict(admin, input);
}
