import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ClipboardList,
  DollarSign,
  ListChecks,
  Stamp,
  Target,
  UserCircle,
} from "lucide-react";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { isFeatureEnabled } from "@/lib/feature-flags";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import {
  OperationalQueueRow,
  OperationalSectionHeader,
  OperationalSummaryCard,
} from "@/components/ui/operational-summary-card";
import type { OperationalTone } from "@/lib/ui/operational-surface";

const PERSONAS = [
  { id: "ops", label: "Ops lead" },
  { id: "finance", label: "Finance" },
  { id: "legal", label: "Legal reviewer" },
  { id: "account_owner", label: "Account owner" },
  { id: "reviewer", label: "Contract coordinator" },
  { id: "manager", label: "Founder / manager" },
] as const;

type PersonaId = (typeof PERSONAS)[number]["id"];

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

export default async function PersonaDashboardPage(props: {
  searchParams: Promise<{ persona?: string }>;
}) {
  if (!isFeatureEnabled("v3PersonaDashboards")) {
    return (
      <div className="ui-card px-6 py-8">
        <p className="ui-eyebrow">Feature flag</p>
        <h1 className="ui-display-title mt-2">Persona dashboard is disabled</h1>
        <p className="mt-3 max-w-xl text-sm text-zinc-500">
          This surface is off when <code className="text-xs">ENABLE_V3_PERSONA_DASHBOARDS</code> is set to false, 0, no,
          or off on the server. Unset it to restore the default (on).
        </p>
        <div className="mt-5">
          <Link href="/dashboard" className="ui-btn-secondary px-4 py-2 text-[13px]">
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
  const pendingApprovals = approvalsRes.data?.length ?? 0;
  const atRisk = contracts.filter((c) => c.health_status === "at_risk").length;
  const exposure = contracts.reduce((sum, c) => sum + Number(c.annual_value ?? 0), 0);
  const pendingApprovalRows = (approvalsRes.data ?? []).slice(0, 6).flatMap((row) => {
    const rel = row.contracts as unknown;
    const contract = (Array.isArray(rel) ? rel[0] : rel) as
      | { id?: string; title?: string; organization_id?: string }
      | null;
    if (!contract?.id) return [];
    return [
      {
        id: row.id,
        href: `/contracts/${contract.id}`,
        label: contract.title ?? "Contract",
        meta: row.due_at ? `Due ${String(row.due_at).slice(0, 10)}` : "No due date",
      },
    ];
  });
  const highPriorityTasks = tasks
    .filter((t) => t.priority === "high" || t.status === "blocked")
    .slice(0, 6)
    .flatMap((row) => {
      const rel = row.contracts as unknown;
      const contract = (Array.isArray(rel) ? rel[0] : rel) as
        | { id?: string; title?: string; organization_id?: string }
        | null;
      if (!contract?.id) return [];
      return [
        {
          id: row.id,
          href: `/contracts/${contract.id}`,
          label: row.title,
          meta: `${row.status} · ${row.priority}${row.due_date ? ` · due ${row.due_date}` : ""}`,
        },
      ];
    });
  const renewalRisks = (renewalScenariosRes.data ?? [])
    .filter((r) => r.workspace_status === "blocked" || !!r.blocker)
    .slice(0, 6)
    .flatMap((row) => {
      const rel = row.contracts as unknown;
      const contract = (Array.isArray(rel) ? rel[0] : rel) as
        | { id?: string; title?: string; organization_id?: string }
        | null;
      if (!contract?.id) return [];
      return [
        {
          id: row.id,
          href: `/contracts/${contract.id}`,
          label: contract.title ?? "Contract",
          meta: row.blocker ? `Blocker: ${row.blocker}` : `Status: ${row.workspace_status}`,
        },
      ];
    });
  const personaQueue =
    persona === "legal"
      ? pendingApprovalRows
      : persona === "finance"
        ? renewalRisks
        : persona === "manager"
          ? [...renewalRisks, ...pendingApprovalRows].slice(0, 8)
          : highPriorityTasks;

  const myOpenTasksCount = tasks.filter((t) => t.assignee_id === user.id).length;
  const myBlockedTasksCount = tasks.filter((t) => t.assignee_id === user.id && t.status === "blocked").length;
  const myOpenObligationsCount = obligations.filter((o) => o.owner_id === user.id).length;
  const highPriorityOpenTasksCount = tasks.filter((t) => t.priority === "high" && t.status !== "done").length;

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

  let personaMetrics: PersonaMetric[] = [];
  if (persona === "finance") {
    personaMetrics = [
      {
        key: "exposure",
        eyebrow: "Portfolio",
        headline: "Annual contract value",
        tone: "neutral",
        icon: DollarSign,
        primaryValue: `$${exposure.toLocaleString()}`,
        primaryUnit: "rolled up from contracts",
        action: { href: "/contracts", label: "View contracts" },
      },
      {
        key: "at-risk",
        eyebrow: "Health",
        headline: "Contracts at risk",
        tone: atRisk > 0 ? "attention" : "healthy",
        icon: AlertTriangle,
        primaryValue: atRisk,
        action: { href: "/contracts", label: "Review at-risk" },
      },
      {
        key: "approvals",
        eyebrow: "Sign-off",
        headline: "Pending approvals",
        tone: pendingApprovals > 0 ? "attention" : "healthy",
        icon: Stamp,
        primaryValue: pendingApprovals,
        action: { href: "/contracts/approvals", label: "View approvals" },
      },
    ];
  } else if (persona === "legal") {
    personaMetrics = [
      {
        key: "approvals",
        eyebrow: "Sign-off",
        headline: "Pending approvals",
        tone: pendingApprovals > 0 ? "attention" : "healthy",
        icon: Stamp,
        primaryValue: pendingApprovals,
        action: { href: "/contracts/approvals", label: "View approvals" },
      },
      {
        key: "obligations",
        eyebrow: "Commitments",
        headline: "Open obligations",
        tone: obligations.length > 0 ? "neutral" : "healthy",
        icon: ListChecks,
        primaryValue: obligations.length,
        action: { href: "/contracts/obligations", label: "View obligations" },
      },
      {
        key: "at-risk",
        eyebrow: "Health",
        headline: "At-risk contracts",
        tone: atRisk > 0 ? "attention" : "healthy",
        icon: AlertTriangle,
        primaryValue: atRisk,
        action: { href: "/contracts", label: "View contracts" },
      },
    ];
  } else if (persona === "account_owner") {
    personaMetrics = [
      {
        key: "my-tasks",
        eyebrow: "You",
        headline: "Open tasks",
        tone: myOpenTasksCount > 0 ? "attention" : "healthy",
        icon: ClipboardList,
        primaryValue: myOpenTasksCount,
        action: { href: "/contracts/tasks", label: "View tasks" },
      },
      {
        key: "blocked",
        eyebrow: "You",
        headline: "Blocked tasks",
        tone: myBlockedTasksCount > 0 ? "risk" : "healthy",
        icon: Target,
        primaryValue: myBlockedTasksCount,
        action: { href: "/contracts/tasks", label: "Unblock work" },
      },
      {
        key: "my-obligations",
        eyebrow: "You",
        headline: "Open obligations",
        tone: myOpenObligationsCount > 0 ? "neutral" : "healthy",
        icon: ListChecks,
        primaryValue: myOpenObligationsCount,
        action: { href: "/contracts/obligations", label: "View obligations" },
      },
    ];
  } else if (persona === "reviewer") {
    personaMetrics = [
      {
        key: "hi-pri",
        eyebrow: "Triage",
        headline: "High-priority tasks",
        tone: highPriorityOpenTasksCount > 0 ? "attention" : "healthy",
        icon: ClipboardList,
        primaryValue: highPriorityOpenTasksCount,
        action: { href: "/contracts/tasks", label: "View tasks" },
      },
      {
        key: "approvals",
        eyebrow: "Sign-off",
        headline: "Pending approvals",
        tone: pendingApprovals > 0 ? "attention" : "healthy",
        icon: Stamp,
        primaryValue: pendingApprovals,
        action: { href: "/contracts/approvals", label: "View approvals" },
      },
      {
        key: "at-risk",
        eyebrow: "Health",
        headline: "At-risk contracts",
        tone: atRisk > 0 ? "attention" : "healthy",
        icon: AlertTriangle,
        primaryValue: atRisk,
        action: { href: "/contracts", label: "View contracts" },
      },
    ];
  } else if (persona === "manager") {
    personaMetrics = [
      {
        key: "exposure",
        eyebrow: "Portfolio",
        headline: "Annual contract value",
        tone: "neutral",
        icon: DollarSign,
        primaryValue: `$${exposure.toLocaleString()}`,
        primaryUnit: "rolled up from contracts",
        action: { href: "/contracts", label: "View contracts" },
      },
      {
        key: "at-risk",
        eyebrow: "Health",
        headline: "At-risk contracts",
        tone: atRisk > 0 ? "attention" : "healthy",
        icon: AlertTriangle,
        primaryValue: atRisk,
        action: { href: "/contracts", label: "Review at-risk" },
      },
      {
        key: "obligations",
        eyebrow: "Commitments",
        headline: "Open obligations",
        tone: obligations.length > 0 ? "neutral" : "healthy",
        icon: ListChecks,
        primaryValue: obligations.length,
        action: { href: "/contracts/obligations", label: "View obligations" },
      },
    ];
  } else {
    personaMetrics = [
      {
        key: "open-tasks",
        eyebrow: "Team",
        headline: "Open tasks",
        tone: tasks.length > 0 ? "neutral" : "healthy",
        icon: ClipboardList,
        primaryValue: tasks.length,
        action: { href: "/contracts/tasks", label: "View tasks" },
      },
      {
        key: "my-open",
        eyebrow: "You",
        headline: "My open tasks",
        tone: myOpenTasksCount > 0 ? "attention" : "healthy",
        icon: UserCircle,
        primaryValue: myOpenTasksCount,
        action: { href: "/work", label: "Open work queue" },
      },
      {
        key: "my-obligations",
        eyebrow: "You",
        headline: "My open obligations",
        tone: myOpenObligationsCount > 0 ? "neutral" : "healthy",
        icon: ListChecks,
        primaryValue: myOpenObligationsCount,
        action: { href: "/contracts/obligations", label: "View obligations" },
      },
    ];
  }

  /** Appendix N / §8.3 — Core keeps execution signals; portfolio/health rollups need Advanced+. */
  if (productSurface.mode === "core") {
    const intelligenceKeys = new Set(["exposure", "at-risk"]);
    personaMetrics = personaMetrics.filter((m) => !intelligenceKeys.has(m.key));
  }

  const queueDescription =
    persona === "legal"
      ? "Surface pending sign-offs before downstream work stalls."
      : persona === "finance"
        ? "Prioritize blocked renewals and approaching decision dates."
        : persona === "manager"
          ? productSurface.mode === "core"
            ? "Track approvals and obligations in one lane."
            : "Track portfolio risk and unresolved approvals in one lane."
          : "Focus on high-priority and blocked execution items.";

  return (
    <div className="space-y-8">
      <header className="border-b border-zinc-200/60 pb-8">
        <p className="ui-eyebrow">Role-based views</p>
        <h1 className="ui-display-title mt-2">Persona dashboard</h1>
        <p className="mt-3 max-w-2xl text-[15px] text-zinc-500">
          A focused view tuned for different operating roles.
        </p>
      </header>
      <form action="/dashboard/persona" method="get" className="flex items-end gap-3">
        <div>
          <label htmlFor="persona" className="ui-label-caps">
            Persona
          </label>
          <select id="persona" name="persona" defaultValue={persona} className="ui-input min-w-[14rem]">
            {PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="ui-btn-primary px-5 py-2.5 text-[13px]">
          Switch view
        </button>
      </form>
      <section className="ui-card p-5">
        <p className="ui-eyebrow">Shortcuts</p>
        <h2 className="ui-section-title mt-1 text-base">Preset command views</h2>
        <p className="ui-muted-tight mt-1 text-[13px]">
          Quick role presets for recurring operating cadences.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PERSONA_PRESETS.map((preset) => (
            <Link
              key={preset.id}
              href={preset.href}
              className={`rounded-xl border px-4 py-3 text-sm transition-colors ${
                preset.persona === persona
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-surface text-zinc-700 hover:bg-zinc-50/90"
              }`}
            >
              <p className="font-semibold">{preset.label}</p>
              <p className={`mt-1 text-xs ${preset.persona === persona ? "text-zinc-200" : "text-zinc-500"}`}>
                {preset.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Signals</p>
          <h2 className="ui-section-title mt-2 text-xl">Persona metrics</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
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
      <section className="ui-card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] bg-zinc-50/60 px-5 py-4">
          <OperationalSectionHeader eyebrow="Queue" title="Persona action queue" description={queueDescription} />
        </div>
        <ul className="divide-y divide-[var(--border-subtle)] p-3">
          {personaQueue.length === 0 ? (
            <li className="px-2 py-4 text-sm text-zinc-500">No queue items in this persona view.</li>
          ) : (
            personaQueue.map((row) => (
              <li key={row.id} className="py-2">
                <OperationalQueueRow
                  href={row.href}
                  eyebrow="Next"
                  title={row.label}
                  hint={row.meta}
                  actionLabel="Open item"
                  tone="neutral"
                />
              </li>
            ))
          )}
        </ul>
      </section>
      <div className="text-sm text-zinc-500">
        <Link className="ui-link" href="/dashboard">
          Back to default dashboard
        </Link>
      </div>
    </div>
  );
}
