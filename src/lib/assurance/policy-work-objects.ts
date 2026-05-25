import type { AdminClient } from "@/lib/assurance/service";
import type { ControlPolicyJsonV1, EvidenceExpectationsV1 } from "@/lib/assurance/policy-types";
import { chunkIds } from "@/lib/assurance/portfolio-metrics";
import { ownerlessBusinessDaysCutoffIso } from "@/lib/assurance/business-days";

const CHUNK = 120;

export type WorkObjectBreach = {
  code: string;
  detail: string;
  severity: "low" | "medium" | "high";
};

/**
 * Table-backed policy checks for work objects and evidence state (v6.md §9.1).
 * When contractIds is empty, uses all active/pending_review contracts in the org (capped).
 */
export async function evaluateWorkObjectPolicyBreaches(
  admin: AdminClient,
  orgId: string,
  contractIds: string[],
  policyJson: ControlPolicyJsonV1,
  evidenceExpectations: EvidenceExpectationsV1
): Promise<WorkObjectBreach[]> {
  const breaches: WorkObjectBreach[] = [];

  let ids = [...new Set(contractIds.map(String))].filter(Boolean);
  if (ids.length === 0) {
    const { data } = await admin
      .from("contracts")
      .select("id")
      .eq("organization_id", orgId)
      .in("status", ["active", "pending_review"])
      .limit(500);
    ids = (data ?? []).map((r) => String((r as { id: string }).id));
  }

  if (ids.length === 0) return breaches;

  if (policyJson.min_open_work_items_in_scope != null) {
    let taskCount = 0;
    for (const part of chunkIds(ids, CHUNK)) {
      const { count } = await admin
        .from("contract_tasks")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["open", "in_progress", "blocked"])
        .in("contract_id", part);
      taskCount += count ?? 0;
    }
    if (taskCount < policyJson.min_open_work_items_in_scope) {
      breaches.push({
        code: "work_item_coverage",
        detail: `Active work items in scope (${taskCount}) are below minimum ${policyJson.min_open_work_items_in_scope}`,
        severity: "medium",
      });
    }
  }

  if (policyJson.max_overdue_obligations_in_scope != null) {
    const today = new Date().toISOString().slice(0, 10);
    let overdueObs = 0;
    for (const part of chunkIds(ids, CHUNK)) {
      const { count } = await admin
        .from("contract_obligations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["open", "in_progress"])
        .not("due_date", "is", null)
        .lt("due_date", today)
        .in("contract_id", part);
      overdueObs += count ?? 0;
    }
    if (overdueObs > policyJson.max_overdue_obligations_in_scope) {
      breaches.push({
        code: "obligation_overdue_scope",
        detail: `Overdue obligations in scope (${overdueObs}) exceed maximum ${policyJson.max_overdue_obligations_in_scope}`,
        severity: "high",
      });
    }
  }

  const maxAgeDays = evidenceExpectations.max_submitted_evidence_age_days;
  if (maxAgeDays != null && maxAgeDays > 0) {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
    let stale = 0;
    for (const part of chunkIds(ids, CHUNK)) {
      const { count } = await admin
        .from("evidence_submissions")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "submitted")
        .lt("submitted_at", cutoff)
        .in("contract_id", part);
      stale += count ?? 0;
    }
    if (stale > 0) {
      breaches.push({
        code: "evidence_stale_in_scope",
        detail: `${stale} evidence submission(s) in scope have been in "submitted" status longer than ${maxAgeDays} days`,
        severity: "medium",
      });
    }
  }

  const bizGrace = policyJson.ownerless_grace_business_days;
  if (bizGrace != null && bizGrace > 0) {
    const cutoffIso = ownerlessBusinessDaysCutoffIso(bizGrace);
    let longOwnerless = 0;
    for (const part of chunkIds(ids, CHUNK)) {
      const { count } = await admin
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["active", "pending_review"])
        .is("owner_id", null)
        .lt("created_at", cutoffIso)
        .in("id", part);
      longOwnerless += count ?? 0;
    }
    if (longOwnerless > 0) {
      breaches.push({
        code: "ownerless_grace_exceeded",
        detail: `${longOwnerless} contract(s) in scope have no owner beyond the ${bizGrace} business-day grace window`,
        severity: "high",
      });
    }
  } else {
    const graceDays = policyJson.ownerless_grace_calendar_days;
    if (graceDays != null && graceDays >= 0) {
      const cutoffMs = Date.now() - graceDays * 24 * 60 * 60 * 1000;
      const cutoffIso = new Date(cutoffMs).toISOString();
      let longOwnerless = 0;
      for (const part of chunkIds(ids, CHUNK)) {
        const { count } = await admin
          .from("contracts")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .in("status", ["active", "pending_review"])
          .is("owner_id", null)
          .lt("created_at", cutoffIso)
          .in("id", part);
        longOwnerless += count ?? 0;
      }
      if (longOwnerless > 0) {
        breaches.push({
          code: "ownerless_grace_exceeded",
          detail: `${longOwnerless} contract(s) in scope have no owner beyond the ${graceDays}-day calendar grace window`,
          severity: "high",
        });
      }
    }
  }

  const renewalHorizon = policyJson.renewal_within_days_require_finance_legal_review;
  if (renewalHorizon != null && renewalHorizon > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizonEnd = new Date(today.getTime() + renewalHorizon * 24 * 60 * 60 * 1000);
    let missingReview = 0;
    const samples: string[] = [];

    for (const part of chunkIds(ids, CHUNK)) {
      const { data: fields } = await admin
        .from("extracted_fields")
        .select("contract_id, field_value")
        .eq("organization_id", orgId)
        .eq("field_name", "renewal_date")
        .eq("status", "approved")
        .in("contract_id", part);

      const nearRenewal = new Set<string>();
      for (const row of fields ?? []) {
        const cid = String((row as { contract_id: string }).contract_id);
        const raw = (row as { field_value?: string | null }).field_value;
        if (!raw) continue;
        const d = new Date(raw.trim());
        if (Number.isNaN(d.getTime())) continue;
        if (d < today || d > horizonEnd) continue;
        nearRenewal.add(cid);
      }

      const nearList = [...nearRenewal];
      if (nearList.length === 0) continue;

      const { data: appr } = await admin
        .from("contract_approvals")
        .select("contract_id")
        .eq("organization_id", orgId)
        .eq("approval_type", "renewal_decision")
        .in("status", ["pending", "approved"])
        .in("contract_id", nearList);

      const covered = new Set((appr ?? []).map((r) => String((r as { contract_id: string }).contract_id)));
      for (const cid of nearList) {
        if (!covered.has(cid)) {
          missingReview += 1;
          if (samples.length < 8) samples.push(cid);
        }
      }
    }

    if (missingReview > 0) {
      breaches.push({
        code: "renewal_finance_legal_review_gap",
        detail: `${missingReview} contract(s) have renewal within ${renewalHorizon} days without a pending or approved finance/legal renewal decision (sample contract ids: ${samples.join(", ")})`,
        severity: "high",
      });
    }
  }

  if (policyJson.renewal_decision_requires_pricing_rationale) {
    const { data: decisions } = await admin
      .from("decision_workspaces")
      .select("id, linked_contract_ids, recommendation_json")
      .eq("organization_id", orgId)
      .in("decision_type", ["renewal", "renewal_recommendation"])
      .in("status", ["open", "in_review"])
      .limit(80);

    const idSet = new Set(ids);
    let bad = 0;
    for (const dw of decisions ?? []) {
      const linked = (dw as { linked_contract_ids?: string[] }).linked_contract_ids ?? [];
      const touches = linked.some((c) => idSet.has(String(c)));
      if (!touches) continue;
      const rec = (dw as { recommendation_json?: Record<string, unknown> }).recommendation_json ?? {};
      const pr = rec.pricing_rationale ?? rec.commercial_rationale;
      const ok =
        typeof pr === "string"
          ? pr.trim().length >= 8
          : pr && typeof pr === "object" && Object.keys(pr as object).length > 0;
      if (!ok) bad += 1;
    }
    if (bad > 0) {
      breaches.push({
        code: "renewal_packet_pricing_rationale",
        detail: `${bad} open renewal decision workspace(s) in scope lack pricing or commercial rationale in recommendation_json`,
        severity: "medium",
      });
    }
  }

  const minFresh = evidenceExpectations.min_fresh_coverage;
  if (minFresh != null && minFresh > 0 && minFresh <= 1 && ids.length > 0) {
    const maxAge = evidenceExpectations.fresh_evidence_max_age_days ?? 90;
    const cutoffMs = Date.now() - maxAge * 24 * 60 * 60 * 1000;
    const cutoffIso = new Date(cutoffMs).toISOString();
    let contractsWithFresh = 0;
    for (const part of chunkIds(ids, CHUNK)) {
      const { data: reqs } = await admin
        .from("evidence_requirements")
        .select("id, contract_id")
        .eq("organization_id", orgId)
        .in("contract_id", part);
      const reqIds = [...new Set((reqs ?? []).map((r) => String((r as { id: string }).id)))];
      const reqToContract = new Map<string, string>();
      for (const r of reqs ?? []) {
        reqToContract.set(String((r as { id: string }).id), String((r as { contract_id: string }).contract_id));
      }
      const freshByContract = new Set<string>();
      if (reqIds.length > 0) {
        const { data: subs } = await admin
          .from("evidence_submissions")
          .select("requirement_id, status, submitted_at, reviewed_at")
          .eq("organization_id", orgId)
          .in("requirement_id", reqIds)
          .in("status", ["submitted", "approved"]);
        for (const s of subs ?? []) {
          const st = String((s as { status: string }).status);
          const reviewed = (s as { reviewed_at?: string | null }).reviewed_at;
          const submitted = (s as { submitted_at?: string }).submitted_at;
          const at = String(reviewed || submitted || "");
          if (!at || at < cutoffIso) continue;
          if (st !== "submitted" && st !== "approved") continue;
          const rid = String((s as { requirement_id: string }).requirement_id);
          const cid = reqToContract.get(rid);
          if (cid) freshByContract.add(cid);
        }
      }
      for (const cid of part) {
        if (freshByContract.has(cid)) contractsWithFresh += 1;
      }
    }
    const ratio = contractsWithFresh / ids.length;
    if (ratio + 1e-9 < minFresh) {
      breaches.push({
        code: "evidence_fresh_coverage",
        detail: `Fresh evidence coverage ${(ratio * 100).toFixed(1)}% is below minimum ${(minFresh * 100).toFixed(1)}% (${maxAge}d window, ${ids.length} contract(s) in scope)`,
        severity: "medium",
      });
    }
  }

  return breaches;
}
