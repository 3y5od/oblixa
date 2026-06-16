import type { ContractTask, ContractTaskStatus } from "@/lib/types";
import type { ExecutionGraphEdgeRow } from "@/lib/contract-operations/graph-edge-labels";

export type MemberOption = {
  userId: string;
  label: string;
};

export type ContractTaskListItem = Pick<
  ContractTask,
  | "id" | "title" | "details" | "status" | "priority"
  | "due_date" | "assignee_id"
  | "completed_at"
  | "created_via"
  | "team_key"
  | "blocked_reason"
  | "recurrence_interval_days"
  | "sla_due_at"
>;

export type ContractTaskEvent = {
  id: string;
  task_id: string;
  event_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type ContractTaskChecklistItem = {
  id: string;
  task_id: string;
  label: string;
  is_done: boolean;
  sort_order: number;
};

export type ContractTaskComment = {
  id: string;
  task_id: string;
  body: string;
  parent_comment_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type ContractTaskDependency = {
  id: string;
  task_id: string;
  depends_on_task_id: string;
};

export type ContractTaskArtifact = {
  id: string;
  task_id: string;
  label: string;
  url: string;
  created_at: string;
};

export type ContractTasksPanelProps = {
  contractId: string;
  tasks: ContractTaskListItem[];
  members: MemberOption[];
  canEdit: boolean;
  executionGraphEdges?: ExecutionGraphEdgeRow[];
  taskEvents: ContractTaskEvent[];
  taskChecklistItems: ContractTaskChecklistItem[];
  taskComments: ContractTaskComment[];
  taskDependencies: ContractTaskDependency[];
  taskArtifacts: ContractTaskArtifact[];
};

export type ContractTaskMutationHandlers = {
  onStatusChange: (taskId: string, status: ContractTaskStatus) => void;
  onDelete: (taskId: string) => void;
  onAddChecklistItem: (taskId: string, formData: FormData) => void;
  onToggleChecklistItem: (checklistItemId: string, done: boolean) => void;
  onUpdateChecklistItem: (checklistItemId: string, formData: FormData) => void;
  onDeleteChecklistItem: (checklistItemId: string) => void;
  onMoveChecklistItem: (checklistItemId: string, direction: "up" | "down") => void;
  onAddComment: (taskId: string, formData: FormData) => void;
  onUpdateComment: (commentId: string, formData: FormData) => void;
  onDeleteComment: (commentId: string) => void;
  onAddDependency: (taskId: string, formData: FormData) => void;
  onAddArtifact: (taskId: string, formData: FormData) => void;
  onDeleteArtifact: (artifactId: string) => void;
};
