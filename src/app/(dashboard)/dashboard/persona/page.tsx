import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { isFeatureEnabled } from "@/lib/feature-flags";

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
  const { admin, orgId, user } = ctx;

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

  const cards =
    persona === "finance"
      ? [
          { label: "Portfolio annual value", value: `$${exposure.toLocaleString()}` },
          { label: "Contracts at risk", value: String(atRisk) },
          { label: "Pending approvals", value: String(pendingApprovals) },
        ]
      : persona === "legal"
        ? [
            { label: "Pending approvals", value: String(pendingApprovals) },
            { label: "Open obligations", value: String(obligations.length) },
            { label: "At-risk contracts", value: String(atRisk) },
          ]
        : persona === "account_owner"
          ? [
              {
                label: "My open tasks",
                value: String(tasks.filter((t) => t.assignee_id === user.id).length),
              },
              {
                label: "My blocked tasks",
                value: String(
                  tasks.filter((t) => t.assignee_id === user.id && t.status === "blocked")
                    .length
                ),
              },
              {
                label: "My open obligations",
                value: String(obligations.filter((o) => o.owner_id === user.id).length),
              },
            ]
          : persona === "reviewer"
            ? [
                {
                  label: "High-priority open tasks",
                  value: String(
                    tasks.filter((t) => t.priority === "high" && t.status !== "done").length
                  ),
                },
                { label: "Pending approvals", value: String(pendingApprovals) },
                { label: "At-risk contracts", value: String(atRisk) },
              ]
            : persona === "manager"
              ? [
                  { label: "Portfolio annual value", value: `$${exposure.toLocaleString()}` },
                  { label: "At-risk contracts", value: String(atRisk) },
                  { label: "Open obligations", value: String(obligations.length) },
                ]
        : [
            { label: "Open tasks", value: String(tasks.length) },
            {
              label: "My open tasks",
              value: String(tasks.filter((t) => t.assignee_id === user.id).length),
            },
            { label: "My open obligations", value: String(obligations.filter((o) => o.owner_id === user.id).length) },
          ];

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
        <h2 className="ui-section-title text-base">Preset command views</h2>
        <p className="mt-1 text-sm text-zinc-500">
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
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
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
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <section key={card.label} className="ui-card px-5 py-4">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">{card.value}</p>
          </section>
        ))}
      </div>
      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-800">Persona action queue</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {persona === "legal"
              ? "Why: approvals are the highest leverage legal bottleneck."
              : persona === "finance"
                ? "Why: blocked renewals and decision windows drive revenue risk."
                : persona === "manager"
                  ? "Why: aggregate risk and unresolved approvals determine weekly posture."
                  : "Why: high-priority and blocked execution items are most likely to slip."}
          </p>
        </div>
        <ul className="divide-y divide-zinc-100">
          {personaQueue.length === 0 ? (
            <li className="px-5 py-4 text-sm text-zinc-500">No queue items in this persona view.</li>
          ) : (
            personaQueue.map((row) => (
              <li key={row.id} className="px-5 py-3">
                <Link href={row.href} className="text-sm font-medium text-zinc-800 hover:text-zinc-900">
                  {row.label}
                </Link>
                <p className="mt-0.5 text-xs text-zinc-500">{row.meta}</p>
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
