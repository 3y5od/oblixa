import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const GET = withCronRoute({
  route: "/api/reports/capture-metrics",
  healthcheckRoute: "reports/capture-metrics",
  rateLimitKey: "cron:reports:capture-metrics",
  rateLimit: RATE_LIMITS.reportsCaptureMetricsCron,
  handler: async ({ admin }) => {
    const { data: orgs } = await admin.from("organizations").select("id");
    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const today = new Date().toISOString().slice(0, 10);
    let updated = 0;

    for (const org of orgs ?? []) {
      const thirtyDayIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [membersRes, auditRes, recipientsRes, contractsRes, fieldsRes, invitesRes, tasksRes, obligationsRes, approvalsRes, checkpointsRes] = await Promise.all([
        admin.from("organization_members").select("user_id, role").eq("organization_id", org.id),
        admin
          .from("audit_events")
          .select("user_id, action, created_at, details")
          .eq("organization_id", org.id)
          .gte("created_at", sinceIso),
        admin
          .from("report_run_recipients")
          .select("opened_at, clicked_at")
          .eq("organization_id", org.id)
          .gte("created_at", sinceIso),
        admin
          .from("contracts")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .eq("health_status", "at_risk"),
        admin
          .from("extracted_fields")
          .select("id, status, contracts!inner(organization_id)")
          .eq("contracts.organization_id", org.id)
          .in("field_name", ["end_date", "renewal_date", "notice_window"]),
        admin
          .from("organization_invites")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .gte("created_at", thirtyDayIso),
        admin
          .from("contract_tasks")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .eq("status", "done")
          .gte("completed_at", sinceIso),
        admin
          .from("contract_obligations")
          .select("id, due_date, completed_at")
          .eq("organization_id", org.id)
          .eq("status", "done")
          .gte("completed_at", sinceIso),
        admin
          .from("contract_approvals")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .in("status", ["approved", "rejected"])
          .gte("resolved_at", sinceIso),
        admin
          .from("contract_renewal_checkpoints")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .gte("created_at", sinceIso),
      ]);

      const memberRoleById = new Map(
        (membersRes.data ?? []).map((row) => [row.user_id, row.role] as const)
      );
      const operators = new Set<string>();
      const managers = new Set<string>();
      const dashboardRevisits = (auditRes.data ?? []).filter((e) =>
        String(e.action).startsWith("dashboard.")
      ).length;
      for (const evt of auditRes.data ?? []) {
        if (!evt.user_id) continue;
        const role = memberRoleById.get(evt.user_id);
        if (
          role === "admin" ||
          role === "editor" ||
          role === "ops_manager" ||
          role === "manager"
        ) {
          operators.add(evt.user_id);
        }
        if (role === "admin" || role === "manager") managers.add(evt.user_id);
      }
      const reportOpens = (recipientsRes.data ?? []).filter((r) => !!r.opened_at).length;
      const reportClicks = (recipientsRes.data ?? []).filter((r) => !!r.clicked_at).length;
      const fieldRows = fieldsRes.data ?? [];
      const approvedFieldCount = fieldRows.filter((r) => r.status === "approved").length;
      const completeness =
        fieldRows.length === 0 ? 0 : (approvedFieldCount / fieldRows.length) * 100;
      const adoptionActions = (auditRes.data ?? []).filter((evt) =>
        ["dashboard.viewed", "settings.policy_pack_applied", "maintenance.change_events_processed"].includes(
          String(evt.action)
        )
      ).length;
      const roleCoverageCount = new Set((membersRes.data ?? []).map((m) => String(m.role))).size;
      const missedDatesPrevented = (auditRes.data ?? []).filter((evt) => {
        if (String(evt.action) !== "task.created_by_rule") return false;
        const details = (evt as { details?: Record<string, unknown> | null }).details ?? {};
        const reason = String(details.reason ?? "");
        return reason.includes("window") || reason.includes("stalled");
      }).length;
      const overdueResolutionSamples = (obligationsRes.data ?? [])
        .filter((row) => !!row.due_date && !!row.completed_at)
        .map((row) => {
          const dueAt = new Date(`${String(row.due_date)}T12:00:00`).getTime();
          const completedAt = new Date(String(row.completed_at)).getTime();
          return Math.max(0, (completedAt - dueAt) / (1000 * 60 * 60 * 24));
        });
      const overdueResolutionAvg =
        overdueResolutionSamples.length === 0
          ? null
          : overdueResolutionSamples.reduce((sum, days) => sum + days, 0) /
            overdueResolutionSamples.length;

      await admin.from("org_behavior_metrics").upsert(
        {
          organization_id: org.id,
          metrics_date: today,
          weekly_active_operators: operators.size,
          weekly_active_managers: managers.size,
          report_opens: reportOpens,
          report_clicks: reportClicks,
          dashboard_revisits: dashboardRevisits,
          stale_record_count: contractsRes.count ?? 0,
          key_field_completeness: Number(completeness.toFixed(2)),
          unresolved_gap_count: Math.max(0, (contractsRes.count ?? 0) + (fieldRows.length - approvedFieldCount)),
          active_workspaces_count: adoptionActions,
          contracts_onboarded_7d: (auditRes.data ?? []).filter((evt) => String(evt.action) === "contract.created")
            .length,
          users_invited_30d: invitesRes.count ?? 0,
          role_coverage_count: roleCoverageCount,
          tasks_completed_7d: tasksRes.count ?? 0,
          obligations_logged_7d: obligationsRes.data?.length ?? 0,
          approvals_resolved_7d: approvalsRes.count ?? 0,
          renewal_checklists_started_7d: checkpointsRes.count ?? 0,
          missed_dates_prevented_7d: missedDatesPrevented,
          overdue_resolution_time_days:
            overdueResolutionAvg == null ? null : Number(overdueResolutionAvg.toFixed(2)),
        },
        { onConflict: "organization_id,metrics_date", ignoreDuplicates: false }
      );
      updated++;
    }

    return {
      body: {
        organizations: orgs?.length ?? 0,
        updated,
      },
    };
  },
});
