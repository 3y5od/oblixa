export const WORK_HUB_LENS_VALUES = [
  "assigned",
  "due_soon",
  "overdue",
  "blocked",
  "recent",
] as const;

export type WorkHubLens = (typeof WORK_HUB_LENS_VALUES)[number];

export function parseWorkHubLens(raw: string | undefined): WorkHubLens {
  return WORK_HUB_LENS_VALUES.includes(raw as WorkHubLens) ? (raw as WorkHubLens) : "assigned";
}

export const WORK_HUB_LENS_LABELS: Record<WorkHubLens, string> = {
  assigned: "Assigned to me",
  due_soon: "Due soon",
  overdue: "Overdue",
  blocked: "Blocked",
  recent: "Recently completed",
};
