import type { AdminClient } from "@/lib/v6/service";
import { listOrganizationIds } from "@/lib/v6/cron";
import { runAssuranceChecks, recomputeScorecards } from "@/lib/v6/service";
import { computeOutcomeViews } from "@/lib/v6/outcomes";
import { rebuildHealthGraphFromPortfolio } from "@/lib/v6/health-graph";
import { runControlPolicyReevaluation, runModularAssuranceChecks } from "@/lib/v6/assurance-checks";
import { executeAutopilotAction, type AutopilotRuleRow } from "@/lib/v6/autopilot-executors";
import { assembleReviewBoardPacket } from "@/lib/v6/review-boards";
import { deliverReviewBoardRunNotifications } from "@/lib/v6/review-board-notifications";
import { recomputeSegmentMemberships } from "@/lib/v6/segments";
import { backfillOutcomeSnapshots } from "@/lib/v6/outcome-writers";
import { recordMissedExternalDeadlineFinding } from "@/lib/v6/external-collaboration";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { safeErrorMessage, type BatchItemError } from "@/lib/route-runtime-contract";

type V6CronJobBaseResult = {
  orgsSucceeded: number;
  orgsFailed: number;
  orgsSkipped: number;
  errors: BatchItemError[];
};

function cronJobError(
  scope: string,
  phase: BatchItemError["phase"],
  diagnosticId: string,
  message: string
): BatchItemError {
  return { scope, phase, diagnostic_id: diagnosticId, message };
}

function summarizeUnknownErrors(items: unknown[], fallback: string): string {
  const messages = items
    .map((item) => {
      if (item instanceof Error) return item.message;
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "message" in item) {
        const message = (item as { message?: unknown }).message;
        return typeof message === "string" ? message : undefined;
      }
      return undefined;
    })
    .filter((value): value is string => Boolean(value))
    .slice(0, 3);
  return messages.join("; ") || fallback;
}

async function resolveCronOrgIds(admin: AdminClient, providedOrgIds?: string[]) {
  if (providedOrgIds) return { orgIds: providedOrgIds, errors: [] as BatchItemError[] };
  const scan = await listOrganizationIds(admin);
  const errors: BatchItemError[] = [];
  if (scan.error) {
    errors.push(
      cronJobError("organizations", "source_query", "v6_cron_organization_query_failed", scan.error.message)
    );
    return { orgIds: [] as string[], errors };
  }
  if (scan.stoppedByOffsetCap) {
    errors.push(
      cronJobError(
        "organizations",
        "source_query",
        "v6_cron_organization_scan_truncated",
        "organization scan reached the configured maximum offset"
      )
    );
  }
  return { orgIds: scan.orgIds, errors };
}

function finalizeBaseResult(errors: BatchItemError[], orgsSucceeded: number, orgsFailed: number, orgsSkipped: number) {
  return { errors, orgsSucceeded, orgsFailed, orgsSkipped } satisfies V6CronJobBaseResult;
}

function recordOrgStatus(status: "success" | "failed" | "skipped", counts: V6CronJobBaseResult) {
  if (status === "success") counts.orgsSucceeded += 1;
  else if (status === "skipped") counts.orgsSkipped += 1;
  else counts.orgsFailed += 1;
}

export async function runAssuranceChecksForAllOrgs(admin: AdminClient, providedOrgIds?: string[]) {
  const resolved = await resolveCronOrgIds(admin, providedOrgIds);
  const counts = finalizeBaseResult(resolved.errors, 0, 0, 0);
  let checkRuns = 0;

  for (const orgId of resolved.orgIds) {
    let status: "success" | "failed" | "skipped" = "success";
    try {
      const result = await runAssuranceChecks(admin, orgId, null);
      if (result.errors.length > 0) {
        status = "failed";
        counts.errors.push(
          cronJobError(
            orgId,
            "handler",
            "v6_assurance_checks_org_degraded",
            summarizeUnknownErrors(result.errors, "assurance checks returned errors")
          )
        );
      } else {
        checkRuns += 1;
        await incrementV6QualityCounter(admin, orgId, "cron_v6_assurance_checks_org_ok_total", 1).catch(() => undefined);
      }
    } catch (err) {
      status = "failed";
      console.error("[cron-jobs] runAssuranceChecksForAllOrgs failed for org", orgId, err);
      counts.errors.push(
        cronJobError(
          orgId,
          "handler",
          "v6_assurance_checks_org_failed",
          safeErrorMessage(err) ?? "runAssuranceChecksForAllOrgs failed"
        )
      );
    }
    recordOrgStatus(status, counts);
  }

  return { checkRuns, ...counts };
}

export async function refreshFindingsAging(admin: AdminClient, providedOrgIds?: string[]) {
  const resolved = await resolveCronOrgIds(admin, providedOrgIds);
  const counts = finalizeBaseResult(resolved.errors, 0, 0, 0);
  let updated = 0;
  let findingsScanned = 0;

  for (const orgId of resolved.orgIds) {
    let status: "success" | "failed" | "skipped" = "success";
    try {
      const findingsResult = await admin
        .from("assurance_findings")
        .select("id, created_at, status")
        .eq("organization_id", orgId)
        .eq("status", "open")
        .limit(500);
      if (findingsResult.error) {
        status = "failed";
        counts.errors.push(
          cronJobError(
            orgId,
            "source_query",
            "v6_finding_refresh_query_failed",
            findingsResult.error.message
          )
        );
        recordOrgStatus(status, counts);
        continue;
      }

      const findings = findingsResult.data ?? [];
      findingsScanned += findings.length;
      for (const finding of findings) {
        const findingId = String((finding as { id: string }).id);
        const ageDays = Math.floor((Date.now() - Date.parse(String(finding.created_at))) / (1000 * 60 * 60 * 24));
        const fullResult = await admin
          .from("assurance_findings")
          .select("severity, analyst_note")
          .eq("organization_id", orgId)
          .eq("id", findingId)
          .maybeSingle();
        if (fullResult.error) {
          status = "failed";
          counts.errors.push(
            cronJobError(
              `${orgId}:${findingId}`,
              "source_query",
              "v6_finding_refresh_read_failed",
              fullResult.error.message
            )
          );
          continue;
        }

        const full = fullResult.data as { severity?: string; analyst_note?: string | null } | null;
        const currentSev = String(full?.severity ?? "medium");
        let nextSev = currentSev;
        if (ageDays >= 30 && currentSev !== "critical") nextSev = "critical";
        else if (ageDays >= 14 && currentSev === "low") nextSev = "medium";
        else if (ageDays >= 14 && currentSev === "medium") nextSev = "high";

        const notePrefix = `Aging: ${ageDays} day(s) open`;
        const prevNote = String(full?.analyst_note ?? "");
        const analyst_note = prevNote.startsWith("Aging:") ? notePrefix : `${notePrefix}. ${prevNote}`.trim();

        const { error: updateErr } = await admin
          .from("assurance_findings")
          .update({
            analyst_note,
            severity: nextSev,
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", orgId)
          .eq("id", findingId);
        if (updateErr) {
          status = "failed";
          console.error("[cron-jobs] refreshFindingsAging update failed", { orgId, findingId, error: updateErr });
          counts.errors.push(
            cronJobError(`${orgId}:${findingId}`, "persist", "v6_finding_refresh_update_failed", updateErr.message)
          );
          continue;
        }

        updated += 1;
        if (nextSev !== currentSev) {
          const { error: eventErr } = await admin.from("assurance_finding_events").insert({
            organization_id: orgId,
            finding_id: findingId,
            event_type: "finding.aged_escalation",
            actor_user_id: null,
            payload_json: { from_severity: currentSev, to_severity: nextSev, age_days: ageDays },
          });
          if (eventErr) {
            status = "failed";
            counts.errors.push(
              cronJobError(
                `${orgId}:${findingId}`,
                "persist",
                "v6_finding_refresh_event_insert_failed",
                eventErr.message
              )
            );
          }
        }
      }
      await incrementV6QualityCounter(admin, orgId, "cron_v6_finding_refresh_org_processed_total", 1).catch(
        () => undefined
      );
    } catch (err) {
      status = "failed";
      console.error("[cron-jobs] refreshFindingsAging failed for org", orgId, err);
      counts.errors.push(
        cronJobError(
          orgId,
          "handler",
          "v6_finding_refresh_org_failed",
          safeErrorMessage(err) ?? "refreshFindingsAging failed"
        )
      );
    }
    recordOrgStatus(status, counts);
  }

  return { updated, findingsScanned, ...counts };
}

export async function runAutopilotDryRun(admin: AdminClient, providedOrgIds?: string[]) {
  const resolved = await resolveCronOrgIds(admin, providedOrgIds);
  const counts = finalizeBaseResult(resolved.errors, 0, 0, 0);
  let logs = 0;
  let rulesScanned = 0;

  for (const orgId of resolved.orgIds) {
    let status: "success" | "failed" | "skipped" = "success";
    try {
      const rulesResult = await admin
        .from("autopilot_rules")
        .select("id, action_type, allowlist_json, requires_approval, enabled")
        .eq("organization_id", orgId)
        .limit(100);
      if (rulesResult.error) {
        status = "failed";
        counts.errors.push(
          cronJobError(orgId, "source_query", "v6_autopilot_dry_run_rule_query_failed", rulesResult.error.message)
        );
        recordOrgStatus(status, counts);
        continue;
      }

      const rules = rulesResult.data ?? [];
      if (rules.length === 0) {
        recordOrgStatus("skipped", counts);
        continue;
      }

      rulesScanned += rules.length;
      for (const rule of rules) {
        const ruleId = String((rule as { id: string }).id);
        try {
          const { output } = await executeAutopilotAction(admin, orgId, null, rule as AutopilotRuleRow, true, {});
          const { error: logErr } = await admin.from("autopilot_run_logs").insert({
            organization_id: orgId,
            autopilot_rule_id: ruleId,
            status: "dry_run",
            action_type: rule.action_type,
            reason: "Scheduled dry-run validation",
            input_json: { scheduled: true },
            output_json: output,
          });
          if (logErr) {
            status = "failed";
            counts.errors.push(
              cronJobError(
                `${orgId}:${ruleId}`,
                "persist",
                "v6_autopilot_dry_run_log_insert_failed",
                logErr.message
              )
            );
            continue;
          }
          logs += 1;
        } catch (err) {
          status = "failed";
          counts.errors.push(
            cronJobError(
              `${orgId}:${ruleId}`,
              "handler",
              "v6_autopilot_dry_run_rule_failed",
              safeErrorMessage(err) ?? "autopilot dry-run failed"
            )
          );
        }
      }
      if (status === "success") {
        await incrementV6QualityCounter(admin, orgId, "cron_v6_autopilot_dry_run_org_ok_total", 1).catch(() => undefined);
      }
    } catch (err) {
      status = "failed";
      console.error("[cron-jobs] runAutopilotDryRun failed for org", orgId, err);
      counts.errors.push(
        cronJobError(
          orgId,
          "handler",
          "v6_autopilot_dry_run_org_failed",
          safeErrorMessage(err) ?? "runAutopilotDryRun failed"
        )
      );
    }
    recordOrgStatus(status, counts);
  }

  return { logs, rulesScanned, ...counts };
}

export async function runAutopilotExecution(admin: AdminClient, providedOrgIds?: string[]) {
  const resolved = await resolveCronOrgIds(admin, providedOrgIds);
  const counts = finalizeBaseResult(resolved.errors, 0, 0, 0);
  let executed = 0;
  let blocked = 0;
  let failedActions = 0;
  let rulesScanned = 0;

  for (const orgId of resolved.orgIds) {
    let status: "success" | "failed" | "skipped" = "success";
    try {
      const openFindingResult = await admin
        .from("assurance_findings")
        .select("id")
        .eq("organization_id", orgId)
        .in("status", ["open", "in_review"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (openFindingResult.error) {
        status = "failed";
        counts.errors.push(
          cronJobError(
            orgId,
            "source_query",
            "v6_autopilot_execution_finding_lookup_failed",
            openFindingResult.error.message
          )
        );
        recordOrgStatus(status, counts);
        continue;
      }

      const rulesResult = await admin
        .from("autopilot_rules")
        .select("id, action_type, allowlist_json, requires_approval, enabled")
        .eq("organization_id", orgId)
        .eq("enabled", true)
        .limit(100);
      if (rulesResult.error) {
        status = "failed";
        counts.errors.push(
          cronJobError(orgId, "source_query", "v6_autopilot_execution_rule_query_failed", rulesResult.error.message)
        );
        recordOrgStatus(status, counts);
        continue;
      }

      const rules = rulesResult.data ?? [];
      if (rules.length === 0) {
        recordOrgStatus("skipped", counts);
        continue;
      }

      rulesScanned += rules.length;
      for (const rule of rules) {
        const r = rule as AutopilotRuleRow & { requires_approval?: boolean };
        const ruleId = String(rule.id);
        if (r.requires_approval) {
          const { error: logErr } = await admin.from("autopilot_run_logs").insert({
            organization_id: orgId,
            autopilot_rule_id: rule.id,
            status: "blocked",
            action_type: rule.action_type,
            reason: "requires_approval",
            input_json: { scheduled: true },
            output_json: { blocked: true },
          });
          if (logErr) {
            status = "failed";
            counts.errors.push(
              cronJobError(
                `${orgId}:${ruleId}`,
                "persist",
                "v6_autopilot_execution_blocked_log_failed",
                logErr.message
              )
            );
          } else {
            blocked += 1;
          }
          continue;
        }

        try {
          const { output } = await executeAutopilotAction(admin, orgId, null, r, false, {
            findingId: openFindingResult.data?.id ? String(openFindingResult.data.id) : null,
            targetRefId: openFindingResult.data?.id ? String(openFindingResult.data.id) : undefined,
          });
          const masterBlocked = output.blocked === "autopilot_execution_master_disabled";
          const ruleBlocked = Boolean(output.blocked);
          const ok = !ruleBlocked && output.created !== false && output.mode !== "logged_only";
          const logStatus = masterBlocked || ruleBlocked ? "blocked" : ok ? "executed" : "failed";
          const { error: logErr } = await admin.from("autopilot_run_logs").insert({
            organization_id: orgId,
            autopilot_rule_id: rule.id,
            status: logStatus,
            action_type: rule.action_type,
            reason: "Scheduled autopilot execution",
            input_json: { scheduled: true },
            output_json: output,
          });
          if (logErr) {
            status = "failed";
            counts.errors.push(
              cronJobError(
                `${orgId}:${ruleId}`,
                "persist",
                "v6_autopilot_execution_log_insert_failed",
                logErr.message
              )
            );
            continue;
          }

          if (masterBlocked || ruleBlocked) {
            blocked += 1;
            continue;
          }
          if (ok) {
            executed += 1;
            continue;
          }

          failedActions += 1;
          status = "failed";
          counts.errors.push(
            cronJobError(
              `${orgId}:${ruleId}`,
              "handler",
              "v6_autopilot_execution_rule_failed",
              "autopilot execution output indicated failure"
            )
          );
        } catch (err) {
          failedActions += 1;
          status = "failed";
          counts.errors.push(
            cronJobError(
              `${orgId}:${ruleId}`,
              "handler",
              "v6_autopilot_execution_rule_exception",
              safeErrorMessage(err) ?? "autopilot execution failed"
            )
          );
        }
      }
      if (status === "success") {
        await incrementV6QualityCounter(admin, orgId, "cron_v6_autopilot_execution_org_ok_total", 1).catch(
          () => undefined
        );
      }
    } catch (err) {
      status = "failed";
      console.error("[cron-jobs] runAutopilotExecution failed for org", orgId, err);
      counts.errors.push(
        cronJobError(
          orgId,
          "handler",
          "v6_autopilot_execution_org_failed",
          safeErrorMessage(err) ?? "runAutopilotExecution failed"
        )
      );
    }
    recordOrgStatus(status, counts);
  }

  return { executed, blocked, failedActions, rulesScanned, ...counts };
}

export async function recomputeScorecardsForAllOrgs(admin: AdminClient, providedOrgIds?: string[]) {
  const resolved = await resolveCronOrgIds(admin, providedOrgIds);
  const counts = finalizeBaseResult(resolved.errors, 0, 0, 0);
  let updated = 0;

  for (const orgId of resolved.orgIds) {
    let status: "success" | "failed" | "skipped" = "success";
    try {
      const result = await recomputeScorecards(admin, orgId);
      if (result.error || (result.errors?.length ?? 0) > 0) {
        status = "failed";
        counts.errors.push(
          cronJobError(
            orgId,
            "persist",
            "v6_scorecard_recompute_failed",
            result.error?.message ?? summarizeUnknownErrors(result.errors ?? [], "scorecard recompute failed")
          )
        );
      } else if ((result.data ?? []).length === 0) {
        status = "skipped";
      } else {
        updated += 1;
        await incrementV6QualityCounter(admin, orgId, "cron_v6_scorecard_recompute_org_ok_total", 1).catch(
          () => undefined
        );
      }
    } catch (err) {
      status = "failed";
      console.error("[cron-jobs] recomputeScorecardsForAllOrgs failed for org", orgId, err);
      counts.errors.push(
        cronJobError(
          orgId,
          "handler",
          "v6_scorecard_recompute_org_failed",
          safeErrorMessage(err) ?? "recomputeScorecardsForAllOrgs failed"
        )
      );
    }
    recordOrgStatus(status, counts);
  }

  return { updated, ...counts };
}

export async function rebuildHealthGraph(admin: AdminClient, providedOrgIds?: string[]) {
  const resolved = await resolveCronOrgIds(admin, providedOrgIds);
  const counts = finalizeBaseResult(resolved.errors, 0, 0, 0);
  let nodes = 0;
  let edges = 0;
  let attemptedNodes = 0;
  let attemptedEdges = 0;

  for (const orgId of resolved.orgIds) {
    let status: "success" | "failed" | "skipped" = "success";
    try {
      const res = await rebuildHealthGraphFromPortfolio(admin, orgId);
      nodes += res.nodes;
      edges += res.edges;
      attemptedNodes += res.attemptedNodes ?? 0;
      attemptedEdges += res.attemptedEdges ?? 0;
      if ((res.errors ?? []).length > 0) {
        status = "failed";
        counts.errors.push(...res.errors);
      } else {
        await incrementV6QualityCounter(admin, orgId, "cron_v6_health_graph_org_ok_total", 1).catch(() => undefined);
      }
    } catch (err) {
      status = "failed";
      console.error("[cron-jobs] rebuildHealthGraph failed for org", orgId, err);
      counts.errors.push(
        cronJobError(
          orgId,
          "handler",
          "v6_health_graph_rebuild_failed",
          safeErrorMessage(err) ?? "rebuildHealthGraph failed"
        )
      );
    }
    recordOrgStatus(status, counts);
  }

  return { nodes, edges, attemptedNodes, attemptedEdges, ...counts };
}

export async function reevaluateControlPolicies(admin: AdminClient, providedOrgIds?: string[]) {
  const resolved = await resolveCronOrgIds(admin, providedOrgIds);
  const counts = finalizeBaseResult(resolved.errors, 0, 0, 0);
  let evaluations = 0;

  for (const orgId of resolved.orgIds) {
    let status: "success" | "failed" | "skipped" = "success";
    try {
      const res = await runControlPolicyReevaluation(admin, orgId);
      if (res.error) {
        status = "failed";
        counts.errors.push(
          cronJobError(orgId, "persist", "v6_control_policy_reevaluation_failed", res.error.message)
        );
      } else {
        evaluations += 1;
        await incrementV6QualityCounter(admin, orgId, "cron_v6_control_policy_reeval_org_ok_total", 1).catch(
          () => undefined
        );
      }
    } catch (err) {
      status = "failed";
      console.error("[cron-jobs] reevaluateControlPolicies failed for org", orgId, err);
      counts.errors.push(
        cronJobError(
          orgId,
          "handler",
          "v6_control_policy_reevaluation_org_failed",
          safeErrorMessage(err) ?? "reevaluateControlPolicies failed"
        )
      );
    }
    recordOrgStatus(status, counts);
  }

  return { evaluations, ...counts };
}

/** Scan open external links whose workflow_deadline_iso has passed; record assurance findings (deduped in helper). */
export async function scanExternalWorkflowDeadlines(admin: AdminClient, providedOrgIds?: string[]) {
  const resolved = await resolveCronOrgIds(admin, providedOrgIds);
  const counts = finalizeBaseResult(resolved.errors, 0, 0, 0);
  if (!isFeatureEnabled("v6AssuranceCore")) {
    counts.orgsSkipped = resolved.orgIds.length;
    return { escalated: 0, linksScanned: 0, orgsTouched: 0, ...counts };
  }

  const linksResult = await admin
    .from("external_action_links")
    .select("id, organization_id, action_type, scope_json, status, expires_at")
    .eq("status", "open")
    .limit(400);
  if (linksResult.error) {
    counts.errors.push(
      cronJobError(
        "external_action_links",
        "source_query",
        "v6_external_deadline_scan_query_failed",
        linksResult.error.message
      )
    );
    return { escalated: 0, linksScanned: 0, orgsTouched: 0, ...counts };
  }

  const links = linksResult.data ?? [];
  const now = Date.now();
  let escalated = 0;
  const orgsTouched = new Set<string>();
  const failedOrgIds = new Set<string>();

  for (const link of links) {
    const scope = (link as { scope_json?: Record<string, unknown> }).scope_json ?? {};
    const deadlineRaw = scope.workflow_deadline_iso;
    if (typeof deadlineRaw !== "string") continue;
    const t = Date.parse(deadlineRaw);
    if (!Number.isFinite(t) || t > now) continue;

    const linkOrgId = String((link as { organization_id: string }).organization_id);
    try {
      await recordMissedExternalDeadlineFinding(
        admin,
        linkOrgId,
        String((link as { id: string }).id),
        String((link as { action_type: string }).action_type)
      );
      orgsTouched.add(linkOrgId);
      escalated += 1;
    } catch (err) {
      failedOrgIds.add(linkOrgId);
      counts.errors.push(
        cronJobError(
          `${linkOrgId}:${String((link as { id: string }).id)}`,
          "persist",
          "v6_external_deadline_record_failed",
          safeErrorMessage(err) ?? "failed to record missed external deadline finding"
        )
      );
    }
  }

  for (const oid of orgsTouched) {
    await incrementV6QualityCounter(admin, oid, "cron_v6_external_deadline_org_touched_total", 1).catch(() => undefined);
  }

  counts.orgsSucceeded = Math.max(0, resolved.orgIds.length - failedOrgIds.size);
  counts.orgsFailed = failedOrgIds.size;
  return { escalated, linksScanned: links.length, orgsTouched: orgsTouched.size, ...counts };
}

export async function recomputeOutcomeEffectiveness(admin: AdminClient, providedOrgIds?: string[]) {
  const resolved = await resolveCronOrgIds(admin, providedOrgIds);
  const counts = finalizeBaseResult(resolved.errors, 0, 0, 0);
  let analyzed = 0;
  let backfilledRuns = 0;
  let viewRows = 0;

  for (const orgId of resolved.orgIds) {
    let status: "success" | "failed" | "skipped" = "success";
    try {
      try {
        const backfill = await backfillOutcomeSnapshots(admin, orgId);
        analyzed += backfill.analyzed;
        backfilledRuns += backfill.backfilled_runs;
      } catch (err) {
        status = "failed";
        counts.errors.push(
          cronJobError(
            orgId,
            "handler",
            "v6_outcome_snapshot_backfill_failed",
            safeErrorMessage(err) ?? "outcome snapshot backfill failed"
          )
        );
      }

      const views = await computeOutcomeViews(admin, orgId);
      if (views.error) {
        status = "failed";
        counts.errors.push(
          cronJobError(orgId, "source_query", "v6_outcome_view_compute_failed", views.error.message)
        );
      } else {
        viewRows += views.interventions.length;
        if (views.truncated) {
          status = "failed";
          counts.errors.push(
            cronJobError(
              orgId,
              "source_query",
              "v6_outcome_view_truncated",
              "outcome intervention analysis exceeded the compute window"
            )
          );
        }
      }

      if (status === "success") {
        await incrementV6QualityCounter(admin, orgId, "cron_v6_outcome_effectiveness_org_ok_total", 1).catch(
          () => undefined
        );
      }
    } catch (err) {
      status = "failed";
      console.error("[cron-jobs] recomputeOutcomeEffectiveness failed for org", orgId, err);
      counts.errors.push(
        cronJobError(
          orgId,
          "handler",
          "v6_outcome_effectiveness_org_failed",
          safeErrorMessage(err) ?? "recomputeOutcomeEffectiveness failed"
        )
      );
    }
    recordOrgStatus(status, counts);
  }

  return { analyzed, backfilledRuns, viewRows, ...counts };
}

export async function generateReviewBoardPackets(admin: AdminClient, providedOrgIds?: string[]) {
  const resolved = await resolveCronOrgIds(admin, providedOrgIds);
  const counts = finalizeBaseResult(resolved.errors, 0, 0, 0);
  let generated = 0;
  let duplicateRunsSkipped = 0;
  let boardsScanned = 0;
  let notificationsAttempted = 0;
  let notificationsDelivered = 0;
  const scheduleSlot = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();

  for (const orgId of resolved.orgIds) {
    let status: "success" | "failed" | "skipped" = "success";
    try {
      const boardsResult = await admin
        .from("review_boards")
        .select("id, name, subscriptions_json")
        .eq("organization_id", orgId)
        .eq("active", true)
        .limit(100);
      if (boardsResult.error) {
        status = "failed";
        counts.errors.push(
          cronJobError(orgId, "source_query", "v6_review_board_query_failed", boardsResult.error.message)
        );
        recordOrgStatus(status, counts);
        continue;
      }

      const boards = boardsResult.data ?? [];
      if (boards.length === 0) {
        recordOrgStatus("skipped", counts);
        continue;
      }

      boardsScanned += boards.length;
      for (const board of boards) {
        const boardId = String((board as { id: string }).id);
        const assembled = await assembleReviewBoardPacket(admin, orgId, boardId);
        if (Array.isArray(assembled.errors) && assembled.errors.length > 0) {
          status = "failed";
          counts.errors.push(...assembled.errors.map((error) => ({ ...error, scope: `${orgId}:${boardId}` })));
        }

        const runResult = await admin
          .from("review_board_runs")
          .insert({
            organization_id: orgId,
            review_board_id: boardId,
            status: "generated",
            agenda_json: { ...assembled.agenda_json, source: "cron", schedule_slot: scheduleSlot },
            packet_json: assembled.packet_json,
            unresolved_findings_json: assembled.unresolved_findings_json,
          })
          .select("id")
          .single();
        if (runResult.error?.code === "23505") {
          duplicateRunsSkipped += 1;
          continue;
        }
        if (runResult.error || !runResult.data?.id) {
          status = "failed";
          counts.errors.push(
            cronJobError(
              `${orgId}:${boardId}`,
              "persist",
              "v6_review_board_run_insert_failed",
              runResult.error?.message ?? "review board run insert did not return an id"
            )
          );
          continue;
        }

        const packet = assembled.packet_json as { summary?: Record<string, unknown> };
        const notificationResult = await deliverReviewBoardRunNotifications(admin, orgId, {
          boardId,
          boardName: String((board as { name?: string }).name ?? "Review board"),
          runId: String(runResult.data.id),
          subscriptions: (board as { subscriptions_json?: unknown }).subscriptions_json,
          packetSummary: packet.summary ?? {},
          source: "cron",
        });
        notificationsAttempted += notificationResult.attempted;
        notificationsDelivered += notificationResult.delivered;
        if (Array.isArray(notificationResult.errors) && notificationResult.errors.length > 0) {
          status = "failed";
          counts.errors.push(...notificationResult.errors.map((error) => ({ ...error, scope: `${orgId}:${boardId}` })));
        }
        generated += 1;
      }
      if (status === "success") {
        await incrementV6QualityCounter(admin, orgId, "cron_v6_review_board_packet_org_ok_total", 1).catch(
          () => undefined
        );
      }
    } catch (err) {
      status = "failed";
      console.error("[cron-jobs] generateReviewBoardPackets failed for org", orgId, err);
      counts.errors.push(
        cronJobError(
          orgId,
          "handler",
          "v6_review_board_packet_org_failed",
          safeErrorMessage(err) ?? "generateReviewBoardPackets failed"
        )
      );
    }
    recordOrgStatus(status, counts);
  }

  return { generated, duplicateRunsSkipped, boardsScanned, notificationsAttempted, notificationsDelivered, ...counts };
}

export async function recomputeSegmentMembershipsForAll(admin: AdminClient, providedOrgIds?: string[]) {
  const resolved = await resolveCronOrgIds(admin, providedOrgIds);
  const counts = finalizeBaseResult(resolved.errors, 0, 0, 0);
  let recomputed = 0;
  let segmentsScanned = 0;

  for (const orgId of resolved.orgIds) {
    let status: "success" | "failed" | "skipped" = "success";
    try {
      const segmentsResult = await admin
        .from("segment_definitions")
        .select("id")
        .eq("organization_id", orgId)
        .eq("active", true)
        .limit(100);
      if (segmentsResult.error) {
        status = "failed";
        counts.errors.push(
          cronJobError(orgId, "source_query", "v6_segment_recompute_query_failed", segmentsResult.error.message)
        );
        recordOrgStatus(status, counts);
        continue;
      }

      const segments = segmentsResult.data ?? [];
      if (segments.length === 0) {
        recordOrgStatus("skipped", counts);
        continue;
      }

      segmentsScanned += segments.length;
      for (const segment of segments) {
        const segmentId = String(segment.id);
        const result = await recomputeSegmentMemberships(admin, orgId, segmentId);
        if (result.error) {
          status = "failed";
          counts.errors.push(
            cronJobError(
              `${orgId}:${segmentId}`,
              "persist",
              "v6_segment_recompute_failed",
              result.error.message
            )
          );
          continue;
        }
        if (result.truncated) {
          status = "failed";
          counts.errors.push(
            cronJobError(
              `${orgId}:${segmentId}`,
              "source_query",
              "v6_segment_recompute_truncated",
              "segment recompute exceeded the configured source scan window"
            )
          );
        }
        recomputed += 1;
      }
      if (status === "success") {
        await incrementV6QualityCounter(admin, orgId, "cron_v6_segment_recompute_org_ok_total", 1).catch(
          () => undefined
        );
      }
    } catch (err) {
      status = "failed";
      console.error("[cron-jobs] recomputeSegmentMembershipsForAll failed for org", orgId, err);
      counts.errors.push(
        cronJobError(
          orgId,
          "handler",
          "v6_segment_recompute_org_failed",
          safeErrorMessage(err) ?? "recomputeSegmentMembershipsForAll failed"
        )
      );
    }
    recordOrgStatus(status, counts);
  }

  return { recomputed, segmentsScanned, ...counts };
}

/**
 * When playbooks completed 1–14 days ago defined follow-up checks, run portfolio assurance once per org
 * so watch signals and findings refresh (v6.md §9.3 follow-up checks).
 */
export async function runPlaybookFollowUpAssurancePasses(admin: AdminClient, providedOrgIds?: string[]) {
  const resolved = await resolveCronOrgIds(admin, providedOrgIds);
  const counts = finalizeBaseResult(resolved.errors, 0, 0, 0);
  let assuranceRuns = 0;
  const completedAfter = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const completedBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  for (const orgId of resolved.orgIds) {
    let status: "success" | "failed" | "skipped" = "success";
    try {
      const playbooksResult = await admin
        .from("adaptive_playbooks")
        .select("id, follow_up_checks_json")
        .eq("organization_id", orgId)
        .eq("active", true)
        .limit(120);
      if (playbooksResult.error) {
        status = "failed";
        counts.errors.push(
          cronJobError(orgId, "source_query", "v6_playbook_followup_playbook_query_failed", playbooksResult.error.message)
        );
        recordOrgStatus(status, counts);
        continue;
      }

      const withFollow = (playbooksResult.data ?? []).filter((playbook) => {
        const checks = (playbook as { follow_up_checks_json?: unknown }).follow_up_checks_json;
        return Array.isArray(checks) && checks.length > 0;
      });
      if (withFollow.length === 0) {
        recordOrgStatus("skipped", counts);
        continue;
      }

      const pbIds = withFollow.map((playbook) => String((playbook as { id: string }).id));
      const runLookup = await admin
        .from("adaptive_playbook_runs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "completed")
        .in("adaptive_playbook_id", pbIds)
        .gte("completed_at", completedAfter)
        .lte("completed_at", completedBefore);
      if (runLookup.error) {
        status = "failed";
        counts.errors.push(
          cronJobError(orgId, "source_query", "v6_playbook_followup_run_query_failed", runLookup.error.message)
        );
        recordOrgStatus(status, counts);
        continue;
      }
      if ((runLookup.count ?? 0) < 1) {
        recordOrgStatus("skipped", counts);
        continue;
      }

      await runModularAssuranceChecks(admin, orgId, null, "scheduled");
      assuranceRuns += 1;
      await incrementV6QualityCounter(admin, orgId, "cron_v6_playbook_followup_assurance_org_ok_total", 1).catch(
        () => undefined
      );
    } catch (err) {
      status = "failed";
      console.error("[cron-jobs] runPlaybookFollowUpAssurancePasses failed for org", orgId, err);
      counts.errors.push(
        cronJobError(
          orgId,
          "handler",
          "v6_playbook_followup_assurance_failed",
          safeErrorMessage(err) ?? "runPlaybookFollowUpAssurancePasses failed"
        )
      );
    }
    recordOrgStatus(status, counts);
  }

  return { assuranceRuns, ...counts };
}