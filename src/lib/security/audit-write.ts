import { recordV10AuditEvent, type V10AuditInput } from "@/lib/v10-server-contracts";
import type { createAdminClient } from "@/lib/supabase/server";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

/** Namespaced actions for security-sensitive product events (stored in v10_audit_events). */
export type SecurityAuditAction =
  | "security.integration_api_key_created"
  | "security.integration_api_key_revoked"
  | "security.session_signed_out"
  | "security.mfa_totp_verified"
  | "security.mfa_totp_unenrolled"
  | "security.org_mfa_required_updated"
  | "security.sessions_revoke_others"
  | "security.step_up_password_verified"
  | "security.dsr_self_export_downloaded"
  | "security.dsr_account_delete_requested"
  | "security.dsr_self_export_blocked_legal_hold"
  | "security.dsr_account_delete_blocked_legal_hold"
  | "security.internal_debugging_sweep_success";

export async function recordSecurityAuditEvent(
  admin: Admin,
  input: Omit<V10AuditInput, "action"> & { action: SecurityAuditAction }
): Promise<string | null> {
  return recordV10AuditEvent(admin, input);
}
