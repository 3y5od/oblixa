import { analyzePolicyRegistry, validatePolicyRegistry } from "@/lib/contract-operations/policy-registry";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";

export const DEFAULT_WORKSPACE_POLICY_REGISTRY = [
  {
    id: "evidence_required_high_value",
    title: "Evidence for high-value renewals",
    applies_to: ["renewal", "obligation"],
    severity: "high",
    notes: "Require manager approval evidence before marking complete.",
  },
  {
    id: "approval_sla_default",
    title: "Default approval SLA",
    applies_to: ["approval"],
    sla_hours: 48,
  },
] as const;

export type WorkspacePolicyMode = WorkspaceProductMode;
export type WorkspacePolicyStatus = "active" | "warning" | "unavailable";
export type WorkspacePolicyGroupKey =
  | "approvals"
  | "tasks"
  | "obligations"
  | "evidence"
  | "assurance"
  | "other";

export type WorkspacePolicy = {
  id: string;
  title: string;
  group: WorkspacePolicyGroupKey;
  status: WorkspacePolicyStatus;
  appliesTo: string[];
  affectsLabel: string;
  detail: string;
  modeAvailability: WorkspacePolicyMode[];
  hiddenModule?: string;
  raw: Record<string, unknown>;
};

export type WorkspacePolicyGroup = {
  key: WorkspacePolicyGroupKey;
  title: string;
  description: string;
  policies: WorkspacePolicy[];
};

export type WorkspacePolicyWarning = {
  severity: "attention" | "risk";
  title: string;
  message: string;
  policyId?: string;
  actionLabel: string;
  actionHref: string;
  rawMessage?: string;
};

export type WorkspacePolicySummary = {
  activePolicyCount: number;
  warningCount: number;
  affectedGroupCount: number;
  modeLabel: string;
};

const GROUP_ORDER: WorkspacePolicyGroupKey[] = [
  "approvals",
  "tasks",
  "obligations",
  "evidence",
  "assurance",
  "other",
];

const GROUP_META: Record<WorkspacePolicyGroupKey, Omit<WorkspacePolicyGroup, "policies">> = {
  approvals: {
    key: "approvals",
    title: "Approvals",
    description: "Timing and routing rules for approval work.",
  },
  tasks: {
    key: "tasks",
    title: "Tasks and reminders",
    description: "Rules that influence follow-up work and reminder timing.",
  },
  obligations: {
    key: "obligations",
    title: "Obligations",
    description: "Rules that guide obligation and renewal review workflows.",
  },
  evidence: {
    key: "evidence",
    title: "Evidence",
    description: "Rules that define when supporting evidence is expected.",
  },
  assurance: {
    key: "assurance",
    title: "Assurance",
    description: "Rules connected to controls, findings, scorecards, and assurance programs.",
  },
  other: {
    key: "other",
    title: "Other policies",
    description: "Valid policies that do not map cleanly to a standard workflow group.",
  },
};

const MODE_LABELS: Record<WorkspacePolicyMode, string> = {
  core: "Core",
  advanced: "Advanced",
  assurance: "Assurance",
};

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function hasTag(tags: string[], candidates: string[]): boolean {
  return tags.some((tag) => candidates.includes(tag));
}

function titleFromEntry(entry: Record<string, unknown>, fallbackId: string): string {
  const title = typeof entry.title === "string" ? entry.title.trim() : "";
  if (title) return title;
  return fallbackId
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function groupForTags(tags: string[], entry: Record<string, unknown>): WorkspacePolicyGroupKey {
  const combined = [...tags, String(entry.type ?? ""), String(entry.category ?? ""), String(entry.notes ?? "")].map((x) =>
    x.toLowerCase()
  );
  if (hasTag(combined, ["control", "controls", "control_policy", "control_policies", "finding", "findings", "scorecard", "scorecards", "playbook", "playbooks", "assurance"])) {
    return "assurance";
  }
  if (hasTag(combined, ["evidence", "evidence_requirement", "evidence_requirements"])) return "evidence";
  if (hasTag(combined, ["approval", "approvals"])) return "approvals";
  if (hasTag(combined, ["renewal", "renewals", "obligation", "obligations"])) return "obligations";
  if (hasTag(combined, ["task", "tasks", "reminder", "reminders", "notification", "notifications"])) return "tasks";
  return "other";
}

function assuranceModuleForTags(tags: string[], entry: Record<string, unknown>): string | null {
  const combined = [...tags, String(entry.type ?? ""), String(entry.category ?? "")].map((x) => x.toLowerCase());
  if (hasTag(combined, ["control", "controls", "control_policy", "control_policies"])) return "control_policies";
  if (hasTag(combined, ["finding", "findings"])) return "findings";
  if (hasTag(combined, ["scorecard", "scorecards"])) return "scorecards";
  if (hasTag(combined, ["playbook", "playbooks"])) return "playbooks";
  if (hasTag(combined, ["autopilot"])) return "autopilot";
  return null;
}

function availabilityForGroup(group: WorkspacePolicyGroupKey): WorkspacePolicyMode[] {
  if (group === "assurance") return ["assurance"];
  return ["core", "advanced", "assurance"];
}

function affectsLabelForGroup(group: WorkspacePolicyGroupKey): string {
  switch (group) {
    case "approvals":
      return "Approval workflows";
    case "tasks":
      return "Tasks and reminders";
    case "obligations":
      return "Obligations and renewals";
    case "evidence":
      return "Evidence requests";
    case "assurance":
      return "Assurance workflows";
    default:
      return "Workspace workflows";
  }
}

function detailForEntry(entry: Record<string, unknown>, group: WorkspacePolicyGroupKey): string {
  const hours = entry.sla_hours;
  if (typeof hours === "number" && Number.isFinite(hours) && hours > 0) {
    return group === "approvals" ? `${Math.round(hours)} hour approval timing` : `${Math.round(hours)} hour timing`;
  }
  const severity = typeof entry.severity === "string" ? entry.severity.trim() : "";
  if (severity) return `${severity.charAt(0).toUpperCase()}${severity.slice(1)} priority`;
  const notes = typeof entry.notes === "string" ? entry.notes.trim() : "";
  if (notes) return notes;
  return "Configured workflow rule";
}

function isModeAllowed(mode: WorkspacePolicyMode, availability: WorkspacePolicyMode[]): boolean {
  return availability.includes(mode);
}

export function normalizeWorkspacePolicies(
  registry: unknown,
  mode: WorkspacePolicyMode,
  options: { hiddenAssuranceModules?: ReadonlySet<string> } = {}
): WorkspacePolicy[] {
  if (!Array.isArray(registry)) return [];
  return registry.flatMap((entry, index) => {
    const row = toRecord(entry);
    if (!row) return [];
    const id = String(row.id ?? `policy_${index + 1}`).trim();
    if (!id) return [];
    const appliesTo = stringList(row.applies_to);
    const group = groupForTags(appliesTo, row);
    const modeAvailability = availabilityForGroup(group);
    const hiddenModule = assuranceModuleForTags(appliesTo, row) ?? undefined;
    const hiddenByModule =
      mode === "assurance" && hiddenModule ? options.hiddenAssuranceModules?.has(hiddenModule) === true : false;
    return [
      {
        id,
        title: titleFromEntry(row, id),
        group,
        status: isModeAllowed(mode, modeAvailability) && !hiddenByModule ? "active" : "unavailable",
        appliesTo,
        affectsLabel: affectsLabelForGroup(group),
        detail: detailForEntry(row, group),
        modeAvailability,
        hiddenModule: hiddenByModule ? hiddenModule : undefined,
        raw: row,
      },
    ];
  });
}

export function groupWorkspacePolicies(policies: WorkspacePolicy[]): WorkspacePolicyGroup[] {
  const visible = policies.filter((policy) => policy.status !== "unavailable");
  return GROUP_ORDER.flatMap((key) => {
    const groupPolicies = visible.filter((policy) => policy.group === key);
    if (groupPolicies.length === 0) return [];
    return [{ ...GROUP_META[key], policies: groupPolicies }];
  });
}

function duplicateIdWarnings(registry: unknown): WorkspacePolicyWarning[] {
  if (!Array.isArray(registry)) return [];
  const seen = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const entry of registry) {
    const row = toRecord(entry);
    if (!row) continue;
    const id = String(row.id ?? "").trim();
    if (!id) continue;
    if (seen.has(id)) duplicateIds.add(id);
    seen.add(id);
  }
  return [...duplicateIds].map((id) => ({
    severity: "risk" as const,
    title: "Duplicate policy IDs",
    message: "Each policy needs a unique identifier before changes can be saved.",
    policyId: id,
    actionLabel: "Edit advanced settings",
    actionHref: "/settings/policy/registry",
  }));
}

function entryWarnings(
  registry: unknown,
  mode: WorkspacePolicyMode,
  options: { hiddenAssuranceModules?: ReadonlySet<string> } = {}
): WorkspacePolicyWarning[] {
  if (!Array.isArray(registry)) return [];
  const warnings: WorkspacePolicyWarning[] = [];
  const approvalDefaults: string[] = [];
  for (const entry of registry) {
    const row = toRecord(entry);
    if (!row) continue;
    const id = String(row.id ?? "").trim();
    const tags = stringList(row.applies_to);
    const group = groupForTags(tags, row);
    const hiddenModule = assuranceModuleForTags(tags, row);
    if (!id) {
      warnings.push({
        severity: "risk",
        title: "Policy is missing a name",
        message: "A policy cannot be managed safely until it has a stable identifier.",
        actionLabel: "Edit advanced settings",
        actionHref: "/settings/policy/registry",
      });
    }
    if (group === "approvals") {
      const hours = row.sla_hours;
      if (hours === undefined) {
        warnings.push({
          severity: "attention",
          title: "Approval timing is incomplete",
          message: "Add approval timing so approval work has a clear default target.",
          policyId: id || undefined,
          actionLabel: "Edit advanced settings",
          actionHref: "/settings/policy/registry",
        });
      } else if (typeof hours !== "number" || !Number.isFinite(hours) || hours <= 0) {
        warnings.push({
          severity: "risk",
          title: "Approval timing must be greater than zero",
          message: "Fix the approval timing value before relying on this policy.",
          policyId: id || undefined,
          actionLabel: "Edit advanced settings",
          actionHref: "/settings/policy/registry",
        });
      } else {
        approvalDefaults.push(id || "approval policy");
      }
    }
    if (group === "obligations") {
      const hasSeverity = typeof row.severity === "string" && row.severity.trim().length > 0;
      const hasHours = typeof row.sla_hours === "number" && Number.isFinite(row.sla_hours) && row.sla_hours > 0;
      const hasNotes = typeof row.notes === "string" && row.notes.trim().length > 0;
      if (!hasSeverity && !hasHours && !hasNotes) {
        warnings.push({
          severity: "attention",
          title: "Policy intent is unclear",
          message: "Add timing, priority, or notes so admins can understand what this policy changes.",
          policyId: id || undefined,
          actionLabel: "Edit advanced settings",
          actionHref: "/settings/policy/registry",
        });
      }
    }
    if (!isModeAllowed(mode, availabilityForGroup(group))) {
      warnings.push({
        severity: "attention",
        title: "Policy is not active in this workspace mode",
        message: "This policy targets a workspace area that is not visible in the current mode.",
        policyId: id || undefined,
        actionLabel: "Open settings",
        actionHref: "/settings",
      });
    }
    if (mode === "assurance" && hiddenModule && options.hiddenAssuranceModules?.has(hiddenModule)) {
      warnings.push({
        severity: "attention",
        title: "Policy applies to a hidden workspace area",
        message: "This policy targets an Assurance area that is currently hidden from the workspace.",
        policyId: id || undefined,
        actionLabel: "Open settings",
        actionHref: "/settings",
      });
    }
  }
  if (approvalDefaults.length > 1) {
    warnings.push({
      severity: "attention",
      title: "Multiple approval timing defaults may conflict",
      message: "More than one approval policy defines default timing. Review ordering before relying on fallback behavior.",
      actionLabel: "View diagnostics",
      actionHref: "/settings/policy/diagnostics",
    });
  }
  return warnings;
}

function validationWarning(registry: unknown): WorkspacePolicyWarning[] {
  const validation = validatePolicyRegistry(registry);
  if (validation.ok) return [];
  return [
    {
      severity: "risk",
      title: validation.error.includes("Duplicate") ? "Duplicate policy IDs" : "Policy registry needs attention",
      message: validation.error.includes("Duplicate")
        ? "Each policy needs a unique identifier before changes can be saved."
        : "The saved policy list cannot be read as a valid set of workspace policies.",
      actionLabel: "Edit advanced settings",
      actionHref: "/settings/policy/registry",
      rawMessage: validation.error,
    },
  ];
}

export function getWorkspacePolicyWarnings(
  registry: unknown,
  mode: WorkspacePolicyMode,
  options: { hiddenAssuranceModules?: ReadonlySet<string> } = {}
): WorkspacePolicyWarning[] {
  const validation = validationWarning(registry);
  const existingRawWarnings: WorkspacePolicyWarning[] = analyzePolicyRegistry(registry).map((rawMessage) => ({
    severity: "attention" as const,
    title: rawMessage.includes("Multiple entries")
      ? "Multiple approval timing defaults may conflict"
      : rawMessage.includes("renewal or obligation")
        ? "Policy intent is unclear"
        : "Policy warning",
    message: rawMessage.includes("Multiple entries")
      ? "More than one approval policy defines default timing. Review ordering before relying on fallback behavior."
      : rawMessage.includes("renewal or obligation")
        ? "Add timing, priority, or notes so admins can understand what this policy changes."
        : "Review this policy before relying on it for workflow behavior.",
    actionLabel: "View diagnostics",
    actionHref: "/settings/policy/diagnostics",
    rawMessage,
  }));
  const all = [
    ...validation,
    ...duplicateIdWarnings(registry),
    ...entryWarnings(registry, mode, options),
    ...existingRawWarnings,
  ];
  const seen = new Set<string>();
  return all.filter((warning) => {
    const key = `${warning.title}:${warning.policyId ?? ""}:${warning.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function summarizeWorkspacePolicies(input: {
  groups: WorkspacePolicyGroup[];
  warnings: WorkspacePolicyWarning[];
  mode: WorkspacePolicyMode;
}): WorkspacePolicySummary {
  return {
    activePolicyCount: input.groups.reduce((sum, group) => sum + group.policies.filter((p) => p.status === "active").length, 0),
    warningCount: input.warnings.length,
    affectedGroupCount: input.groups.length,
    modeLabel: MODE_LABELS[input.mode],
  };
}

export function buildWorkspacePolicyView(
  registry: unknown,
  mode: WorkspacePolicyMode,
  options: { hiddenAssuranceModules?: ReadonlySet<string> } = {}
) {
  const policies = normalizeWorkspacePolicies(registry, mode, options);
  const groups = groupWorkspacePolicies(policies);
  const warnings = getWorkspacePolicyWarnings(registry, mode, options);
  return {
    policies,
    groups,
    warnings,
    summary: summarizeWorkspacePolicies({ groups, warnings, mode }),
  };
}
