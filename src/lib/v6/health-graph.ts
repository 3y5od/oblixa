import type { AdminClient } from "@/lib/v6/service";
import { nowIso } from "@/lib/v5/api";

/**
 * Build portfolio health graph nodes from scorecards and edges for shared-risk relationships.
 */
export async function rebuildHealthGraphFromPortfolio(admin: AdminClient, orgId: string) {
  const { data: scorecards } = await admin
    .from("assurance_scorecards")
    .select("id, scorecard_type, entity_ref_id, overall_score")
    .eq("organization_id", orgId)
    .limit(300);

  let nodes = 0;
  const nodeIdByKey = new Map<string, string>();

  const avgScore =
    (scorecards ?? []).length > 0
      ? (scorecards as { overall_score?: number }[]).reduce((s, r) => s + Number(r.overall_score ?? 0), 0) /
        (scorecards ?? []).length
      : 50;
  const orgRisk = Math.max(0, 100 - avgScore);
  const orgUpsert = await admin
    .from("portfolio_health_graph_nodes")
    .upsert(
      {
        organization_id: orgId,
        node_type: "organization",
        node_ref_id: "portfolio_root",
        label: "Portfolio",
        risk_score: orgRisk,
        concentration_score: Math.min(100, orgRisk + 10),
        metadata_json: { role: "root", updated_at: nowIso() },
      },
      { onConflict: "organization_id,node_type,node_ref_id" }
    )
    .select("id")
    .single();
  if (!orgUpsert.error && orgUpsert.data?.id) {
    nodeIdByKey.set("organization:portfolio_root", orgUpsert.data.id as string);
    nodeIdByKey.set("segment:org", orgUpsert.data.id as string);
    nodes += 1;
  }

  const { data: policies } = await admin
    .from("control_policies")
    .select("id, name, status")
    .eq("organization_id", orgId)
    .eq("status", "published")
    .limit(40);

  for (const pol of policies ?? []) {
    const pid = (pol as { id: string }).id;
    const { data: pn, error } = await admin
      .from("portfolio_health_graph_nodes")
      .upsert(
        {
          organization_id: orgId,
          node_type: "control_policy",
          node_ref_id: pid,
          label: String((pol as { name?: string }).name ?? "Policy"),
          risk_score: 15,
          concentration_score: 10,
          metadata_json: { updated_at: nowIso() },
        },
        { onConflict: "organization_id,node_type,node_ref_id" }
      )
      .select("id")
      .single();
    if (!error && pn?.id) {
      nodeIdByKey.set(`control_policy:${pid}`, pn.id as string);
      nodes += 1;
    }
  }

  const { data: campaigns } = await admin
    .from("portfolio_campaigns")
    .select("id, name, status, v6_effectiveness_json")
    .eq("organization_id", orgId)
    .in("status", ["active", "paused"])
    .limit(40);

  for (const c of campaigns ?? []) {
    const cid = (c as { id: string }).id;
    const eff = (c as { v6_effectiveness_json?: { drift_score?: number } }).v6_effectiveness_json;
    const drift = typeof eff?.drift_score === "number" ? eff.drift_score : 0;
    const { data: cn, error } = await admin
      .from("portfolio_health_graph_nodes")
      .upsert(
        {
          organization_id: orgId,
          node_type: "campaign",
          node_ref_id: cid,
          label: String((c as { name?: string }).name ?? "Campaign"),
          risk_score: Math.min(100, 20 + drift),
          concentration_score: Math.min(100, 25 + drift),
          metadata_json: { status: (c as { status?: string }).status, updated_at: nowIso() },
        },
        { onConflict: "organization_id,node_type,node_ref_id" }
      )
      .select("id")
      .single();
    if (!error && cn?.id) {
      nodeIdByKey.set(`campaign:${cid}`, cn.id as string);
      nodes += 1;
    }
  }

  for (const sc of scorecards ?? []) {
    const row = sc as {
      id: string;
      scorecard_type: string;
      entity_ref_id: string;
      overall_score: number | string;
    };
    const risk = Math.max(0, 100 - Number(row.overall_score ?? 0));
    const conc =
      row.scorecard_type === "counterparty" || row.scorecard_type === "account"
        ? Math.min(100, risk + 5)
        : risk * 0.5;

    const { data: n, error } = await admin
      .from("portfolio_health_graph_nodes")
      .upsert(
        {
          organization_id: orgId,
          node_type: row.scorecard_type,
          node_ref_id: row.entity_ref_id,
          label: `${row.scorecard_type}:${row.entity_ref_id}`,
          risk_score: risk,
          concentration_score: conc,
          metadata_json: { scorecard_id: row.id, updated_at: nowIso() },
        },
        { onConflict: "organization_id,node_type,node_ref_id" }
      )
      .select("id")
      .single();

    if (!error && n?.id) {
      nodeIdByKey.set(`${row.scorecard_type}:${row.entity_ref_id}`, n.id as string);
      nodes += 1;
    }
  }

  const { data: ownRows } = await admin
    .from("contracts")
    .select("owner_id")
    .eq("organization_id", orgId)
    .in("status", ["active", "pending_review"])
    .not("owner_id", "is", null)
    .limit(400);

  const byOwner = new Map<string, number>();
  for (const r of ownRows ?? []) {
    const uid = String((r as { owner_id: string }).owner_id);
    byOwner.set(uid, (byOwner.get(uid) ?? 0) + 1);
  }

  for (const [uid, cnt] of byOwner.entries()) {
    if (cnt < 2) continue;
    const { data: on, error: oe } = await admin
      .from("portfolio_health_graph_nodes")
      .upsert(
        {
          organization_id: orgId,
          node_type: "owner",
          node_ref_id: uid,
          label: `Owner workload`,
          risk_score: Math.min(95, 15 + cnt * 4),
          concentration_score: Math.min(100, 20 + cnt * 5),
          metadata_json: { active_contracts: cnt, updated_at: nowIso() },
        },
        { onConflict: "organization_id,node_type,node_ref_id" }
      )
      .select("id")
      .single();
    if (!oe && on?.id) {
      nodeIdByKey.set(`owner:${uid}`, on.id as string);
      nodes += 1;
    }
  }

  const { data: teamTaskRows } = await admin
    .from("contract_tasks")
    .select("team_key")
    .eq("organization_id", orgId)
    .not("team_key", "is", null)
    .limit(500);

  const byTeam = new Map<string, number>();
  for (const r of teamTaskRows ?? []) {
    const tk = String((r as { team_key?: string }).team_key ?? "").trim();
    if (!tk) continue;
    byTeam.set(tk, (byTeam.get(tk) ?? 0) + 1);
  }

  for (const [tk, cnt] of byTeam.entries()) {
    if (cnt < 2) continue;
    const { data: tn, error: te } = await admin
      .from("portfolio_health_graph_nodes")
      .upsert(
        {
          organization_id: orgId,
          node_type: "team",
          node_ref_id: tk,
          label: `Team ${tk}`,
          risk_score: Math.min(90, 12 + cnt * 3),
          concentration_score: Math.min(100, 18 + cnt * 4),
          metadata_json: { task_rows: cnt, updated_at: nowIso() },
        },
        { onConflict: "organization_id,node_type,node_ref_id" }
      )
      .select("id")
      .single();
    if (!te && tn?.id) {
      nodeIdByKey.set(`team:${tk}`, tn.id as string);
      nodes += 1;
    }
  }

  const orgNodeId = nodeIdByKey.get("segment:org") ?? nodeIdByKey.get("organization:portfolio_root");
  let edges = 0;

  if (orgNodeId) {
    for (const sc of scorecards ?? []) {
      const row = sc as { scorecard_type: string; entity_ref_id: string; overall_score: number };
      if (row.scorecard_type !== "counterparty" && row.scorecard_type !== "account") continue;
      const childId = nodeIdByKey.get(`${row.scorecard_type}:${row.entity_ref_id}`);
      if (!childId || childId === orgNodeId) continue;

      await admin.from("portfolio_health_graph_edges").upsert(
        {
          organization_id: orgId,
          source_node_id: orgNodeId,
          target_node_id: childId,
          relationship_type: "rollup_contains",
          weight: Number(row.overall_score ?? 0) / 100,
          propagation_risk: Math.max(0, 100 - Number(row.overall_score ?? 0)),
          explainability_json: {
            rule: "org_roll_up",
            child_type: row.scorecard_type,
            ref: row.entity_ref_id,
          },
        },
        { onConflict: "organization_id,source_node_id,target_node_id,relationship_type" }
      );
      edges += 1;
    }
  }

  const { data: cpRows } = await admin
    .from("contracts")
    .select("counterparty, linked_account_key")
    .eq("organization_id", orgId)
    .not("counterparty", "is", null)
    .not("linked_account_key", "is", null)
    .limit(400);

  const pairCounts = new Map<string, number>();
  for (const r of cpRows ?? []) {
    const cp = String((r as { counterparty?: string }).counterparty ?? "").trim();
    const ak = String((r as { linked_account_key?: string }).linked_account_key ?? "").trim();
    if (!cp || !ak) continue;
    const k = `${cp}|||${ak}`;
    pairCounts.set(k, (pairCounts.get(k) ?? 0) + 1);
  }

  for (const [k, cnt] of pairCounts.entries()) {
    if (cnt < 2) continue;
    const [cp, ak] = k.split("|||");
    const a = nodeIdByKey.get(`counterparty:${cp}`);
    const b = nodeIdByKey.get(`account:${ak}`);
    if (!a || !b) continue;

    await admin.from("portfolio_health_graph_edges").upsert(
      {
        organization_id: orgId,
        source_node_id: a,
        target_node_id: b,
        relationship_type: "shared_contract_exposure",
        weight: cnt,
        propagation_risk: Math.min(100, cnt * 8),
        explainability_json: {
          rule: "contracts_link_counterparty_and_account",
          shared_contracts: cnt,
        },
      },
      { onConflict: "organization_id,source_node_id,target_node_id,relationship_type" }
    );
    edges += 1;
  }

  if (orgNodeId) {
    for (const pol of policies ?? []) {
      const pid = (pol as { id: string }).id;
      const pNode = nodeIdByKey.get(`control_policy:${pid}`);
      if (!pNode) continue;
      await admin.from("portfolio_health_graph_edges").upsert(
        {
          organization_id: orgId,
          source_node_id: orgNodeId,
          target_node_id: pNode,
          relationship_type: "policy_scope",
          weight: 1,
          propagation_risk: 12,
          explainability_json: { rule: "org_to_published_policy", policy_id: pid },
        },
        { onConflict: "organization_id,source_node_id,target_node_id,relationship_type" }
      );
      edges += 1;
    }
    for (const c of campaigns ?? []) {
      const cid = (c as { id: string }).id;
      const cNode = nodeIdByKey.get(`campaign:${cid}`);
      if (!cNode) continue;
      await admin.from("portfolio_health_graph_edges").upsert(
        {
          organization_id: orgId,
          source_node_id: orgNodeId,
          target_node_id: cNode,
          relationship_type: "portfolio_campaign",
          weight: 1,
          propagation_risk: 18,
          explainability_json: { rule: "active_campaign_touchpoint", campaign_id: cid },
        },
        { onConflict: "organization_id,source_node_id,target_node_id,relationship_type" }
      );
      edges += 1;
    }

    for (const [uid, cnt] of byOwner.entries()) {
      if (cnt < 2) continue;
      const oNode = nodeIdByKey.get(`owner:${uid}`);
      if (!oNode) continue;
      await admin.from("portfolio_health_graph_edges").upsert(
        {
          organization_id: orgId,
          source_node_id: orgNodeId,
          target_node_id: oNode,
          relationship_type: "owner_portfolio_load",
          weight: cnt,
          propagation_risk: Math.min(90, 10 + cnt * 3),
          explainability_json: {
            rule: "contracts_per_owner",
            owner_user_id: uid,
            active_contracts: cnt,
          },
        },
        { onConflict: "organization_id,source_node_id,target_node_id,relationship_type" }
      );
      edges += 1;
    }

    for (const [tk, cnt] of byTeam.entries()) {
      if (cnt < 2) continue;
      const tNode = nodeIdByKey.get(`team:${tk}`);
      if (!tNode) continue;
      await admin.from("portfolio_health_graph_edges").upsert(
        {
          organization_id: orgId,
          source_node_id: orgNodeId,
          target_node_id: tNode,
          relationship_type: "team_task_load",
          weight: cnt,
          propagation_risk: Math.min(88, 12 + cnt * 2),
          explainability_json: {
            rule: "open_tasks_by_team_key",
            team_key: tk,
            task_rows: cnt,
          },
        },
        { onConflict: "organization_id,source_node_id,target_node_id,relationship_type" }
      );
      edges += 1;
    }
  }

  const { data: openDecisions } = await admin
    .from("decision_workspaces")
    .select("id, title, status, decision_type")
    .eq("organization_id", orgId)
    .in("status", ["open", "in_review"])
    .order("updated_at", { ascending: false })
    .limit(25);

  for (const d of openDecisions ?? []) {
    const did = String((d as { id: string }).id);
    const { data: dn, error: dErr } = await admin
      .from("portfolio_health_graph_nodes")
      .upsert(
        {
          organization_id: orgId,
          node_type: "decision_workspace",
          node_ref_id: did,
          label: String((d as { title?: string }).title ?? "Decision"),
          risk_score: 28,
          concentration_score: 22,
          metadata_json: {
            status: (d as { status?: string }).status,
            decision_type: (d as { decision_type?: string }).decision_type,
            updated_at: nowIso(),
          },
        },
        { onConflict: "organization_id,node_type,node_ref_id" }
      )
      .select("id")
      .single();
    if (!dErr && dn?.id) {
      nodeIdByKey.set(`decision_workspace:${did}`, dn.id as string);
      nodes += 1;
    }
  }

  const { data: openExceptions } = await admin
    .from("exceptions")
    .select("id, title, exception_type, severity")
    .eq("organization_id", orgId)
    .in("status", ["open", "in_progress"])
    .order("updated_at", { ascending: false })
    .limit(25);

  for (const ex of openExceptions ?? []) {
    const eid = String((ex as { id: string }).id);
    const { data: en, error: exErr } = await admin
      .from("portfolio_health_graph_nodes")
      .upsert(
        {
          organization_id: orgId,
          node_type: "exception",
          node_ref_id: eid,
          label: String((ex as { title?: string }).title ?? "Exception"),
          risk_score: String((ex as { severity?: string }).severity) === "high" ? 55 : 38,
          concentration_score: 30,
          metadata_json: {
            exception_type: (ex as { exception_type?: string }).exception_type,
            updated_at: nowIso(),
          },
        },
        { onConflict: "organization_id,node_type,node_ref_id" }
      )
      .select("id")
      .single();
    if (!exErr && en?.id) {
      nodeIdByKey.set(`exception:${eid}`, en.id as string);
      nodes += 1;
    }
  }

  const { data: evidenceReqs } = await admin
    .from("evidence_requirements")
    .select("id, contract_id, status")
    .eq("organization_id", orgId)
    .eq("status", "required")
    .not("contract_id", "is", null)
    .limit(80);

  const evIds = [...new Set((evidenceReqs ?? []).map((r) => String((r as { contract_id?: string }).contract_id ?? "")).filter(Boolean))].slice(0, 20);
  if (evIds.length > 0) {
    const bucketKey = "evidence_group:open_required";
    const { data: evN, error: evErr } = await admin
      .from("portfolio_health_graph_nodes")
      .upsert(
        {
          organization_id: orgId,
          node_type: "evidence_group",
          node_ref_id: bucketKey,
          label: "Open evidence requirements",
          risk_score: Math.min(85, 20 + evIds.length * 3),
          concentration_score: Math.min(90, 15 + evIds.length * 4),
          metadata_json: { contract_sample: evIds.slice(0, 8), updated_at: nowIso() },
        },
        { onConflict: "organization_id,node_type,node_ref_id" }
      )
      .select("id")
      .single();
    if (!evErr && evN?.id) {
      nodeIdByKey.set(bucketKey, evN.id as string);
      nodes += 1;
      const orgNodeId2 = nodeIdByKey.get("segment:org") ?? nodeIdByKey.get("organization:portfolio_root");
      if (orgNodeId2) {
        await admin.from("portfolio_health_graph_edges").upsert(
          {
            organization_id: orgId,
            source_node_id: orgNodeId2,
            target_node_id: evN.id as string,
            relationship_type: "evidence_concentration",
            weight: evIds.length,
            propagation_risk: Math.min(95, 12 + evIds.length * 4),
            explainability_json: {
              rule: "open_evidence_requirements_across_contracts",
              distinct_contracts: evIds.length,
            },
          },
          { onConflict: "organization_id,source_node_id,target_node_id,relationship_type" }
        );
        edges += 1;
      }
    }
  }

  if (orgNodeId) {
    for (const d of openDecisions ?? []) {
      const did = String((d as { id: string }).id);
      const n = nodeIdByKey.get(`decision_workspace:${did}`);
      if (!n) continue;
      await admin.from("portfolio_health_graph_edges").upsert(
        {
          organization_id: orgId,
          source_node_id: orgNodeId,
          target_node_id: n,
          relationship_type: "open_decision_queue",
          weight: 1,
          propagation_risk: 24,
          explainability_json: { rule: "portfolio_to_open_decision", decision_id: did },
        },
        { onConflict: "organization_id,source_node_id,target_node_id,relationship_type" }
      );
      edges += 1;
    }
    for (const ex of openExceptions ?? []) {
      const eid = String((ex as { id: string }).id);
      const n = nodeIdByKey.get(`exception:${eid}`);
      if (!n) continue;
      await admin.from("portfolio_health_graph_edges").upsert(
        {
          organization_id: orgId,
          source_node_id: orgNodeId,
          target_node_id: n,
          relationship_type: "open_exception_exposure",
          weight: 1,
          propagation_risk: 30,
          explainability_json: { rule: "portfolio_to_open_exception", exception_id: eid },
        },
        { onConflict: "organization_id,source_node_id,target_node_id,relationship_type" }
      );
      edges += 1;
    }
  }

  const { data: openFindingRows } = await admin
    .from("assurance_findings")
    .select("id, title, severity, finding_type, linked_entities_json")
    .eq("organization_id", orgId)
    .in("status", ["open", "in_review"])
    .order("updated_at", { ascending: false })
    .limit(45);

  const contractIdsFromFindings = new Set<string>();
  for (const fr of openFindingRows ?? []) {
    const le = (fr as { linked_entities_json?: unknown }).linked_entities_json;
    if (!Array.isArray(le)) continue;
    for (const ent of le) {
      if (!ent || typeof ent !== "object") continue;
      const o = ent as { type?: string; id?: string };
      if (o.type === "contract" && o.id) contractIdsFromFindings.add(String(o.id));
    }
  }
  const cidList = [...contractIdsFromFindings].slice(0, 45);
  const { data: contractRowsForFindings } =
    cidList.length > 0
      ? await admin
          .from("contracts")
          .select("id, name, counterparty, linked_account_key")
          .eq("organization_id", orgId)
          .in("id", cidList)
      : { data: [] as { id: string; name?: string | null; counterparty?: string | null; linked_account_key?: string | null }[] };

  const contractMeta = new Map<
    string,
    { name: string | null; counterparty: string | null; accountKey: string | null }
  >();
  for (const c of contractRowsForFindings ?? []) {
    const row = c as {
      id: string;
      name?: string | null;
      counterparty?: string | null;
      linked_account_key?: string | null;
    };
    contractMeta.set(row.id, {
      name: row.name ?? null,
      counterparty: row.counterparty ?? null,
      accountKey: row.linked_account_key ?? null,
    });
  }

  function riskFromSeverity(sev: string | undefined): number {
    const s = String(sev ?? "").toLowerCase();
    if (s === "critical") return 90;
    if (s === "high") return 74;
    if (s === "medium") return 52;
    if (s === "low") return 32;
    return 44;
  }

  for (const fr of openFindingRows ?? []) {
    const fid = String((fr as { id: string }).id);
    const title = String((fr as { title?: string }).title ?? "Finding");
    const sev = (fr as { severity?: string }).severity;
    const { data: fn, error: fErr } = await admin
      .from("portfolio_health_graph_nodes")
      .upsert(
        {
          organization_id: orgId,
          node_type: "assurance_finding",
          node_ref_id: fid,
          label: title.slice(0, 80),
          risk_score: riskFromSeverity(sev),
          concentration_score: Math.min(95, riskFromSeverity(sev) + 6),
          metadata_json: {
            severity: sev,
            finding_type: (fr as { finding_type?: string }).finding_type,
            updated_at: nowIso(),
          },
        },
        { onConflict: "organization_id,node_type,node_ref_id" }
      )
      .select("id")
      .single();
    if (!fErr && fn?.id) {
      nodeIdByKey.set(`assurance_finding:${fid}`, fn.id as string);
      nodes += 1;
      if (orgNodeId) {
        await admin.from("portfolio_health_graph_edges").upsert(
          {
            organization_id: orgId,
            source_node_id: orgNodeId,
            target_node_id: fn.id as string,
            relationship_type: "portfolio_open_finding",
            weight: 1,
            propagation_risk: riskFromSeverity(sev),
            explainability_json: { rule: "org_to_open_assurance_finding", finding_id: fid },
          },
          { onConflict: "organization_id,source_node_id,target_node_id,relationship_type" }
        );
        edges += 1;
      }
    }
  }

  for (const cid of cidList) {
    const meta = contractMeta.get(cid);
    const label = (meta?.name && meta.name.trim()) || `Contract ${cid.slice(0, 8)}`;
    const { data: cn, error: cErr } = await admin
      .from("portfolio_health_graph_nodes")
      .upsert(
        {
          organization_id: orgId,
          node_type: "contract",
          node_ref_id: cid,
          label: label.slice(0, 80),
          risk_score: 22,
          concentration_score: 18,
          metadata_json: {
            counterparty: meta?.counterparty ?? null,
            account_key: meta?.accountKey ?? null,
            updated_at: nowIso(),
          },
        },
        { onConflict: "organization_id,node_type,node_ref_id" }
      )
      .select("id")
      .single();
    if (!cErr && cn?.id) {
      nodeIdByKey.set(`contract:${cid}`, cn.id as string);
      nodes += 1;
      if (orgNodeId) {
        await admin.from("portfolio_health_graph_edges").upsert(
          {
            organization_id: orgId,
            source_node_id: orgNodeId,
            target_node_id: cn.id as string,
            relationship_type: "portfolio_contract_exposure",
            weight: 1,
            propagation_risk: 16,
            explainability_json: { rule: "org_to_contract_from_findings", contract_id: cid },
          },
          { onConflict: "organization_id,source_node_id,target_node_id,relationship_type" }
        );
        edges += 1;
      }
    }
  }

  for (const fr of openFindingRows ?? []) {
    const fid = String((fr as { id: string }).id);
    const fNode = nodeIdByKey.get(`assurance_finding:${fid}`);
    if (!fNode) continue;
    const le = (fr as { linked_entities_json?: unknown }).linked_entities_json;
    if (!Array.isArray(le)) continue;
    for (const ent of le) {
      if (!ent || typeof ent !== "object") continue;
      const o = ent as { type?: string; id?: string };
      if (o.type === "contract" && o.id) {
        const cNode = nodeIdByKey.get(`contract:${String(o.id)}`);
        if (!cNode) continue;
        await admin.from("portfolio_health_graph_edges").upsert(
          {
            organization_id: orgId,
            source_node_id: fNode,
            target_node_id: cNode,
            relationship_type: "finding_targets_contract",
            weight: 1,
            propagation_risk: Math.min(92, riskFromSeverity((fr as { severity?: string }).severity) + 4),
            explainability_json: { rule: "assurance_finding_linked_contract", finding_id: fid, contract_id: o.id },
          },
          { onConflict: "organization_id,source_node_id,target_node_id,relationship_type" }
        );
        edges += 1;
        continue;
      }
      if (o.type === "counterparty" && o.id) {
        const cpNode = nodeIdByKey.get(`counterparty:${String(o.id)}`);
        if (!cpNode) continue;
        await admin.from("portfolio_health_graph_edges").upsert(
          {
            organization_id: orgId,
            source_node_id: fNode,
            target_node_id: cpNode,
            relationship_type: "finding_counterparty_signal",
            weight: 1,
            propagation_risk: Math.min(90, riskFromSeverity((fr as { severity?: string }).severity)),
            explainability_json: { rule: "finding_to_counterparty_entity", finding_id: fid },
          },
          { onConflict: "organization_id,source_node_id,target_node_id,relationship_type" }
        );
        edges += 1;
      }
      if (o.type === "account" && o.id) {
        const aNode = nodeIdByKey.get(`account:${String(o.id)}`);
        if (!aNode) continue;
        await admin.from("portfolio_health_graph_edges").upsert(
          {
            organization_id: orgId,
            source_node_id: fNode,
            target_node_id: aNode,
            relationship_type: "finding_account_signal",
            weight: 1,
            propagation_risk: Math.min(88, riskFromSeverity((fr as { severity?: string }).severity)),
            explainability_json: { rule: "finding_to_account_entity", finding_id: fid },
          },
          { onConflict: "organization_id,source_node_id,target_node_id,relationship_type" }
        );
        edges += 1;
      }
    }
  }

  for (const cid of cidList) {
    const cNode = nodeIdByKey.get(`contract:${cid}`);
    if (!cNode) continue;
    const meta = contractMeta.get(cid);
    const cp = meta?.counterparty?.trim();
    if (cp) {
      const cpNode = nodeIdByKey.get(`counterparty:${cp}`);
      if (cpNode) {
        await admin.from("portfolio_health_graph_edges").upsert(
          {
            organization_id: orgId,
            source_node_id: cNode,
            target_node_id: cpNode,
            relationship_type: "contract_counterparty_link",
            weight: 1,
            propagation_risk: 22,
            explainability_json: { rule: "contract_roll_up_counterparty", contract_id: cid, counterparty: cp },
          },
          { onConflict: "organization_id,source_node_id,target_node_id,relationship_type" }
        );
        edges += 1;
      }
    }
    const ak = meta?.accountKey?.trim();
    if (ak) {
      const aNode = nodeIdByKey.get(`account:${ak}`);
      if (aNode) {
        await admin.from("portfolio_health_graph_edges").upsert(
          {
            organization_id: orgId,
            source_node_id: cNode,
            target_node_id: aNode,
            relationship_type: "contract_account_link",
            weight: 1,
            propagation_risk: 20,
            explainability_json: { rule: "contract_roll_up_account", contract_id: cid, account_key: ak },
          },
          { onConflict: "organization_id,source_node_id,target_node_id,relationship_type" }
        );
        edges += 1;
      }
    }
  }

  return { nodes, edges };
}
