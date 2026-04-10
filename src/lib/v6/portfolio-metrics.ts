import type { AdminClient } from "@/lib/v6/service";

const IN_CHUNK = 120;

export function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export type V6PortfolioMetrics = {
  open_exceptions: number;
  open_exceptions_in_progress: number;
  pending_approvals: number;
  approvals_past_due: number;
  open_decisions: number;
  active_campaigns: number;
  open_tasks: number;
  overdue_tasks: number;
  contracts_without_owner: number;
  open_external_links: number;
  attestation_gaps: number;
  /** Contracts in active/pending_review with stale ownership vs org settings (simplified: no owner) */
  evidence_stale_proxy: number;
  /** Mean overall_score across assurance_scorecards rows (null if none) */
  avg_assurance_score: number | null;
  /** Mean renewal_readiness dimension when present on scorecards */
  avg_renewal_readiness: number | null;
  /** Obligations past due_date with open/in_progress status */
  obligations_overdue: number;
  /** Active/paused campaigns flagged with drift in v6_effectiveness_json */
  campaigns_with_drift_concern: number;
  /** Relationship timelines with non-empty v6 risk propagation */
  relationship_risk_signals: number;
  /** Exception types with three or more open rows (recurrence / cluster signal) */
  repeat_exception_type_clusters: number;
  /** Program scorecards (type program) with overall_score below weak threshold */
  low_health_program_scorecards: number;
};

/**
 * Grounded counts for assurance checks and policy evaluation (org-scoped).
 */
export async function gatherPortfolioMetrics(admin: AdminClient, orgId: string): Promise<V6PortfolioMetrics> {
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [
    exOpen,
    exProgress,
    pendApp,
    pastDueApp,
    decisions,
    campaigns,
    tasks,
    overdueTasks,
    noOwner,
    extLinks,
    attest,
    evidenceStale,
    scorecards,
    obligationsOverdue,
    campaignRows,
    relRiskCount,
    exTypesOpen,
    weakProgramScorecards,
  ] = await Promise.all([
    admin
      .from("exceptions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "open"),
    admin
      .from("exceptions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "in_progress"),
    admin
      .from("contract_approvals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "pending"),
    admin
      .from("contract_approvals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .not("due_at", "is", null)
      .lt("due_at", nowIso),
    admin
      .from("decision_workspaces")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["open", "in_review"]),
    admin
      .from("portfolio_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["active", "paused"]),
    admin
      .from("contract_tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress", "blocked"]),
    admin
      .from("contract_tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress", "blocked"])
      .not("due_date", "is", null)
      .lt("due_date", today),
    admin
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["active", "pending_review"])
      .is("owner_id", null),
    admin
      .from("external_action_links")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "open"),
    admin
      .from("attestation_requests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["open", "overdue"]),
    admin
      .from("evidence_submissions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "submitted")
      .lt("submitted_at", ninetyDaysAgo),
    admin
      .from("assurance_scorecards")
      .select("overall_score, dimensions_json")
      .eq("organization_id", orgId)
      .limit(200),
    admin
      .from("contract_obligations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress"])
      .not("due_date", "is", null)
      .lt("due_date", today),
    admin
      .from("portfolio_campaigns")
      .select("v6_effectiveness_json")
      .eq("organization_id", orgId)
      .in("status", ["active", "paused"])
      .limit(80),
    admin
      .from("relationship_timelines")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .neq("v6_risk_propagation_json", {}),
    admin
      .from("exceptions")
      .select("exception_type")
      .eq("organization_id", orgId)
      .eq("status", "open")
      .limit(500),
    admin
      .from("assurance_scorecards")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("scorecard_type", "program")
      .lt("overall_score", 52),
  ]);

  let avg_assurance_score: number | null = null;
  let avg_renewal_readiness: number | null = null;
  const scRows = scorecards.data ?? [];
  if (scRows.length > 0) {
    const scores = scRows.map((r) => Number((r as { overall_score?: unknown }).overall_score)).filter((n) => Number.isFinite(n));
    if (scores.length > 0) {
      avg_assurance_score = scores.reduce((a, b) => a + b, 0) / scores.length;
    }
    const renew = scRows
      .map((r) => {
        const d = (r as { dimensions_json?: Record<string, unknown> }).dimensions_json;
        const v = d?.renewal_readiness;
        return typeof v === "number" ? v : null;
      })
      .filter((n): n is number => n != null);
    if (renew.length > 0) {
      avg_renewal_readiness = renew.reduce((a, b) => a + b, 0) / renew.length;
    }
  }

  let campaigns_with_drift_concern = 0;
  const cr = campaignRows.data ?? [];
  for (const row of cr) {
    const j = (row as { v6_effectiveness_json?: Record<string, unknown> }).v6_effectiveness_json;
    if (j && typeof j === "object" && (j.drift_detected === true || typeof j.drift_score === "number")) {
      campaigns_with_drift_concern += 1;
    }
  }

  const exTypeRows = exTypesOpen.data;
  const typeCounts = new Map<string, number>();
  for (const row of (exTypeRows as { exception_type?: string }[] | null) ?? []) {
    const t = String(row.exception_type ?? "unknown");
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }
  const repeat_exception_type_clusters = [...typeCounts.values()].filter((n) => n >= 3).length;

  return {
    open_exceptions: exOpen.count ?? 0,
    open_exceptions_in_progress: exProgress.count ?? 0,
    pending_approvals: pendApp.count ?? 0,
    approvals_past_due: pastDueApp.count ?? 0,
    open_decisions: decisions.count ?? 0,
    active_campaigns: campaigns.count ?? 0,
    open_tasks: tasks.count ?? 0,
    overdue_tasks: overdueTasks.count ?? 0,
    contracts_without_owner: noOwner.count ?? 0,
    open_external_links: extLinks.count ?? 0,
    attestation_gaps: attest.count ?? 0,
    evidence_stale_proxy: evidenceStale.count ?? 0,
    avg_assurance_score,
    avg_renewal_readiness,
    obligations_overdue: obligationsOverdue.count ?? 0,
    campaigns_with_drift_concern,
    relationship_risk_signals: relRiskCount.count ?? 0,
    repeat_exception_type_clusters,
    low_health_program_scorecards: weakProgramScorecards.count ?? 0,
  };
}

const SCOPED_CONTRACT_CAP = 500;

/**
 * Portfolio metrics restricted to a set of contracts (for assignment-scoped control policies).
 * Contract IDs are de-duplicated and capped for query safety.
 */
export async function gatherPortfolioMetricsForContractIds(
  admin: AdminClient,
  orgId: string,
  contractIds: string[]
): Promise<V6PortfolioMetrics> {
  const ids = [...new Set(contractIds.map(String))].filter(Boolean).slice(0, SCOPED_CONTRACT_CAP);

  if (ids.length === 0) {
    return {
      open_exceptions: 0,
      open_exceptions_in_progress: 0,
      pending_approvals: 0,
      approvals_past_due: 0,
      open_decisions: 0,
      active_campaigns: 0,
      open_tasks: 0,
      overdue_tasks: 0,
      contracts_without_owner: 0,
      open_external_links: 0,
      attestation_gaps: 0,
      evidence_stale_proxy: 0,
      avg_assurance_score: null,
      avg_renewal_readiness: null,
      obligations_overdue: 0,
      campaigns_with_drift_concern: 0,
      relationship_risk_signals: 0,
      repeat_exception_type_clusters: 0,
      low_health_program_scorecards: 0,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  async function sumCount(
    run: (part: string[]) => Promise<{ count: number | null }>
  ): Promise<number> {
    let t = 0;
    for (const part of chunkIds(ids, IN_CHUNK)) {
      const { count } = await run(part);
      t += count ?? 0;
    }
    return t;
  }

  const [
    exOpen,
    exProgress,
    pendApp,
    pastDueApp,
    tasks,
    overdueTasks,
    noOwner,
    attest,
    evidenceStale,
    obligationsOverdue,
  ] = await Promise.all([
    sumCount(async (part) =>
      admin
        .from("exceptions")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "open")
        .in("contract_id", part)
    ),
    sumCount(async (part) =>
      admin
        .from("exceptions")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "in_progress")
        .in("contract_id", part)
    ),
    sumCount(async (part) =>
      admin
        .from("contract_approvals")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "pending")
        .in("contract_id", part)
    ),
    sumCount(async (part) =>
      admin
        .from("contract_approvals")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "pending")
        .not("due_at", "is", null)
        .lt("due_at", nowIso)
        .in("contract_id", part)
    ),
    sumCount(async (part) =>
      admin
        .from("contract_tasks")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["open", "in_progress", "blocked"])
        .in("contract_id", part)
    ),
    sumCount(async (part) =>
      admin
        .from("contract_tasks")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["open", "in_progress", "blocked"])
        .not("due_date", "is", null)
        .lt("due_date", today)
        .in("contract_id", part)
    ),
    sumCount(async (part) =>
      admin
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["active", "pending_review"])
        .is("owner_id", null)
        .in("id", part)
    ),
    sumCount(async (part) =>
      admin
        .from("attestation_requests")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["open", "overdue"])
        .in("contract_id", part)
    ),
    sumCount(async (part) =>
      admin
        .from("evidence_submissions")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "submitted")
        .lt("submitted_at", ninetyDaysAgo)
        .in("contract_id", part)
    ),
    sumCount(async (part) =>
      admin
        .from("contract_obligations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["open", "in_progress"])
        .not("due_date", "is", null)
        .lt("due_date", today)
        .in("contract_id", part)
    ),
  ]);

  const { count: openDecisions } = await admin
    .from("decision_workspaces")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .in("status", ["open", "in_review"])
    .overlaps("linked_contract_ids", ids);

  const { data: campaignLinks } = await admin
    .from("portfolio_campaign_contracts")
    .select("campaign_id")
    .eq("organization_id", orgId)
    .in("contract_id", ids)
    .limit(2000);

  const campaignIdSet = new Set(
    (campaignLinks ?? []).map((r) => String((r as { campaign_id: string }).campaign_id))
  );
  const campaignIds = [...campaignIdSet];

  let active_campaigns = 0;
  let campaigns_with_drift_concern = 0;
  if (campaignIds.length > 0) {
    const { data: campRows } = await admin
      .from("portfolio_campaigns")
      .select("id, status, v6_effectiveness_json")
      .eq("organization_id", orgId)
      .in("id", campaignIds.slice(0, 200))
      .in("status", ["active", "paused"]);
    for (const row of campRows ?? []) {
      active_campaigns += 1;
      const j = (row as { v6_effectiveness_json?: Record<string, unknown> }).v6_effectiveness_json;
      if (j && typeof j === "object" && (j.drift_detected === true || typeof j.drift_score === "number")) {
        campaigns_with_drift_concern += 1;
      }
    }
  }

  const { data: linkRows } = await admin
    .from("external_action_links")
    .select("id, scope_json")
    .eq("organization_id", orgId)
    .eq("status", "open")
    .limit(400);

  const idSet = new Set(ids);
  let open_external_links = 0;
  for (const row of linkRows ?? []) {
    const scope = (row as { scope_json?: Record<string, unknown> }).scope_json ?? {};
    const cid = scope.contract_id;
    if (typeof cid === "string" && idSet.has(cid)) open_external_links += 1;
  }

  const { data: contractRows } = await admin
    .from("contracts")
    .select("account_key")
    .eq("organization_id", orgId)
    .in("id", ids)
    .limit(SCOPED_CONTRACT_CAP);

  const accountKeys = [
    ...new Set(
      (contractRows ?? [])
        .map((r) => (r as { account_key?: string | null }).account_key)
        .filter((k): k is string => typeof k === "string" && k.length > 0)
    ),
  ];

  let avg_assurance_score: number | null = null;
  let avg_renewal_readiness: number | null = null;
  if (accountKeys.length > 0) {
    const { data: scoreRows } = await admin
      .from("assurance_scorecards")
      .select("overall_score, dimensions_json")
      .eq("organization_id", orgId)
      .eq("scorecard_type", "account")
      .in("entity_ref_id", accountKeys.slice(0, 100))
      .limit(200);
    const scRows = scoreRows ?? [];
    if (scRows.length > 0) {
      const scores = scRows
        .map((r) => Number((r as { overall_score?: unknown }).overall_score))
        .filter((n) => Number.isFinite(n));
      if (scores.length > 0) {
        avg_assurance_score = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
      const renew = scRows
        .map((r) => {
          const d = (r as { dimensions_json?: Record<string, unknown> }).dimensions_json;
          const v = d?.renewal_readiness;
          return typeof v === "number" ? v : null;
        })
        .filter((n): n is number => n != null);
      if (renew.length > 0) {
        avg_renewal_readiness = renew.reduce((a, b) => a + b, 0) / renew.length;
      }
    }
  }

  let relationship_risk_signals = 0;
  if (accountKeys.length > 0) {
    const { data: wsRows } = await admin
      .from("account_workspaces")
      .select("id")
      .eq("organization_id", orgId)
      .in("account_key", accountKeys.slice(0, 100));
    const wsIds = (wsRows ?? []).map((r) => String((r as { id: string }).id));
    if (wsIds.length > 0) {
      const { count } = await admin
        .from("relationship_timelines")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("account_workspace_id", wsIds)
        .neq("v6_risk_propagation_json", {});
      relationship_risk_signals = count ?? 0;
    }
  }

  let repeat_exception_type_clusters = 0;
  const typeScoped = new Map<string, number>();
  for (const part of chunkIds(ids, IN_CHUNK)) {
    const { data: exRows } = await admin
      .from("exceptions")
      .select("exception_type")
      .eq("organization_id", orgId)
      .eq("status", "open")
      .in("contract_id", part)
      .limit(300);
    for (const row of exRows ?? []) {
      const t = String((row as { exception_type?: string }).exception_type ?? "unknown");
      typeScoped.set(t, (typeScoped.get(t) ?? 0) + 1);
    }
  }
  repeat_exception_type_clusters = [...typeScoped.values()].filter((n) => n >= 3).length;

  const { data: progAssigns } = await admin
    .from("contract_program_assignments")
    .select("program_id")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .in("contract_id", ids)
    .limit(400);
  const scopedProgramIds = [
    ...new Set((progAssigns ?? []).map((r) => String((r as { program_id: string }).program_id))),
  ];
  let low_health_program_scorecards = 0;
  if (scopedProgramIds.length > 0) {
    const { count } = await admin
      .from("assurance_scorecards")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("scorecard_type", "program")
      .lt("overall_score", 52)
      .in("entity_ref_id", scopedProgramIds.slice(0, 120));
    low_health_program_scorecards = count ?? 0;
  }

  return {
    open_exceptions: exOpen,
    open_exceptions_in_progress: exProgress,
    pending_approvals: pendApp,
    approvals_past_due: pastDueApp,
    open_decisions: openDecisions ?? 0,
    active_campaigns,
    open_tasks: tasks,
    overdue_tasks: overdueTasks,
    contracts_without_owner: noOwner,
    open_external_links,
    attestation_gaps: attest,
    evidence_stale_proxy: evidenceStale,
    avg_assurance_score,
    avg_renewal_readiness,
    obligations_overdue: obligationsOverdue,
    campaigns_with_drift_concern,
    relationship_risk_signals,
    repeat_exception_type_clusters,
    low_health_program_scorecards,
  };
}
