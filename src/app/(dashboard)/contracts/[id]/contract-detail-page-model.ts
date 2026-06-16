import { notFound } from "next/navigation";
import { AlertTriangle, BadgeCheck, FileText, NotebookPen, Paperclip, type LucideIcon } from "lucide-react";
import type { getAuthContext } from "@/lib/supabase/server";
import { canDeleteContracts, canEditContracts } from "@/lib/permissions";
import { hasRoleCapability } from "@/lib/access-control";
import type { ContractApproval, ContractExtractionJob, ContractObligation, ContractNote, ContractRenewalScenario, ContractRenewalCheckpoint, ContractTask, OrgRole } from "@/lib/types";
import { buildUnifiedWorkflowTimeline } from "@/lib/workflow-activity";
import { isFeatureEnabled } from "@/lib/feature-flags";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import { emitProductTelemetryIfFirstForOrgUser } from "@/lib/product-telemetry";
import { groupReminderDeliveriesByReminderId } from "@/lib/reminder-delivery-visibility";
import { fetchReviewQueueContinuity } from "@/lib/contract-review-stats";
import { formatBusinessDateAtNoon, parseBusinessDateAtNoon } from "@/lib/business-dates";
import { buildContractImmediateActions, buildContractOperationsStrip } from "@/lib/contract-detail-summary";
import { isEvidenceGapStatus } from "@/lib/evidence-status";
import { applyV10ReadModelVisibility } from "@/lib/visibility";
import { loadOrgMemberProfileRows, orgMemberProfileLabel } from "@/lib/org-member-profiles";
import { CRITICAL_DATE_FIELDS } from "@/lib/contract-filters";
import type { SemanticStatus } from "@/components/ui/status-badge";
import type { ActivityFeedItem } from "@/components/ui/activity-feed";
import { CAPS_VERBS } from "@/lib/ui-copy";
import type { StatTone } from "@/components/ui/stat-cell";

type AuthContext = NonNullable<Awaited<ReturnType<typeof getAuthContext>>>;

export type ContractDetailSearchParams = {
  tab?: string;
  created?: string;
  uploaded?: string;
  invalid?: string;
  failed?: string;
  extraction?: string;
  from?: string;
  reviewPage?: string;
};

export type ContractDetailTab =
  | "overview"
  | "fields"
  | "dates"
  | "work"
  | "tasks"
  | "workflow"
  | "obligations"
  | "renewals"
  | "approvals"
  | "exceptions"
  | "evidence"
  | "casefile"
  | "timeline"
  | "files"
  | "reports"
  | "notes"
  | "activity"
  | "audit"
  | "programs"
  | "integrations"
  | "ownership";

export function humanizeContractEnumLabel(value: string | null | undefined, fallback = "Not set") {
  if (!value) return fallback;
  const explicit: Record<string, string> = {
    awaiting_review: "Awaiting review",
    at_risk: "At risk",
    renewal_prep: "Renewal preparation",
    no_action_required: "No action required",
  };
  return explicit[value] ?? value.replace(/_/g, " ").replace(/^./, (char) => char.toUpperCase());
}

export function humanizeAuditEventLabel(value: string | null | undefined) {
  if (!value) return "Activity recorded";
  const normalized = value.toLowerCase().replace(/\./g, " ").replace(/\s+/g, " ").trim();
  const explicit: Record<string, string> = {
    "product v9 extraction_succeeded": "Contract suggestions ready",
    contract_template_pack_applied: "Template pack applied",
    "contract created": "Contract created",
    "exception detected · exception · system · casefile": "Issue detected",
  };
  return explicit[normalized] ?? humanizeContractEnumLabel(normalized, "Activity recorded");
}

// Maps a humanized activity title/detail to the §8.5 activity-feed vocabulary
// (bounded caps verb + icon + optional tone). Keeps the Core activity feed
// structured instead of prose.
function coreActivityVisual(
  title: string,
  detail: string
): { verb: string; detail: string; icon: LucideIcon; tone?: StatTone } {
  const text = `${title} ${detail}`.toLowerCase();
  if (text.includes("upload") || text.includes("source file") || text.includes("attached"))
    return { verb: CAPS_VERBS.uploaded, detail, icon: Paperclip };
  if (text.includes("extract")) return { verb: CAPS_VERBS.extracted, detail, icon: FileText };
  if (text.includes("approv")) return { verb: CAPS_VERBS.approved, detail, icon: BadgeCheck, tone: "success" };
  if (text.includes("reject")) return { verb: CAPS_VERBS.rejected, detail, icon: AlertTriangle, tone: "danger" };
  if (text.includes("exception")) return { verb: CAPS_VERBS.notice, detail, icon: AlertTriangle, tone: "warning" };
  if (text.includes("note")) return { verb: CAPS_VERBS.created, detail, icon: NotebookPen };
  if (text.includes("template") || text.includes("applied") || text.includes("updat"))
    return { verb: CAPS_VERBS.changed, detail, icon: FileText };
  if (text.includes("creat")) return { verb: CAPS_VERBS.created, detail, icon: FileText };
  const words = title.trim().split(/\s+/);
  return { verb: (words[words.length - 1] || "Activity").toUpperCase(), detail, icon: FileText };
}

export function criticalDateLabel(fieldName: string) {
  const labels: Record<string, string> = {
    effective_date: "Effective date",
    start_date: "Start date",
    end_date: "End date",
    renewal_date: "Renewal date",
    notice_window: "Notice window",
    auto_renewal: "Auto renewal",
  };
  return labels[fieldName] ?? humanizeContractEnumLabel(fieldName);
}

// Coarse reminder urgency bucket. Date.now() lives in this module-scope helper
// (not the component render) to satisfy react-hooks/purity, mirroring how the
// relative-time formatters in @/lib/ui-copy read the clock.
export const CORE_CONTRACT_DATE_FIELDS = [
  "effective_date",
  "start_date",
  "end_date",
  "renewal_date",
  "notice_window",
] as const;

type CoreSignalTone = "attention" | "danger" | "healthy" | "neutral" | "info";

function coreStatusTone(status: string | null | undefined): CoreSignalTone {
  if (!status) return "neutral";
  if (["approved", "active", "complete", "completed", "accepted"].includes(status)) return "healthy";
  if (["rejected", "failed", "blocked"].includes(status)) return "danger";
  if (["pending", "pending_review", "awaiting_review", "in_progress", "open"].includes(status)) return "attention";
  return "neutral";
}

const coreSignalToneToSemantic: Record<CoreSignalTone, SemanticStatus> = {
  healthy: "healthy",
  attention: "warning",
  danger: "blocked",
  info: "info",
  neutral: "empty",
};

export function coreSemanticStatus(status: string | null | undefined): SemanticStatus {
  return coreSignalToneToSemantic[coreStatusTone(status)];
}


export async function loadContractDetailPageModel({
  ctx,
  id,
  searchParams,
}: {
  ctx: AuthContext;
  id: string;
  searchParams: ContractDetailSearchParams;
}) {
  const {
    tab: rawTab,
    created: createdParam,
    uploaded: uploadedParam,
    invalid: invalidParam,
    failed: failedParam,
    extraction: extractionParam,
    from: fromParam,
    reviewPage: reviewPageParam,
  } = searchParams;
  const requestedTab = rawTab as ContractDetailTab | undefined;
  const { orgId, admin, role } = ctx;
  const canEdit = canEditContracts(role as OrgRole);
  const canDelete = canDeleteContracts(role as OrgRole);
  const productSurface = await loadProductSurfaceContext(admin, orgId, role as WorkspaceRole);
  const isCoreContractDetail = productSurface.mode === "core";
  const isAdvancedContractDetail = productSurface.mode === "advanced";
  const isAssuranceContractDetail = productSurface.mode === "assurance";
  const showContractWorkflowOps = isAdvancedContractDetail;
  const showContractRenewalWorkspace = isAdvancedContractDetail;
  const showContractAdvancedRouting = isAdvancedContractDetail;
  const showContractEvidenceOps = isAssuranceContractDetail;
  const showContractAuditOps = isAssuranceContractDetail;
  const showContractRecordControls = true;
  const showContractFieldCollaboration = isAdvancedContractDetail;
  const loadCoreContractOps = isCoreContractDetail;
  const loadContractWorkData = loadCoreContractOps || showContractWorkflowOps;
  const loadContractActivityData = loadCoreContractOps || showContractAuditOps;
  const showUtilityExecutionSurfaces = evaluateFeatureEligibility(
    productSurface,
    "execution_graph"
  ).allowed && showContractAdvancedRouting;
  const showRelationshipWorkspaces =
    showContractAdvancedRouting &&
    isFeatureEnabled("v5RelationshipLayer") &&
    evaluateFeatureEligibility(productSurface, "relationship_workspaces").allowed;
  const showProgramsSurface =
    showContractAdvancedRouting && evaluateFeatureEligibility(productSurface, "programs").allowed;
  const showCollaborationSurface =
    showContractAdvancedRouting &&
    isFeatureEnabled("v5ExternalCollaboration") &&
    isFeatureEnabled("v6AssuranceCore") &&
    evaluateFeatureEligibility(productSurface, "collaboration").allowed;

  const [
    { data: contractData },
    { data: auditEventsData },
    { data: remindersData },
    membersData,
    { data: extractionJobData },
    { data: tasksData },
    { data: notesData },
    { data: obligationsData },
    { data: checkpointsData },
    { data: renewalScenarioData },
    { data: approvalsData },
    { data: fieldCommentsData },
    { data: handoffChecklistData },
    { data: taskEventsData },
    { data: obligationEventsData },
    { data: approvalEventsData },
    { data: watchlistData },
    { data: renewalWorkspaceNotesData },
    { data: casefileEventsData },
    { data: evidenceRequirementsData },
  ] = await Promise.all([
    admin
      .from("contracts")
      .select(
        "id, organization_id, title, counterparty, contract_type, status, intake_status, health_status, required_next_step, source_system, region, annual_value, external_reference_id, owner_id, secondary_owner_id, created_by, created_at, updated_at, account_key, counterparty_key, contract_files(*), extracted_fields(*)"
      )
      .eq("id", id)
      .eq("organization_id", orgId)
      .single(),
    showContractAuditOps
      ? admin
          .from("audit_events")
          .select("id, action, created_at")
          .eq("contract_id", id)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    admin
      .from("reminders")
      .select("id, reminder_type, reminder_date, sent_at")
      .eq("contract_id", id)
      .order("reminder_date", { ascending: true }),
    loadOrgMemberProfileRows(admin, orgId, { orderByCreatedAt: true }),
    admin
      .from("contract_extraction_jobs")
      .select(
        "id, contract_id, organization_id, status, attempt_count, last_error, started_at, completed_at"
      )
      .eq("contract_id", id)
      .maybeSingle(),
    loadContractWorkData
      ? admin
          .from("contract_tasks")
          .select(
            "id, contract_id, organization_id, created_by, assignee_id, title, details, status, priority, created_via, team_key, blocked_reason, recurrence_interval_days, sla_due_at, due_date, completed_at, created_at, updated_at"
          )
          .eq("contract_id", id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    admin
      .from("contract_notes")
      .select(
        "id, contract_id, organization_id, author_id, note, pinned, created_at, updated_at"
      )
      .eq("contract_id", id)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false }),
    loadContractWorkData
      ? admin
          .from("contract_obligations")
          .select(
            "id, contract_id, organization_id, created_by, owner_id, title, details, obligation_type, cadence, recurrence_type, recurrence_interval_days, next_due_date, escalation_due_at, escalation_status, due_date, status, evidence_notes, evidence_url, completed_at, created_at, updated_at"
          )
          .eq("contract_id", id)
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    admin
      .from("contract_renewal_checkpoints")
      .select(
        "id, contract_id, organization_id, task_key, label, offset_days, due_date, status, notes, completed_at, created_at, updated_at, renewal_state, workspace_json"
      )
      .eq("contract_id", id)
      .order("offset_days", { ascending: false }),
    showContractRenewalWorkspace
      ? admin
          .from("contract_renewal_scenarios")
          .select(
            "id, contract_id, organization_id, scenario, decision_notes, blocker, workspace_status, owner_id, target_decision_date, decision_date, escalation_date, commercial_context, scenario_confidence, last_reviewed_at, decided_by, decided_at, created_at, updated_at"
          )
          .eq("contract_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("contract_approvals")
      .select(
        "id, contract_id, organization_id, approval_type, status, requested_by, approver_id, delegated_from_id, delegated_to_id, due_at, escalated_at, category, exception_flag, exception_reason, notes, resolved_at, created_at, updated_at"
      )
      .eq("contract_id", id)
      .order("created_at", { ascending: false }),
    showContractFieldCollaboration
      ? admin
          .from("contract_field_comments")
          .select("id, contract_id, organization_id, field_id, author_id, comment, mentions, created_at")
          .eq("contract_id", id)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    showContractWorkflowOps
      ? admin
          .from("contract_handoff_checklists")
          .select("id, to_owner_id, checklist_note, status, created_at")
          .eq("contract_id", id)
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    loadContractWorkData || showContractAuditOps
      ? admin
          .from("contract_task_events")
          .select("id, task_id, event_type, details, created_at")
          .eq("contract_id", id)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    loadContractWorkData || showContractAuditOps
      ? admin
          .from("contract_obligation_events")
          .select("id, obligation_id, event_type, details, created_at")
          .eq("contract_id", id)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    loadContractWorkData || showContractAuditOps
      ? admin
          .from("contract_approval_events")
          .select("id, approval_id, event_type, details, created_at")
          .eq("contract_id", id)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    admin
      .from("contract_watchlists")
      .select("id")
      .eq("contract_id", id)
      .eq("user_id", ctx.user.id)
      .maybeSingle(),
    showContractRenewalWorkspace || showContractAuditOps
      ? admin
          .from("contract_renewal_workspace_notes")
          .select("id, body, pinned, created_at")
          .eq("contract_id", id)
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    showContractAuditOps
      ? admin
          .from("operational_casefile_events")
          .select("id, event_type, entity_type, source, occurred_at, details_json")
          .eq("organization_id", orgId)
          .eq("contract_id", id)
          .order("occurred_at", { ascending: false })
          .limit(80)
      : Promise.resolve({ data: [] }),
    isCoreContractDetail || showContractEvidenceOps
      ? admin
          .from("evidence_requirements")
          .select("id, title, requirement_type, status, due_at, review_due_at, work_item_type, work_item_id")
          .eq("contract_id", id)
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] }),
  ]);

  if (!contractData) notFound();
  await emitProductTelemetryIfFirstForOrgUser(admin, {
    organizationId: orgId,
    userId: ctx.user.id,
    contractId: contractData.id,
    action: "product.v10.contract_record_opened",
    details: {
      source: "contract_detail",
      health_state: contractData.health_status ?? "unknown",
    },
  });
  const reminders = remindersData ?? [];

  type OwnerProfileRow = { full_name: string | null; email: string | null };
  const ownerProfilePromise = contractData.owner_id
    ? admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", contractData.owner_id)
        .single()
    : Promise.resolve({ data: null as OwnerProfileRow | null });
  const reminderDeliveryPromise =
    !showContractAuditOps || reminders.length === 0
      ? Promise.resolve({
          data: [] as Array<{
            status: string | null;
            created_at: string | null;
            updated_at: string | null;
            delivered_at: string | null;
            next_attempt_at: string | null;
            last_error: string | null;
            metadata: unknown;
          }>,
        })
      : admin
          .from("notification_deliveries")
          .select("status, created_at, updated_at, delivered_at, next_attempt_at, last_error, metadata")
          .eq("organization_id", orgId)
          .eq("notification_type", "reminder_due")
          .order("created_at", { ascending: false })
          .limit(200);
  const evidenceSubmissionPromise =
    (evidenceRequirementsData ?? []).length === 0
      ? Promise.resolve({
          data: [] as Array<{
            id: string;
            requirement_id: string;
            status: string;
            submitted_at: string | null;
            reviewed_at: string | null;
            rejection_reason: string | null;
            payload_json: Record<string, unknown> | null;
          }>,
        })
      : admin
          .from("evidence_submissions")
          .select("id, requirement_id, status, submitted_at, reviewed_at, rejection_reason, payload_json")
          .eq("organization_id", orgId)
          .in(
            "requirement_id",
            (evidenceRequirementsData ?? []).map((row) => row.id as string)
          )
          .order("submitted_at", { ascending: false })
          .limit(120);

  const [
    { data: graphEdgesData },
    { data: exceptionsCasefileData },
    { data: changeEventsCasefileData },
    { data: programAssignmentsData },
    { data: ownerProfile },
    { data: reminderDeliveriesData },
    { data: evidenceSubmissionsData },
    { data: workflowSettingsData },
    { data: v10HealthSnapshotData },
    { data: v10WorkItemsData },
    { data: v10ActivationData },
    { data: v10FieldProvenanceData },
    { data: v10RenewalPostureData },
    { data: v10EvidenceStatusData },
    { data: v10ApprovalRecordsData },
    { data: v10ExceptionRecordsData },
    { data: v10AuditData },
  ] = await Promise.all([
    showUtilityExecutionSurfaces
      ? admin
          .from("execution_graph_edges")
          .select(
            "id, from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, status"
          )
          .eq("organization_id", orgId)
          .eq("contract_id", id)
          .limit(200)
      : Promise.resolve({ data: [] }),
    admin
      .from("exceptions")
      .select("id, title, exception_type, status, updated_at")
      .eq("organization_id", orgId)
      .eq("contract_id", id)
      .order("updated_at", { ascending: false })
      .limit(40),
    showContractAuditOps
      ? admin
          .from("contract_change_events")
          .select("id, event_type, summary, created_at")
          .eq("organization_id", orgId)
          .eq("contract_id", id)
          .order("created_at", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] }),
    showProgramsSurface
      ? admin
          .from("contract_program_assignments")
          .select("id, override_json, program_id, contract_programs(name)")
          .eq("organization_id", orgId)
          .eq("contract_id", id)
          .eq("status", "active")
      : Promise.resolve({ data: [] }),
    ownerProfilePromise,
    reminderDeliveryPromise,
    evidenceSubmissionPromise,
    admin
      .from("organization_workflow_settings")
      .select("role_policy_json")
      .eq("organization_id", orgId)
      .maybeSingle(),
    applyV10ReadModelVisibility(
      admin
        .from("v10_contract_health_snapshots")
        .select("score, band, next_action, deductions, computed_at, stale_owner, missing_required_field_count, missing_critical_date_count, overdue_work_count, open_high_or_critical_exception_count, outstanding_evidence_count, failed_or_partial_job_count"),
      { organizationId: orgId, role, workspaceMode: productSurface.mode }
    )
      .eq("contract_id", id)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    applyV10ReadModelVisibility(
      admin
        .from("v10_work_items")
        .select("source_id, type, title, status, due_state, due_at, blocked_reason, primary_action, updated_at"),
      { organizationId: orgId, role, workspaceMode: productSurface.mode }
    )
      .eq("contract_id", id)
      .neq("status", "done")
      .order("updated_at", { ascending: false })
      .limit(6),
    applyV10ReadModelVisibility(
      admin
        .from("v10_activation_state")
        .select("state, owner_state, required_fields_total, required_fields_approved, blocked_reason, next_action"),
      { organizationId: orgId, role, workspaceMode: productSurface.mode }
    )
      .eq("contract_id", id)
      .limit(1)
      .maybeSingle(),
    applyV10ReadModelVisibility(
      admin
        .from("v10_field_provenance_records")
        .select("field_key, state, confidence_state, source_label, reviewed_at, rejection_reason"),
      { organizationId: orgId, role, workspaceMode: productSurface.mode }
    )
      .eq("contract_id", id)
      .limit(12),
    applyV10ReadModelVisibility(
      admin
        .from("v10_renewal_posture_snapshots")
        .select("posture, horizon, reminder_eligible, blocked_reason, computed_at"),
      { organizationId: orgId, role, workspaceMode: productSurface.mode }
    )
      .eq("contract_id", id)
      .limit(1)
      .maybeSingle(),
    applyV10ReadModelVisibility(
      admin
        .from("v10_evidence_request_statuses")
        .select("evidence_request_id, status, submission_count, external_link_state, resubmission_allowed"),
      { organizationId: orgId, role, workspaceMode: productSurface.mode }
    )
      .eq("contract_id", id)
      .limit(12),
    applyV10ReadModelVisibility(
      admin
        .from("v10_approval_records")
        .select("approval_id, approval_type, status, due_state, sla_state, decision_note_state, decided_at"),
      { organizationId: orgId, role, workspaceMode: productSurface.mode }
    )
      .eq("contract_id", id)
      .limit(12),
    applyV10ReadModelVisibility(
      admin
        .from("v10_exception_records")
        .select("exception_id, title, severity, status, owner_state, due_state, resolution_action"),
      { organizationId: orgId, role, workspaceMode: productSurface.mode }
    )
      .eq("contract_id", id)
      .limit(12),
    loadContractActivityData
      ? applyV10ReadModelVisibility(
          admin
            .from("v10_contract_activity_events")
            .select("source_id, action, outcome, occurred_at"),
          { organizationId: orgId, role, workspaceMode: productSurface.mode }
        )
          .eq("contract_id", id)
          .order("occurred_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
  ]);

  const contract = { ...contractData, owner: ownerProfile as OwnerProfileRow | null };
  const auditEvents = auditEventsData ?? [];

  const ownerMembers = (membersData ?? []).map((m) => {
    return {
      userId: m.user_id,
      label: orgMemberProfileLabel(m.profiles),
    };
  });
  const showContractOwnerAssignment =
    canEdit && ownerMembers.length > 0 && (isCoreContractDetail || showContractWorkflowOps);

  const upcomingReminders = reminders.filter((r) => !r.sent_at);
  const reminderHistory = reminders.filter((r) => r.sent_at);
  const reminderDeliveryMap = groupReminderDeliveriesByReminderId(
    (reminderDeliveriesData ?? []).filter((row) => {
      const metadata =
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : null;
      return typeof metadata?.contract_id === "string" ? metadata.contract_id === id : true;
    })
  );

  const extractionJob = (extractionJobData ?? null) as ContractExtractionJob | null;
  const tasks = (tasksData ?? []) as ContractTask[];
  const notes = (notesData ?? []) as ContractNote[];
  const obligations = (obligationsData ?? []) as ContractObligation[];
  const [
    { data: taskChecklistItemsData },
    { data: taskCommentsData },
    { data: taskDependenciesData },
    { data: taskArtifactsData },
  ] =
    await Promise.all([
      showContractWorkflowOps
        ? admin
            .from("contract_task_checklist_items")
            .select("id, task_id, label, is_done, sort_order")
            .eq("contract_id", id)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
      showContractWorkflowOps
        ? admin
            .from("contract_task_comments")
            .select("id, task_id, body, parent_comment_id, edited_at, deleted_at, created_at")
            .eq("contract_id", id)
            .order("created_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [] }),
      showContractWorkflowOps
        ? admin
            .from("contract_task_dependencies")
            .select("id, task_id, depends_on_task_id")
            .eq("contract_id", id)
        : Promise.resolve({ data: [] }),
      showContractWorkflowOps
        ? admin
            .from("contract_task_artifacts")
            .select("id, task_id, label, url, created_at")
            .eq("contract_id", id)
            .order("created_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [] }),
    ]);
  const checkpoints = (checkpointsData ?? []) as ContractRenewalCheckpoint[];
  const renewalScenario = (renewalScenarioData ?? null) as ContractRenewalScenario | null;
  const approvals = (approvalsData ?? []) as ContractApproval[];
  const taskChecklistItems =
    (taskChecklistItemsData as
      | Array<{ id: string; task_id: string; label: string; is_done: boolean; sort_order: number }>
      | null) ?? [];
  const taskComments =
    (taskCommentsData as
      | Array<{
          id: string;
          task_id: string;
          body: string;
          parent_comment_id: string | null;
          edited_at: string | null;
          deleted_at: string | null;
          created_at: string;
        }>
      | null) ?? [];
  const taskDependencies =
    (taskDependenciesData as Array<{ id: string; task_id: string; depends_on_task_id: string }> | null) ?? [];
  const taskArtifacts =
    (taskArtifactsData as
      | Array<{ id: string; task_id: string; label: string; url: string; created_at: string }>
      | null) ?? [];
  const renewalWorkspaceNotes =
    (renewalWorkspaceNotesData as Array<{ id: string; body: string; pinned: boolean; created_at: string }> | null) ??
    [];
  const fieldComments = fieldCommentsData ?? [];
  const handoffChecklists = handoffChecklistData ?? [];
  const taskEvents = taskEventsData ?? [];
  const obligationEvents = obligationEventsData ?? [];
  const approvalEvents = approvalEventsData ?? [];
  const isWatchlisted = Boolean(watchlistData?.id);
  const casefileEventsRaw =
    (casefileEventsData as
      | Array<{
          id: string;
          event_type: string;
          entity_type: string | null;
          source: string;
          occurred_at: string;
          details_json?: Record<string, unknown> | null;
        }>
      | null) ?? [];

  type MergedCasefileEntry = {
    id: string;
    kind: "casefile" | "exception" | "change";
    headline: string;
    detail: string;
    occurred_at: string;
  };

  const mergedCasefile: MergedCasefileEntry[] = [
    ...casefileEventsRaw.map((e) => ({
      id: `cf-${e.id}`,
      kind: "casefile" as const,
      headline: humanizeAuditEventLabel(
        [e.event_type, e.entity_type, e.source, "casefile"].filter(Boolean).join(" · ")
      ),
      detail: [e.entity_type, e.source].filter(Boolean).map((value) => humanizeContractEnumLabel(value)).join(" · "),
      occurred_at: e.occurred_at,
    })),
    ...(exceptionsCasefileData ?? []).map(
      (e: { id: string; title: string; exception_type: string; status: string; updated_at: string }) => ({
        id: `ex-${e.id}`,
        kind: "exception" as const,
        headline: `Issue · ${humanizeContractEnumLabel(e.exception_type)}`,
        detail: `${e.title} · ${humanizeContractEnumLabel(e.status)}`,
        occurred_at: e.updated_at,
      })
    ),
    ...(changeEventsCasefileData ?? []).map(
      (e: { id: string; event_type: string; summary: string | null; created_at: string }) => ({
        id: `ch-${e.id}`,
        kind: "change" as const,
        headline: `Change · ${humanizeAuditEventLabel(e.event_type)}`,
        detail: e.summary ?? "",
        occurred_at: e.created_at,
      })
    ),
  ]
    .sort((a, b) => +new Date(b.occurred_at) - +new Date(a.occurred_at))
    .slice(0, 120);

  const executionGraphEdges =
    (graphEdgesData as
      | Array<{
          id: string;
          from_entity_type: string;
          from_entity_id: string;
          to_entity_type: string;
          to_entity_id: string;
          relation_type: string;
          status: string;
        }>
      | null) ?? [];
  const evidenceRequirements =
    (evidenceRequirementsData ?? []) as Array<{
      id: string;
      title: string;
      requirement_type: string;
      status: string;
      due_at: string | null;
      review_due_at: string | null;
      work_item_type: string;
      work_item_id: string;
    }>;
  const latestEvidenceSubmissionByRequirement = Object.fromEntries(
    ((evidenceSubmissionsData ?? []) as Array<{
      id: string;
      requirement_id: string;
      status: string;
      submitted_at: string | null;
      reviewed_at: string | null;
      rejection_reason: string | null;
      payload_json: Record<string, unknown> | null;
    }>).map((row) => [row.requirement_id, row])
  ) as Record<
    string,
    {
      id: string;
      status: string;
      submitted_at: string | null;
      reviewed_at: string | null;
      rejection_reason: string | null;
      payload_json: Record<string, unknown> | null;
    }
  >;
  const canReviewEvidence = hasRoleCapability({
    role: role as OrgRole,
    capability: "approvals_manage",
    rolePolicyJson: (workflowSettingsData?.role_policy_json as Record<string, unknown> | null) ?? null,
  });
  const pendingFieldsCount = (contract.extracted_fields ?? []).filter(
    (f: { status: string }) => f.status === "pending"
  ).length;
  const approvedFieldsCount = (contract.extracted_fields ?? []).filter(
    (f: { status: string }) => f.status === "approved"
  ).length;
  // Pending fields that can actually be batch-approved. Mirrors
  // updateContractField: an AI-sourced value needs a source citation before
  // it can be approved. Used to disable bulk approve when nothing is ready.
  const readyFieldsCount = (contract.extracted_fields ?? []).filter(
    (f: {
      status: string;
      field_value?: string | null;
      source_snippet?: string | null;
      source?: string | null;
    }) => {
      if (f.status !== "pending") return false;
      const hasValue = f.field_value != null && String(f.field_value).trim().length > 0;
      const hasSnippet = f.source_snippet != null && String(f.source_snippet).trim().length > 0;
      return !(f.source === "ai" && hasValue && !hasSnippet);
    }
  ).length;
  const approvedFieldNames = new Set(
    (contract.extracted_fields ?? [])
      .filter((f: { status: string; field_value?: string | null }) => f.status === "approved" && Boolean(f.field_value?.trim()))
      .map((f: { field_name: string }) => f.field_name)
  );
  const missingCriticalDateLabels = CRITICAL_DATE_FIELDS.filter((fieldName) => !approvedFieldNames.has(fieldName)).map(
    criticalDateLabel
  );
  const filesCount = contract.contract_files?.length ?? 0;
  const fieldsCount = contract.extracted_fields?.length ?? 0;
  const reviewQueueContinuity =
    pendingFieldsCount > 0 || contract.status === "pending_review"
      ? await fetchReviewQueueContinuity(admin, orgId, contract.id)
      : null;
  const workflowTimeline = buildUnifiedWorkflowTimeline({
    taskEvents: taskEvents as Array<{ id: string; event_type: string; created_at: string }>,
    obligationEvents: obligationEvents as Array<{ id: string; event_type: string; created_at: string }>,
    approvalEvents: approvalEvents as Array<{ id: string; event_type: string; created_at: string }>,
    renewalNotes: renewalWorkspaceNotes,
  });
  const createdFromUpload = createdParam === "1";
  const fromReview = fromParam === "review";
  const parsedReviewPage = Number.parseInt(reviewPageParam ?? "1", 10);
  const reviewPage =
    Number.isFinite(parsedReviewPage) && parsedReviewPage > 0 ? parsedReviewPage : 1;
  const reviewQueueHref = `/contracts/review${reviewPage > 1 ? `?page=${reviewPage}` : ""}`;
  const backHref = fromReview ? reviewQueueHref : "/contracts";
  const backLabel = fromReview ? "Back to review queue" : "Back to contracts";
  const uploadedCount = Math.max(0, Number(uploadedParam ?? "0") || 0);
  const invalidCount = Math.max(0, Number(invalidParam ?? "0") || 0);
  const failedCount = Math.max(0, Number(failedParam ?? "0") || 0);
  const extractionState =
    extractionParam === "queued" || extractionParam === "not_available" || extractionParam === "skipped_no_files"
      ? extractionParam
      : null;
  const creationNotice = createdFromUpload
    ? {
        tone:
          uploadedCount === 0 || failedCount > 0 || invalidCount > 0 ? ("warning" as const) : ("success" as const),
        title:
          uploadedCount > 0
            ? "Contract created and intake started"
            : "Contract created, but source documents still need attention",
        lines: [
          uploadedCount > 0
            ? `${uploadedCount} source file${uploadedCount === 1 ? "" : "s"} stored successfully.`
            : "No source files were stored on the first attempt.",
          invalidCount > 0
            ? `${invalidCount} file${invalidCount === 1 ? " was" : "s were"} skipped because they were unsupported or over 25 MB.`
            : null,
          failedCount > 0
            ? `${failedCount} file upload${failedCount === 1 ? "" : "s"} failed after contract creation. Re-attach any missing signed source documents below.`
            : null,
          extractionState === "queued"
            ? "Suggestions are queued. Confirm suggested details before reminders or downstream tasks rely on them."
            : extractionState === "not_available"
              ? "Suggested details were not started automatically in this environment. You can run them manually from the suggested details section."
              : extractionState === "skipped_no_files"
                ? "Add at least one signed source document to unlock suggested details and source-backed confirmation."
                : null,
        ].filter((line): line is string => Boolean(line)),
      }
    : null;
  const ownerLabel = contract.owner?.full_name || contract.owner?.email || null;
  const latestSourceDocumentAt = contract.contract_files?.length
    ? [...contract.contract_files]
        .map((file: { created_at: string }) => file.created_at)
        .sort((a, b) => +new Date(b) - +new Date(a))[0] ?? null
    : null;
  const latestExtractionTouchAt = extractionJob?.completed_at ?? extractionJob?.started_at ?? null;
  const operationsStrip = buildContractOperationsStrip({
    ownerLabel,
    requiredNextStep: contract.required_next_step,
    upcomingRemindersCount: upcomingReminders.length,
    reminderHistoryCount: reminderHistory.length,
    approvedFieldsCount,
    latestExtractionTouchAt,
    latestSourceDocumentAt,
  });
  const openExceptionsCount = (exceptionsCasefileData ?? []).filter((item) =>
    ["open", "in_progress"].includes(item.status)
  ).length;
  const pendingApprovalsCount = approvals.filter((item) => item.status === "pending").length;
  const outstandingEvidenceCount = evidenceRequirements.filter((item) =>
    isEvidenceGapStatus(item.status)
  ).length;
  const immediateActions = buildContractImmediateActions({
    contractId: contract.id,
    pendingFieldsCount,
    pendingApprovalsCount,
    openExceptionsCount,
    outstandingEvidenceCount,
    hasOwner: Boolean(ownerLabel),
    approvedFieldsCount,
  });
  const v10HealthSnapshot = v10HealthSnapshotData as {
    score: number;
    band: string;
    next_action: string;
    deductions: Array<{
      key?: string;
      label?: string;
      points?: number;
      source_type?: string | null;
      source_id?: string | null;
    }> | unknown;
    computed_at: string;
    stale_owner: boolean;
    missing_required_field_count: number;
    missing_critical_date_count: number;
    overdue_work_count: number;
    open_high_or_critical_exception_count: number;
    outstanding_evidence_count: number;
    failed_or_partial_job_count: number;
  } | null;
  const v10Deductions = Array.isArray(v10HealthSnapshot?.deductions) ? v10HealthSnapshot.deductions : [];
  const v10DeductionCount = v10Deductions.length;
  const v10WorkItems = v10WorkItemsData ?? [];
  const v10Activation = v10ActivationData as {
    state: string;
    owner_state: string;
    required_fields_total: number;
    required_fields_approved: number;
    blocked_reason: string | null;
    next_action: string;
  } | null;
  const v10FieldProvenance = v10FieldProvenanceData ?? [];
  const v10RenewalPosture = v10RenewalPostureData as {
    posture: string;
    horizon: string | null;
    reminder_eligible: boolean;
    blocked_reason: string | null;
    computed_at: string;
  } | null;
  const v10EvidenceStatuses = v10EvidenceStatusData ?? [];
  const activeV10EvidenceCount = v10EvidenceStatuses.filter((item) =>
    !["accepted", "approved", "complete", "completed"].includes(String(item.status))
  ).length;
  const v10ApprovalRecords = v10ApprovalRecordsData ?? [];
  const v10ExceptionRecords = v10ExceptionRecordsData ?? [];
  const v10AuditEvents = v10AuditData ?? [];
  const coreWorkRows = [
    ...v10WorkItems.map((item) => ({
      id: `v10-${item.source_id}`,
      title: String(item.title ?? "Task"),
      detail: [humanizeContractEnumLabel(String(item.type ?? "")), item.due_state ? humanizeContractEnumLabel(String(item.due_state)) : null]
        .filter(Boolean)
        .join(" · "),
      status: String(item.status ?? "open"),
      action: item.primary_action ? humanizeContractEnumLabel(String(item.primary_action)) : "Open task",
      updatedAt: item.updated_at ? String(item.updated_at) : null,
    })),
    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      detail: [task.assignee_id ? ownerMembers.find((member) => member.userId === task.assignee_id)?.label ?? "Assigned" : "Unassigned", task.due_date ? `Due ${formatBusinessDateAtNoon(task.due_date)}` : null]
        .filter(Boolean)
        .join(" · "),
      status: task.status,
      action: "Open task",
      updatedAt: task.updated_at ?? null,
    })),
  ];
  const coreActivityRows = [
    ...v10AuditEvents.map((event) => ({
      id: `activity-${String(event.source_id)}-${String(event.occurred_at)}`,
      title: humanizeAuditEventLabel(String(event.action ?? "")),
      detail: event.outcome ? humanizeContractEnumLabel(String(event.outcome)) : "Recorded",
      occurredAt: event.occurred_at ? String(event.occurred_at) : null,
    })),
    ...(latestSourceDocumentAt
      ? [
          {
            id: "activity-source-file",
            title: "Source file attached",
            detail: `${filesCount} file${filesCount === 1 ? "" : "s"} on record`,
            occurredAt: latestSourceDocumentAt,
          },
        ]
      : []),
    ...(latestExtractionTouchAt
      ? [
          {
            id: "activity-extraction",
            title: "Suggestions updated",
            detail: fieldsCount > 0 ? `${fieldsCount} detail${fieldsCount === 1 ? "" : "s"} available` : "No details yet",
            occurredAt: latestExtractionTouchAt,
          },
        ]
      : []),
    ...notes.slice(0, 4).map((note) => ({
      id: `activity-note-${note.id}`,
      title: "Note added",
      detail: note.pinned ? "Pinned note" : "Internal note",
      occurredAt: note.created_at,
    })),
  ]
    .filter((row) => row.occurredAt)
    .sort((a, b) => +new Date(b.occurredAt ?? 0) - +new Date(a.occurredAt ?? 0))
    .slice(0, 12);
  const coreActivityFeedItems: ActivityFeedItem[] = coreActivityRows.map((event) => {
    const visual = coreActivityVisual(event.title, event.detail);
    return {
      id: event.id,
      icon: visual.icon,
      tone: visual.tone,
      verb: visual.verb,
      detail: visual.detail,
      timestamp: event.occurredAt ?? "",
    };
  });
  const v10HasAnyTrustSignal = Boolean(
    v10HealthSnapshot ||
      v10Activation ||
      v10WorkItems.length > 0 ||
      v10FieldProvenance.length > 0 ||
      v10RenewalPosture ||
      v10EvidenceStatuses.length > 0 ||
      v10ApprovalRecords.length > 0 ||
      v10ExceptionRecords.length > 0 ||
      v10AuditEvents.length > 0
  );

  const ownerWorkHref = !contract.owner_id
    ? "/work?lens=unassigned"
    : contract.owner_id === ctx.user.id
      ? "/work?lens=assigned_to_me"
      : "/work?lens=assigned_to_my_team";
  const v10HeaderCards = [
    {
      label: "Owner",
      value: ownerLabel ?? "Unassigned",
      href: ownerWorkHref,
      sourceObject: "contract",
    },
    {
      label: "Next action",
      value: humanizeContractEnumLabel(
        v10HealthSnapshot?.next_action ?? v10Activation?.next_action ?? contract.required_next_step ?? "no_action_required"
      ),
      href: v10WorkItems.length > 0 ? "/work" : `/contracts/${contract.id}`,
      sourceObject: "work_item",
    },
    {
      label: "Health",
      value: v10HealthSnapshot
        ? `${v10HealthSnapshot.score} · ${humanizeContractEnumLabel(v10HealthSnapshot.band)}`
        : "Not materialized",
      href: `/contracts/${contract.id}#v10-contract-record-trust-title`,
      sourceObject: "contract",
    },
    {
      label: "Renewal",
      value: v10RenewalPosture ? humanizeContractEnumLabel(v10RenewalPosture.posture) : "Not materialized",
      href: "/renewals",
      sourceObject: "renewal_checkpoint",
    },
    {
      label: "Critical dates",
      value: v10HealthSnapshot
        ? `${v10HealthSnapshot.missing_critical_date_count} missing or unconfirmed`
        : "Data refresh needed",
      href: `/contracts/${contract.id}?tab=overview#extracted-fields`,
      sourceObject: "field",
    },
    {
      label: "Issues",
      value: `${v10ExceptionRecords.filter((item) => item.status !== "resolved").length || openExceptionsCount} open`,
      href: `/contracts/exceptions?status=open&contract=${contract.id}`,
      sourceObject: "exception",
    },
    {
      label: "Evidence",
      value: `${v10EvidenceStatuses.length || outstandingEvidenceCount} outstanding`,
      href: `/contracts/${contract.id}?tab=overview#contract-evidence`,
      sourceObject: "evidence_request",
    },
    {
      label: "Approvals",
      value: `${v10ApprovalRecords.filter((item) => item.status === "pending").length || pendingApprovalsCount} pending`,
      href: `/contracts/${contract.id}?tab=overview#renewal-approvals`,
      sourceObject: "approval",
    },
    {
      label: "Detail confirmation",
      value: `${pendingFieldsCount} pending`,
      href: `/contracts/${contract.id}?tab=overview#extracted-fields`,
      sourceObject: "field",
    },
    {
      label: "Latest audit",
      value: humanizeAuditEventLabel(v10AuditEvents[0]?.action ? String(v10AuditEvents[0].action) : null),
      href: `/contracts/${contract.id}#contract-audit-trail`,
      sourceObject: "audit_event",
    },
  ] as const;
  const visibleV10HeaderCards = v10HeaderCards.filter((card) => {
    if (!isCoreContractDetail) return true;
    if (["Latest audit", "Evidence", "Approvals", "Issues"].includes(card.label)) {
      return card.label === "Approvals"
        ? pendingApprovalsCount > 0
        : card.label === "Issues"
          ? openExceptionsCount > 0
          : card.label === "Evidence"
            ? outstandingEvidenceCount > 0 || activeV10EvidenceCount > 0
          : false;
    }
    return ["Owner", "Next action", "Health", "Critical dates", "Detail confirmation"].includes(card.label);
  });
  const hasBlockingApprovals = pendingApprovalsCount > 0 || v10ApprovalRecords.some((item) => item.status === "pending");
  const hasActiveIssues =
    openExceptionsCount > 0 || v10ExceptionRecords.some((item) => !["resolved", "closed"].includes(String(item.status)));
  const coreTabLinks: Array<[ContractDetailTab, string]> = [
    ["overview", "Overview"],
    ["fields", "Details"],
    ["dates", "Dates"],
    ["work", "Tasks"],
    ["approvals", "Approvals"],
    ["obligations", "Requirements"],
    ["evidence", "Evidence"],
    ["files", "Files"],
    ["notes", "Notes"],
    ["activity", "Activity"],
  ];
  const advancedTabLinks: Array<[ContractDetailTab, string]> = [
    ["overview", "Overview"],
    ["workflow", "Workflow"],
    ["renewals", "Renewals"],
    ["approvals", "Approvals"],
    ["programs", "Programs"],
    ["integrations", "Integrations"],
    ["ownership", "Ownership"],
    ["fields", "Details"],
    ["dates", "Dates"],
    ["files", "Files"],
    ["notes", "Notes"],
  ];
  const assuranceTabLinks: Array<[ContractDetailTab, string]> = [
    ["overview", "Overview"],
    ["evidence", "Evidence"],
    ["casefile", "Casefile"],
    ["timeline", "Timeline"],
    ["audit", "Audit"],
    ["reports", "Reports"],
    ["approvals", "Approvals"],
    ["files", "Files"],
    ["notes", "Notes"],
  ];
  const allTabLinks = isCoreContractDetail
    ? coreTabLinks
    : isAssuranceContractDetail
      ? assuranceTabLinks
      : advancedTabLinks;
  const tabValues = new Set(allTabLinks.map(([value]) => value));
  const activeTab = requestedTab && tabValues.has(requestedTab) ? requestedTab : "overview";
  const primaryTabGroups = allTabLinks.slice(0, isCoreContractDetail ? allTabLinks.length : 7).map(([value, label]) => ({
    value,
    label,
    tabs: [value],
  }));
  const hasSourceFiles = filesCount > 0;
  const hasExtractedFields = fieldsCount > 0;
  const needsOwner = !ownerLabel;
  const needsCounterparty = !contract.counterparty?.trim();
  const activeIssueCount = openExceptionsCount || v10ExceptionRecords.length;
  const blockingApprovalCount =
    pendingApprovalsCount || v10ApprovalRecords.filter((item) => item.status === "pending").length;
  const attentionEvidenceCount = outstandingEvidenceCount || activeV10EvidenceCount;
  type CoreAttentionRow = {
    key: string;
    kind: string;
    count: number;
    verb: string;
    /** Full caps action phrase shown in the capsule's right segment. */
    action: string;
    href: string;
    label: string;
    tone: "warning" | "danger";
  };
  const coreAttentionItems: CoreAttentionRow[] = [
    !hasSourceFiles
      ? {
          key: "file",
          kind: "File",
          count: 1,
          verb: "Attach",
          action: "Attach file",
          tone: "warning",
          href: `/contracts/${id}?tab=files`,
          label: "Signed source file is missing",
        }
      : null,
    needsOwner
      ? {
          key: "owner",
          kind: "Owner",
          count: 1,
          verb: "Assign",
          action: "Assign owner",
          tone: "warning",
          href: "#ownership-record",
          label: "Owner is unassigned",
        }
      : null,
    needsCounterparty
      ? {
          key: "counterparty",
          kind: "Counterparty",
          count: 1,
          verb: "Add",
          action: "Add counterparty",
          tone: "warning",
          href: "#ownership-record",
          label: "Counterparty is missing",
        }
      : null,
    hasSourceFiles && !hasExtractedFields
      ? {
          key: "extraction",
          kind: "Suggestions",
          count: 1,
          verb: "Run",
          action: "Run suggestions",
          tone: "warning",
          href: "#extracted-fields",
          label: "Suggested details are not ready yet",
        }
      : null,
    hasExtractedFields && missingCriticalDateLabels.length > 0
      ? {
          key: "dates",
          kind: missingCriticalDateLabels.length === 1 ? "Date" : "Dates",
          count: missingCriticalDateLabels.length,
          verb: "Add",
          action: `Add ${missingCriticalDateLabels.length === 1 ? "date" : "dates"}`,
          tone: "warning",
          href: "#contract-dates",
          label: `Missing key date${missingCriticalDateLabels.length === 1 ? "" : "s"}: ${missingCriticalDateLabels.join(", ")}`,
        }
      : null,
    pendingFieldsCount > 0
      ? {
          key: "fields",
          kind: pendingFieldsCount === 1 ? "Detail" : "Details",
          count: pendingFieldsCount,
          verb: "Confirm",
          action: `Confirm ${pendingFieldsCount === 1 ? "detail" : "details"}`,
          tone: "warning",
          href: "#extracted-fields",
          label: `${pendingFieldsCount} pending detail${pendingFieldsCount === 1 ? " needs" : "s need"} confirmation`,
        }
      : null,
    hasActiveIssues
      ? {
          key: "issues",
          kind: activeIssueCount === 1 ? "Issue" : "Issues",
          count: activeIssueCount,
          verb: "Triage",
          action: `Triage ${activeIssueCount === 1 ? "issue" : "issues"}`,
          tone: "danger",
          href: `/contracts/exceptions?status=open&contract=${contract.id}`,
          label: `${activeIssueCount} active issue${activeIssueCount === 1 ? "" : "s"}`,
        }
      : null,
    hasBlockingApprovals
      ? {
          key: "approvals",
          kind: blockingApprovalCount === 1 ? "Approval" : "Approvals",
          count: blockingApprovalCount,
          verb: "Review",
          action: `Review ${blockingApprovalCount === 1 ? "approval" : "approvals"}`,
          tone: "warning",
          href: "#renewal-approvals",
          label: `${blockingApprovalCount} approval${blockingApprovalCount === 1 ? "" : "s"} blocking next action`,
        }
      : null,
    attentionEvidenceCount > 0
      ? {
          key: "evidence",
          kind: attentionEvidenceCount === 1 ? "Gap" : "Gaps",
          count: attentionEvidenceCount,
          verb: "Request",
          action: "Request evidence",
          tone: "warning",
          href: "#contract-evidence",
          label: `${attentionEvidenceCount} evidence gap${attentionEvidenceCount === 1 ? " needs" : "s need"} follow-up`,
        }
      : null,
  ].filter((item): item is CoreAttentionRow => Boolean(item));
  // Severity-first ordering so the rows a reviewer must act on lead the rail:
  // active exceptions and blocking approvals first, then review/data work
  // (fields, dates, evidence), then setup gaps. The build order above is
  // setup-first for readability, so re-sort by acted-on severity here.
  const ATTENTION_PRIORITY: Record<string, number> = {
    issues: 0,
    approvals: 1,
    fields: 2,
    dates: 3,
    evidence: 4,
    file: 5,
    extraction: 6,
    owner: 7,
    counterparty: 8,
  };
  coreAttentionItems.sort(
    (a, b) => (ATTENTION_PRIORITY[a.key] ?? 99) - (ATTENTION_PRIORITY[b.key] ?? 99)
  );

  await emitProductTelemetryIfFirstForOrgUser(admin, {
    organizationId: orgId,
    userId: ctx.user.id,
    contractId: contract.id,
    action: "product.v10.contract_record_trust_viewed",
    details: {
      source: "contract_detail_trust_header",
      has_health_snapshot: Boolean(v10HealthSnapshot),
      has_activation_state: Boolean(v10Activation),
      work_item_count: v10WorkItems.length,
      field_provenance_count: v10FieldProvenance.length,
      audit_event_state: v10AuditEvents.length > 0 ? "present" : "empty",
      renewal_posture_state: v10RenewalPosture ? "present" : "missing",
    },
  });

  const extractedFields = contract.extracted_fields ?? [];
  const fieldByName = new Map(
    extractedFields.map((field: { field_name: string }) => [field.field_name, field])
  );
  // Date-typed fields live in the Dates card — exclude them from the
  // generic Extracted fields list so the same value isn't authored twice
  // on the same page (§10.4).
  const coreDateFieldSet = new Set<string>(CORE_CONTRACT_DATE_FIELDS);
  const nonDateExtractedFields = extractedFields.filter(
    (field: { field_name: string }) => !coreDateFieldSet.has(field.field_name)
  );
  const coreDateRows = CORE_CONTRACT_DATE_FIELDS.map((fieldName) => {
    const field = fieldByName.get(fieldName) as
      | { id?: string; field_name: string; field_value?: string | null; status?: string | null; confidence?: number | null }
      | undefined;
    return {
      key: fieldName,
      id: field?.id ?? null,
      label: criticalDateLabel(fieldName),
      value: field?.field_value?.trim() || "Missing",
      status: field?.status ?? "missing",
      confidence: field?.confidence ?? null,
    };
  });
  const missingCoreDateCount = coreDateRows.filter((row) => row.status !== "approved").length;
  const activeEvidenceCount = outstandingEvidenceCount || activeV10EvidenceCount;
  // Header `Open tasks` is real tracked follow-up items (v10 work + tasks);
  // `Needs attention` is the setup-gap + dependency list the rail renders from
  // `coreAttentionItems`.
  const openWorkCount = coreWorkRows.length;
  // Hold activation until suggested details are confirmed — a record should not
  // read as trusted/"Active" while AI suggestions are still pending sign-off
  // (release-state AI trust boundary). Null when nothing blocks activation.
  const markActiveBlockedReason =
    contract.status === "pending_review" && pendingFieldsCount > 0
      ? `Confirm ${pendingFieldsCount} pending suggested detail${pendingFieldsCount === 1 ? "" : "s"} before marking this contract active.`
      : null;
  // Header review-completeness ratio. Prefer the activation read model's
  // required-field tally; fall back to all extracted fields. Null when there
  // is nothing to review yet so the header chip is simply omitted.
  const reviewCompleteness =
    v10Activation && v10Activation.required_fields_total > 0
      ? {
          approved: v10Activation.required_fields_approved,
          total: v10Activation.required_fields_total,
        }
      : fieldsCount > 0
        ? { approved: approvedFieldsCount, total: fieldsCount }
        : null;
  // Open counts shown as subtle wayfinding chips on the section tabs. Kept
  // neutral (not amber) so the summary strip + rail remain the attention
  // focal zone — tab chips just tell you where the open items live.
  const coreTabBadgeCounts: Partial<Record<ContractDetailTab, number>> = {
    fields: pendingFieldsCount,
    dates: hasExtractedFields ? missingCoreDateCount : 0,
    work: coreWorkRows.length,
    approvals: pendingApprovalsCount,
    evidence: activeEvidenceCount,
  };
  // "Next date" must be an actual calendar deadline. notice_window is a
  // duration ("75 days before renewal"), not a date — exclude it so it can
  // never leak into the header as a parsed-NaN raw string. Pick the soonest
  // upcoming confirmed calendar date; show — when none is confirmed.
  const todayNoon = parseBusinessDateAtNoon(new Date().toISOString().slice(0, 10));
  const nextReviewedDate = coreDateRows
    .filter((row) => row.key !== "notice_window" && row.status === "approved")
    .map((row) => parseBusinessDateAtNoon(row.value))
    .filter((d): d is Date => d != null && (!todayNoon || d.getTime() >= todayNoon.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  // Notice window is a confirmed duration, surfaced separately as a compact
  // token ("75D") — never as a calendar date.
  const noticeWindowRow = coreDateRows.find((row) => row.key === "notice_window");
  const noticeWindowShort =
    noticeWindowRow && noticeWindowRow.status === "approved" && noticeWindowRow.value !== "Missing"
      ? noticeWindowRow.value.match(/\d+/)?.[0]
        ? `${noticeWindowRow.value.match(/\d+/)![0]}D`
        : noticeWindowRow.value
      : null;
  const shouldPrioritizeSourceDocuments = false;
  // Priority chain for the morphing header CTA. Active dependencies (issues,
  // blocking approvals) top the list, then pending confirmation — a record with
  // suggested details awaiting sign-off should surface "Confirm details", which
  // is why it outranks the lower-severity setup gaps (missing file, owner,
  // date). "Attach source file" only wins once there is nothing left to
  // review.
  const primaryAction = hasActiveIssues
    ? { href: `/contracts/exceptions?status=open&contract=${contract.id}`, label: "Review issue" }
    : hasBlockingApprovals
      ? { href: "#renewal-approvals", label: "Review approval" }
      : pendingFieldsCount > 0
        ? { href: "#extracted-fields", label: "Confirm details" }
        : !hasSourceFiles
          ? { href: `/contracts/${id}?tab=files`, label: "Attach source file" }
          : needsOwner
            ? { href: "#ownership-record", label: "Assign owner" }
            : missingCoreDateCount > 0 && hasExtractedFields
              ? { href: "#contract-dates", label: "Add key date" }
              : { href: "#contract-notes", label: "Add note" };
  const primaryActionHref = primaryAction.href;
  const primaryActionLabel = primaryAction.label;
  const coreReviewSignal = hasExtractedFields
    ? {
        value: pendingFieldsCount,
        tone: pendingFieldsCount > 0 ? ("attention" as const) : ("healthy" as const),
        href: "#extracted-fields",
        actionLabel: pendingFieldsCount > 0 ? "Review" : undefined,
      }
    : {
        value: 0,
        tone: hasSourceFiles ? ("attention" as const) : ("neutral" as const),
        href: hasSourceFiles ? "#extracted-fields" : "#source-documents",
        actionLabel: hasSourceFiles ? "Run" : "Attach",
      };
  const coreDateSignal = hasExtractedFields
    ? {
        value: missingCoreDateCount,
        tone: missingCoreDateCount > 0 ? ("attention" as const) : ("healthy" as const),
        actionLabel: missingCoreDateCount > 0 ? "Add" : undefined,
      }
    : {
        value: 0,
        tone: "neutral" as const,
        actionLabel: "Inspect",
      };



  return {
    id,
    ctx,
    orgId,
    admin,
    role,
    canEdit,
    canDelete,
    productSurface,
    isCoreContractDetail,
    isAdvancedContractDetail,
    isAssuranceContractDetail,
    showContractWorkflowOps,
    showContractRenewalWorkspace,
    showContractAdvancedRouting,
    showContractEvidenceOps,
    showContractAuditOps,
    showContractRecordControls,
    showContractFieldCollaboration,
    loadCoreContractOps,
    loadContractWorkData,
    loadContractActivityData,
    showUtilityExecutionSurfaces,
    showRelationshipWorkspaces,
    showProgramsSurface,
    showCollaborationSurface,
    contract,
    auditEvents,
    ownerMembers,
    showContractOwnerAssignment,
    upcomingReminders,
    reminderHistory,
    reminderDeliveryMap,
    extractionJob,
    tasks,
    notes,
    obligations,
    taskChecklistItems,
    taskComments,
    taskDependencies,
    taskArtifacts,
    checkpoints,
    renewalScenario,
    approvals,
    renewalWorkspaceNotes,
    fieldComments,
    handoffChecklists,
    taskEvents,
    obligationEvents,
    approvalEvents,
    isWatchlisted,
    casefileEventsRaw,
    mergedCasefile,
    executionGraphEdges,
    evidenceRequirements,
    latestEvidenceSubmissionByRequirement,
    canReviewEvidence,
    pendingFieldsCount,
    approvedFieldsCount,
    readyFieldsCount,
    approvedFieldNames,
    missingCriticalDateLabels,
    filesCount,
    fieldsCount,
    reviewQueueContinuity,
    workflowTimeline,
    createdFromUpload,
    fromReview,
    reviewPage,
    reviewQueueHref,
    backHref,
    backLabel,
    uploadedCount,
    invalidCount,
    failedCount,
    extractionState,
    creationNotice,
    ownerLabel,
    latestSourceDocumentAt,
    latestExtractionTouchAt,
    operationsStrip,
    openExceptionsCount,
    pendingApprovalsCount,
    outstandingEvidenceCount,
    immediateActions,
    v10HealthSnapshot,
    v10Deductions,
    v10DeductionCount,
    v10WorkItems,
    v10Activation,
    v10FieldProvenance,
    v10RenewalPosture,
    v10EvidenceStatuses,
    activeV10EvidenceCount,
    v10ApprovalRecords,
    v10ExceptionRecords,
    v10AuditEvents,
    coreWorkRows,
    coreActivityRows,
    coreActivityFeedItems,
    v10HasAnyTrustSignal,
    visibleV10HeaderCards,
    hasBlockingApprovals,
    hasActiveIssues,
    coreTabLinks,
    advancedTabLinks,
    assuranceTabLinks,
    allTabLinks,
    tabValues,
    activeTab,
    primaryTabGroups,
    hasSourceFiles,
    hasExtractedFields,
    needsOwner,
    needsCounterparty,
    activeIssueCount,
    blockingApprovalCount,
    attentionEvidenceCount,
    coreAttentionItems,
    extractedFields,
    fieldByName,
    coreDateFieldSet,
    nonDateExtractedFields,
    coreDateRows,
    missingCoreDateCount,
    activeEvidenceCount,
    openWorkCount,
    markActiveBlockedReason,
    reviewCompleteness,
    coreTabBadgeCounts,
    todayNoon,
    nextReviewedDate,
    noticeWindowRow,
    noticeWindowShort,
    shouldPrioritizeSourceDocuments,
    primaryAction,
    primaryActionHref,
    primaryActionLabel,
    coreReviewSignal,
    coreDateSignal,
    exceptionsCasefileData,
    changeEventsCasefileData,
    programAssignmentsData,
  };
}

export type ContractDetailPageModel = Awaited<ReturnType<typeof loadContractDetailPageModel>>;
