import type { AdminClient } from "@/lib/v6/service";
import { nowIso } from "@/lib/v5/api";
import { collectSupabaseRangePages, type SupabaseRangePage } from "@/lib/supabase/range-pagination";
import type { BatchItemError } from "@/lib/route-runtime-contract";

const LARGE_PAGE_SIZE = 500;
const SMALL_PAGE_SIZE = 200;
const LARGE_MAX_ROWS = 10_000;
const MEDIUM_MAX_ROWS = 5_000;
const SMALL_MAX_ROWS = 1_000;
const ID_CHUNK_SIZE = 200;

type ScorecardRow = {
  id: string;
  scorecard_type: string;
  entity_ref_id: string;
  overall_score: number | string;
};
type PolicyRow = { id: string; name?: string | null; status?: string | null };
type CampaignRow = {
  id: string;
  name?: string | null;
  status?: string | null;
  v6_effectiveness_json?: { drift_score?: number } | null;
};
type OwnerContractRow = { owner_id: string };
type TeamTaskRow = { team_key?: string | null };
type CounterpartyAccountRow = { counterparty?: string | null; account_key?: string | null };
type DecisionRow = { id: string; title?: string | null; status?: string | null; decision_type?: string | null };
type ExceptionRow = { id: string; title?: string | null; exception_type?: string | null; severity?: string | null };
type EvidenceRequirementRow = { contract_id?: string | null };
type FindingRow = {
  id: string;
  title?: string | null;
  severity?: string | null;
  finding_type?: string | null;
  linked_entities_json?: unknown;
};
type ContractMetaRow = {
  id: string;
  name?: string | null;
  counterparty?: string | null;
  account_key?: string | null;
};

type HealthGraphResult = {
  nodes: number;
  edges: number;
  attemptedNodes: number;
  attemptedEdges: number;
  errors: BatchItemError[];
};

function graphError(
  scope: string,
  phase: BatchItemError["phase"],
  diagnosticId: string,
  message: string
): BatchItemError {
  return { scope, phase, diagnostic_id: diagnosticId, message };
}

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size) as T[]);
  }
  return chunks;
}

function riskFromSeverity(sev: string | null | undefined): number {
  const s = String(sev ?? "").toLowerCase();
  if (s === "critical") return 90;
  if (s === "high") return 74;
  if (s === "medium") return 52;
  if (s === "low") return 32;
  return 44;
}

async function collectRows<T>(input: {
  fetchPage: (from: number, to: number) => PromiseLike<SupabaseRangePage<T>>;
  errors: BatchItemError[];
  scope: string;
  queryDiagnosticId: string;
  truncateDiagnosticId: string;
  pageSize: number;
  maxRows: number;
}): Promise<T[]> {
  const result = await collectSupabaseRangePages<T>(input.fetchPage, {
    pageSize: input.pageSize,
    maxRows: input.maxRows,
  });
  if (result.error) {
    input.errors.push(graphError(input.scope, "source_query", input.queryDiagnosticId, result.error.message));
  }
  if (result.truncated) {
    input.errors.push(
      graphError(
        input.scope,
        "source_query",
        input.truncateDiagnosticId,
        `source scan exceeded ${input.maxRows} rows`
      )
    );
  }
  return result.rows;
}

/**
 * Build portfolio health graph nodes from scorecards and edges for shared-risk relationships.
 */
export async function rebuildHealthGraphFromPortfolio(
  admin: AdminClient,
  orgId: string
): Promise<HealthGraphResult> {
  const errors: BatchItemError[] = [];
  let nodes = 0;
  let edges = 0;
  let attemptedNodes = 0;
  let attemptedEdges = 0;
  const nodeIdByKey = new Map<string, string>();

  const upsertNode = async (input: {
    key: string;
    scope: string;
    diagnosticId: string;
    payload: Record<string, unknown>;
  }): Promise<string | null> => {
    attemptedNodes += 1;
    const result = await admin
      .from("portfolio_health_graph_nodes")
      .upsert(input.payload, { onConflict: "organization_id,node_type,node_ref_id" })
      .select("id")
      .single();
    if (result.error || !result.data?.id) {
      errors.push(
        graphError(
          input.scope,
          "persist",
          input.diagnosticId,
          result.error?.message ?? "node upsert did not return an id"
        )
      );
      return null;
    }
    const nodeId = String(result.data.id);
    nodeIdByKey.set(input.key, nodeId);
    nodes += 1;
    return nodeId;
  };

  const upsertEdge = async (input: {
    scope: string;
    diagnosticId: string;
    payload: Record<string, unknown>;
  }) => {
    attemptedEdges += 1;
    const result = await admin
      .from("portfolio_health_graph_edges")
      .upsert(input.payload, { onConflict: "organization_id,source_node_id,target_node_id,relationship_type" });
    if (result.error) {
      errors.push(graphError(input.scope, "persist", input.diagnosticId, result.error.message));
      return false;
    }
    edges += 1;
    return true;
  };

  const scorecards = await collectRows<ScorecardRow>({
    fetchPage: (from, to) =>
      admin
        .from("assurance_scorecards")
        .select("id, scorecard_type, entity_ref_id, overall_score")
        .eq("organization_id", orgId)
        .order("id", { ascending: true })
        .range(from, to),
    errors,
    scope: orgId,
    queryDiagnosticId: "v6_health_graph_scorecards_query_failed",
    truncateDiagnosticId: "v6_health_graph_scorecards_truncated",
    pageSize: SMALL_PAGE_SIZE,
    maxRows: MEDIUM_MAX_ROWS,
  });

  const avgScore =
    scorecards.length > 0
      ? scorecards.reduce((sum, row) => sum + Number(row.overall_score ?? 0), 0) / scorecards.length
      : 50;
  const orgRisk = Math.max(0, 100 - avgScore);
  const orgNodeId = await upsertNode({
    key: "organization:portfolio_root",
    scope: `${orgId}:portfolio_root`,
    diagnosticId: "v6_health_graph_root_node_upsert_failed",
    payload: {
      organization_id: orgId,
      node_type: "organization",
      node_ref_id: "portfolio_root",
      label: "Portfolio",
      risk_score: orgRisk,
      concentration_score: Math.min(100, orgRisk + 10),
      metadata_json: { role: "root", updated_at: nowIso() },
    },
  });
  if (orgNodeId) {
    nodeIdByKey.set("segment:org", orgNodeId);
  }

  const policies = await collectRows<PolicyRow>({
    fetchPage: (from, to) =>
      admin
        .from("control_policies")
        .select("id, name, status")
        .eq("organization_id", orgId)
        .eq("status", "published")
        .order("id", { ascending: true })
        .range(from, to),
    errors,
    scope: orgId,
    queryDiagnosticId: "v6_health_graph_policies_query_failed",
    truncateDiagnosticId: "v6_health_graph_policies_truncated",
    pageSize: SMALL_PAGE_SIZE,
    maxRows: SMALL_MAX_ROWS,
  });

  for (const policy of policies) {
    await upsertNode({
      key: `control_policy:${policy.id}`,
      scope: `${orgId}:control_policy:${policy.id}`,
      diagnosticId: "v6_health_graph_policy_node_upsert_failed",
      payload: {
        organization_id: orgId,
        node_type: "control_policy",
        node_ref_id: policy.id,
        label: String(policy.name ?? "Policy"),
        risk_score: 15,
        concentration_score: 10,
        metadata_json: { updated_at: nowIso() },
      },
    });
  }

  const campaigns = await collectRows<CampaignRow>({
    fetchPage: (from, to) =>
      admin
        .from("portfolio_campaigns")
        .select("id, name, status, v6_effectiveness_json")
        .eq("organization_id", orgId)
        .in("status", ["active", "paused"])
        .order("id", { ascending: true })
        .range(from, to),
    errors,
    scope: orgId,
    queryDiagnosticId: "v6_health_graph_campaigns_query_failed",
    truncateDiagnosticId: "v6_health_graph_campaigns_truncated",
    pageSize: SMALL_PAGE_SIZE,
    maxRows: SMALL_MAX_ROWS,
  });

  for (const campaign of campaigns) {
    const drift = typeof campaign.v6_effectiveness_json?.drift_score === "number"
      ? campaign.v6_effectiveness_json.drift_score
      : 0;
    await upsertNode({
      key: `campaign:${campaign.id}`,
      scope: `${orgId}:campaign:${campaign.id}`,
      diagnosticId: "v6_health_graph_campaign_node_upsert_failed",
      payload: {
        organization_id: orgId,
        node_type: "campaign",
        node_ref_id: campaign.id,
        label: String(campaign.name ?? "Campaign"),
        risk_score: Math.min(100, 20 + drift),
        concentration_score: Math.min(100, 25 + drift),
        metadata_json: { status: campaign.status, updated_at: nowIso() },
      },
    });
  }

  for (const scorecard of scorecards) {
    const risk = Math.max(0, 100 - Number(scorecard.overall_score ?? 0));
    const conc =
      scorecard.scorecard_type === "counterparty" || scorecard.scorecard_type === "account"
        ? Math.min(100, risk + 5)
        : risk * 0.5;
    await upsertNode({
      key: `${scorecard.scorecard_type}:${scorecard.entity_ref_id}`,
      scope: `${orgId}:${scorecard.scorecard_type}:${scorecard.entity_ref_id}`,
      diagnosticId: "v6_health_graph_scorecard_node_upsert_failed",
      payload: {
        organization_id: orgId,
        node_type: scorecard.scorecard_type,
        node_ref_id: scorecard.entity_ref_id,
        label: `${scorecard.scorecard_type}:${scorecard.entity_ref_id}`,
        risk_score: risk,
        concentration_score: conc,
        metadata_json: { scorecard_id: scorecard.id, updated_at: nowIso() },
      },
    });
  }

  const ownerRows = await collectRows<OwnerContractRow>({
    fetchPage: (from, to) =>
      admin
        .from("contracts")
        .select("owner_id")
        .eq("organization_id", orgId)
        .in("status", ["active", "pending_review"])
        .not("owner_id", "is", null)
        .order("owner_id", { ascending: true })
        .range(from, to),
    errors,
    scope: orgId,
    queryDiagnosticId: "v6_health_graph_owner_contract_query_failed",
    truncateDiagnosticId: "v6_health_graph_owner_contract_truncated",
    pageSize: LARGE_PAGE_SIZE,
    maxRows: LARGE_MAX_ROWS,
  });

  const byOwner = new Map<string, number>();
  for (const row of ownerRows) {
    const ownerId = String(row.owner_id);
    byOwner.set(ownerId, (byOwner.get(ownerId) ?? 0) + 1);
  }
  for (const [ownerId, count] of byOwner.entries()) {
    if (count < 2) continue;
    await upsertNode({
      key: `owner:${ownerId}`,
      scope: `${orgId}:owner:${ownerId}`,
      diagnosticId: "v6_health_graph_owner_node_upsert_failed",
      payload: {
        organization_id: orgId,
        node_type: "owner",
        node_ref_id: ownerId,
        label: "Owner workload",
        risk_score: Math.min(95, 15 + count * 4),
        concentration_score: Math.min(100, 20 + count * 5),
        metadata_json: { active_contracts: count, updated_at: nowIso() },
      },
    });
  }

  const teamTaskRows = await collectRows<TeamTaskRow>({
    fetchPage: (from, to) =>
      admin
        .from("contract_tasks")
        .select("team_key")
        .eq("organization_id", orgId)
        .not("team_key", "is", null)
        .order("team_key", { ascending: true })
        .range(from, to),
    errors,
    scope: orgId,
    queryDiagnosticId: "v6_health_graph_team_task_query_failed",
    truncateDiagnosticId: "v6_health_graph_team_task_truncated",
    pageSize: LARGE_PAGE_SIZE,
    maxRows: LARGE_MAX_ROWS,
  });

  const byTeam = new Map<string, number>();
  for (const row of teamTaskRows) {
    const teamKey = String(row.team_key ?? "").trim();
    if (!teamKey) continue;
    byTeam.set(teamKey, (byTeam.get(teamKey) ?? 0) + 1);
  }
  for (const [teamKey, count] of byTeam.entries()) {
    if (count < 2) continue;
    await upsertNode({
      key: `team:${teamKey}`,
      scope: `${orgId}:team:${teamKey}`,
      diagnosticId: "v6_health_graph_team_node_upsert_failed",
      payload: {
        organization_id: orgId,
        node_type: "team",
        node_ref_id: teamKey,
        label: `Team ${teamKey}`,
        risk_score: Math.min(90, 12 + count * 3),
        concentration_score: Math.min(100, 18 + count * 4),
        metadata_json: { task_rows: count, updated_at: nowIso() },
      },
    });
  }

  if (orgNodeId) {
    for (const scorecard of scorecards) {
      if (scorecard.scorecard_type !== "counterparty" && scorecard.scorecard_type !== "account") continue;
      const childId = nodeIdByKey.get(`${scorecard.scorecard_type}:${scorecard.entity_ref_id}`);
      if (!childId || childId === orgNodeId) continue;
      await upsertEdge({
        scope: `${orgId}:portfolio_root:${scorecard.scorecard_type}:${scorecard.entity_ref_id}`,
        diagnosticId: "v6_health_graph_org_rollup_edge_upsert_failed",
        payload: {
          organization_id: orgId,
          source_node_id: orgNodeId,
          target_node_id: childId,
          relationship_type: "rollup_contains",
          weight: Number(scorecard.overall_score ?? 0) / 100,
          propagation_risk: Math.max(0, 100 - Number(scorecard.overall_score ?? 0)),
          explainability_json: {
            rule: "org_roll_up",
            child_type: scorecard.scorecard_type,
            ref: scorecard.entity_ref_id,
          },
        },
      });
    }
  }

  const counterpartyAccountRows = await collectRows<CounterpartyAccountRow>({
    fetchPage: (from, to) =>
      admin
        .from("contracts")
        .select("counterparty, account_key")
        .eq("organization_id", orgId)
        .not("counterparty", "is", null)
        .not("account_key", "is", null)
        .order("counterparty", { ascending: true })
        .range(from, to),
    errors,
    scope: orgId,
    queryDiagnosticId: "v6_health_graph_counterparty_account_query_failed",
    truncateDiagnosticId: "v6_health_graph_counterparty_account_truncated",
    pageSize: LARGE_PAGE_SIZE,
    maxRows: LARGE_MAX_ROWS,
  });

  const pairCounts = new Map<string, number>();
  for (const row of counterpartyAccountRows) {
    const counterparty = String(row.counterparty ?? "").trim();
    const accountKey = String(row.account_key ?? "").trim();
    if (!counterparty || !accountKey) continue;
    const key = `${counterparty}|||${accountKey}`;
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }
  for (const [key, count] of pairCounts.entries()) {
    if (count < 2) continue;
    const [counterparty, accountKey] = key.split("|||");
    const counterpartyNode = nodeIdByKey.get(`counterparty:${counterparty}`);
    const accountNode = nodeIdByKey.get(`account:${accountKey}`);
    if (!counterpartyNode || !accountNode) continue;
    await upsertEdge({
      scope: `${orgId}:counterparty:${counterparty}:account:${accountKey}`,
      diagnosticId: "v6_health_graph_shared_exposure_edge_upsert_failed",
      payload: {
        organization_id: orgId,
        source_node_id: counterpartyNode,
        target_node_id: accountNode,
        relationship_type: "shared_contract_exposure",
        weight: count,
        propagation_risk: Math.min(100, count * 8),
        explainability_json: {
          rule: "contracts_link_counterparty_and_account",
          shared_contracts: count,
        },
      },
    });
  }

  if (orgNodeId) {
    for (const policy of policies) {
      const policyNode = nodeIdByKey.get(`control_policy:${policy.id}`);
      if (!policyNode) continue;
      await upsertEdge({
        scope: `${orgId}:portfolio_root:control_policy:${policy.id}`,
        diagnosticId: "v6_health_graph_policy_scope_edge_upsert_failed",
        payload: {
          organization_id: orgId,
          source_node_id: orgNodeId,
          target_node_id: policyNode,
          relationship_type: "policy_scope",
          weight: 1,
          propagation_risk: 12,
          explainability_json: { rule: "org_to_published_policy", policy_id: policy.id },
        },
      });
    }

    for (const campaign of campaigns) {
      const campaignNode = nodeIdByKey.get(`campaign:${campaign.id}`);
      if (!campaignNode) continue;
      await upsertEdge({
        scope: `${orgId}:portfolio_root:campaign:${campaign.id}`,
        diagnosticId: "v6_health_graph_campaign_edge_upsert_failed",
        payload: {
          organization_id: orgId,
          source_node_id: orgNodeId,
          target_node_id: campaignNode,
          relationship_type: "portfolio_campaign",
          weight: 1,
          propagation_risk: 18,
          explainability_json: { rule: "active_campaign_touchpoint", campaign_id: campaign.id },
        },
      });
    }

    for (const [ownerId, count] of byOwner.entries()) {
      if (count < 2) continue;
      const ownerNode = nodeIdByKey.get(`owner:${ownerId}`);
      if (!ownerNode) continue;
      await upsertEdge({
        scope: `${orgId}:portfolio_root:owner:${ownerId}`,
        diagnosticId: "v6_health_graph_owner_edge_upsert_failed",
        payload: {
          organization_id: orgId,
          source_node_id: orgNodeId,
          target_node_id: ownerNode,
          relationship_type: "owner_portfolio_load",
          weight: count,
          propagation_risk: Math.min(90, 10 + count * 3),
          explainability_json: {
            rule: "contracts_per_owner",
            owner_user_id: ownerId,
            active_contracts: count,
          },
        },
      });
    }

    for (const [teamKey, count] of byTeam.entries()) {
      if (count < 2) continue;
      const teamNode = nodeIdByKey.get(`team:${teamKey}`);
      if (!teamNode) continue;
      await upsertEdge({
        scope: `${orgId}:portfolio_root:team:${teamKey}`,
        diagnosticId: "v6_health_graph_team_edge_upsert_failed",
        payload: {
          organization_id: orgId,
          source_node_id: orgNodeId,
          target_node_id: teamNode,
          relationship_type: "team_task_load",
          weight: count,
          propagation_risk: Math.min(88, 12 + count * 2),
          explainability_json: {
            rule: "open_tasks_by_team_key",
            team_key: teamKey,
            task_rows: count,
          },
        },
      });
    }
  }

  const openDecisions = await collectRows<DecisionRow>({
    fetchPage: (from, to) =>
      admin
        .from("decision_workspaces")
        .select("id, title, status, decision_type")
        .eq("organization_id", orgId)
        .in("status", ["open", "in_review"])
        .order("updated_at", { ascending: false })
        .range(from, to),
    errors,
    scope: orgId,
    queryDiagnosticId: "v6_health_graph_decision_query_failed",
    truncateDiagnosticId: "v6_health_graph_decision_truncated",
    pageSize: SMALL_PAGE_SIZE,
    maxRows: SMALL_MAX_ROWS,
  });

  for (const decision of openDecisions) {
    const decisionNode = await upsertNode({
      key: `decision_workspace:${decision.id}`,
      scope: `${orgId}:decision:${decision.id}`,
      diagnosticId: "v6_health_graph_decision_node_upsert_failed",
      payload: {
        organization_id: orgId,
        node_type: "decision_workspace",
        node_ref_id: decision.id,
        label: String(decision.title ?? "Decision"),
        risk_score: 28,
        concentration_score: 22,
        metadata_json: {
          status: decision.status,
          decision_type: decision.decision_type,
          updated_at: nowIso(),
        },
      },
    });
    if (orgNodeId && decisionNode) {
      await upsertEdge({
        scope: `${orgId}:portfolio_root:decision:${decision.id}`,
        diagnosticId: "v6_health_graph_decision_edge_upsert_failed",
        payload: {
          organization_id: orgId,
          source_node_id: orgNodeId,
          target_node_id: decisionNode,
          relationship_type: "open_decision_queue",
          weight: 1,
          propagation_risk: 24,
          explainability_json: { rule: "portfolio_to_open_decision", decision_id: decision.id },
        },
      });
    }
  }

  const openExceptions = await collectRows<ExceptionRow>({
    fetchPage: (from, to) =>
      admin
        .from("exceptions")
        .select("id, title, exception_type, severity")
        .eq("organization_id", orgId)
        .in("status", ["open", "in_progress"])
        .order("updated_at", { ascending: false })
        .range(from, to),
    errors,
    scope: orgId,
    queryDiagnosticId: "v6_health_graph_exception_query_failed",
    truncateDiagnosticId: "v6_health_graph_exception_truncated",
    pageSize: SMALL_PAGE_SIZE,
    maxRows: SMALL_MAX_ROWS,
  });

  for (const exception of openExceptions) {
    const exceptionNode = await upsertNode({
      key: `exception:${exception.id}`,
      scope: `${orgId}:exception:${exception.id}`,
      diagnosticId: "v6_health_graph_exception_node_upsert_failed",
      payload: {
        organization_id: orgId,
        node_type: "exception",
        node_ref_id: exception.id,
        label: String(exception.title ?? "Exception"),
        risk_score: String(exception.severity ?? "") === "high" ? 55 : 38,
        concentration_score: 30,
        metadata_json: {
          exception_type: exception.exception_type,
          updated_at: nowIso(),
        },
      },
    });
    if (orgNodeId && exceptionNode) {
      await upsertEdge({
        scope: `${orgId}:portfolio_root:exception:${exception.id}`,
        diagnosticId: "v6_health_graph_exception_edge_upsert_failed",
        payload: {
          organization_id: orgId,
          source_node_id: orgNodeId,
          target_node_id: exceptionNode,
          relationship_type: "open_exception_exposure",
          weight: 1,
          propagation_risk: 30,
          explainability_json: { rule: "portfolio_to_open_exception", exception_id: exception.id },
        },
      });
    }
  }

  const evidenceRequirements = await collectRows<EvidenceRequirementRow>({
    fetchPage: (from, to) =>
      admin
        .from("evidence_requirements")
        .select("id, contract_id, status")
        .eq("organization_id", orgId)
        .eq("status", "required")
        .not("contract_id", "is", null)
        .order("id", { ascending: true })
        .range(from, to),
    errors,
    scope: orgId,
    queryDiagnosticId: "v6_health_graph_evidence_query_failed",
    truncateDiagnosticId: "v6_health_graph_evidence_truncated",
    pageSize: LARGE_PAGE_SIZE,
    maxRows: MEDIUM_MAX_ROWS,
  });

  const evidenceContractIds = [
    ...new Set(evidenceRequirements.map((row) => String(row.contract_id ?? "")).filter(Boolean)),
  ];
  if (evidenceContractIds.length > 0) {
    const evidenceNode = await upsertNode({
      key: "evidence_group:open_required",
      scope: `${orgId}:evidence_group:open_required`,
      diagnosticId: "v6_health_graph_evidence_node_upsert_failed",
      payload: {
        organization_id: orgId,
        node_type: "evidence_group",
        node_ref_id: "evidence_group:open_required",
        label: "Open evidence requirements",
        risk_score: Math.min(85, 20 + evidenceContractIds.length * 3),
        concentration_score: Math.min(90, 15 + evidenceContractIds.length * 4),
        metadata_json: { contract_sample: evidenceContractIds.slice(0, 8), updated_at: nowIso() },
      },
    });
    if (orgNodeId && evidenceNode) {
      await upsertEdge({
        scope: `${orgId}:portfolio_root:evidence_group:open_required`,
        diagnosticId: "v6_health_graph_evidence_edge_upsert_failed",
        payload: {
          organization_id: orgId,
          source_node_id: orgNodeId,
          target_node_id: evidenceNode,
          relationship_type: "evidence_concentration",
          weight: evidenceContractIds.length,
          propagation_risk: Math.min(95, 12 + evidenceContractIds.length * 4),
          explainability_json: {
            rule: "open_evidence_requirements_across_contracts",
            distinct_contracts: evidenceContractIds.length,
          },
        },
      });
    }
  }

  const openFindings = await collectRows<FindingRow>({
    fetchPage: (from, to) =>
      admin
        .from("assurance_findings")
        .select("id, title, severity, finding_type, linked_entities_json")
        .eq("organization_id", orgId)
        .in("status", ["open", "in_review"])
        .order("updated_at", { ascending: false })
        .range(from, to),
    errors,
    scope: orgId,
    queryDiagnosticId: "v6_health_graph_finding_query_failed",
    truncateDiagnosticId: "v6_health_graph_finding_truncated",
    pageSize: SMALL_PAGE_SIZE,
    maxRows: MEDIUM_MAX_ROWS,
  });

  const contractIdsFromFindings = new Set<string>();
  for (const finding of openFindings) {
    const linkedEntities = finding.linked_entities_json;
    if (!Array.isArray(linkedEntities)) continue;
    for (const entity of linkedEntities) {
      if (!entity || typeof entity !== "object") continue;
      const item = entity as { type?: string; id?: string };
      if (item.type === "contract" && item.id) contractIdsFromFindings.add(String(item.id));
    }
  }

  const contractMeta = new Map<string, { name: string | null; counterparty: string | null; accountKey: string | null }>();
  for (const contractIdChunk of chunkArray([...contractIdsFromFindings], ID_CHUNK_SIZE)) {
    const contractsResult = await admin
      .from("contracts")
      .select("id, name, counterparty, account_key")
      .eq("organization_id", orgId)
      .in("id", contractIdChunk);
    if (contractsResult.error) {
      errors.push(
        graphError(orgId, "source_query", "v6_health_graph_finding_contract_query_failed", contractsResult.error.message)
      );
      continue;
    }
    for (const contract of (contractsResult.data ?? []) as ContractMetaRow[]) {
      contractMeta.set(contract.id, {
        name: contract.name ?? null,
        counterparty: contract.counterparty ?? null,
        accountKey: contract.account_key ?? null,
      });
    }
  }

  for (const finding of openFindings) {
    const findingNode = await upsertNode({
      key: `assurance_finding:${finding.id}`,
      scope: `${orgId}:assurance_finding:${finding.id}`,
      diagnosticId: "v6_health_graph_finding_node_upsert_failed",
      payload: {
        organization_id: orgId,
        node_type: "assurance_finding",
        node_ref_id: finding.id,
        label: String(finding.title ?? "Finding").slice(0, 80),
        risk_score: riskFromSeverity(finding.severity),
        concentration_score: Math.min(95, riskFromSeverity(finding.severity) + 6),
        metadata_json: {
          severity: finding.severity,
          finding_type: finding.finding_type,
          updated_at: nowIso(),
        },
      },
    });
    if (orgNodeId && findingNode) {
      await upsertEdge({
        scope: `${orgId}:portfolio_root:assurance_finding:${finding.id}`,
        diagnosticId: "v6_health_graph_finding_edge_upsert_failed",
        payload: {
          organization_id: orgId,
          source_node_id: orgNodeId,
          target_node_id: findingNode,
          relationship_type: "portfolio_open_finding",
          weight: 1,
          propagation_risk: riskFromSeverity(finding.severity),
          explainability_json: { rule: "org_to_open_assurance_finding", finding_id: finding.id },
        },
      });
    }
  }

  for (const contractId of contractIdsFromFindings) {
    const meta = contractMeta.get(contractId);
    const contractNode = await upsertNode({
      key: `contract:${contractId}`,
      scope: `${orgId}:contract:${contractId}`,
      diagnosticId: "v6_health_graph_contract_node_upsert_failed",
      payload: {
        organization_id: orgId,
        node_type: "contract",
        node_ref_id: contractId,
        label: ((meta?.name && meta.name.trim()) || `Contract ${contractId.slice(0, 8)}`).slice(0, 80),
        risk_score: 22,
        concentration_score: 18,
        metadata_json: {
          counterparty: meta?.counterparty ?? null,
          account_key: meta?.accountKey ?? null,
          updated_at: nowIso(),
        },
      },
    });
    if (orgNodeId && contractNode) {
      await upsertEdge({
        scope: `${orgId}:portfolio_root:contract:${contractId}`,
        diagnosticId: "v6_health_graph_contract_edge_upsert_failed",
        payload: {
          organization_id: orgId,
          source_node_id: orgNodeId,
          target_node_id: contractNode,
          relationship_type: "portfolio_contract_exposure",
          weight: 1,
          propagation_risk: 16,
          explainability_json: { rule: "org_to_contract_from_findings", contract_id: contractId },
        },
      });
    }
  }

  for (const finding of openFindings) {
    const findingNode = nodeIdByKey.get(`assurance_finding:${finding.id}`);
    if (!findingNode) continue;
    const linkedEntities = finding.linked_entities_json;
    if (!Array.isArray(linkedEntities)) continue;

    for (const entity of linkedEntities) {
      if (!entity || typeof entity !== "object") continue;
      const item = entity as { type?: string; id?: string };
      if (!item.id) continue;

      if (item.type === "contract") {
        const contractNode = nodeIdByKey.get(`contract:${String(item.id)}`);
        if (!contractNode) continue;
        await upsertEdge({
          scope: `${orgId}:assurance_finding:${finding.id}:contract:${String(item.id)}`,
          diagnosticId: "v6_health_graph_finding_contract_edge_upsert_failed",
          payload: {
            organization_id: orgId,
            source_node_id: findingNode,
            target_node_id: contractNode,
            relationship_type: "finding_targets_contract",
            weight: 1,
            propagation_risk: Math.min(92, riskFromSeverity(finding.severity) + 4),
            explainability_json: {
              rule: "assurance_finding_linked_contract",
              finding_id: finding.id,
              contract_id: item.id,
            },
          },
        });
        continue;
      }

      if (item.type === "counterparty") {
        const counterpartyNode = nodeIdByKey.get(`counterparty:${String(item.id)}`);
        if (!counterpartyNode) continue;
        await upsertEdge({
          scope: `${orgId}:assurance_finding:${finding.id}:counterparty:${String(item.id)}`,
          diagnosticId: "v6_health_graph_finding_counterparty_edge_upsert_failed",
          payload: {
            organization_id: orgId,
            source_node_id: findingNode,
            target_node_id: counterpartyNode,
            relationship_type: "finding_counterparty_signal",
            weight: 1,
            propagation_risk: Math.min(90, riskFromSeverity(finding.severity)),
            explainability_json: { rule: "finding_to_counterparty_entity", finding_id: finding.id },
          },
        });
        continue;
      }

      if (item.type === "account") {
        const accountNode = nodeIdByKey.get(`account:${String(item.id)}`);
        if (!accountNode) continue;
        await upsertEdge({
          scope: `${orgId}:assurance_finding:${finding.id}:account:${String(item.id)}`,
          diagnosticId: "v6_health_graph_finding_account_edge_upsert_failed",
          payload: {
            organization_id: orgId,
            source_node_id: findingNode,
            target_node_id: accountNode,
            relationship_type: "finding_account_signal",
            weight: 1,
            propagation_risk: Math.min(88, riskFromSeverity(finding.severity)),
            explainability_json: { rule: "finding_to_account_entity", finding_id: finding.id },
          },
        });
      }
    }
  }

  for (const contractId of contractIdsFromFindings) {
    const contractNode = nodeIdByKey.get(`contract:${contractId}`);
    if (!contractNode) continue;
    const meta = contractMeta.get(contractId);

    const counterparty = meta?.counterparty?.trim();
    if (counterparty) {
      const counterpartyNode = nodeIdByKey.get(`counterparty:${counterparty}`);
      if (counterpartyNode) {
        await upsertEdge({
          scope: `${orgId}:contract:${contractId}:counterparty:${counterparty}`,
          diagnosticId: "v6_health_graph_contract_counterparty_edge_upsert_failed",
          payload: {
            organization_id: orgId,
            source_node_id: contractNode,
            target_node_id: counterpartyNode,
            relationship_type: "contract_counterparty_link",
            weight: 1,
            propagation_risk: 22,
            explainability_json: {
              rule: "contract_roll_up_counterparty",
              contract_id: contractId,
              counterparty,
            },
          },
        });
      }
    }

    const accountKey = meta?.accountKey?.trim();
    if (accountKey) {
      const accountNode = nodeIdByKey.get(`account:${accountKey}`);
      if (accountNode) {
        await upsertEdge({
          scope: `${orgId}:contract:${contractId}:account:${accountKey}`,
          diagnosticId: "v6_health_graph_contract_account_edge_upsert_failed",
          payload: {
            organization_id: orgId,
            source_node_id: contractNode,
            target_node_id: accountNode,
            relationship_type: "contract_account_link",
            weight: 1,
            propagation_risk: 20,
            explainability_json: {
              rule: "contract_roll_up_account",
              contract_id: contractId,
              account_key: accountKey,
            },
          },
        });
      }
    }
  }

  return { nodes, edges, attemptedNodes, attemptedEdges, errors };
}
