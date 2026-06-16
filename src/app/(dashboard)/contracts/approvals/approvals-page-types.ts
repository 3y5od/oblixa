export type MemberOption = {
  id: string;
  label: string;
};

export type ApprovalRow = {
  id: string;
  contract_id: string;
  approval_type: string;
  status: string;
  notes: string | null;
  category: string | null;
  due_at: string | null;
  exception_flag: boolean | null;
  exception_reason: string | null;
  approver_id: string | null;
  delegated_to_id: string | null;
  created_at: string;
  contracts: unknown;
};

export type RenewalScenarioRow = {
  id: string;
  contract_id: string;
  scenario: string;
  workspace_status: string | null;
  target_decision_date: string | null;
  escalation_date: string | null;
  blocker: string | null;
  updated_at: string;
  contracts: unknown;
};
