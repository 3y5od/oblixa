import type { getV10ExceptionResolutionActionOptions } from "@/lib/approval-exception";

export type StatusFilter = "" | "open" | "in_progress" | "resolved" | "closed";
export type SeverityFilter = "" | "low" | "medium" | "high" | "critical";

export type ExceptionRow = {
  id: string;
  contract_id: string | null;
  title: string | null;
  exception_type: string;
  severity: string;
  status: string;
  owner_id: string | null;
  due_date: string | null;
  updated_at: string;
};

export type ExceptionEvent = {
  event_type: string;
  created_at: string;
};

export type OwnerOption = {
  id: string;
  label: string;
};

export type ResolutionActionOptions = ReturnType<typeof getV10ExceptionResolutionActionOptions>;
