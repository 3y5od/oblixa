import type { SupabaseClient } from "@supabase/supabase-js";

export type PortfolioSignalSeverity = "high" | "medium" | "low";

export type PortfolioSignalLinkedRef = { ref_type: string; ref_id: string };

export type PortfolioSignalRow = {
  key: string;
  label: string;
  value: number;
  severity: PortfolioSignalSeverity;
  linked_object: string;
  reason: string;
  reason_json: Record<string, unknown>[];
  linked_refs: PortfolioSignalLinkedRef[];
};

export type PortfolioDriversPayload = Record<string, unknown> & {
  linked_object: string;
  reason_json: { key: string; value: unknown }[];
};

/**
 * Grounded portfolio signal counts and drivers (V5 §9.5). Shared by
 * GET /api/intelligence/portfolio-signals, dashboard, and reports.
 */
export async function buildPortfolioSignalSummary(
  admin: SupabaseClient,
  orgId: string
): Promise<{ signalSummary: PortfolioSignalRow[]; drivers: PortfolioDriversPayload }> {
  const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: openExceptions },
    { count: activeCampaigns },
    { count: openDecisions },
    { count: pendingApprovals },
    { count: attestationGaps },
    { count: openExecutionTasks },
    { count: openExternalLinks },
    { count: pendingEvidenceRequirements },
    { count: obligationsDueMonth },
    { count: staleOpenExceptions },
    { count: renewalCheckpointPending },
    { count: activeProgramAssignments },
    { data: activeCampaignIdRows },
  ] = await Promise.all([
    admin
      .from("exceptions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "open"),
    admin
      .from("portfolio_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["active", "paused"]),
    admin
      .from("decision_workspaces")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["open", "in_review"]),
    admin
      .from("contract_approvals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "pending"),
    admin
      .from("attestation_requests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["open", "overdue"]),
    admin
      .from("contract_tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress", "blocked"]),
    admin
      .from("external_action_links")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "open"),
    admin
      .from("evidence_requirements")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "required"),
    admin
      .from("contract_obligations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress"])
      .lte("due_date", thirtyDaysAhead.slice(0, 10)),
    admin
      .from("exceptions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "open")
      .lt("created_at", ninetyDaysAgo),
    admin
      .from("contract_renewal_checkpoints")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "pending"),
    admin
      .from("contract_program_assignments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "active"),
    admin
      .from("portfolio_campaigns")
      .select("id")
      .eq("organization_id", orgId)
      .in("status", ["active", "paused"])
      .limit(400),
  ]);

  const activeCampIds = (activeCampaignIdRows ?? []).map((r) => String(r.id));
  let campaignContractBacklog = 0;
  if (activeCampIds.length > 0) {
    const { count: ccBacklog } = await admin
      .from("portfolio_campaign_contracts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("campaign_id", activeCampIds)
      .in("status", ["pending", "in_progress"]);
    campaignContractBacklog = ccBacklog ?? 0;
  }

  const { data: exForAccounts } = await admin
    .from("exceptions")
    .select("contract_id")
    .eq("organization_id", orgId)
    .eq("status", "open")
    .limit(500);
  const exRows = exForAccounts ?? [];
  const cids = [...new Set(exRows.map((r) => r.contract_id).filter(Boolean))] as string[];
  let drivers: Record<string, unknown> = {
    key: "exceptions_by_account",
    accounts: [] as { account_key: string; open_exceptions: number }[],
    reason: "Open exceptions grouped by contract account_key (top five).",
  };
  if (cids.length > 0) {
    const { data: contracts } = await admin
      .from("contracts")
      .select("id, account_key")
      .eq("organization_id", orgId)
      .in("id", cids);
    const idToAccount = new Map(
      (contracts ?? []).map((c) => [String(c.id), c.account_key as string | null])
    );
    const accountCount = new Map<string, number>();
    for (const e of exRows) {
      const ak = idToAccount.get(String(e.contract_id));
      if (!ak) continue;
      accountCount.set(ak, (accountCount.get(ak) ?? 0) + 1);
    }
    const accounts = [...accountCount.entries()]
      .map(([account_key, open_exceptions]) => ({ account_key, open_exceptions }))
      .sort((a, b) => b.open_exceptions - a.open_exceptions)
      .slice(0, 5);
    drivers = {
      key: "exceptions_by_account",
      accounts,
      reason: "Open exceptions grouped by contract account_key (top five).",
    };
  }

  const signalSummary: PortfolioSignalRow[] = [
    {
      key: "overdue_operational_risk",
      label: "Open exceptions",
      value: openExceptions ?? 0,
      severity: (openExceptions ?? 0) > 25 ? "high" : "medium",
      linked_object: "exceptions",
      reason:
        "Count of exception records in open status; elevated counts suggest operational backlog and renewal/amendment risk.",
      reason_json: [
        { signal: "open_exceptions", value: openExceptions ?? 0 },
        { signal: "driver", value: "exceptions_by_account" },
      ],
      linked_refs: [{ ref_type: "table", ref_id: "exceptions" }],
    },
    {
      key: "stalled_decision_risk",
      label: "Open decisions",
      value: openDecisions ?? 0,
      severity: (openDecisions ?? 0) > 20 ? "high" : "medium",
      linked_object: "decision_workspaces",
      reason:
        "Decision workspaces still in open or in_review; use the decision queue to sequence by due date and stakeholder load.",
      reason_json: [{ signal: "open_decisions", value: openDecisions ?? 0 }],
      linked_refs: [{ ref_type: "table", ref_id: "decision_workspaces" }],
    },
    {
      key: "policy_divergence_risk",
      label: "Active campaigns",
      value: activeCampaigns ?? 0,
      severity: (activeCampaigns ?? 0) > 10 ? "high" : "low",
      linked_object: "portfolio_campaigns",
      reason:
        "Portfolio campaigns that are active or paused; many concurrent campaigns increase execution spread and capacity risk.",
      reason_json: [{ signal: "active_or_paused_campaigns", value: activeCampaigns ?? 0 }],
      linked_refs: [{ ref_type: "table", ref_id: "portfolio_campaigns" }],
    },
    {
      key: "approval_queue_pressure",
      label: "Pending contract approvals",
      value: pendingApprovals ?? 0,
      severity:
        (pendingApprovals ?? 0) > 40 ? "high" : (pendingApprovals ?? 0) > 15 ? "medium" : "low",
      linked_object: "contract_approvals",
      reason: "Grounded count of approvals still in pending status for this organization.",
      reason_json: [{ signal: "pending_approvals", value: pendingApprovals ?? 0 }],
      linked_refs: [{ ref_type: "table", ref_id: "contract_approvals" }],
    },
    {
      key: "evidence_attestation_gap",
      label: "Open or overdue attestations",
      value: attestationGaps ?? 0,
      severity:
        (attestationGaps ?? 0) > 20 ? "high" : (attestationGaps ?? 0) > 8 ? "medium" : "low",
      linked_object: "attestation_requests",
      reason: "Attestation requests that are still open or marked overdue.",
      reason_json: [{ signal: "attestation_gaps", value: attestationGaps ?? 0 }],
      linked_refs: [{ ref_type: "table", ref_id: "attestation_requests" }],
    },
    {
      key: "workload_execution_spike",
      label: "Open execution tasks",
      value: openExecutionTasks ?? 0,
      severity:
        (openExecutionTasks ?? 0) > 200 ? "high" : (openExecutionTasks ?? 0) > 80 ? "medium" : "low",
      linked_object: "contract_tasks",
      reason:
        "Contract tasks in open, in_progress, or blocked status; elevated counts suggest upcoming workload spikes relative to team capacity.",
      reason_json: [{ signal: "open_execution_tasks", value: openExecutionTasks ?? 0 }],
      linked_refs: [{ ref_type: "table", ref_id: "contract_tasks" }],
    },
    {
      key: "external_collaboration_backlog",
      label: "Pending external action links",
      value: openExternalLinks ?? 0,
      severity:
        (openExternalLinks ?? 0) > 15 ? "high" : (openExternalLinks ?? 0) > 5 ? "medium" : "low",
      linked_object: "external_action_links",
      reason:
        "External collaboration tokens still awaiting submission; stalls here often block renewals, evidence, or amendment decisions.",
      reason_json: [{ signal: "open_external_links", value: openExternalLinks ?? 0 }],
      linked_refs: [{ ref_type: "table", ref_id: "external_action_links" }],
    },
    {
      key: "missing_evidence_risk",
      label: "Unsatisfied evidence requirements",
      value: pendingEvidenceRequirements ?? 0,
      severity:
        (pendingEvidenceRequirements ?? 0) > 40
          ? "high"
          : (pendingEvidenceRequirements ?? 0) > 15
            ? "medium"
            : "low",
      linked_object: "evidence_requirements",
      reason:
        "Evidence requirements still in required status; correlates with renewal and compliance exposure until submitted or waived.",
      reason_json: [{ signal: "pending_evidence_requirements", value: pendingEvidenceRequirements ?? 0 }],
      linked_refs: [{ ref_type: "table", ref_id: "evidence_requirements" }],
    },
    {
      key: "renewal_obligation_horizon",
      label: "Obligations due within 30 days",
      value: obligationsDueMonth ?? 0,
      severity:
        (obligationsDueMonth ?? 0) > 100 ? "high" : (obligationsDueMonth ?? 0) > 40 ? "medium" : "low",
      linked_object: "contract_obligations",
      reason:
        "Open or in-progress obligations with due_date within the next 30 days; use for renewal readiness and operational pacing signals.",
      reason_json: [{ signal: "obligations_due_30d", value: obligationsDueMonth ?? 0 }],
      linked_refs: [{ ref_type: "table", ref_id: "contract_obligations" }],
    },
    {
      key: "stale_exception_backlog",
      label: "Open exceptions older than 90 days",
      value: staleOpenExceptions ?? 0,
      severity:
        (staleOpenExceptions ?? 0) > 15 ? "high" : (staleOpenExceptions ?? 0) > 5 ? "medium" : "low",
      linked_object: "exceptions",
      reason:
        "Exceptions still in open status with created_at older than 90 days; indicates aging operational debt.",
      reason_json: [
        { signal: "stale_open_exceptions_90d", value: staleOpenExceptions ?? 0 },
        { signal: "threshold_created_before", value: ninetyDaysAgo },
      ],
      linked_refs: [{ ref_type: "table", ref_id: "exceptions" }],
    },
    {
      key: "renewal_readiness_gap",
      label: "Pending renewal checkpoints",
      value: renewalCheckpointPending ?? 0,
      severity:
        (renewalCheckpointPending ?? 0) > 80 ? "high" : (renewalCheckpointPending ?? 0) > 30 ? "medium" : "low",
      linked_object: "contract_renewal_checkpoints",
      reason:
        "Renewal playbook checkpoints still pending across the portfolio; correlates with renewal readiness risk.",
      reason_json: [{ signal: "pending_renewal_checkpoints", value: renewalCheckpointPending ?? 0 }],
      linked_refs: [{ ref_type: "table", ref_id: "contract_renewal_checkpoints" }],
    },
    {
      key: "program_execution_surface",
      label: "Active program assignments",
      value: activeProgramAssignments ?? 0,
      severity:
        (activeProgramAssignments ?? 0) > 500
          ? "high"
          : (activeProgramAssignments ?? 0) > 200
            ? "medium"
            : "low",
      linked_object: "contract_program_assignments",
      reason:
        "Active contract_program_assignments rows; high counts imply broad program surface area and coordination load.",
      reason_json: [{ signal: "active_program_assignments", value: activeProgramAssignments ?? 0 }],
      linked_refs: [{ ref_type: "table", ref_id: "contract_program_assignments" }],
    },
    {
      key: "campaign_execution_backlog",
      label: "Campaign contracts pending execution",
      value: campaignContractBacklog,
      severity:
        campaignContractBacklog > 200 ? "high" : campaignContractBacklog > 80 ? "medium" : "low",
      linked_object: "portfolio_campaign_contracts",
      reason:
        "Portfolio campaign contract rows in pending or in_progress for active/paused campaigns; highlights rollout drift.",
      reason_json: [
        { signal: "campaign_contract_backlog", value: campaignContractBacklog },
        { signal: "active_campaigns_sampled", value: activeCampIds.length },
      ],
      linked_refs: [{ ref_type: "table", ref_id: "portfolio_campaign_contracts" }],
    },
  ];

  const driversOut: PortfolioDriversPayload = {
    ...drivers,
    linked_object: "exceptions",
    reason_json: [
      { key: "driver", value: drivers.key },
      {
        key: "account_rows",
        value: Array.isArray((drivers as { accounts?: unknown }).accounts)
          ? (drivers as { accounts: unknown[] }).accounts.length
          : 0,
      },
    ],
  };

  return { signalSummary, drivers: driversOut };
}
