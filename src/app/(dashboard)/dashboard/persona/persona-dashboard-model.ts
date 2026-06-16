import type { LucideIcon } from "lucide-react";
import { AlertTriangle, DollarSign } from "lucide-react";
import type { OperationalTone } from "@/lib/ui/operational-surface";
import {
  dueLabel,
  PERSONA_CONFIG,
  PERSONA_PRESETS,
  readableStatus,
  relationContract,
  sortQueueItems,
  urgencyFrom,
  type PersonaId,
  type PersonaQueueItem,
  type PersonaViewConfig,
} from "@/app/(dashboard)/dashboard/persona/persona-dashboard-config";

export type ContractRow = {
  id?: string;
  title?: string;
  health_status?: string | null;
  annual_value?: unknown;
};

export type TaskRow = {
  id: string;
  title: string;
  status?: string | null;
  priority?: string | null;
  assignee_id?: string | null;
  due_date?: string | null;
  contracts?: unknown;
};

export type ObligationRow = {
  id: string;
  title: string;
  status?: string | null;
  owner_id?: string | null;
  due_date?: string | null;
  contracts?: unknown;
};

export type ApprovalRow = {
  id: string;
  due_at?: string | null;
  contracts?: unknown;
};

export type RenewalScenarioRow = {
  id: string;
  workspace_status?: string | null;
  target_decision_date?: string | null;
  blocker?: string | null;
  contracts?: unknown;
};

export type PersonaMetric = {
  key: string;
  eyebrow: string;
  headline: string;
  tone: OperationalTone;
  icon: LucideIcon;
  primaryValue: string | number;
  primaryUnit?: string;
  breakdown?: { label: string; value: string }[];
  action: { href: string; label: string };
};

export type ActionableChip = {
  label: string;
  value: number;
  tone: OperationalTone;
};

export type PersonaDashboardModel = {
  config: PersonaViewConfig;
  personaQueue: PersonaQueueItem[];
  actionableChips: ActionableChip[];
  personaMetrics: PersonaMetric[];
  showAllClear: boolean;
  secondaryNavAction: (typeof PERSONA_PRESETS)[number] | undefined;
};

export function buildPersonaDashboardModel(input: {
  persona: PersonaId;
  productMode: string;
  userId: string;
  contracts: ContractRow[];
  tasks: TaskRow[];
  obligations: ObligationRow[];
  approvals: ApprovalRow[];
  renewalScenarios: RenewalScenarioRow[];
}): PersonaDashboardModel {
  const pendingApprovalRows = buildPendingApprovalRows(input.approvals, input.persona);
  const highPriorityTasks = buildHighPriorityTasks(input.tasks, input.userId);
  const accountOwnerTasks = highPriorityTasks.filter((row) => row.ownerLabel === "Assigned to you");
  const renewalRisks = buildRenewalRisks(input.renewalScenarios);
  const ownerObligations = buildOwnerObligations(input.obligations, input.userId);
  const personaQueue = selectPersonaQueue({
    persona: input.persona,
    pendingApprovalRows,
    highPriorityTasks,
    accountOwnerTasks,
    renewalRisks,
    ownerObligations,
  });
  const actionableChips = buildActionableChips({
    persona: input.persona,
    personaQueue,
    pendingApprovals: input.approvals.length,
    myOpenTasksCount: input.tasks.filter((t) => t.assignee_id === input.userId).length,
    myOpenObligationsCount: input.obligations.filter((o) => o.owner_id === input.userId).length,
    highPriorityOpenTasksCount: input.tasks.filter((t) => t.priority === "high" && t.status !== "done").length,
    renewalBlockersCount: renewalRisks.length,
  });
  const personaMetrics = buildPersonaMetrics({
    persona: input.persona,
    productMode: input.productMode,
    contracts: input.contracts,
  });

  return {
    config: PERSONA_CONFIG[input.persona],
    personaQueue,
    actionableChips,
    personaMetrics,
    showAllClear: personaQueue.length === 0 && actionableChips.length === 0,
    secondaryNavAction: PERSONA_PRESETS.find((preset) => preset.persona !== input.persona),
  };
}

function buildPendingApprovalRows(approvals: ApprovalRow[], persona: PersonaId): PersonaQueueItem[] {
  return approvals.flatMap((row) => {
    const contract = relationContract(row.contracts);
    if (!contract?.id) return [];
    return [
      {
        id: row.id,
        href: `/contracts/${contract.id}`,
        title: contract.title ?? "Approval needed",
        contractTitle: contract.title,
        dueLabel: dueLabel(row.due_at),
        dueDate: row.due_at ? String(row.due_at).slice(0, 10) : undefined,
        reason: row.due_at ? "Pending approval with due date" : "Pending approval",
        actionLabel: persona === "manager" ? "Review escalation" : "Review approval",
        urgency: urgencyFrom(undefined, row.due_at),
      },
    ];
  });
}

function buildHighPriorityTasks(tasks: TaskRow[], userId: string): PersonaQueueItem[] {
  return tasks
    .filter((t) => t.priority === "high" || t.status === "blocked")
    .flatMap((row) => {
      const contract = relationContract(row.contracts);
      if (!contract?.id) return [];
      const urgency = urgencyFrom(row.status, row.due_date, row.priority);
      return [
        {
          id: row.id,
          href: `/contracts/${contract.id}`,
          title: row.title,
          contractTitle: contract.title,
          ownerLabel: row.assignee_id === userId ? "Assigned to you" : undefined,
          dueLabel: dueLabel(row.due_date),
          dueDate: row.due_date ? String(row.due_date).slice(0, 10) : undefined,
          reason:
            urgency === "blocked"
              ? "Task needs input"
              : urgency === "overdue"
                ? "Overdue task"
                : urgency === "due_today"
                  ? "Due today"
                  : "High-priority task",
          actionLabel: urgency === "blocked" ? "Review dependency" : urgency === "normal" ? "Review task" : "Triage task",
          urgency,
        },
      ];
    });
}

function buildRenewalRisks(renewalScenarios: RenewalScenarioRow[]): PersonaQueueItem[] {
  return renewalScenarios
    .filter((r) => r.workspace_status === "blocked" || !!r.blocker)
    .flatMap((row) => {
      const contract = relationContract(row.contracts);
      if (!contract?.id) return [];
      const urgency = urgencyFrom(row.workspace_status, row.target_decision_date);
      return [
        {
          id: row.id,
          href: `/contracts/${contract.id}`,
          title: contract.title ?? "Renewal decision",
          contractTitle: contract.title,
          dueLabel: dueLabel(row.target_decision_date),
          dueDate: row.target_decision_date ? String(row.target_decision_date).slice(0, 10) : undefined,
          reason: row.blocker ? `Input needed: ${row.blocker}` : `${readableStatus(row.workspace_status)} renewal`,
          actionLabel: urgency === "blocked" ? "Review dependency" : "Review renewal",
          urgency,
        },
      ];
    });
}

function buildOwnerObligations(obligations: ObligationRow[], userId: string): PersonaQueueItem[] {
  return obligations
    .filter((o) => o.owner_id === userId)
    .flatMap((row) => {
      const contract = relationContract(row.contracts);
      if (!contract?.id) return [];
      const urgency = urgencyFrom(row.status, row.due_date);
      return [
        {
          id: row.id,
          href: `/contracts/${contract.id}`,
          title: row.title,
          contractTitle: contract.title,
          ownerLabel: "Owned by you",
          dueLabel: dueLabel(row.due_date),
          dueDate: row.due_date ? String(row.due_date).slice(0, 10) : undefined,
          reason:
            urgency === "overdue"
              ? "Overdue requirement"
              : urgency === "due_today"
                ? "Requirement due today"
                : "Open requirement",
          actionLabel: "Review requirement",
          urgency,
        },
      ];
    });
}

function selectPersonaQueue(input: {
  persona: PersonaId;
  pendingApprovalRows: PersonaQueueItem[];
  highPriorityTasks: PersonaQueueItem[];
  accountOwnerTasks: PersonaQueueItem[];
  renewalRisks: PersonaQueueItem[];
  ownerObligations: PersonaQueueItem[];
}) {
  if (input.persona === "legal") return sortQueueItems(input.pendingApprovalRows).slice(0, 6);
  if (input.persona === "finance") return sortQueueItems(input.renewalRisks).slice(0, 6);
  if (input.persona === "manager") {
    return sortQueueItems([...input.renewalRisks, ...input.pendingApprovalRows]).slice(0, 8);
  }
  if (input.persona === "account_owner") {
    return sortQueueItems([...input.accountOwnerTasks, ...input.ownerObligations]).slice(0, 6);
  }
  return sortQueueItems(input.highPriorityTasks).slice(0, 6);
}

function buildActionableChips(input: {
  persona: PersonaId;
  personaQueue: PersonaQueueItem[];
  pendingApprovals: number;
  myOpenTasksCount: number;
  myOpenObligationsCount: number;
  highPriorityOpenTasksCount: number;
  renewalBlockersCount: number;
}): ActionableChip[] {
  const blockedCount = input.personaQueue.filter((row) => row.urgency === "blocked").length;
  const overdueCount = input.personaQueue.filter((row) => row.urgency === "overdue").length;
  const dueTodayCount = input.personaQueue.filter((row) => row.urgency === "due_today").length;
  const highCount = input.personaQueue.filter((row) => row.urgency === "high").length;

  return [
    { label: "Needs input", value: blockedCount, tone: "risk" as OperationalTone },
    { label: "Overdue", value: overdueCount, tone: "risk" as OperationalTone },
    { label: "Due today", value: dueTodayCount, tone: "attention" as OperationalTone },
    { label: "High priority", value: highCount, tone: "attention" as OperationalTone },
    ...(input.persona === "legal" || input.persona === "manager" || input.persona === "reviewer"
      ? [{ label: "Pending approvals", value: input.pendingApprovals, tone: "attention" as OperationalTone }]
      : []),
    ...(input.persona === "finance" || input.persona === "manager"
      ? [{ label: "Renewal dependencies", value: input.renewalBlockersCount, tone: "risk" as OperationalTone }]
      : []),
    ...(input.persona === "account_owner" || input.persona === "ops"
      ? [
          { label: "My tasks", value: input.myOpenTasksCount, tone: "attention" as OperationalTone },
          { label: "My obligations", value: input.myOpenObligationsCount, tone: "neutral" as OperationalTone },
        ]
      : []),
    ...(input.persona === "reviewer"
      ? [{ label: "High-priority tasks", value: input.highPriorityOpenTasksCount, tone: "attention" as OperationalTone }]
      : []),
  ].filter((chip) => chip.value > 0);
}

function buildPersonaMetrics(input: {
  persona: PersonaId;
  productMode: string;
  contracts: ContractRow[];
}): PersonaMetric[] {
  const atRisk = input.contracts.filter((c) => c.health_status === "at_risk").length;
  const exposure = input.contracts.reduce((sum, c) => sum + Number(c.annual_value ?? 0), 0);
  const metricCandidates: PersonaMetric[] = [
    {
      key: "exposure",
      eyebrow: "Portfolio",
      headline: "Annual contract value",
      tone: "neutral",
      icon: DollarSign,
      primaryValue: `$${exposure.toLocaleString()}`,
      primaryUnit: "rolled up from contracts",
      action: { href: "/contracts", label: "Browse contracts" },
    },
    {
      key: "at-risk",
      eyebrow: "Health",
      headline: "At-risk contracts",
      tone: "attention",
      icon: AlertTriangle,
      primaryValue: atRisk,
      action: { href: "/contracts", label: "Review at-risk" },
    },
  ];
  return metricCandidates.filter((m) => {
    const personaCanSeeMetrics =
      input.persona === "finance" ||
      input.persona === "manager" ||
      input.persona === "legal" ||
      input.persona === "reviewer";
    if (!personaCanSeeMetrics || input.productMode === "core") return false;
    if (m.key === "exposure") return exposure > 0 && (input.persona === "finance" || input.persona === "manager");
    return atRisk > 0;
  });
}
