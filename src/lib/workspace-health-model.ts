export type WorkspaceHealthVisibility = "user" | "support" | "internal";
export type WorkspaceHealthMode = "core" | "advanced" | "assurance";
export type WorkspaceHealthStatus =
  | "healthy"
  | "needs_attention"
  | "delayed"
  | "blocked"
  | "not_configured"
  | "unavailable";

export type WorkspaceHealthArea =
  | "imports"
  | "extraction"
  | "reports"
  | "reminders"
  | "notifications"
  | "integrations"
  | "configuration"
  | "approvals"
  | "exceptions"
  | "evidence"
  | "analytics"
  | "assurance";

export type WorkspaceHealthItem = {
  id: string;
  area: WorkspaceHealthArea;
  label: string;
  status: WorkspaceHealthStatus;
  severity: number;
  visibility: WorkspaceHealthVisibility;
  modes: WorkspaceHealthMode[];
  requiredFeature?: string;
  userImpact?: string;
  detail?: string;
  primaryAction?: {
    label: string;
    href: string;
  };
  supportReference?: string;
  chips?: Array<{ label: string; value: string }>;
};

export type WorkspaceHealthTone = "neutral" | "attention" | "risk" | "healthy";

const MODE_RANK: Record<WorkspaceHealthMode, number> = {
  core: 0,
  advanced: 1,
  assurance: 2,
};

export function parseWorkspaceHealthMode(value: unknown): WorkspaceHealthMode {
  return value === "advanced" || value === "assurance" ? value : "core";
}

export function workspaceHealthModeLabel(mode: WorkspaceHealthMode): string {
  if (mode === "assurance") return "Assurance";
  if (mode === "advanced") return "Advanced";
  return "Core";
}

export function statusLabel(status: WorkspaceHealthStatus): string {
  switch (status) {
    case "blocked":
      return "Blocked";
    case "needs_attention":
      return "Needs attention";
    case "delayed":
      return "Delayed";
    case "not_configured":
      return "Not configured";
    case "unavailable":
      return "Unavailable";
    case "healthy":
    default:
      return "Healthy";
  }
}

export function statusTone(status: WorkspaceHealthStatus): WorkspaceHealthTone {
  if (status === "blocked" || status === "needs_attention") return "risk";
  if (status === "delayed" || status === "not_configured") return "attention";
  if (status === "healthy") return "healthy";
  return "neutral";
}

function pluralizeNoun(noun: string, count: number): string {
  if (count === 1) return noun;
  if (noun.endsWith("y")) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

export function formatPercentOrNoSample(value: number | null, noSampleLabel: string): string {
  return typeof value === "number" ? `${value.toFixed(1)}%` : noSampleLabel;
}

export function formatSampleDetail(successCount: number, failedCount: number, noun: string): string {
  const total = successCount + failedCount;
  if (total === 0) return `No ${pluralizeNoun(noun, 0)} sampled`;
  return `${successCount} successful ${pluralizeNoun(noun, successCount)}; ${failedCount} failed ${pluralizeNoun(noun, failedCount)}`;
}

export function formatIsoMinute(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 16);
}

export function filterWorkspaceHealthItems(
  items: WorkspaceHealthItem[],
  mode: WorkspaceHealthMode,
  visibility: WorkspaceHealthVisibility,
  hiddenFeatures: ReadonlySet<string> = new Set()
): WorkspaceHealthItem[] {
  return items
    .filter((item) => item.visibility === visibility)
    .filter((item) => item.modes.some((m) => MODE_RANK[mode] >= MODE_RANK[m]))
    .filter((item) => !item.requiredFeature || !hiddenFeatures.has(item.requiredFeature))
    .filter((item) => item.status !== "unavailable")
    .sort((a, b) => b.severity - a.severity || a.label.localeCompare(b.label));
}

export function getAffectedWorkspaceHealthCount(items: WorkspaceHealthItem[]): number {
  return items.filter((item) => item.status !== "healthy" && item.status !== "unavailable").length;
}

export function getOverallWorkspaceHealthStatus(items: WorkspaceHealthItem[]): WorkspaceHealthStatus {
  if (items.some((item) => item.status === "blocked")) return "blocked";
  if (items.some((item) => item.status === "needs_attention")) return "needs_attention";
  if (items.some((item) => item.status === "delayed")) return "delayed";
  if (items.some((item) => item.status === "not_configured")) return "not_configured";
  return "healthy";
}

export function buildWorkspaceHealthItem(input: Omit<WorkspaceHealthItem, "severity"> & { severity?: number }) {
  return {
    ...input,
    severity: input.severity ?? severityForStatus(input.status),
  };
}

function severityForStatus(status: WorkspaceHealthStatus): number {
  switch (status) {
    case "blocked":
      return 600;
    case "needs_attention":
      return 500;
    case "delayed":
      return 400;
    case "not_configured":
      return 300;
    case "healthy":
      return 100;
    case "unavailable":
    default:
      return 0;
  }
}
