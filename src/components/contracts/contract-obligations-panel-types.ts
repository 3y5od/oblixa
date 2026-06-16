import type { ExecutionGraphEdgeRow } from "@/lib/contract-operations/graph-edge-labels";
import type { ContractObligation, ContractObligationStatus } from "@/lib/types";

export type MemberOption = { userId: string; label: string };

export type ObligationRow = Pick<
  ContractObligation,
  | "id"
  | "title"
  | "details"
  | "obligation_type"
  | "cadence"
  | "recurrence_type"
  | "recurrence_interval_days"
  | "next_due_date"
  | "escalation_due_at"
  | "escalation_status"
  | "due_date"
  | "status"
  | "owner_id"
  | "evidence_notes"
  | "evidence_url"
  | "completed_at"
>;

export type ObligationEvent = {
  id: string;
  obligation_id: string;
  event_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type ObligationRowHandlers = {
  onStatusChange: (id: string, status: ContractObligationStatus) => void;
  onOwnerChange: (id: string, ownerId: string) => void;
  onDelete: (id: string) => void;
  onOperationalUpdate: (id: string, formData: FormData) => void;
};

export type ObligationExecutionGraphEdges = ExecutionGraphEdgeRow[] | undefined;
