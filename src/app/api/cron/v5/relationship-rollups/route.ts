/**
 * Relationship rollup cron: org-isolated, safe to run on a schedule.
 * Idempotent per org + account/counterparty key — ensures workspaces/timelines exist and only
 * appends rollup events when derived contract counts change (see inline snapshot compare).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireV5CronFeature } from "@/lib/v5/feature-guards";
import { listOrganizationIds, requireV5CronAuth } from "@/lib/v5/cron";
import { buildRelationshipKeyMetrics } from "@/lib/v5/relationship-key-metrics";
import {
  ensureAccountWorkspaceFromContracts,
  ensureCounterpartyWorkspaceFromContracts,
  ensureTimelineForAccount,
  ensureTimelineForCounterparty,
} from "@/lib/v5/relationship-bootstrap";
import { appendTimelineEventDeduped } from "@/lib/v5/relationship-timeline";

export async function GET(request: Request) {
  const unauthorized = requireV5CronAuth(request);
  if (unauthorized) return unauthorized;
  const skipped = requireV5CronFeature("v5RelationshipLayer");
  if (skipped) return skipped;
  const admin = await createAdminClient();
  const orgIds = await listOrganizationIds(admin);

  let timelineEvents = 0;
  for (const orgId of orgIds) {
    const { data: accountRows } = await admin
      .from("contracts")
      .select("account_key")
      .eq("organization_id", orgId)
      .not("account_key", "is", null)
      .limit(500);
    const accountKeys = [
      ...new Set((accountRows ?? []).map((r) => String(r.account_key)).filter(Boolean)),
    ].slice(0, 40);

    for (const accountKey of accountKeys) {
      const w = await ensureAccountWorkspaceFromContracts(admin, orgId, accountKey);
      if (!w) continue;
      const timelineId = await ensureTimelineForAccount(
        admin,
        orgId,
        w.id,
        `Timeline · ${w.display_name}`
      );
      if (!timelineId) continue;
      const { count } = await admin
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("account_key", accountKey);

      const { data: cRows } = await admin
        .from("contracts")
        .select("id")
        .eq("organization_id", orgId)
        .eq("account_key", accountKey)
        .limit(500);
      const cids = (cRows ?? []).map((r) => String(r.id));
      let openExceptions = 0;
      let openObligations = 0;
      if (cids.length > 0) {
        const [{ count: ex }, { count: ob }] = await Promise.all([
          admin
            .from("exceptions")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .in("contract_id", cids)
            .in("status", ["open", "in_progress"]),
          admin
            .from("contract_obligations")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .in("contract_id", cids)
            .in("status", ["open", "in_progress"]),
        ]);
        openExceptions = ex ?? 0;
        openObligations = ob ?? 0;
      }

      const refreshedAt = new Date().toISOString();
      const live =
        cids.length > 0 ? await buildRelationshipKeyMetrics(admin, orgId, cids) : null;
      await admin
        .from("account_workspaces")
        .update({
          summary_json: {
            contract_count: count ?? 0,
            open_exceptions: openExceptions,
            open_obligations: openObligations,
            refreshed_at: refreshedAt,
            ...(live
              ? {
                  pending_approvals: live.pending_approvals,
                  open_tasks: live.open_tasks,
                  unsatisfied_evidence: live.unsatisfied_evidence,
                  open_attestations: live.open_attestations,
                  active_campaign_contract_links: live.active_campaign_contract_links,
                  active_program_assignments: live.active_program_assignments,
                  renewal_checkpoints_open: live.renewal_checkpoints_open,
                }
              : {}),
          },
          health_signal_json: {
            risk_hint:
              openExceptions > 10 ? "elevated_exceptions" : openExceptions > 3 ? "watch" : "stable",
            open_exceptions: openExceptions,
            open_obligations: openObligations,
            ...(live
              ? {
                  pending_approvals: live.pending_approvals,
                  renewal_checkpoints_open: live.renewal_checkpoints_open,
                }
              : {}),
          },
          updated_at: refreshedAt,
        })
        .eq("organization_id", orgId)
        .eq("id", w.id);

      await admin.from("relationship_timeline_events").insert({
        organization_id: orgId,
        relationship_timeline_id: timelineId,
        event_type: "relationship.account_roll_up",
        payload_json: {
          account_key: accountKey,
          contract_count: count ?? 0,
          open_exceptions: openExceptions,
          open_obligations: openObligations,
          recorded_at: refreshedAt,
        },
      });
      timelineEvents += 1;

      if (live && cids.length > 0) {
        let unassignedContracts = 0;
        const { count: unownedCt } = await admin
          .from("contracts")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .in("id", cids)
          .is("owner_id", null);
        unassignedContracts = unownedCt ?? 0;
        await appendTimelineEventDeduped(admin, orgId, timelineId, "relationship.renewal_readiness", {
          account_key: accountKey,
          pending_renewal_checkpoints: live.renewal_checkpoints_open,
        });
        await appendTimelineEventDeduped(admin, orgId, timelineId, "relationship.campaign_touch", {
          account_key: accountKey,
          active_campaign_contract_links: live.active_campaign_contract_links,
        });
        await appendTimelineEventDeduped(admin, orgId, timelineId, "relationship.ownership_spread", {
          account_key: accountKey,
          contracts_without_owner: unassignedContracts,
        });
      }
    }

    const { data: cpRows } = await admin
      .from("contracts")
      .select("counterparty_key")
      .eq("organization_id", orgId)
      .not("counterparty_key", "is", null)
      .limit(500);
    const counterpartyKeys = [
      ...new Set((cpRows ?? []).map((r) => String(r.counterparty_key)).filter(Boolean)),
    ].slice(0, 40);

    for (const counterpartyKey of counterpartyKeys) {
      const w = await ensureCounterpartyWorkspaceFromContracts(admin, orgId, counterpartyKey);
      if (!w) continue;
      const timelineId = await ensureTimelineForCounterparty(
        admin,
        orgId,
        w.id,
        `Timeline · ${w.display_name}`
      );
      if (!timelineId) continue;
      const { count } = await admin
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("counterparty_key", counterpartyKey);

      const { data: cRowsCp } = await admin
        .from("contracts")
        .select("id")
        .eq("organization_id", orgId)
        .eq("counterparty_key", counterpartyKey)
        .limit(500);
      const cidsCp = (cRowsCp ?? []).map((r) => String(r.id));
      let openExceptionsCp = 0;
      let openObligationsCp = 0;
      if (cidsCp.length > 0) {
        const [{ count: ex }, { count: ob }] = await Promise.all([
          admin
            .from("exceptions")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .in("contract_id", cidsCp)
            .in("status", ["open", "in_progress"]),
          admin
            .from("contract_obligations")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .in("contract_id", cidsCp)
            .in("status", ["open", "in_progress"]),
        ]);
        openExceptionsCp = ex ?? 0;
        openObligationsCp = ob ?? 0;
      }

      const refreshedCp = new Date().toISOString();
      const liveCp =
        cidsCp.length > 0 ? await buildRelationshipKeyMetrics(admin, orgId, cidsCp) : null;
      await admin
        .from("counterparty_workspaces")
        .update({
          summary_json: {
            contract_count: count ?? 0,
            open_exceptions: openExceptionsCp,
            open_obligations: openObligationsCp,
            refreshed_at: refreshedCp,
            ...(liveCp
              ? {
                  pending_approvals: liveCp.pending_approvals,
                  open_tasks: liveCp.open_tasks,
                  unsatisfied_evidence: liveCp.unsatisfied_evidence,
                  open_attestations: liveCp.open_attestations,
                  active_campaign_contract_links: liveCp.active_campaign_contract_links,
                  active_program_assignments: liveCp.active_program_assignments,
                  renewal_checkpoints_open: liveCp.renewal_checkpoints_open,
                }
              : {}),
          },
          health_signal_json: {
            risk_hint:
              openExceptionsCp > 10
                ? "elevated_exceptions"
                : openExceptionsCp > 3
                  ? "watch"
                  : "stable",
            open_exceptions: openExceptionsCp,
            open_obligations: openObligationsCp,
            ...(liveCp
              ? {
                  pending_approvals: liveCp.pending_approvals,
                  renewal_checkpoints_open: liveCp.renewal_checkpoints_open,
                }
              : {}),
          },
          updated_at: refreshedCp,
        })
        .eq("organization_id", orgId)
        .eq("id", w.id);

      await admin.from("relationship_timeline_events").insert({
        organization_id: orgId,
        relationship_timeline_id: timelineId,
        event_type: "relationship.counterparty_roll_up",
        payload_json: {
          counterparty_key: counterpartyKey,
          contract_count: count ?? 0,
          open_exceptions: openExceptionsCp,
          open_obligations: openObligationsCp,
          recorded_at: refreshedCp,
        },
      });
      timelineEvents += 1;

      if (liveCp && cidsCp.length > 0) {
        let unassignedContractsCp = 0;
        const { count: unownedCp } = await admin
          .from("contracts")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .in("id", cidsCp)
          .is("owner_id", null);
        unassignedContractsCp = unownedCp ?? 0;
        await appendTimelineEventDeduped(admin, orgId, timelineId, "relationship.renewal_readiness", {
          counterparty_key: counterpartyKey,
          pending_renewal_checkpoints: liveCp.renewal_checkpoints_open,
        });
        await appendTimelineEventDeduped(admin, orgId, timelineId, "relationship.campaign_touch", {
          counterparty_key: counterpartyKey,
          active_campaign_contract_links: liveCp.active_campaign_contract_links,
        });
        await appendTimelineEventDeduped(admin, orgId, timelineId, "relationship.ownership_spread", {
          counterparty_key: counterpartyKey,
          contracts_without_owner: unassignedContractsCp,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, rollupsRecorded: timelineEvents });
}
