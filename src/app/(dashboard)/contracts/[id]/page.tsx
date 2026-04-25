import { getAuthContext } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { FieldReview } from "@/components/contracts/field-review";
import { AddFieldForm } from "@/components/contracts/add-field-form";
import { ExtractButton } from "@/components/contracts/extract-button";
import { DownloadButton } from "@/components/contracts/download-button";
import { UploadMoreFiles } from "@/components/contracts/upload-more-files";
import { OwnerAssignmentForm } from "@/components/contracts/owner-assignment-form";
import { DeleteContractButton } from "@/components/contracts/delete-contract-button";
import { FileText, ArrowLeft, User, Calendar, Bell } from "lucide-react";
import Link from "next/link";
import { STATUS_STYLES, STATUS_LABELS } from "@/lib/contracts";
import { formatFileSize } from "@/lib/format-file-size";
import { ContractStatusTransition } from "@/components/contracts/contract-status-transition";
import { ExtractionJobAlert } from "@/components/contracts/extraction-job-alert";
import { BatchApproveButton } from "@/components/contracts/batch-approve-button";
import { ReviewSaveNextTelemetryLink } from "@/components/contracts/review-save-next-telemetry-link";
import { ContractTasksPanel } from "@/components/contracts/contract-tasks-panel";
import { ContractNotesPanel } from "@/components/contracts/contract-notes-panel";
import { ContractObligationsPanel } from "@/components/contracts/contract-obligations-panel";
import { RenewalCheckpointsPanel } from "@/components/contracts/renewal-checkpoints-panel";
import { ContractEvidenceRequirementsPanel } from "@/components/contracts/contract-evidence-requirements-panel";
import { addRenewalWorkspaceNoteForm, seedRenewalPlaybook } from "@/actions/renewal-playbook";
import { canEditContracts } from "@/lib/permissions";
import { hasRoleCapability } from "@/lib/access-control";
import { addFieldCommentForm } from "@/actions/field-comments";
import { createClarificationTaskForm } from "@/actions/tasks";
import { removeWatchlistEntry, upsertWatchlistEntryForm } from "@/actions/watchlists";
import { requestContractApprovalForm, upsertRenewalScenarioForm } from "@/actions/approvals";
import {
  updateContractHandoffChecklistStatusForm,
  upsertContractHandoffChecklistForm,
  supersedeContractFileForm,
  updateContractExternalLinkForm,
  updateContractOperationalStateForm,
  applyContractTemplatePackForm,
} from "@/actions/contracts";
import { updateProgramAssignmentOverrideFormAction } from "@/actions/v4";
import { ExecutionGraphVizDynamic } from "@/components/v4/execution-graph-viz-dynamic";
import type {
  ContractApproval,
  ContractExtractionJob,
  ContractObligation,
  ContractNote,
  ContractRenewalScenario,
  ContractRenewalCheckpoint,
  ContractTask,
  OrgRole,
} from "@/lib/types";
import { buildUnifiedWorkflowTimeline } from "@/lib/workflow-activity";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { ContractExternalCollaborationSummary } from "@/components/contracts/contract-external-collaboration-summary";
import type { WorkspaceRole } from "@/lib/navigation";
import { loadProductSurfaceContext } from "@/lib/product-surface";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import { ContractHeroMetrics } from "@/components/contracts/contract-hero-metrics";
import { OperationalQueueRow } from "@/components/ui/operational-summary-card";
import {
  getReminderDeliveryState,
  groupReminderDeliveriesByReminderId,
} from "@/lib/reminder-delivery-visibility";
import { fetchReviewQueueContinuity } from "@/lib/contract-review-stats";
import { formatBusinessDateAtNoon } from "@/lib/v9-business-dates";
import {
  buildContractImmediateActions,
  buildContractOperationsStrip,
  type ContractDetailIconKey,
} from "@/lib/contract-detail-summary";
import { isEvidenceGapStatus } from "@/lib/evidence-status";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";

export default async function ContractDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    created?: string;
    uploaded?: string;
    invalid?: string;
    failed?: string;
    extraction?: string;
    from?: string;
    reviewPage?: string;
  }>;
}) {
  const { id } = await props.params;
  const {
    tab: rawTab,
    created: createdParam,
    uploaded: uploadedParam,
    invalid: invalidParam,
    failed: failedParam,
    extraction: extractionParam,
    from: fromParam,
    reviewPage: reviewPageParam,
  } = await props.searchParams;
  const activeTab = (
    ["overview", "dates", "tasks", "obligations", "notes", "audit"].includes(
      rawTab ?? ""
    )
      ? rawTab
      : "overview"
  ) as "overview" | "dates" | "tasks" | "obligations" | "notes" | "audit";
  const ctx = await getAuthContext();
  if (!ctx) {
    return (
      <WorkspaceRequiredState
        title="Workspace required for contract details"
        message="Contract detail, review continuity, and evidence state are only available inside a workspace. Refresh this page, then ask a workspace admin to restore access if this record stays unavailable."
      />
    );
  }

  const { orgId, admin, role } = ctx;
  const canEdit = canEditContracts(role as OrgRole);
  const productSurface = await loadProductSurfaceContext(admin, orgId, role as WorkspaceRole);
  const showUtilityExecutionSurfaces = evaluateFeatureEligibility(
    productSurface,
    "execution_graph"
  ).allowed;
  const showRelationshipWorkspaces =
    isFeatureEnabled("v5RelationshipLayer") &&
    evaluateFeatureEligibility(productSurface, "relationship_workspaces").allowed;
  const showProgramsSurface = evaluateFeatureEligibility(productSurface, "programs").allowed;
  const showCollaborationSurface =
    isFeatureEnabled("v5ExternalCollaboration") &&
    isFeatureEnabled("v6AssuranceCore") &&
    evaluateFeatureEligibility(productSurface, "collaboration").allowed;

  const [
    { data: contractData },
    { data: auditEventsData },
    { data: remindersData },
    { data: membersData },
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
    admin
      .from("audit_events")
      .select("id, action, created_at")
      .eq("contract_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("reminders")
      .select("id, reminder_type, reminder_date, sent_at")
      .eq("contract_id", id)
      .order("reminder_date", { ascending: true }),
    admin
      .from("organization_members")
      .select("user_id, profiles(full_name, email)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true }),
    admin
      .from("contract_extraction_jobs")
      .select(
        "id, contract_id, organization_id, status, attempt_count, last_error, started_at, completed_at"
      )
      .eq("contract_id", id)
      .maybeSingle(),
    admin
      .from("contract_tasks")
      .select(
        "id, contract_id, organization_id, created_by, assignee_id, title, details, status, priority, created_via, team_key, blocked_reason, recurrence_interval_days, sla_due_at, due_date, completed_at, created_at, updated_at"
      )
      .eq("contract_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("contract_notes")
      .select(
        "id, contract_id, organization_id, author_id, note, pinned, created_at, updated_at"
      )
      .eq("contract_id", id)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false }),
    admin
      .from("contract_obligations")
      .select(
        "id, contract_id, organization_id, created_by, owner_id, title, details, obligation_type, cadence, recurrence_type, recurrence_interval_days, next_due_date, escalation_due_at, escalation_status, due_date, status, evidence_notes, evidence_url, completed_at, created_at, updated_at"
      )
      .eq("contract_id", id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    admin
      .from("contract_renewal_checkpoints")
      .select(
        "id, contract_id, organization_id, task_key, label, offset_days, due_date, status, notes, completed_at, created_at, updated_at, renewal_state, workspace_json"
      )
      .eq("contract_id", id)
      .order("offset_days", { ascending: false }),
    admin
      .from("contract_renewal_scenarios")
      .select(
        "id, contract_id, organization_id, scenario, decision_notes, blocker, workspace_status, owner_id, target_decision_date, decision_date, escalation_date, commercial_context, scenario_confidence, last_reviewed_at, decided_by, decided_at, created_at, updated_at"
      )
      .eq("contract_id", id)
      .maybeSingle(),
    admin
      .from("contract_approvals")
      .select(
        "id, contract_id, organization_id, approval_type, status, requested_by, approver_id, delegated_from_id, delegated_to_id, due_at, escalated_at, category, exception_flag, exception_reason, notes, resolved_at, created_at, updated_at"
      )
      .eq("contract_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("contract_field_comments")
      .select("id, contract_id, organization_id, field_id, author_id, comment, mentions, created_at")
      .eq("contract_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("contract_handoff_checklists")
      .select("id, to_owner_id, checklist_note, status, created_at")
      .eq("contract_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("contract_task_events")
      .select("id, task_id, event_type, details, created_at")
      .eq("contract_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("contract_obligation_events")
      .select("id, obligation_id, event_type, details, created_at")
      .eq("contract_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("contract_approval_events")
      .select("id, approval_id, event_type, details, created_at")
      .eq("contract_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("contract_watchlists")
      .select("id")
      .eq("contract_id", id)
      .eq("user_id", ctx.user.id)
      .maybeSingle(),
    admin
      .from("contract_renewal_workspace_notes")
      .select("id, body, pinned, created_at")
      .eq("contract_id", id)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("operational_casefile_events")
      .select("id, event_type, entity_type, source, occurred_at, details_json")
      .eq("organization_id", orgId)
      .eq("contract_id", id)
      .order("occurred_at", { ascending: false })
      .limit(80),
    admin
      .from("evidence_requirements")
      .select("id, title, requirement_type, status, due_at, review_due_at, work_item_type, work_item_id")
      .eq("contract_id", id)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  if (!contractData) notFound();
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
    reminders.length === 0
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
  ] = await Promise.all([
    admin
      .from("execution_graph_edges")
      .select(
        "id, from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, status"
      )
      .eq("organization_id", orgId)
      .eq("contract_id", id)
      .limit(200),
    admin
      .from("exceptions")
      .select("id, title, exception_type, status, updated_at")
      .eq("organization_id", orgId)
      .eq("contract_id", id)
      .order("updated_at", { ascending: false })
      .limit(40),
    admin
      .from("contract_change_events")
      .select("id, event_type, summary, created_at")
      .eq("organization_id", orgId)
      .eq("contract_id", id)
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("contract_program_assignments")
      .select("id, override_json, program_id, contract_programs(name)")
      .eq("organization_id", orgId)
      .eq("contract_id", id)
      .eq("status", "active"),
    ownerProfilePromise,
    reminderDeliveryPromise,
    evidenceSubmissionPromise,
    admin
      .from("organization_workflow_settings")
      .select("role_policy_json")
      .eq("organization_id", orgId)
      .maybeSingle(),
  ]);

  const contract = { ...contractData, owner: ownerProfile as OwnerProfileRow | null };
  const auditEvents = auditEventsData ?? [];

  const ownerMembers = (membersData ?? []).map((m) => {
    const profile = m.profiles as unknown as {
      full_name: string | null;
      email: string | null;
    } | null;
    return {
      userId: m.user_id,
      label: profile?.full_name || profile?.email || "Member",
    };
  });

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
      admin
        .from("contract_task_checklist_items")
        .select("id, task_id, label, is_done, sort_order")
        .eq("contract_id", id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      admin
        .from("contract_task_comments")
        .select("id, task_id, body, parent_comment_id, edited_at, deleted_at, created_at")
        .eq("contract_id", id)
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("contract_task_dependencies")
        .select("id, task_id, depends_on_task_id")
        .eq("contract_id", id),
      admin
        .from("contract_task_artifacts")
        .select("id, task_id, label, url, created_at")
        .eq("contract_id", id)
        .order("created_at", { ascending: false })
        .limit(200),
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
      headline: e.event_type.replace(/\./g, " "),
      detail: [e.entity_type, e.source].filter(Boolean).join(" · "),
      occurred_at: e.occurred_at,
    })),
    ...(exceptionsCasefileData ?? []).map(
      (e: { id: string; title: string; exception_type: string; status: string; updated_at: string }) => ({
        id: `ex-${e.id}`,
        kind: "exception" as const,
        headline: `Exception · ${e.exception_type}`,
        detail: `${e.title} · ${e.status}`,
        occurred_at: e.updated_at,
      })
    ),
    ...(changeEventsCasefileData ?? []).map(
      (e: { id: string; event_type: string; summary: string | null; created_at: string }) => ({
        id: `ch-${e.id}`,
        kind: "change" as const,
        headline: `Change · ${e.event_type}`,
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
  const backLabel = fromReview ? "Review queue" : "Contracts";
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
            ? `${invalidCount} file${invalidCount === 1 ? " was" : "s were"} skipped because they were unsupported or over 20 MB.`
            : null,
          failedCount > 0
            ? `${failedCount} file upload${failedCount === 1 ? "" : "s"} failed after contract creation. Re-attach any missing signed source documents below.`
            : null,
          extractionState === "queued"
            ? "Extraction has been queued. Review extracted fields before reminders or downstream work rely on them."
            : extractionState === "not_available"
              ? "Extraction was not started automatically in this environment. You can run it manually from the extracted fields section."
              : extractionState === "skipped_no_files"
                ? "Add at least one signed source document to unlock extraction and source-backed review."
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

  const iconByKey: Record<ContractDetailIconKey, typeof User> = {
    owner: User,
    nextAction: FileText,
    reminders: Bell,
    freshness: Calendar,
  };

  const accentClassByKey = {
    primary: "text-[var(--text-primary)]",
    attention: "text-amber-700",
    secondary: "text-[var(--text-secondary)]",
  } as const;

  return (
    <div className="space-y-7 md:space-y-8">
      {creationNotice ? (
        <div className={creationNotice.tone === "success" ? "ui-alert-success" : "ui-alert-warning"}>
          <p className="font-semibold">{creationNotice.title}</p>
          <ul className="mt-2 space-y-1 text-[13px] leading-relaxed">
            {creationNotice.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
            <Link href="#extracted-fields" className="ui-link">
              Open extracted fields
            </Link>
            <span className="text-[var(--text-tertiary)]">·</span>
            <Link href={`${contract.id ? `/contracts/${contract.id}?tab=overview#source-documents` : "#source-documents"}`} className="ui-link">
              Check source documents
            </Link>
          </div>
        </div>
      ) : null}
      <div className="ui-card-hero overflow-hidden">
        <div className="border-b border-[var(--border-subtle)]/90 bg-[radial-gradient(circle_at_top_right,var(--canvas-glow),transparent_24%),linear-gradient(180deg,color-mix(in_oklab,var(--surface)_92%,white),var(--surface-raised))] px-5 py-6 md:px-10 md:py-8">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-strong)]"
          >
            <ArrowLeft size={16} strokeWidth={2} aria-hidden />
            {backLabel}
          </Link>
          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="ui-eyebrow">Agreement</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="ui-display-title max-w-3xl">{contract.title}</h1>
                <span
                  className={`ui-badge shrink-0 ${
                    STATUS_STYLES[contract.status as keyof typeof STATUS_STYLES]
                  }`}
                >
                  {STATUS_LABELS[contract.status as keyof typeof STATUS_LABELS]}
                </span>
              </div>
              {(contract.counterparty || contract.contract_type) && (
                <p className="mt-3 text-[14px] text-[var(--text-secondary)] md:text-[15px]">
                  {contract.counterparty && (
                    <span className="font-medium text-[var(--text-primary)]">{contract.counterparty}</span>
                  )}
                  {contract.counterparty && contract.contract_type && (
                    <span className="text-[var(--text-tertiary)]"> · </span>
                  )}
                  {contract.contract_type && (
                    <span className="text-[var(--text-secondary)]">{contract.contract_type}</span>
                  )}
                </p>
              )}
              {canEdit && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {isWatchlisted ? (
                    <form action={removeWatchlistEntry.bind(null, contract.id)}>
                      <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                        Remove from watchlist
                      </button>
                    </form>
                  ) : (
                    <form action={upsertWatchlistEntryForm} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="contractId" value={contract.id} />
                      <input
                        name="teamKey"
                        defaultValue="ops"
                        placeholder="team key"
                        maxLength={80}
                        className="ui-input-compact h-8 w-28 text-xs"
                      />
                      <input
                        name="note"
                        placeholder="why watch?"
                        maxLength={240}
                        className="ui-input-compact h-8 w-56 text-xs"
                      />
                      <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                        Add to watchlist
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {operationsStrip.map((item) => {
              const Icon = iconByKey[item.icon];
              return (
                <div
                  key={item.label}
                  className="rounded-[1rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_84%,white)] px-4 py-3 shadow-[var(--shadow-1)]"
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_76%,transparent)] p-2 text-[var(--text-tertiary)]">
                      <Icon size={14} aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                        {item.label}
                      </p>
                      <p className={`mt-1 text-[13px] leading-relaxed ${accentClassByKey[item.accent]}`}>{item.value}</p>
                      {item.footerHref && item.footerLabel ? (
                        <div className="mt-1">
                          <Link
                            href={item.footerHref}
                            className="text-[12px] font-medium text-[var(--text-link)] underline underline-offset-2"
                          >
                            {item.footerLabel}
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <ContractHeroMetrics
            contractId={contract.id}
            pendingFieldsCount={pendingFieldsCount}
            fieldsCount={fieldsCount}
            filesCount={filesCount}
            upcomingRemindersCount={upcomingReminders.length}
          />
          {immediateActions.length > 0 ? (
            <div className="mt-6 border-t border-[var(--border-subtle)] pt-6 sm:mt-8 sm:pt-8">
              <div className="flex flex-col gap-2">
                <p className="ui-eyebrow">Immediate actions</p>
                <p className="text-[13px] text-[var(--text-secondary)]">
                  The highest-signal blockers and next steps on this contract.
                </p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {immediateActions.map((action) => (
                  <OperationalQueueRow
                    key={`${action.eyebrow}-${action.title}`}
                    href={action.href}
                    eyebrow={action.eyebrow}
                    title={action.title}
                    hint={action.hint}
                    actionLabel={action.actionLabel}
                    tone={action.tone}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="ui-card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_52%,transparent)] px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              ["overview", "Overview"],
              ["dates", "Dates"],
              ["tasks", "Tasks"],
              ["obligations", "Obligations"],
              ["notes", "Notes"],
              ["audit", "Audit"],
            ].map(([value, label]) => (
              <Link
                key={value}
                href={`/contracts/${contract.id}?tab=${value}`}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors md:text-[12px] ${
                  activeTab === value
                    ? "border-[var(--accent-strong)] bg-[var(--accent-strong)] text-[var(--accent-fg)]"
                    : "border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_84%,white)] text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_74%,transparent)] hover:text-[var(--text-primary)]"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-7 md:gap-8 lg:grid-cols-3">
        <div className="space-y-7 md:space-y-8 lg:col-span-2">
          {(activeTab === "overview" || activeTab === "dates") && (
          <div id="extracted-fields" className="scroll-mt-28 ui-card overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-5 sm:flex-row sm:items-center sm:justify-between md:px-8">
              <div>
                <h2 className="ui-section-title text-base">Extracted fields</h2>
                <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">Review before reminders run.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/contracts/review" className="ui-link text-xs">
                  Review queue
                </Link>
                <ExtractButton
                  contractId={contract.id}
                  hasFiles={!!contract.contract_files?.length}
                  canEdit={canEdit}
                  extractionJob={extractionJob}
                />
                {canEdit && (
                  <form action={applyContractTemplatePackForm}>
                    <input type="hidden" name="contractId" value={contract.id} />
                    <button type="submit" className="ui-btn-secondary px-3 py-2 text-xs">
                      Apply template pack
                    </button>
                  </form>
                )}
              </div>
            </div>
            <div className="space-y-5 px-4 py-6 md:px-8">
              <ExtractionJobAlert
                job={extractionJob}
                fieldsCount={fieldsCount}
                pendingFieldsCount={pendingFieldsCount}
              />
              {reviewQueueContinuity ? (
                <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/50 px-4 py-4 text-sm text-indigo-950">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700/80">
                        Review queue
                      </p>
                      <p className="font-semibold text-indigo-950">
                        Contract {reviewQueueContinuity.position} of {reviewQueueContinuity.total} still needs attention.
                      </p>
                      <p className="text-[13px] leading-relaxed text-indigo-900/85">
                        {reviewQueueContinuity.currentPendingCount > 0
                          ? `${reviewQueueContinuity.currentPendingCount} field${reviewQueueContinuity.currentPendingCount === 1 ? "" : "s"} on this contract are still pending.`
                          : "The contract is still marked pending review even though no extracted fields are pending."}{" "}
                        {reviewQueueContinuity.nextContractId
                          ? `When you finish here, continue straight to the next contract instead of returning to the queue.`
                          : "This is the last contract currently waiting in the active queue."}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={reviewQueueHref} className="ui-btn-secondary px-3 py-2 text-xs">
                        Open queue
                      </Link>
                      {reviewQueueContinuity.nextContractId ? (
                        <ReviewSaveNextTelemetryLink
                          href={`/contracts/${reviewQueueContinuity.nextContractId}?tab=overview&from=review&reviewPage=${reviewPage}#extracted-fields`}
                          className="ui-btn-primary px-3 py-2 text-xs"
                        >
                          Open next contract
                          {reviewQueueContinuity.nextPendingCount > 0
                            ? ` (${reviewQueueContinuity.nextPendingCount} pending)`
                            : ""}
                        </ReviewSaveNextTelemetryLink>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              <BatchApproveButton
                contractId={contract.id}
                pendingCount={pendingFieldsCount}
                canEdit={canEdit}
              />
              <FieldReview
                fields={contract.extracted_fields || []}
                canEdit={canEdit}
              />
              <AddFieldForm
                contractId={contract.id}
                existingFieldNames={(contract.extracted_fields || []).map(
                  (f: { field_name: string }) => f.field_name
                )}
                canEdit={canEdit}
              />
            </div>
          </div>
          )}

          {activeTab === "overview" &&
            showRelationshipWorkspaces &&
            (Boolean((contract as { account_key?: string | null }).account_key) ||
              Boolean((contract as { counterparty_key?: string | null }).counterparty_key)) && (
              <div className="ui-card border-emerald-200/50 bg-emerald-50/30 p-5 md:p-6">
                <h2 className="ui-section-title text-base">Relationship context</h2>
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                  Open portfolio summaries for keys on this contract.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(contract as { account_key?: string | null }).account_key ? (
                    <Link
                      href={`/accounts/${encodeURIComponent(String((contract as { account_key?: string | null }).account_key))}`}
                      className="ui-btn-secondary px-3 py-2 text-xs"
                    >
                      Account workspace
                    </Link>
                  ) : null}
                  {(contract as { counterparty_key?: string | null }).counterparty_key ? (
                    <Link
                      href={`/counterparties/${encodeURIComponent(String((contract as { counterparty_key?: string | null }).counterparty_key))}`}
                      className="ui-btn-secondary px-3 py-2 text-xs"
                    >
                      Counterparty workspace
                    </Link>
                  ) : null}
                </div>
              </div>
            )}

          {(activeTab === "overview" || activeTab === "dates") && (
          <div id="source-documents" className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-4 py-3.5 md:px-8 md:py-4">
              <h2 className="ui-section-title text-base">Source documents</h2>
              <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">Signed files on this agreement.</p>
            </div>
            <div className="px-4 py-4.5 md:px-8 md:py-5">
              {!contract.contract_files?.length ? (
                <p className="text-[13px] text-[var(--text-tertiary)]">No files uploaded yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {contract.contract_files.map(
                    (file: {
                      id: string;
                      file_name: string;
                      file_type: string;
                      file_size: number;
                      storage_path: string;
                      created_at: string;
                    }) => (
                      <li
                        key={file.id}
                        className="flex items-center justify-between gap-4 py-4 first:pt-0"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))]">
                            <FileText size={18} className="text-[var(--text-tertiary)]" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                              {file.file_name}
                            </p>
                            <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">
                              {formatFileSize(file.file_size)}
                              <span className="text-[var(--text-tertiary)]"> · </span>
                              {format(new Date(file.created_at), "MMM d, yyyy")}
                              <span className="text-[var(--text-tertiary)]"> · </span>
                              <span className="font-medium text-emerald-700">Stored</span>
                            </p>
                          </div>
                        </div>
                        <DownloadButton
                          storagePath={file.storage_path}
                          fileName={file.file_name}
                        />
                      </li>
                    )
                  )}
                </ul>
              )}
              <div className="mt-6 border-t border-[var(--border-subtle)] pt-6">
                <UploadMoreFiles contractId={contract.id} canEdit={canEdit} />
                {canEdit && contract.contract_files?.length ? (
                  <form action={supersedeContractFileForm} className="mt-4 space-y-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <p className="ui-label-caps">Supersede older file and re-extract</p>
                    <select name="fileId" className="ui-input text-xs" defaultValue="">
                      <option value="" disabled>
                        Select file to supersede
                      </option>
                      {contract.contract_files.map((file: { id: string; file_name: string }) => (
                        <option key={file.id} value={file.id}>
                          {file.file_name}
                        </option>
                      ))}
                    </select>
                    <input
                      name="reason"
                      maxLength={200}
                      placeholder="Reason (optional)"
                      className="ui-input text-xs"
                    />
                    <button type="submit" className="ui-btn-secondary px-3 py-2 text-xs">
                      Mark superseded & re-run extraction
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          </div>
          )}

          {(activeTab === "overview" || activeTab === "tasks") && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4 md:px-8">
              <h2 className="ui-section-title text-base">Tasks & follow-up</h2>
              <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">Ownership and execution work.</p>
            </div>
            <div className="px-4 py-6 md:px-8">
              <ContractTasksPanel
                contractId={contract.id}
                tasks={tasks}
                canEdit={canEdit}
                members={ownerMembers}
                taskEvents={taskEvents}
                taskChecklistItems={taskChecklistItems}
                taskComments={taskComments}
                taskDependencies={taskDependencies}
                taskArtifacts={taskArtifacts}
                executionGraphEdges={executionGraphEdges}
              />
            </div>
          </div>
          )}

          {(activeTab === "overview" || activeTab === "obligations") && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4 md:px-8">
              <h2 className="ui-section-title text-base">Obligations</h2>
              <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">Ongoing commitments and evidence.</p>
            </div>
            <div className="px-4 py-6 md:px-8">
              <ContractObligationsPanel
                contractId={contract.id}
                obligations={obligations}
                members={ownerMembers}
                canEdit={canEdit}
                obligationEvents={obligationEvents}
                executionGraphEdges={executionGraphEdges}
              />
            </div>
          </div>
          )}

          {(activeTab === "overview" || activeTab === "dates") && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4 md:px-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="ui-section-title text-base">Renewal checklist</h2>
                  <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">120/90/60/30 renewal checkpoints.</p>
                </div>
                {canEdit && checkpoints.length === 0 && (
                  <form action={seedRenewalPlaybook.bind(null, contract.id) as never}>
                    <button type="submit" className="ui-btn-secondary px-4 py-2 text-[13px]">
                      Seed checklist
                    </button>
                  </form>
                )}
              </div>
            </div>
            <div className="px-4 py-6 md:px-8">
              <RenewalCheckpointsPanel checkpoints={checkpoints} canEdit={canEdit} />
            </div>
          </div>
          )}
        </div>

        <div className="space-y-7 md:space-y-8">
          {activeTab === "overview" && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4">
              <h3 className="ui-section-title text-base">Workflow status</h3>
            </div>
            <div className="p-6">
              <ContractStatusTransition
                contractId={contract.id}
                currentStatus={contract.status}
                canEdit={canEdit}
              />
              <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
                <p className="ui-label-caps">Operational lifecycle</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Intake: {contract.intake_status ?? "awaiting_review"} · Health:{" "}
                  {contract.health_status ?? "unknown"}
                </p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Next step: {contract.required_next_step || "Not set"}
                </p>
                {canEdit && (
                  <form action={updateContractOperationalStateForm} className="mt-3 space-y-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="min-w-0">
                      <select name="intakeStatus" defaultValue={contract.intake_status ?? "awaiting_review"} className="ui-input w-full min-w-0 text-xs">
                        <option value="awaiting_review">awaiting review</option>
                        <option value="in_clarification">in clarification</option>
                        <option value="active">active</option>
                        <option value="at_risk">at risk</option>
                        <option value="renewal_prep">renewal prep</option>
                        <option value="notice_decision">notice decision</option>
                        <option value="archived">archived</option>
                      </select>
                      </div>
                      <div className="min-w-0">
                      <select name="healthStatus" defaultValue={contract.health_status ?? "unknown"} className="ui-input w-full min-w-0 text-xs">
                        <option value="healthy">healthy</option>
                        <option value="watch">watch</option>
                        <option value="at_risk">at risk</option>
                        <option value="unknown">unknown</option>
                      </select>
                      </div>
                    </div>
                    <input
                      name="requiredNextStep"
                      defaultValue={contract.required_next_step ?? ""}
                      placeholder="Required next step"
                      maxLength={240}
                      className="ui-input text-xs"
                    />
                    <button type="submit" className="ui-btn-secondary w-full px-3 py-2 text-xs">
                      Update lifecycle
                    </button>
                  </form>
                )}
              </div>
              {showUtilityExecutionSurfaces ? (
                <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
                  <p className="ui-label-caps">Execution graph</p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">Cross-work dependencies for this contract.</p>
                  <Link
                    href={`/contracts/execution-graph?contractId=${contract.id}`}
                    className="ui-link mt-2 inline-block text-xs"
                  >
                    Open portfolio graph view
                  </Link>
                  {executionGraphEdges.length > 0 ? (
                    <div className="mt-3 max-h-[320px] overflow-auto">
                      <ExecutionGraphVizDynamic edges={executionGraphEdges} />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-[var(--text-tertiary)]">Apply a program to generate dependency edges.</p>
                  )}
                </div>
              ) : null}
              <div id="contract-evidence" className="mt-6 border-t border-[var(--border-subtle)] pt-5">
                <p className="ui-label-caps">Operational evidence pack</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Export submissions and requirements for audits.
                </p>
                <a
                  href={`/api/evidence/export/${contract.id}`}
                  className="ui-link mt-2 inline-block text-xs"
                  target="_blank"
                  rel="noreferrer"
                >
                  Download evidence pack (JSON)
                </a>
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                    Active requirements
                  </p>
                  <div className="mt-2">
                    <ContractEvidenceRequirementsPanel
                      requirements={evidenceRequirements}
                      canEdit={canEdit}
                      canReview={canReviewEvidence}
                      contractId={contract.id}
                      latestSubmissionByRequirement={latestEvidenceSubmissionByRequirement}
                    />
                  </div>
                </div>
              </div>
              <ContractExternalCollaborationSummary
                admin={admin}
                orgId={orgId}
                contractId={contract.id}
                allowed={showCollaborationSurface}
              />
              {showProgramsSurface && (programAssignmentsData ?? []).length > 0 ? (
                <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
                  <p className="ui-label-caps">Program assignment overrides</p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    Per-contract routing JSON merged when programs apply (assignee_id, assignee_by_team).
                  </p>
                  <ul className="mt-3 space-y-3">
                    {(programAssignmentsData ?? []).map(
                      (row: {
                        id: string;
                        program_id: string;
                        override_json: Record<string, unknown>;
                        contract_programs: { name: string } | { name: string }[] | null;
                      }) => {
                        const prog = row.contract_programs;
                        const programName = Array.isArray(prog)
                          ? prog[0]?.name
                          : prog?.name;
                        return (
                          <li key={row.id} className="rounded-lg border border-[var(--border-subtle)] p-3 text-xs">
                            <p className="font-medium text-[var(--text-primary)]">
                              {programName ?? row.program_id}
                            </p>
                            {canEdit ? (
                              <form action={updateProgramAssignmentOverrideFormAction} className="mt-2 space-y-2">
                                <input type="hidden" name="assignmentId" value={row.id} />
                                <textarea
                                  name="overrideJson"
                                  defaultValue={JSON.stringify(row.override_json ?? {}, null, 2)}
                                  rows={5}
                                  className="ui-input w-full font-mono text-[11px]"
                                />
                                <button type="submit" className="ui-btn-secondary px-3 py-1.5 text-xs">
                                  Save override
                                </button>
                              </form>
                            ) : (
                              <pre className="mt-2 overflow-x-auto rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] p-2 text-[11px]">
                                {JSON.stringify(row.override_json ?? {}, null, 2)}
                              </pre>
                            )}
                          </li>
                        );
                      }
                    )}
                  </ul>
                </div>
              ) : null}
              <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
                <p className="ui-label-caps">CRM / external link</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {contract.source_system || "No source system"} ·{" "}
                  {contract.region || "No region"} ·{" "}
                  {contract.annual_value != null ? `$${Number(contract.annual_value).toLocaleString()}` : "No annual value"} ·{" "}
                  {contract.external_reference_id || "No external reference"}
                </p>
                {canEdit && (
                  <form action={updateContractExternalLinkForm} className="mt-3 space-y-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <input
                      name="sourceSystem"
                      defaultValue={contract.source_system ?? ""}
                      placeholder="CRM/system name"
                      maxLength={80}
                      className="ui-input text-xs"
                    />
                    <input
                      name="externalReferenceId"
                      defaultValue={contract.external_reference_id ?? ""}
                      placeholder="External ID"
                      maxLength={160}
                      className="ui-input text-xs"
                    />
                    <input
                      name="region"
                      defaultValue={contract.region ?? ""}
                      placeholder="Region (NA, EMEA, APAC...)"
                      maxLength={40}
                      className="ui-input text-xs"
                    />
                    <input
                      name="annualValue"
                      defaultValue={
                        contract.annual_value == null ? "" : String(contract.annual_value)
                      }
                      placeholder="Annual value (e.g. 125000)"
                      inputMode="decimal"
                      className="ui-input text-xs"
                    />
                    <button type="submit" className="ui-btn-secondary w-full px-3 py-2 text-xs">
                      Save external link
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
          )}

          {activeTab === "overview" && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4">
              <h3 className="ui-section-title text-base">Renewal scenario & approvals</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-[var(--text-tertiary)]">
                Scenario: {renewalScenario?.scenario?.replace(/_/g, " ") || "not set"}
                {renewalScenario?.blocker ? ` · blocker: ${renewalScenario.blocker}` : ""}
              </p>
              {canEdit && (
                <form action={upsertRenewalScenarioForm} className="space-y-2">
                  <input type="hidden" name="contractId" value={contract.id} />
                  <select name="scenario" defaultValue={renewalScenario?.scenario ?? "awaiting_decision"} className="ui-input text-xs">
                    <option value="awaiting_decision">awaiting decision</option>
                    <option value="renew">renew</option>
                    <option value="renegotiate">renegotiate</option>
                    <option value="terminate">terminate</option>
                    <option value="replace">replace</option>
                    <option value="discontinue">discontinue</option>
                    <option value="temporary_extension">temporary extension</option>
                  </select>
                  <input
                    name="blocker"
                    defaultValue={renewalScenario?.blocker ?? ""}
                    placeholder="Blocker (optional)"
                    className="ui-input text-xs"
                  />
                  <textarea
                    name="decisionNotes"
                    defaultValue={renewalScenario?.decision_notes ?? ""}
                    placeholder="Decision notes"
                    className="ui-input min-h-[70px] text-xs"
                  />
                  <select
                    name="workspaceStatus"
                    defaultValue={renewalScenario?.workspace_status ?? "in_progress"}
                    className="ui-input text-xs"
                  >
                    <option value="not_started">not started</option>
                    <option value="in_progress">in progress</option>
                    <option value="blocked">blocked</option>
                    <option value="decision_pending">decision pending</option>
                    <option value="closed">closed</option>
                  </select>
                  <select name="ownerId" defaultValue={renewalScenario?.owner_id ?? ""} className="ui-input text-xs">
                    <option value="">Workspace owner (optional)</option>
                    {ownerMembers.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.label}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input
                      name="targetDecisionDate"
                      type="date"
                      defaultValue={renewalScenario?.target_decision_date ?? ""}
                      className="ui-input text-xs"
                    />
                    <input
                      name="escalationDate"
                      type="date"
                      defaultValue={renewalScenario?.escalation_date ?? ""}
                      className="ui-input text-xs"
                    />
                    <input
                      name="scenarioConfidence"
                      type="number"
                      min={1}
                      max={100}
                      defaultValue={renewalScenario?.scenario_confidence ?? ""}
                      placeholder="Confidence %"
                      className="ui-input text-xs"
                    />
                  </div>
                  <textarea
                    name="commercialContext"
                    defaultValue={renewalScenario?.commercial_context ?? ""}
                    placeholder="Commercial context (optional)"
                    className="ui-input min-h-[54px] text-xs"
                  />
                  <button type="submit" className="ui-btn-secondary w-full px-3 py-2 text-xs">
                    Save scenario
                  </button>
                </form>
              )}
              <div className="border-t border-[var(--border-subtle)] pt-4">
                <p className="ui-label-caps">Workspace notes ({renewalWorkspaceNotes.length})</p>
                {canEdit && (
                  <form action={addRenewalWorkspaceNoteForm as never} className="mt-2 space-y-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <textarea name="body" placeholder="Add renewal workspace note" className="ui-input min-h-[60px] text-xs" />
                    <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <input type="checkbox" name="pinned" value="1" className="h-3.5 w-3.5 rounded border-[var(--border-strong)]" />
                      Pin note
                    </label>
                    <button type="submit" className="ui-btn-secondary w-full px-3 py-2 text-xs">
                      Add note
                    </button>
                  </form>
                )}
                {renewalWorkspaceNotes.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {renewalWorkspaceNotes.slice(0, 4).map((note) => (
                      <li key={note.id} className="rounded border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                        {note.pinned ? "Pinned · " : ""}
                        {note.body}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="border-t border-[var(--border-subtle)] pt-4">
                <p className="ui-label-caps">Renewal command context</p>
                <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                  <li>
                    Watchlist:{" "}
                    <span className="font-semibold text-[var(--text-primary)]">{isWatchlisted ? "yes" : "no"}</span>
                  </li>
                  <li>
                    Pending approvals:{" "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {approvals.filter((a) => a.status === "pending").length}
                    </span>
                  </li>
                  <li>
                    Contract risk:{" "}
                    <span className="font-semibold text-[var(--text-primary)]">{contract.health_status ?? "unknown"}</span>
                  </li>
                  <li>
                    Why surfaced: target decision path, blockers, approvals, and risk are coordinated here.
                  </li>
                </ul>
              </div>
              <div id="renewal-approvals" className="border-t border-[var(--border-subtle)] pt-4">
                <p className="ui-label-caps">Approvals ({approvals.length})</p>
                {canEdit && (
                  <form action={requestContractApprovalForm} className="mt-2 space-y-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <select name="approvalType" defaultValue="renewal_decision" className="ui-input text-xs">
                      <option value="renewal_decision">renewal decision</option>
                      <option value="notice_action">notice action</option>
                      <option value="commercial_exception">commercial exception</option>
                      <option value="ownership_handoff">ownership handoff</option>
                    </select>
                    <textarea name="notes" placeholder="Request notes" className="ui-input min-h-[60px] text-xs" />
                    <select name="approverId" defaultValue="" className="ui-input text-xs">
                      <option value="">Policy/default approver</option>
                      {ownerMembers.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.label}
                        </option>
                      ))}
                    </select>
                    <select name="category" defaultValue="standard" className="ui-input text-xs">
                      <option value="standard">standard</option>
                      <option value="policy_exception">policy exception</option>
                      <option value="financial">financial</option>
                      <option value="operational">operational</option>
                    </select>
                    <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <input type="checkbox" name="exceptionFlag" value="1" className="h-3.5 w-3.5 rounded border-[var(--border-strong)]" />
                      Mark as exception
                    </label>
                    <input
                      name="exceptionReason"
                      placeholder="Exception reason (optional)"
                      className="ui-input text-xs"
                    />
                    <button type="submit" className="ui-btn-secondary w-full px-3 py-2 text-xs">
                      Request approval
                    </button>
                  </form>
                )}
                {approvals.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {approvals.slice(0, 4).map((a) => (
                      <li key={a.id} className="rounded border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                        {a.approval_type.replace(/_/g, " ")} · {a.status}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          )}

          {activeTab === "overview" && (
          <div id="ownership-record" className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4">
              <h3 className="flex items-center gap-2 ui-section-title text-base">
                <Bell size={17} className="text-[var(--accent)]" strokeWidth={1.75} aria-hidden />
                Reminders
              </h3>
            </div>
            <div className="p-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase text-[var(--text-tertiary)]">
                  Scheduled
                </p>
                {upcomingReminders.length === 0 ? (
                  <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                    None pending. Approve a date field to schedule reminders.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {upcomingReminders.map(
                      (r: {
                        id: string;
                        reminder_type: string;
                        reminder_date: string;
                      }) => {
                        const delivery = getReminderDeliveryState(reminderDeliveryMap[r.id] ?? []);
                        const deliveryToneClass =
                          delivery.tone === "healthy"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : delivery.tone === "risk"
                              ? "border-rose-200 bg-rose-50 text-rose-800"
                              : delivery.tone === "attention"
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] text-[var(--text-secondary)]";
                        return (
                          <li
                            key={r.id}
                            className="rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] px-3 py-2 text-sm"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-[var(--text-primary)]">
                                {r.reminder_type.replace(/_/g, " ")}
                              </span>
                              <span className="text-[var(--text-tertiary)]">
                                {formatBusinessDateAtNoon(r.reminder_date)}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${deliveryToneClass}`}
                              >
                                {delivery.label}
                              </span>
                            </div>
                            <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">{delivery.detail}</p>
                            {delivery.timestamp ? (
                              <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                                Updated {format(new Date(delivery.timestamp), "MMM d, yyyy h:mm a")}
                              </p>
                            ) : null}
                          </li>
                        );
                      }
                    )}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-[var(--text-tertiary)]">
                  Sent (history)
                </p>
                {reminderHistory.length === 0 ? (
                  <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                    No reminder emails sent yet for this contract.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {reminderHistory.map(
                      (r: {
                        id: string;
                        reminder_type: string;
                        reminder_date: string;
                        sent_at: string;
                      }) => {
                        const delivery = getReminderDeliveryState(reminderDeliveryMap[r.id] ?? []);
                        const deliveryToneClass =
                          delivery.tone === "healthy"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : delivery.tone === "risk"
                              ? "border-rose-200 bg-rose-50 text-rose-800"
                              : delivery.tone === "attention"
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] text-[var(--text-secondary)]";
                        return (
                          <li key={r.id} className="rounded-lg border border-[var(--border-subtle)]/70 px-3 py-2 text-sm text-[var(--text-secondary)]">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[var(--text-primary)]">
                                {r.reminder_type.replace(/_/g, " ")}
                              </span>
                              <span>scheduled {formatBusinessDateAtNoon(r.reminder_date)}</span>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${deliveryToneClass}`}
                              >
                                {delivery.label}
                              </span>
                            </div>
                            {r.sent_at ? (
                              <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">
                                Sent {format(new Date(r.sent_at), "MMM d, yyyy h:mm a")}
                              </p>
                            ) : null}
                            <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">{delivery.detail}</p>
                          </li>
                        );
                      }
                    )}
                  </ul>
                )}
              </div>
            </div>
            </div>
          </div>
          )}

          {(activeTab === "overview" || activeTab === "audit") && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4">
              <h3 className="ui-section-title text-base">Operational casefile</h3>
            </div>
            <div className="p-6">
              {mergedCasefile.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)]">No casefile events recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {mergedCasefile.map((entry) => (
                    <li key={entry.id} className="flex items-start justify-between gap-3 text-xs">
                      <span className="text-[var(--text-secondary)]">
                        <span className="font-semibold">{entry.headline}</span>
                        {entry.detail ? ` · ${entry.detail}` : ""}
                        <span className="text-[var(--text-tertiary)]"> · {entry.kind}</span>
                      </span>
                      <span className="shrink-0 text-[var(--text-tertiary)]">
                        {format(new Date(entry.occurred_at), "MMM d, h:mm a")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          )}

          {(activeTab === "overview" || activeTab === "audit") && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4">
              <h3 className="ui-section-title text-base">Ownership & record</h3>
            </div>
            <div className="p-6">
            <dl className="space-y-3">
              <div className="flex items-center gap-2">
                <User size={14} className="text-[var(--text-tertiary)]" />
                <dt className="text-sm text-[var(--text-tertiary)]">Owner</dt>
                <dd className="ml-auto text-sm font-medium text-[var(--text-primary)]">
                  {contract.owner?.full_name || contract.owner?.email || "—"}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-[var(--text-tertiary)]" />
                <dt className="text-sm text-[var(--text-tertiary)]">Created</dt>
                <dd className="ml-auto text-sm text-[var(--text-primary)]">
                  {format(new Date(contract.created_at), "MMM d, yyyy")}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-[var(--text-tertiary)]" />
                <dt className="text-sm text-[var(--text-tertiary)]">Updated</dt>
                <dd className="ml-auto text-sm text-[var(--text-primary)]">
                  {format(new Date(contract.updated_at), "MMM d, yyyy")}
                </dd>
              </div>
            </dl>
            {canEdit && ownerMembers.length > 0 && (
              <OwnerAssignmentForm
                contractId={contract.id}
                currentOwnerId={contract.owner_id}
                currentSecondaryOwnerId={contract.secondary_owner_id ?? null}
                members={ownerMembers}
              />
            )}
            {canEdit && ownerMembers.length > 0 && (
              <form action={upsertContractHandoffChecklistForm} className="mt-4 space-y-2">
                <input type="hidden" name="contractId" value={contract.id} />
                <p className="ui-label-caps">Ownership handoff checklist</p>
                <select name="toOwnerId" required className="ui-input text-xs">
                  <option value="">Select new owner...</option>
                  {ownerMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <textarea
                  name="checklistNote"
                  required
                  maxLength={4000}
                  placeholder="Capture context, client nuance, unresolved issues, and next actions."
                  className="ui-input min-h-[72px] text-xs"
                />
                <button type="submit" className="ui-btn-secondary px-3 py-2 text-xs">
                  Save handoff checklist
                </button>
                {handoffChecklists.length > 0 && (
                  <ul className="space-y-1.5">
                    {handoffChecklists.slice(0, 3).map((item) => (
                      <li key={item.id} className="text-xs text-[var(--text-secondary)]">
                        <span>{item.status} · {item.checklist_note}</span>
                        {item.status !== "completed" && (
                          <form
                            action={updateContractHandoffChecklistStatusForm.bind(
                              null,
                              item.id,
                              "completed"
                            )}
                            className="inline-block ml-2"
                          >
                            <button type="submit" className="ui-btn-secondary px-2 py-0.5 text-[11px]">
                              Mark complete
                            </button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </form>
            )}
            <DeleteContractButton
              contractId={contract.id}
              contractTitle={contract.title}
              canEdit={canEdit}
            />
            </div>
          </div>
          )}

          {(activeTab === "overview" || activeTab === "audit") && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4">
              <h3 className="ui-section-title text-base">Unified workflow timeline</h3>
            </div>
            <div className="p-6">
              {workflowTimeline.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)]">No workflow timeline entries yet.</p>
              ) : (
                <ul className="space-y-2">
                  {workflowTimeline.map((entry) => (
                    <li key={entry.id} className="flex items-start justify-between gap-3 text-xs">
                      <span className="text-[var(--text-secondary)]">
                        <span className="font-semibold">{entry.domain}</span> · {entry.label}
                      </span>
                      <span className="shrink-0 text-[var(--text-tertiary)]">
                        {format(new Date(entry.createdAt), "MMM d, h:mm a")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          )}

          {(activeTab === "overview" || activeTab === "audit") && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4">
              <h3 className="ui-section-title text-base">Activity</h3>
            </div>
            <div className="p-6">
            {auditEvents.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">No activity recorded.</p>
            ) : (
              <ul className="space-y-3">
                {auditEvents.map(
                  (event: {
                    id: string;
                    action: string;
                    created_at: string;
                  }) => (
                    <li key={event.id} className="flex items-start gap-2">
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--border-strong)]" />
                      <div>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {event.action.replace(/\./g, " ")}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {format(
                            new Date(event.created_at),
                            "MMM d, yyyy h:mm a"
                          )}
                        </p>
                      </div>
                    </li>
                  )
                )}
              </ul>
            )}
            </div>
          </div>
          )}

          {(activeTab === "overview" || activeTab === "notes") && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] px-6 py-4">
              <h3 className="ui-section-title text-base">Notes & commentary</h3>
            </div>
            <div className="p-6">
              <ContractNotesPanel
                contractId={contract.id}
                notes={notes}
                currentUserId={ctx.user.id}
                memberLabels={ownerMembers}
                canEdit={canEdit}
              />
              <div id="field-comments" className="mt-6 border-t border-[var(--border-subtle)] pt-5 scroll-mt-28">
                <p className="ui-label-caps">Field comments & mentions</p>
                {canEdit && (
                  <form action={createClarificationTaskForm as never} className="mt-2 space-y-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <input
                      name="fieldId"
                      placeholder="Optional field id"
                      className="ui-input text-xs"
                    />
                    <input
                      name="teamKey"
                      defaultValue="ops"
                      placeholder="Team queue key"
                      className="ui-input text-xs"
                    />
                    <textarea
                      name="requesterNote"
                      required
                      placeholder="Request clarification from owner/teammate..."
                      className="ui-input min-h-[64px] text-xs"
                    />
                    <button type="submit" className="ui-btn-secondary px-3 py-2 text-xs">
                      Create clarification task
                    </button>
                  </form>
                )}
                {canEdit && (
                  <form action={addFieldCommentForm} className="mt-2 space-y-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <input
                      name="fieldId"
                      placeholder="Optional field id"
                      className="ui-input text-xs"
                    />
                    <textarea
                      name="comment"
                      required
                      placeholder="Add field-level context. Mention teammates with @email or @full.name."
                      className="ui-input min-h-[72px] text-xs"
                    />
                    <button type="submit" className="ui-btn-secondary px-3 py-2 text-xs">
                      Add field comment
                    </button>
                  </form>
                )}
                {fieldComments.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {fieldComments.map((comment) => (
                      <li key={comment.id} className="rounded border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                        {comment.comment}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
