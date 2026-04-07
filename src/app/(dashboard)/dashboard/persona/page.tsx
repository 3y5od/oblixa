import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";

const PERSONAS = [
  { id: "ops", label: "Ops lead" },
  { id: "finance", label: "Finance" },
  { id: "legal", label: "Legal reviewer" },
  { id: "account_owner", label: "Account owner" },
  { id: "reviewer", label: "Contract coordinator" },
  { id: "manager", label: "Founder / manager" },
] as const;

type PersonaId = (typeof PERSONAS)[number]["id"];

export default async function PersonaDashboardPage(props: {
  searchParams: Promise<{ persona?: string }>;
}) {
  const { persona: rawPersona } = await props.searchParams;
  const persona = (PERSONAS.find((p) => p.id === rawPersona)?.id ?? "ops") as PersonaId;
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const { admin, orgId, user } = ctx;

  const [contractsRes, tasksRes, obligationsRes, approvalsRes] = await Promise.all([
    admin.from("contracts").select("id, health_status, annual_value").eq("organization_id", orgId),
    admin
      .from("contract_tasks")
      .select("id, status, priority, assignee_id")
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress", "blocked"]),
    admin
      .from("contract_obligations")
      .select("id, status, owner_id")
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress"]),
    admin
      .from("contract_approvals")
      .select("id, status")
      .eq("organization_id", orgId)
      .eq("status", "pending"),
  ]);

  const contracts = contractsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const obligations = obligationsRes.data ?? [];
  const pendingApprovals = approvalsRes.data?.length ?? 0;
  const atRisk = contracts.filter((c) => c.health_status === "at_risk").length;
  const exposure = contracts.reduce((sum, c) => sum + Number(c.annual_value ?? 0), 0);

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
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <section key={card.label} className="ui-card px-5 py-4">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">{card.value}</p>
          </section>
        ))}
      </div>
      <div className="text-sm text-zinc-500">
        <Link className="ui-link" href="/dashboard">
          Back to default dashboard
        </Link>
      </div>
    </div>
  );
}
