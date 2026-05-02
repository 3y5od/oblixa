export const WORK_HUB_LENS_VALUES = [
  "assigned",
  "assigned_to_team",
  "unassigned",
  "due_today",
  "due_soon",
  "overdue",
  "blocked",
  "high_risk",
  "recent",
  "failed_jobs",
  "automation_approvals",
] as const;

export type WorkHubLens = (typeof WORK_HUB_LENS_VALUES)[number];

export const V9_WORK_HUB_LENS_VALUES = [
  "assigned",
  "due_soon",
  "overdue",
  "blocked",
  "recent",
] as const;

export function parseWorkHubLens(raw: string | undefined): WorkHubLens {
  if (raw === "assigned_to_me") return "assigned";
  if (raw === "assigned_to_my_team") return "assigned_to_team";
  if (raw === "recently_completed") return "recent";
  return WORK_HUB_LENS_VALUES.includes(raw as WorkHubLens) ? (raw as WorkHubLens) : "assigned";
}

export const WORK_HUB_LENS_LABELS: Record<WorkHubLens, string> = {
  assigned: "Assigned to me",
  assigned_to_team: "Assigned to my team",
  unassigned: "Unassigned",
  due_today: "Due today",
  due_soon: "Due soon",
  overdue: "Overdue",
  blocked: "Blocked",
  high_risk: "High risk",
  recent: "Recently completed",
  failed_jobs: "Failed jobs",
  automation_approvals: "Automation approvals",
};
