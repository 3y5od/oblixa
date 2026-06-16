export type TaskStatusFilter = "" | "open" | "in_progress" | "blocked" | "done";

export type TaskViewRow = {
  id: string;
  title: string;
  details: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  blockedReason: string | null;
  recurrenceIntervalDays: number | null;
  slaDueAt: string | null;
  assigneeId: string | null;
  updatedAt: string;
  createdVia: string | null;
  teamKey: string | null;
  contractId: string;
  contractTitle: string;
};

export type SavedTaskView = {
  id: string;
  name: string;
  href: string;
  weeklyActive: boolean;
  pinned: boolean;
};
