import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DECISION_CONTEXT_MAX_CONTRACTS = 25;

/** Normalizes linked contract ids: valid UUIDs only, max {@link DECISION_CONTEXT_MAX_CONTRACTS}, truncation flag from raw array length. */
export function normalizeLinkedContractIds(linkedContractIds: unknown): {
  ids: string[];
  truncated: boolean;
} {
  const raw = Array.isArray(linkedContractIds) ? linkedContractIds : [];
  const ids = [...new Set(raw
    .map((x) => String(x))
    .filter((id) => UUID_RE.test(id)))]
    .slice(0, DECISION_CONTEXT_MAX_CONTRACTS);
  const truncated = raw.length > DECISION_CONTEXT_MAX_CONTRACTS;
  return { ids, truncated };
}

type Admin = SupabaseClient;

export type DecisionExecutionContext = {
  linkedContractIdsUsed: string[];
  truncated: boolean;
  tasks: Array<{
    id: string;
    contract_id: string;
    title: string | null;
    status: string;
    due_date: string | null;
  }>;
  approvals: Array<{
    id: string;
    contract_id: string;
    status: string;
    approval_type: string;
    notes: string | null;
  }>;
  obligations: Array<{
    id: string;
    contract_id: string;
    title: string | null;
    status: string;
    due_date: string | null;
  }>;
  exceptions: Array<{
    id: string;
    contract_id: string;
    title: string | null;
    status: string;
  }>;
  evidenceRequirements: Array<{
    id: string;
    contract_id: string;
    title: string | null;
    status: string;
  }>;
  attestations: Array<{
    id: string;
    contract_id: string | null;
    title: string;
    status: string;
    due_at: string | null;
  }>;
  counts: {
    openTasks: number;
    pendingApprovals: number;
    openObligations: number;
    openExceptions: number;
    requiredEvidence: number;
    openAttestations: number;
  };
};

export async function buildDecisionExecutionContext(
  admin: Admin,
  organizationId: string,
  linkedContractIds: unknown
): Promise<DecisionExecutionContext> {
  const { ids, truncated } = normalizeLinkedContractIds(linkedContractIds);

  const empty: DecisionExecutionContext = {
    linkedContractIdsUsed: ids,
    truncated,
    tasks: [],
    approvals: [],
    obligations: [],
    exceptions: [],
    evidenceRequirements: [],
    attestations: [],
    counts: {
      openTasks: 0,
      pendingApprovals: 0,
      openObligations: 0,
      openExceptions: 0,
      requiredEvidence: 0,
      openAttestations: 0,
    },
  };

  if (ids.length === 0) return empty;

  const [
    { data: tasks, error: tasksErr },
    { data: approvals, error: approvalsErr },
    { data: obligations, error: obligationsErr },
    { data: exceptions, error: exceptionsErr },
    { data: evidenceRequirements, error: evidenceErr },
    { data: attestations, error: attestationsErr },
  ] = await Promise.all([
    admin
      .from("contract_tasks")
      .select("id, contract_id, title, status, due_date")
      .eq("organization_id", organizationId)
      .in("contract_id", ids)
      .in("status", ["open", "in_progress", "blocked"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(80),
    admin
      .from("contract_approvals")
      .select("id, contract_id, status, approval_type, notes")
      .eq("organization_id", organizationId)
      .in("contract_id", ids)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(80),
    admin
      .from("contract_obligations")
      .select("id, contract_id, title, status, due_date")
      .eq("organization_id", organizationId)
      .in("contract_id", ids)
      .in("status", ["open", "in_progress"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(80),
    admin
      .from("exceptions")
      .select("id, contract_id, title, status")
      .eq("organization_id", organizationId)
      .in("contract_id", ids)
      .in("status", ["open", "in_progress"])
      .order("updated_at", { ascending: false })
      .limit(80),
    admin
      .from("evidence_requirements")
      .select("id, contract_id, title, status")
      .eq("organization_id", organizationId)
      .in("contract_id", ids)
      .eq("status", "required")
      .order("updated_at", { ascending: false })
      .limit(80),
    admin
      .from("attestation_requests")
      .select("id, contract_id, title, status, due_at")
      .eq("organization_id", organizationId)
      .in("contract_id", ids)
      .in("status", ["open", "overdue"])
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(80),
  ]);

  if (tasksErr) console.error("[decision-context] tasks query failed:", tasksErr.message);
  if (approvalsErr) console.error("[decision-context] approvals query failed:", approvalsErr.message);
  if (obligationsErr) console.error("[decision-context] obligations query failed:", obligationsErr.message);
  if (exceptionsErr) console.error("[decision-context] exceptions query failed:", exceptionsErr.message);
  if (evidenceErr) console.error("[decision-context] evidence query failed:", evidenceErr.message);
  if (attestationsErr) console.error("[decision-context] attestations query failed:", attestationsErr.message);

  const taskRows = tasks ?? [];
  const apprRows = approvals ?? [];
  const oblRows = obligations ?? [];
  const exRows = exceptions ?? [];
  const evRows = evidenceRequirements ?? [];
  const attRows = attestations ?? [];

  return {
    linkedContractIdsUsed: ids,
    truncated,
    tasks: taskRows as DecisionExecutionContext["tasks"],
    approvals: apprRows as DecisionExecutionContext["approvals"],
    obligations: oblRows as DecisionExecutionContext["obligations"],
    exceptions: exRows as DecisionExecutionContext["exceptions"],
    evidenceRequirements: evRows as DecisionExecutionContext["evidenceRequirements"],
    attestations: attRows as DecisionExecutionContext["attestations"],
    counts: {
      openTasks: taskRows.length,
      pendingApprovals: apprRows.length,
      openObligations: oblRows.length,
      openExceptions: exRows.length,
      requiredEvidence: evRows.length,
      openAttestations: attRows.length,
    },
  };
}
