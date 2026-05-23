import type { AdminClient } from "@/lib/v6/service";
import { nowIso } from "@/lib/v5/api";
import {
  gatherPortfolioMetrics,
  gatherPortfolioMetricsForContractIds,
  type V6PortfolioMetrics,
} from "@/lib/v6/portfolio-metrics";

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}

function dimensionsFromMetrics(m: V6PortfolioMetrics, openFindings: number) {
  const penalty = Math.min(35, openFindings * 3);
  const renewalReadiness =
    m.avg_renewal_readiness != null && Number.isFinite(Number(m.avg_renewal_readiness))
      ? clampScore(Number(m.avg_renewal_readiness))
      : clampScore(92 - penalty * 0.2);
  return {
    ownership_integrity: clampScore(100 - Math.min(80, m.contracts_without_owner * 8)),
    exception_pressure: clampScore(100 - Math.min(80, (m.open_exceptions + m.open_exceptions_in_progress) * 4)),
    evidence_freshness: clampScore(100 - Math.min(60, m.evidence_stale_proxy * 5)),
    sla_adherence: clampScore(100 - Math.min(80, m.approvals_past_due * 5)),
    renewal_readiness: renewalReadiness,
    decision_timeliness: clampScore(100 - Math.min(50, m.open_decisions * 2)),
    external_responsiveness: clampScore(100 - Math.min(40, m.open_external_links * 3)),
    control_conformance: clampScore(100 - penalty),
  };
}

async function upsertScorecard(
  admin: AdminClient,
  orgId: string,
  scorecardType: string,
  entityRefId: string,
  overall: number,
  dimensions: Record<string, number>,
  drivers: { key: string; value: unknown }[],
  summary: Record<string, unknown>
) {
  const { data: existing } = await admin
    .from("assurance_scorecards")
    .select("id, overall_score")
    .eq("organization_id", orgId)
    .eq("scorecard_type", scorecardType)
    .eq("entity_ref_id", entityRefId)
    .maybeSingle();

  const { data: row, error } = await admin
    .from("assurance_scorecards")
    .upsert(
      {
        organization_id: orgId,
        scorecard_type: scorecardType,
        entity_ref_id: entityRefId,
        overall_score: overall,
        dimensions_json: dimensions,
        score_drivers_json: drivers,
        summary_json: { ...summary, updated_at: nowIso() },
        computed_at: nowIso(),
      },
      { onConflict: "organization_id,scorecard_type,entity_ref_id" }
    )
    .select("id, overall_score")
    .single();

  if (row?.id && existing && typeof existing.overall_score === "number") {
    const delta = Math.abs(Number(existing.overall_score) - overall);
    if (delta >= 0.5) {
      await admin.from("scorecard_snapshots").insert({
        organization_id: orgId,
        assurance_scorecard_id: row.id,
        snapshot_at: nowIso(),
        overall_score: overall,
        dimensions_json: dimensions,
        score_drivers_json: drivers,
      });
    }
  } else if (row?.id && !existing) {
    await admin.from("scorecard_snapshots").insert({
      organization_id: orgId,
      assurance_scorecard_id: row.id,
      snapshot_at: nowIso(),
      overall_score: overall,
      dimensions_json: dimensions,
      score_drivers_json: drivers,
    });
  }

  return { data: row, error };
}

async function countOpenFindingsTouchingContractIds(
  admin: AdminClient,
  orgId: string,
  contractIdSet: Set<string>
): Promise<number> {
  if (contractIdSet.size === 0) return 0;
  const { data } = await admin
    .from("assurance_findings")
    .select("linked_entities_json")
    .eq("organization_id", orgId)
    .in("status", ["open", "in_review"])
    .limit(1000);
  let n = 0;
  for (const row of data ?? []) {
    const le = (row as { linked_entities_json?: unknown }).linked_entities_json;
    if (!Array.isArray(le)) continue;
    const touches = le.some((e: unknown) => {
      if (!e || typeof e !== "object") return false;
      const o = e as { type?: string; id?: string };
      return o.type === "contract" && o.id != null && contractIdSet.has(String(o.id));
    });
    if (touches) n += 1;
  }
  return n;
}

/**
 * Multi-entity assurance scorecards + snapshots on material change.
 */
export async function recomputeScorecards(admin: AdminClient, orgId: string) {
  const metrics = await gatherPortfolioMetrics(admin, orgId);
  const { count: openFindingsCount } = await admin
    .from("assurance_findings")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .in("status", ["open", "in_review"]);

  const openFindings = openFindingsCount ?? 0;
  const dimensions = dimensionsFromMetrics(metrics, openFindings);
  const overall =
    Object.values(dimensions).reduce((a, b) => a + b, 0) / Object.keys(dimensions).length;

  const drivers = [
    { key: "open_findings", value: openFindings },
    { key: "open_exceptions", value: metrics.open_exceptions + metrics.open_exceptions_in_progress },
    { key: "avg_renewal_readiness_input", value: metrics.avg_renewal_readiness },
    { key: "evidence_stale_proxy", value: metrics.evidence_stale_proxy },
    { key: "approvals_past_due", value: metrics.approvals_past_due },
    { key: "recompute_source", value: "v6_scorecard_engine" },
  ];

  const summary = {
    open_findings: openFindings,
    metrics_snapshot: metrics,
  };

  const results: unknown[] = [];

  const orgRes = await upsertScorecard(
    admin,
    orgId,
    "segment",
    "org",
    clampScore(overall),
    dimensions,
    drivers,
    summary
  );
  results.push(orgRes);

  const { data: counterparties } = await admin
    .from("contracts")
    .select("counterparty")
    .eq("organization_id", orgId)
    .not("counterparty", "is", null)
    .limit(500);

  const cpCounts = new Map<string, number>();
  for (const row of counterparties ?? []) {
    const cp = String((row as { counterparty?: string }).counterparty ?? "").trim();
    if (!cp) continue;
    cpCounts.set(cp, (cpCounts.get(cp) ?? 0) + 1);
  }

  const topCp = [...cpCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  for (const [cp, count] of topCp) {
    const concentration = Math.min(25, count * 2);
    const adj = clampScore(overall - concentration * 0.4);
    const dim = { ...dimensions, exception_pressure: clampScore(dimensions.exception_pressure - concentration * 0.2) };
    const r = await upsertScorecard(
      admin,
      orgId,
      "counterparty",
      cp,
      adj,
      dim,
      [...drivers, { key: "contract_count", value: count }],
      { ...summary, counterparty: cp }
    );
    results.push(r);
  }

  const { data: accounts } = await admin
    .from("contracts")
    .select("account_key")
    .eq("organization_id", orgId)
    .not("account_key", "is", null)
    .limit(500);

  const acCounts = new Map<string, number>();
  for (const row of accounts ?? []) {
    const ak = String((row as { account_key?: string }).account_key ?? "").trim();
    if (!ak) continue;
    acCounts.set(ak, (acCounts.get(ak) ?? 0) + 1);
  }

  const topAc = [...acCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  for (const [ak, count] of topAc) {
    const concentration = Math.min(20, count * 2);
    const adj = clampScore(overall - concentration * 0.35);
    const r = await upsertScorecard(
      admin,
      orgId,
      "account",
      ak,
      adj,
      { ...dimensions, ownership_integrity: clampScore(dimensions.ownership_integrity - concentration * 0.15) },
      [...drivers, { key: "contract_count", value: count }],
      { ...summary, account_key: ak }
    );
    results.push(r);
  }

  const { data: progAssigns } = await admin
    .from("contract_program_assignments")
    .select("program_id, contract_id")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .limit(800);

  const progCounts = new Map<string, number>();
  for (const row of progAssigns ?? []) {
    const pid = String((row as { program_id: string }).program_id);
    progCounts.set(pid, (progCounts.get(pid) ?? 0) + 1);
  }

  const topProg = [...progCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  for (const [programId, count] of topProg) {
    const concentration = Math.min(22, count * 1.5);
    const adj = clampScore(overall - concentration * 0.3);
    const r = await upsertScorecard(
      admin,
      orgId,
      "program",
      programId,
      adj,
      {
        ...dimensions,
        control_conformance: clampScore(dimensions.control_conformance - concentration * 0.12),
      },
      [...drivers, { key: "assigned_contracts", value: count }],
      { ...summary, program_id: programId }
    );
    results.push(r);
  }

  const { data: teamRows } = await admin
    .from("contract_tasks")
    .select("team_key")
    .eq("organization_id", orgId)
    .not("team_key", "is", null)
    .limit(800);

  const teamCounts = new Map<string, number>();
  for (const row of teamRows ?? []) {
    const tk = String((row as { team_key?: string }).team_key ?? "").trim();
    if (!tk) continue;
    teamCounts.set(tk, (teamCounts.get(tk) ?? 0) + 1);
  }

  const topTeams = [...teamCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  for (const [tk, count] of topTeams) {
    const concentration = Math.min(22, count);
    const adj = clampScore(overall - concentration * 0.25);
    const teamDims = {
      ...dimensions,
      sla_adherence: clampScore(dimensions.sla_adherence - concentration * 0.3),
    };
    const tr = await upsertScorecard(
      admin,
      orgId,
      "team",
      tk,
      adj,
      teamDims,
      [...drivers, { key: "task_rows_with_team_key", value: count }],
      { ...summary, team_key: tk }
    );
    results.push(tr);
  }

  const { data: segmentDefs } = await admin
    .from("segment_definitions")
    .select("id, key, name")
    .eq("organization_id", orgId)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(35);

  for (const seg of segmentDefs ?? []) {
    const segId = String((seg as { id: string }).id);
    const segKey = String((seg as { key: string }).key);
    const segName = String((seg as { name: string }).name);
    const { data: members } = await admin
      .from("segment_memberships")
      .select("entity_ref_id")
      .eq("organization_id", orgId)
      .eq("segment_definition_id", segId)
      .eq("entity_type", "contract")
      .limit(500);
    const contractIds = (members ?? []).map((m) => String((m as { entity_ref_id: string }).entity_ref_id));
    if (contractIds.length === 0) continue;
    const contractSet = new Set(contractIds);
    const scoped = await gatherPortfolioMetricsForContractIds(admin, orgId, contractIds);
    const findingPenalty = await countOpenFindingsTouchingContractIds(admin, orgId, contractSet);
    const segDimensions = dimensionsFromMetrics(scoped, findingPenalty);
    const segOverall =
      Object.values(segDimensions).reduce((a, b) => a + b, 0) / Object.keys(segDimensions).length;
    const segDrivers = [
      ...drivers,
      { key: "segment_key", value: segKey },
      { key: "segment_member_contracts", value: contractIds.length },
      { key: "segment_open_findings_touching", value: findingPenalty },
      { key: "recompute_source", value: "v6_scorecard_segment_scope" },
    ];
    const segSummary = {
      ...summary,
      segment_id: segId,
      segment_name: segName,
      segment_contract_sample_size: contractIds.length,
    };
    const sr = await upsertScorecard(
      admin,
      orgId,
      "segment",
      segKey,
      clampScore(segOverall),
      segDimensions,
      segDrivers,
      segSummary
    );
    results.push(sr);
  }

  const errs = results.map((r) => (r as { error?: { message?: string } }).error).filter(Boolean);
  return {
    data: results,
    errors: errs,
    error: errs.length > 0
      ? { message: errs.map((e) => e?.message).filter(Boolean).join("; ") }
      : null,
  };
}
