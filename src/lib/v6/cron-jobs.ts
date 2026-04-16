import type { AdminClient } from "@/lib/v6/service";
import { listOrganizationIds } from "@/lib/v6/cron";
import { runAssuranceChecks, recomputeScorecards } from "@/lib/v6/service";
import { computeOutcomeViews } from "@/lib/v6/outcomes";
import { rebuildHealthGraphFromPortfolio } from "@/lib/v6/health-graph";
import { runControlPolicyReevaluation } from "@/lib/v6/assurance-checks";
import { executeAutopilotAction, type AutopilotRuleRow } from "@/lib/v6/autopilot-executors";
import { assembleReviewBoardPacket } from "@/lib/v6/review-boards";
import { deliverReviewBoardRunNotifications } from "@/lib/v6/review-board-notifications";
import { recomputeSegmentMemberships } from "@/lib/v6/segments";
import { backfillOutcomeSnapshots } from "@/lib/v6/outcome-writers";
import { recordMissedExternalDeadlineFinding } from "@/lib/v6/external-collaboration";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runModularAssuranceChecks } from "@/lib/v6/assurance-checks";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function runAssuranceChecksForAllOrgs(admin: AdminClient) {
  const orgIds = await listOrganizationIds(admin);
  let checkRuns = 0;
  for (const orgId of orgIds) {
    try {
      const result = await runAssuranceChecks(admin, orgId, null);
      if (!result.errors.length) {
        checkRuns += 1;
        await incrementV6QualityCounter(admin, orgId, "cron_v6_assurance_checks_org_ok_total", 1).catch(() => undefined);
      }
    } catch (err) {
      console.error("[cron-jobs] runAssuranceChecksForAllOrgs failed for org", orgId, err);
    }
  }
  return { checkRuns };
}

export async function refreshFindingsAging(admin: AdminClient) {
  const orgIds = await listOrganizationIds(admin);
  let updated = 0;
  for (const orgId of orgIds) {
    try {
      const { data } = await admin
        .from("assurance_findings")
        .select("id, created_at, status")
        .eq("organization_id", orgId)
        .eq("status", "open")
        .limit(500);

      for (const finding of data ?? []) {
        const ageDays = Math.floor((Date.now() - Date.parse(String(finding.created_at))) / (1000 * 60 * 60 * 24));
        const { data: full } = await admin
          .from("assurance_findings")
          .select("severity, analyst_note")
          .eq("organization_id", orgId)
          .eq("id", String(finding.id))
          .maybeSingle();
        const currentSev = String((full as { severity?: string } | null)?.severity ?? "medium");
        let nextSev = currentSev;
        if (ageDays >= 30 && currentSev !== "critical") nextSev = "critical";
        else if (ageDays >= 14 && currentSev === "low") nextSev = "medium";
        else if (ageDays >= 14 && currentSev === "medium") nextSev = "high";

        const notePrefix = `Aging: ${ageDays} day(s) open`;
        const prevNote = String((full as { analyst_note?: string | null } | null)?.analyst_note ?? "");
        const analyst_note = prevNote.startsWith("Aging:") ? `${notePrefix}` : `${notePrefix}. ${prevNote}`.trim();

        const { error: updateErr } = await admin
          .from("assurance_findings")
          .update({
            analyst_note,
            severity: nextSev,
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", orgId)
          .eq("id", String(finding.id));

        if (updateErr) {
          console.error("[cron-jobs] refreshFindingsAging update failed", { orgId, findingId: finding.id, error: updateErr });
          continue;
        }

        if (nextSev !== currentSev) {
          await admin.from("assurance_finding_events").insert({
            organization_id: orgId,
            finding_id: String(finding.id),
            event_type: "finding.aged_escalation",
            actor_user_id: null,
            payload_json: { from_severity: currentSev, to_severity: nextSev, age_days: ageDays },
          });
        }
        updated += 1;
      }
      await incrementV6QualityCounter(admin, orgId, "cron_v6_finding_refresh_org_processed_total", 1).catch(
        () => undefined
      );
    } catch (err) {
      console.error("[cron-jobs] refreshFindingsAging failed for org", orgId, err);
    }
  }
  return { updated };
}

export async function runAutopilotDryRun(admin: AdminClient) {
  const orgIds = await listOrganizationIds(admin);
  let logs = 0;
  for (const orgId of orgIds) {
    try {
      const { data: rules } = await admin
        .from("autopilot_rules")
        .select("id, action_type, allowlist_json, requires_approval, enabled")
        .eq("organization_id", orgId)
        .limit(100);

      for (const rule of rules ?? []) {
        const { output } = await executeAutopilotAction(admin, orgId, null, rule as AutopilotRuleRow, true, {});
        await admin.from("autopilot_run_logs").insert({
          organization_id: orgId,
          autopilot_rule_id: rule.id,
          status: "dry_run",
          action_type: rule.action_type,
          reason: "Scheduled dry-run validation",
          input_json: { scheduled: true },
          output_json: output,
        });
        logs += 1;
      }
      await incrementV6QualityCounter(admin, orgId, "cron_v6_autopilot_dry_run_org_ok_total", 1).catch(() => undefined);
    } catch (err) {
      console.error("[cron-jobs] runAutopilotDryRun failed for org", orgId, err);
    }
  }
  return { logs };
}

export async function runAutopilotExecution(admin: AdminClient) {
  const orgIds = await listOrganizationIds(admin);
  let executed = 0;
  for (const orgId of orgIds) {
    try {
      const { data: openFinding } = await admin
        .from("assurance_findings")
        .select("id")
        .eq("organization_id", orgId)
        .in("status", ["open", "in_review"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: rules } = await admin
        .from("autopilot_rules")
        .select("id, action_type, allowlist_json, requires_approval, enabled")
        .eq("organization_id", orgId)
        .eq("enabled", true)
        .limit(100);

      for (const rule of rules ?? []) {
        const r = rule as AutopilotRuleRow & { requires_approval?: boolean };
        if (r.requires_approval) {
          await admin.from("autopilot_run_logs").insert({
            organization_id: orgId,
            autopilot_rule_id: rule.id,
            status: "blocked",
            action_type: rule.action_type,
            reason: "requires_approval",
            input_json: { scheduled: true },
            output_json: { blocked: true },
          });
          executed += 1;
          continue;
        }

        const { output } = await executeAutopilotAction(admin, orgId, null, r, false, {
          findingId: openFinding?.id ? String(openFinding.id) : null,
          targetRefId: openFinding?.id ? String(openFinding.id) : undefined,
        });
        const masterBlocked = output.blocked === "autopilot_execution_master_disabled";
        const ok =
          !masterBlocked && output.created !== false && output.mode !== "logged_only" && !output.blocked;
        await admin.from("autopilot_run_logs").insert({
          organization_id: orgId,
          autopilot_rule_id: rule.id,
          status: masterBlocked ? "blocked" : ok ? "executed" : "failed",
          action_type: rule.action_type,
          reason: "Scheduled autopilot execution",
          input_json: { scheduled: true },
          output_json: output,
        });
        executed += 1;
      }
      await incrementV6QualityCounter(admin, orgId, "cron_v6_autopilot_execution_org_ok_total", 1).catch(
        () => undefined
      );
    } catch (err) {
      console.error("[cron-jobs] runAutopilotExecution failed for org", orgId, err);
    }
  }
  return { executed };
}

export async function recomputeScorecardsForAllOrgs(admin: AdminClient) {
  const orgIds = await listOrganizationIds(admin);
  let updated = 0;
  for (const orgId of orgIds) {
    try {
      const result = await recomputeScorecards(admin, orgId);
      if (!result.error) {
        updated += 1;
        await incrementV6QualityCounter(admin, orgId, "cron_v6_scorecard_recompute_org_ok_total", 1).catch(
          () => undefined
        );
      }
    } catch (err) {
      console.error("[cron-jobs] recomputeScorecardsForAllOrgs failed for org", orgId, err);
    }
  }
  return { updated };
}

export async function rebuildHealthGraph(admin: AdminClient) {
  const orgIds = await listOrganizationIds(admin);
  let nodes = 0;
  let edges = 0;
  for (const orgId of orgIds) {
    try {
      const res = await rebuildHealthGraphFromPortfolio(admin, orgId);
      nodes += res.nodes;
      edges += res.edges;
      await incrementV6QualityCounter(admin, orgId, "cron_v6_health_graph_org_ok_total", 1).catch(() => undefined);
    } catch (err) {
      console.error("[cron-jobs] rebuildHealthGraph failed for org", orgId, err);
    }
  }
  return { nodes, edges };
}

export async function reevaluateControlPolicies(admin: AdminClient) {
  const orgIds = await listOrganizationIds(admin);
  let evaluations = 0;
  for (const orgId of orgIds) {
    try {
      const res = await runControlPolicyReevaluation(admin, orgId);
      if (!res.error) {
        evaluations += 1;
        await incrementV6QualityCounter(admin, orgId, "cron_v6_control_policy_reeval_org_ok_total", 1).catch(
          () => undefined
        );
      }
    } catch (err) {
      console.error("[cron-jobs] reevaluateControlPolicies failed for org", orgId, err);
    }
  }
  return { evaluations };
}

/** Scan open external links whose workflow_deadline_iso has passed; record assurance findings (deduped in helper). */
export async function scanExternalWorkflowDeadlines(admin: AdminClient) {
  if (!isFeatureEnabled("v6AssuranceCore")) {
    return { escalated: 0 };
  }
  const { data: links } = await admin
    .from("external_action_links")
    .select("id, organization_id, action_type, scope_json, status, expires_at")
    .eq("status", "open")
    .limit(400);

  const now = Date.now();
  let escalated = 0;
  const orgsEscalated = new Set<string>();
  for (const link of links ?? []) {
    const scope = (link as { scope_json?: Record<string, unknown> }).scope_json ?? {};
    const deadlineRaw = scope.workflow_deadline_iso;
    if (typeof deadlineRaw !== "string") continue;
    const t = Date.parse(deadlineRaw);
    if (!Number.isFinite(t) || t > now) continue;

    const linkOrgId = String((link as { organization_id: string }).organization_id);
    await recordMissedExternalDeadlineFinding(
      admin,
      linkOrgId,
      String((link as { id: string }).id),
      String((link as { action_type: string }).action_type)
    ).catch(() => undefined);
    orgsEscalated.add(linkOrgId);
    escalated += 1;
  }
  for (const oid of orgsEscalated) {
    await incrementV6QualityCounter(admin, oid, "cron_v6_external_deadline_org_touched_total", 1).catch(
      () => undefined
    );
  }
  return { escalated };
}

export async function recomputeOutcomeEffectiveness(admin: AdminClient) {
  const orgIds = await listOrganizationIds(admin);
  let analyzed = 0;
  for (const orgId of orgIds) {
    try {
      const { backfilled_runs: backfilled } = await backfillOutcomeSnapshots(admin, orgId);
      analyzed += backfilled;
      const views = await computeOutcomeViews(admin, orgId);
      if (!views.error) {
        analyzed += views.interventions.length;
      }
      await incrementV6QualityCounter(admin, orgId, "cron_v6_outcome_effectiveness_org_ok_total", 1).catch(
        () => undefined
      );
    } catch (err) {
      console.error("[cron-jobs] recomputeOutcomeEffectiveness failed for org", orgId, err);
    }
  }
  return { analyzed };
}

export async function generateReviewBoardPackets(admin: AdminClient) {
  const orgIds = await listOrganizationIds(admin);
  let generated = 0;
  for (const orgId of orgIds) {
    try {
      const { data: boards } = await admin
        .from("review_boards")
        .select("id, name, subscriptions_json")
        .eq("organization_id", orgId)
        .eq("active", true)
        .limit(100);

      for (const board of boards ?? []) {
        const bid = String((board as { id: string }).id);
        const assembled = await assembleReviewBoardPacket(admin, orgId, bid);
        const { data: runRow, error: runErr } = await admin
          .from("review_board_runs")
          .insert({
            organization_id: orgId,
            review_board_id: bid,
            status: "generated",
            agenda_json: { ...assembled.agenda_json, source: "cron" },
            packet_json: assembled.packet_json,
            unresolved_findings_json: assembled.unresolved_findings_json,
          })
          .select("id")
          .single();

        if (!runErr && runRow?.id) {
          const packet = assembled.packet_json as { summary?: Record<string, unknown> };
          await deliverReviewBoardRunNotifications(admin, orgId, {
            boardId: bid,
            boardName: String((board as { name?: string }).name ?? "Review board"),
            runId: String(runRow.id),
            subscriptions: (board as { subscriptions_json?: unknown }).subscriptions_json,
            packetSummary: packet.summary ?? {},
            source: "cron",
          }).catch(() => undefined);
          generated += 1;
        }
      }
      await incrementV6QualityCounter(admin, orgId, "cron_v6_review_board_packet_org_ok_total", 1).catch(
        () => undefined
      );
    } catch (err) {
      console.error("[cron-jobs] generateReviewBoardPackets failed for org", orgId, err);
    }
  }
  return { generated };
}

export async function recomputeSegmentMembershipsForAll(admin: AdminClient) {
  const orgIds = await listOrganizationIds(admin);
  let recomputed = 0;
  for (const orgId of orgIds) {
    try {
      const { data: segments } = await admin
        .from("segment_definitions")
        .select("id")
        .eq("organization_id", orgId)
        .eq("active", true)
        .limit(100);

      for (const segment of segments ?? []) {
        await recomputeSegmentMemberships(admin, orgId, String(segment.id));
        recomputed += 1;
      }
      await incrementV6QualityCounter(admin, orgId, "cron_v6_segment_recompute_org_ok_total", 1).catch(
        () => undefined
      );
    } catch (err) {
      console.error("[cron-jobs] recomputeSegmentMembershipsForAll failed for org", orgId, err);
    }
  }
  return { recomputed };
}

/**
 * When playbooks completed 1–14 days ago defined follow-up checks, run portfolio assurance once per org
 * so watch signals and findings refresh (v6.md §9.3 follow-up checks).
 */
export async function runPlaybookFollowUpAssurancePasses(admin: AdminClient) {
  const orgIds = await listOrganizationIds(admin);
  let assuranceRuns = 0;
  const completedAfter = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const completedBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  for (const orgId of orgIds) {
    try {
      const { data: playbooks } = await admin
        .from("adaptive_playbooks")
        .select("id, follow_up_checks_json")
        .eq("organization_id", orgId)
        .eq("active", true)
        .limit(120);
      const withFollow = (playbooks ?? []).filter((p) => {
        const f = (p as { follow_up_checks_json?: unknown }).follow_up_checks_json;
        return Array.isArray(f) && f.length > 0;
      });
      if (withFollow.length === 0) continue;
      const pbIds = withFollow.map((p) => String((p as { id: string }).id));
      const { count } = await admin
        .from("adaptive_playbook_runs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "completed")
        .in("adaptive_playbook_id", pbIds)
        .gte("completed_at", completedAfter)
        .lte("completed_at", completedBefore);
      if ((count ?? 0) < 1) continue;
      await runModularAssuranceChecks(admin, orgId, null, "scheduled");
      assuranceRuns += 1;
      await incrementV6QualityCounter(admin, orgId, "cron_v6_playbook_followup_assurance_org_ok_total", 1).catch(
        () => undefined
      );
    } catch (err) {
      console.error("[cron-jobs] runPlaybookFollowUpAssurancePasses failed for org", orgId, err);
    }
  }

  return { assuranceRuns };
}
