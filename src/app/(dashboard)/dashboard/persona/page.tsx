import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { isFeatureEnabled } from "@/lib/feature-flags";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import {
  CompressedNormalState,
  OperationalQueueRow,
  OperationalSummaryCard,
  SeverityMetricStrip,
} from "@/components/ui/operational-summary-card";
import type { OperationalTone } from "@/lib/ui/operational-surface";

const PERSONA_CONFIG = {
  ops: {
    label: "Ops lead",
    purpose: "Work blocked or high-priority tasks before routine follow-up.",
    queueTitle: "Ops work queue",
    queueDescription: "Blocked work, due work, and high-priority tasks are listed first.",
    emptyMessage: "No blocked or high-priority Ops work is visible for your current workspace and role.",
  },
  finance: {
    label: "Finance",
    purpose: "Clear renewal blockers and financial exposure that needs a decision.",
    queueTitle: "Renewal blocker queue",
    queueDescription: "Blocked renewals and blocker-bearing decisions are listed first.",
    emptyMessage: "No blocked renewal decisions are visible for your current workspace and role.",
  },
  legal: {
    label: "Legal reviewer",
    purpose: "Review pending approvals before downstream work stalls.",
    queueTitle: "Legal approval queue",
    queueDescription: "Pending sign-offs are ordered by urgency and due date.",
    emptyMessage: "No pending legal approvals are visible for your current workspace and role.",
  },
  account_owner: {
    label: "Account owner",
    purpose: "Follow up on assigned tasks and obligations that need your attention.",
    queueTitle: "Assigned work queue",
    queueDescription: "Your blocked, overdue, due, and high-priority work is listed first.",
    emptyMessage: "No assigned tasks or obligations are visible for your current workspace and role.",
  },
  reviewer: {
    label: "Contract coordinator",
    purpose: "Coordinate open contract work that needs triage or follow-up.",
    queueTitle: "Coordination queue",
    queueDescription: "Blocked and high-priority coordination work is listed first.",
    emptyMessage: "No coordination work is visible for your current workspace and role.",
  },
  manager: {
    label: "Founder / manager",
    purpose: "Review blockers, approvals, and ownership gaps that need escalation.",
    queueTitle: "Manager escalation queue",
    queueDescription: "Renewal blockers and pending approvals are combined by urgency.",
    emptyMessage: "No approvals, blockers, or ownership gaps are visible for your current workspace and role.",
  },
} as const;

type PersonaId = keyof typeof PERSONA_CONFIG;

const PERSONAS = Object.entries(PERSONA_CONFIG).map(([id, config]) => ({
  id: id as PersonaId,
  label: config.label,
}));

type PersonaViewConfig = {
  label: string;
  purpose: string;
  queueTitle: string;
  queueDescription: string;
  emptyMessage: string;
};

const PERSONA_PRESETS: Array<{
  id: string;
  label: string;
  persona: PersonaId;
  description: string;
  href: string;
}> = [
  {
    id: "ops-daily",
    label: "Ops Daily",
    persona: "ops",
    description: "Run tasks + obligations + intake triage",
    href: "/dashboard/persona?persona=ops",
  },
  {
    id: "legal-approvals",
    label: "Legal Approvals",
    persona: "legal",
    description: "Clear approval queue and exceptions",
    href: "/dashboard/persona?persona=legal",
  },
  {
    id: "finance-renewals",
    label: "Finance Renewals",
    persona: "finance",
    description: "Prioritize high-value renewal exposure",
    href: "/dashboard/persona?persona=finance",
  },
  {
    id: "manager-overview",
    label: "Manager Weekly",
    persona: "manager",
    description: "Portfolio risk and execution posture",
    href: "/dashboard/persona?persona=manager",
  },
];

const ALL_CLEAR_ACTION_LABELS: Record<(typeof PERSONA_PRESETS)[number]["id"], string> = {
  "ops-daily": "Browse Ops Daily",
  "legal-approvals": "Review legal approvals",
  "finance-renewals": "Inspect renewal blockers",
  "manager-overview": "Review escalations",
};

type ContractRelation = { id?: string; title?: string; organization_id?: string } | null;

type PersonaQueueItem = {
  id: string;
  href: string;
  title: string;
  contractTitle?: string;
  ownerLabel?: string;
  dueLabel?: string;
  reason: string;
  actionLabel: string;
  urgency: "blocked" | "overdue" | "due_today" | "high" | "normal";
  dueDate?: string;
};

const urgencyRank = {
  blocked: 0,
  overdue: 1,
  due_today: 2,
  high: 3,
  normal: 4,
} as const;

function relationContract(rel: unknown): ContractRelation {
  return (Array.isArray(rel) ? rel[0] : rel) as ContractRelation;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dueLabel(value: string | null | undefined) {
  return value ? `Due ${String(value).slice(0, 10)}` : undefined;
}

function readableStatus(value: string | null | undefined) {
  return String(value ?? "open").replaceAll("_", " ");
}

function urgencyFrom(status?: string | null, due?: string | null, priority?: string | null): PersonaQueueItem["urgency"] {
  const dueKey = due ? String(due).slice(0, 10) : "";
  const today = todayKey();
  if (status === "blocked") return "blocked";
  if (dueKey && dueKey < today) return "overdue";
  if (dueKey && dueKey === today) return "due_today";
  if (priority === "high") return "high";
  return "normal";
}

function sortQueueItems(items: PersonaQueueItem[]) {
  return [...items].sort((a, b) => {
    const rankDiff = urgencyRank[a.urgency] - urgencyRank[b.urgency];
    if (rankDiff !== 0) return rankDiff;
    const aDue = a.dueDate ?? "9999-12-31";
    const bDue = b.dueDate ?? "9999-12-31";
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    return a.title.localeCompare(b.title);
  });
}

function rowTone(urgency: PersonaQueueItem["urgency"]): OperationalTone {
  if (urgency === "blocked" || urgency === "overdue") return "risk";
  if (urgency === "due_today" || urgency === "high") return "attention";
  return "neutral";
}

export default async function PersonaDashboardPage(props: {
  searchParams: Promise<{ persona?: string }>;
}) {
  if (!isFeatureEnabled("v3PersonaDashboards")) {
    return (
      <div className="ui-card-hero px-6 py-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">Feature flag</p>
        <h1 className="mt-2 text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-[2rem]">Persona dashboard is disabled</h1>
        <p className="mt-3 max-w-xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          This surface is off when <code className="text-xs">ENABLE_V3_PERSONA_DASHBOARDS</code> is set to false, 0, no,
          or off on the server. Unset it to restore the default (on).
        </p>
        <div className="mt-5">
          <Link href="/dashboard" className="ui-btn-secondary px-4 py-2 text-[12.5px]">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { persona: rawPersona } = await props.searchParams;
  const persona = (PERSONAS.find((p) => p.id === rawPersona)?.id ?? "ops") as PersonaId;
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const { admin, orgId, user, role } = ctx;
  const productSurface = await loadProductSurfaceContext(admin, orgId, role as WorkspaceRole);
  const workspaceRole = role as WorkspaceRole;
  if (
    productSurface.mode === "core" &&
    (workspaceRole === "viewer" ||
      workspaceRole === "legal_reviewer" ||
      workspaceRole === "finance_reviewer")
  ) {
    redirect("/dashboard");
  }

  const [contractsRes, tasksRes, obligationsRes, approvalsRes, renewalScenariosRes] = await Promise.all([
    admin
      .from("contracts")
      .select("id, title, health_status, annual_value, owner_id, region, contract_type")
      .eq("organization_id", orgId),
    admin
      .from("contract_tasks")
      .select("id, title, status, priority, assignee_id, due_date, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress", "blocked"]),
    admin
      .from("contract_obligations")
      .select("id, title, status, owner_id, due_date, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress"]),
    admin
      .from("contract_approvals")
      .select("id, status, due_at, contract_id, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .eq("status", "pending"),
    admin
      .from("contract_renewal_scenarios")
      .select("id, contract_id, workspace_status, target_decision_date, blocker, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId),
  ]);

  const contracts = contractsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const obligations = obligationsRes.data ?? [];
  const approvals = approvalsRes.data ?? [];
  const renewalScenarios = renewalScenariosRes.data ?? [];
  const config: PersonaViewConfig = PERSONA_CONFIG[persona];
  const pendingApprovals = approvals.length;
  const atRisk = contracts.filter((c) => c.health_status === "at_risk").length;
  const exposure = contracts.reduce((sum, c) => sum + Number(c.annual_value ?? 0), 0);
  const pendingApprovalRows = approvals.flatMap((row) => {
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
  const highPriorityTasks = tasks
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
          ownerLabel: row.assignee_id === user.id ? "Assigned to you" : undefined,
          dueLabel: dueLabel(row.due_date),
          dueDate: row.due_date ? String(row.due_date).slice(0, 10) : undefined,
          reason: urgency === "blocked" ? "Blocked task" : urgency === "overdue" ? "Overdue task" : urgency === "due_today" ? "Due today" : "High-priority task",
          actionLabel: urgency === "blocked" ? "Resolve blocker" : urgency === "normal" ? "Review task" : "Triage task",
          urgency,
        },
      ];
    });
  const accountOwnerTasks = highPriorityTasks.filter((row) => row.ownerLabel === "Assigned to you");
  const renewalRisks = renewalScenarios
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
          reason: row.blocker ? `Blocker: ${row.blocker}` : `${readableStatus(row.workspace_status)} renewal`,
          actionLabel: urgency === "blocked" ? "Clear blocker" : "Review renewal",
          urgency,
        },
      ];
    });
  const ownerObligations = obligations
    .filter((o) => o.owner_id === user.id)
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
          reason: urgency === "overdue" ? "Overdue obligation" : urgency === "due_today" ? "Obligation due today" : "Open obligation",
          actionLabel: "Review obligation",
          urgency,
        },
      ];
    });
  const personaQueue =
    persona === "legal"
      ? sortQueueItems(pendingApprovalRows).slice(0, 6)
      : persona === "finance"
        ? sortQueueItems(renewalRisks).slice(0, 6)
        : persona === "manager"
          ? sortQueueItems([...renewalRisks, ...pendingApprovalRows]).slice(0, 8)
          : persona === "account_owner"
            ? sortQueueItems([...accountOwnerTasks, ...ownerObligations]).slice(0, 6)
            : sortQueueItems(highPriorityTasks).slice(0, 6);

  const myOpenTasksCount = tasks.filter((t) => t.assignee_id === user.id).length;
  const myOpenObligationsCount = obligations.filter((o) => o.owner_id === user.id).length;
  const highPriorityOpenTasksCount = tasks.filter((t) => t.priority === "high" && t.status !== "done").length;
  const blockedCount = personaQueue.filter((row) => row.urgency === "blocked").length;
  const overdueCount = personaQueue.filter((row) => row.urgency === "overdue").length;
  const dueTodayCount = personaQueue.filter((row) => row.urgency === "due_today").length;
  const highCount = personaQueue.filter((row) => row.urgency === "high").length;
  const renewalBlockersCount = renewalRisks.length;

  type PersonaMetric = {
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

  const actionableChips = [
    { label: "Blocked", value: blockedCount, tone: "risk" as OperationalTone },
    { label: "Overdue", value: overdueCount, tone: "risk" as OperationalTone },
    { label: "Due today", value: dueTodayCount, tone: "attention" as OperationalTone },
    { label: "High priority", value: highCount, tone: "attention" as OperationalTone },
    ...(persona === "legal" || persona === "manager" || persona === "reviewer"
      ? [{ label: "Pending approvals", value: pendingApprovals, tone: "attention" as OperationalTone }]
      : []),
    ...(persona === "finance" || persona === "manager"
      ? [{ label: "Renewal blockers", value: renewalBlockersCount, tone: "risk" as OperationalTone }]
      : []),
    ...(persona === "account_owner" || persona === "ops"
      ? [
          { label: "My tasks", value: myOpenTasksCount, tone: "attention" as OperationalTone },
          { label: "My obligations", value: myOpenObligationsCount, tone: "neutral" as OperationalTone },
        ]
      : []),
    ...(persona === "reviewer" ? [{ label: "High-priority tasks", value: highPriorityOpenTasksCount, tone: "attention" as OperationalTone }] : []),
  ].filter((chip) => chip.value > 0);

  let personaMetrics: PersonaMetric[] = [
    {
      key: "exposure",
      eyebrow: "Portfolio",
      headline: "Annual contract value",
      tone: "neutral" as OperationalTone,
      icon: DollarSign,
      primaryValue: `$${exposure.toLocaleString()}`,
      primaryUnit: "rolled up from contracts",
      action: { href: "/contracts", label: "Browse contracts" },
    },
    {
      key: "at-risk",
      eyebrow: "Health",
      headline: "At-risk contracts",
      tone: "attention" as OperationalTone,
      icon: AlertTriangle,
      primaryValue: atRisk,
      action: { href: "/contracts", label: "Review at-risk" },
    },
  ].filter((m) => {
    if (persona !== "finance" && persona !== "manager" && persona !== "legal" && persona !== "reviewer") return false;
    if (m.key === "exposure") return productSurface.mode !== "core" && exposure > 0 && (persona === "finance" || persona === "manager");
    return productSurface.mode !== "core" && atRisk > 0;
  });

  /** Appendix N / §8.3 — Core keeps execution signals; portfolio/health rollups need Advanced+. */
  if (productSurface.mode === "core") {
    const intelligenceKeys = new Set(["exposure", "at-risk"]);
    personaMetrics = personaMetrics.filter((m) => !intelligenceKeys.has(m.key));
  }

  const showAllClear = personaQueue.length === 0 && actionableChips.length === 0;
  const secondaryNavAction = PERSONA_PRESETS.find((preset) => preset.persona !== persona);

  return (
    <div className="ui-page-stack gap-3">
      <header className="ui-page-shell px-4 py-3.5 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="ui-eyebrow">Persona</p>
            <h1 className="ui-section-title mt-1 text-2xl sm:text-3xl">{config.label}</h1>
            <p className="ui-muted-tight mt-1.5 max-w-2xl text-sm">{config.purpose}</p>
            <Link className="ui-link mt-2 inline-flex text-xs" href="/dashboard">
              Back to default dashboard
            </Link>
          </div>
          <form action="/dashboard/persona" method="get" className="ui-toolbar items-end gap-2">
            <div className="min-w-0">
              <label htmlFor="persona" className="ui-label-caps">
                Persona
              </label>
              <select id="persona" name="persona" defaultValue={persona} className="ui-input min-w-[14rem] max-w-full">
                {PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="ui-btn-secondary px-4 py-2.5 text-[12.5px]">
              Apply persona
            </button>
          </form>
        </div>
      </header>
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="shrink-0">
            <h2 className="ui-section-title text-base">Work views</h2>
          </div>
          <nav aria-label="Work views" className="flex min-w-0 flex-wrap gap-2">
            {PERSONA_PRESETS.map((preset) => {
              const active = preset.persona === persona;
              return (
                <Link
                  key={preset.id}
                  href={preset.href}
                  aria-current={active ? "page" : undefined}
                  className={`ui-operational-focusable rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    active
                      ? "border-[var(--accent-strong)] bg-[var(--accent-strong)] text-[var(--accent-fg)] shadow-[var(--shadow-1)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_72%,transparent)]"
                  }`}
                >
                  {preset.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </section>
      <section className="ui-card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_52%,transparent)] px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="ui-eyebrow">Work queue</p>
              <h2 className="ui-section-title mt-1 text-xl">{config.queueTitle}</h2>
              <p className="ui-muted-tight mt-1 text-[12.5px]">{config.queueDescription}</p>
            </div>
            {actionableChips.length > 0 ? <SeverityMetricStrip items={actionableChips.map((chip) => ({ ...chip, value: String(chip.value) }))} /> : null}
          </div>
        </div>
        <div className="p-3">
          {showAllClear ? (
            <CompressedNormalState
              title={config.emptyMessage}
              description="Switch work views to inspect another queue."
              action={
                secondaryNavAction
                  ? { href: secondaryNavAction.href, label: ALL_CLEAR_ACTION_LABELS[secondaryNavAction.id] }
                  : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {personaQueue.map((row) => {
                const metadata = [row.contractTitle, row.ownerLabel, row.dueLabel].filter(Boolean).join(" · ");
                return (
                  <li key={row.id} className="py-2">
                    <OperationalQueueRow
                      href={row.href}
                      eyebrow={row.reason}
                      title={row.title}
                      hint={metadata}
                      actionLabel={row.actionLabel}
                      tone={rowTone(row.urgency)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
      {personaMetrics.length > 0 ? (
        <section className="space-y-3">
          <div>
            <p className="ui-eyebrow">Summary</p>
            <h2 className="ui-section-title mt-1 text-lg">Advanced portfolio summary</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {personaMetrics.map((m) => (
              <OperationalSummaryCard
                key={m.key}
                eyebrow={m.eyebrow}
                headline={m.headline}
                tone={m.tone}
                icon={m.icon}
                primaryValue={m.primaryValue}
                primaryUnit={m.primaryUnit}
                breakdown={m.breakdown ?? []}
                action={m.action}
                variant="compact"
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
