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
import { ContractTasksPanel } from "@/components/contracts/contract-tasks-panel";
import { ContractNotesPanel } from "@/components/contracts/contract-notes-panel";
import { ContractObligationsPanel } from "@/components/contracts/contract-obligations-panel";
import { RenewalCheckpointsPanel } from "@/components/contracts/renewal-checkpoints-panel";
import { ContractEvidenceRequirementsPanel } from "@/components/contracts/contract-evidence-requirements-panel";
import { addRenewalWorkspaceNoteForm, seedRenewalPlaybook } from "@/actions/renewal-playbook";
import { canEditContracts } from "@/lib/permissions";
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
import { ExecutionGraphViz } from "@/components/v4/execution-graph-viz";
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

export default async function ContractDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await props.params;
  const { tab: rawTab } = await props.searchParams;
  const activeTab = (
    ["overview", "dates", "tasks", "obligations", "notes", "audit"].includes(
      rawTab ?? ""
    )
      ? rawTab
      : "overview"
  ) as "overview" | "dates" | "tasks" | "obligations" | "notes" | "audit";
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const { orgId, admin, role } = ctx;
  const canEdit = canEditContracts(role as OrgRole);

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
  ] = await Promise.all([
    admin
      .from("contracts")
      .select(
        "id, organization_id, title, counterparty, contract_type, status, intake_status, health_status, required_next_step, source_system, region, annual_value, external_reference_id, owner_id, secondary_owner_id, created_by, created_at, updated_at, contract_files(*), extracted_fields(*)"
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
  ]);

  if (!contractData) notFound();

  const { data: evidenceRequirementsData } = await admin
    .from("evidence_requirements")
    .select("id, title, requirement_type, status, due_at, review_due_at, work_item_type, work_item_id")
    .eq("contract_id", id)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(40);

  const [
    { data: graphEdgesData },
    { data: exceptionsCasefileData },
    { data: changeEventsCasefileData },
    { data: programAssignmentsData },
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
  ]);

  let ownerProfile: { full_name: string | null; email: string | null } | null = null;
  if (contractData.owner_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", contractData.owner_id)
      .single();
    ownerProfile = profile;
  }

  const contract = { ...contractData, owner: ownerProfile };
  const auditEvents = auditEventsData ?? [];
  const reminders = remindersData ?? [];

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
  const pendingFieldsCount = (contract.extracted_fields ?? []).filter(
    (f: { status: string }) => f.status === "pending"
  ).length;
  const filesCount = contract.contract_files?.length ?? 0;
  const fieldsCount = contract.extracted_fields?.length ?? 0;
  const workflowTimeline = buildUnifiedWorkflowTimeline({
    taskEvents: taskEvents as Array<{ id: string; event_type: string; created_at: string }>,
    obligationEvents: obligationEvents as Array<{ id: string; event_type: string; created_at: string }>,
    approvalEvents: approvalEvents as Array<{ id: string; event_type: string; created_at: string }>,
    renewalNotes: renewalWorkspaceNotes,
  });

  return (
    <div className="space-y-7 md:space-y-8">
      <div className="ui-card-hero overflow-hidden">
        <div className="border-b border-zinc-100/90 bg-gradient-to-br from-zinc-50/90 via-white to-white px-5 py-6 md:px-10 md:py-8">
          <Link
            href="/contracts"
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-zinc-500 transition-colors hover:text-[var(--accent)]"
          >
            <ArrowLeft size={16} strokeWidth={2} aria-hidden />
            Contracts
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
                <p className="mt-3 text-[14px] text-zinc-600 md:text-[15px]">
                  {contract.counterparty && (
                    <span className="font-medium text-zinc-800">{contract.counterparty}</span>
                  )}
                  {contract.counterparty && contract.contract_type && (
                    <span className="text-zinc-300"> · </span>
                  )}
                  {contract.contract_type && (
                    <span className="text-zinc-500">{contract.contract_type}</span>
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
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-zinc-200/60 pt-6 sm:mt-8 sm:pt-8 sm:grid-cols-4">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Pending review
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950">
                {pendingFieldsCount}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Fields tracked
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950">
                {fieldsCount}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Documents
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950">
                {filesCount}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Reminders
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950">
                {upcomingReminders.length}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-4 py-3">
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
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors md:text-[12px] ${
                  activeTab === value
                    ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900"
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
            <div className="flex flex-col gap-4 border-b border-zinc-100/90 bg-zinc-50/40 px-6 py-5 sm:flex-row sm:items-center sm:justify-between md:px-8">
              <div>
                <h2 className="ui-section-title text-base">Extracted fields</h2>
                <p className="mt-1 text-[12px] text-zinc-500">
                  Review AI output before it drives reminders
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
              <ExtractionJobAlert job={extractionJob} />
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

          {(activeTab === "overview" || activeTab === "dates") && (
          <div className="ui-card overflow-hidden">
            <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-4 py-3.5 md:px-8 md:py-4">
              <h2 className="ui-section-title text-base">Source documents</h2>
              <p className="mt-1 text-[12px] text-zinc-500">
                Signed files stored for this agreement
              </p>
            </div>
            <div className="px-4 py-4.5 md:px-8 md:py-5">
              {!contract.contract_files?.length ? (
                <p className="text-[13px] text-zinc-500">No files uploaded yet.</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
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
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200/80 bg-zinc-50/80">
                            <FileText size={18} className="text-zinc-500" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-zinc-900">
                              {file.file_name}
                            </p>
                            <p className="mt-0.5 text-[12px] text-zinc-500">
                              {formatFileSize(file.file_size)}
                              <span className="text-zinc-300"> · </span>
                              {format(new Date(file.created_at), "MMM d, yyyy")}
                              <span className="text-zinc-300"> · </span>
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
              <div className="mt-6 border-t border-zinc-100 pt-6">
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
            <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-6 py-4 md:px-8">
              <h2 className="ui-section-title text-base">Tasks & follow-up</h2>
              <p className="mt-1 text-[12px] text-zinc-500">
                Track ownership and execution work tied to this contract
              </p>
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
            <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-6 py-4 md:px-8">
              <h2 className="ui-section-title text-base">Obligations</h2>
              <p className="mt-1 text-[12px] text-zinc-500">
                Track ongoing commitments beyond reminders and date fields
              </p>
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
            <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-6 py-4 md:px-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="ui-section-title text-base">Renewal playbook</h2>
                  <p className="mt-1 text-[12px] text-zinc-500">
                    120/90/60/30 checkpoints for predictable renewal execution
                  </p>
                </div>
                {canEdit && checkpoints.length === 0 && (
                  <form action={seedRenewalPlaybook.bind(null, contract.id)}>
                    <button type="submit" className="ui-btn-secondary px-4 py-2 text-[13px]">
                      Seed playbook
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
            <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-6 py-4">
              <h3 className="ui-section-title text-base">Workflow status</h3>
            </div>
            <div className="p-6">
              <ContractStatusTransition
                contractId={contract.id}
                currentStatus={contract.status}
                canEdit={canEdit}
              />
              <div className="mt-6 border-t border-zinc-100 pt-5">
                <p className="ui-label-caps">Operational lifecycle</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Intake: {contract.intake_status ?? "awaiting_review"} · Health:{" "}
                  {contract.health_status ?? "unknown"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Next step: {contract.required_next_step || "Not set"}
                </p>
                {canEdit && (
                  <form action={updateContractOperationalStateForm} className="mt-3 space-y-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <div className="grid grid-cols-2 gap-2">
                      <select name="intakeStatus" defaultValue={contract.intake_status ?? "awaiting_review"} className="ui-input text-xs">
                        <option value="awaiting_review">awaiting review</option>
                        <option value="in_clarification">in clarification</option>
                        <option value="active">active</option>
                        <option value="at_risk">at risk</option>
                        <option value="renewal_prep">renewal prep</option>
                        <option value="notice_decision">notice decision</option>
                        <option value="archived">archived</option>
                      </select>
                      <select name="healthStatus" defaultValue={contract.health_status ?? "unknown"} className="ui-input text-xs">
                        <option value="healthy">healthy</option>
                        <option value="watch">watch</option>
                        <option value="at_risk">at risk</option>
                        <option value="unknown">unknown</option>
                      </select>
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
              <div className="mt-6 border-t border-zinc-100 pt-5">
                <p className="ui-label-caps">Execution graph</p>
                <p className="mt-1 text-xs text-zinc-500">Cross-work dependencies for this contract.</p>
                <Link
                  href={`/contracts/execution-graph?contractId=${contract.id}`}
                  className="ui-link mt-2 inline-block text-xs"
                >
                  Open portfolio graph view
                </Link>
                {executionGraphEdges.length > 0 ? (
                  <div className="mt-3 max-h-[320px] overflow-auto">
                    <ExecutionGraphViz edges={executionGraphEdges} />
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-zinc-500">Apply a program to generate dependency edges.</p>
                )}
              </div>
              <div className="mt-6 border-t border-zinc-100 pt-5">
                <p className="ui-label-caps">Operational evidence pack</p>
                <p className="mt-1 text-xs text-zinc-500">
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
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Active requirements
                  </p>
                  <div className="mt-2">
                    <ContractEvidenceRequirementsPanel
                      requirements={evidenceRequirements}
                      canEdit={canEdit}
                      contractId={contract.id}
                    />
                  </div>
                </div>
              </div>
              {(programAssignmentsData ?? []).length > 0 ? (
                <div className="mt-6 border-t border-zinc-100 pt-5">
                  <p className="ui-label-caps">Program assignment overrides</p>
                  <p className="mt-1 text-xs text-zinc-500">
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
                          <li key={row.id} className="rounded-lg border border-zinc-200 p-3 text-xs">
                            <p className="font-medium text-zinc-900">
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
                              <pre className="mt-2 overflow-x-auto rounded bg-zinc-50 p-2 text-[11px]">
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
              <div className="mt-6 border-t border-zinc-100 pt-5">
                <p className="ui-label-caps">CRM / external link</p>
                <p className="mt-1 text-xs text-zinc-500">
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
            <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-6 py-4">
              <h3 className="ui-section-title text-base">Renewal scenario & approvals</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-zinc-500">
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
              <div className="border-t border-zinc-100 pt-4">
                <p className="ui-label-caps">Workspace notes ({renewalWorkspaceNotes.length})</p>
                {canEdit && (
                  <form action={addRenewalWorkspaceNoteForm} className="mt-2 space-y-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <textarea name="body" placeholder="Add renewal workspace note" className="ui-input min-h-[60px] text-xs" />
                    <label className="inline-flex items-center gap-2 text-xs text-zinc-600">
                      <input type="checkbox" name="pinned" value="1" className="h-3.5 w-3.5 rounded border-zinc-300" />
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
                      <li key={note.id} className="rounded border border-zinc-200/80 px-3 py-2 text-xs text-zinc-600">
                        {note.pinned ? "Pinned · " : ""}
                        {note.body}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="border-t border-zinc-100 pt-4">
                <p className="ui-label-caps">Renewal command context</p>
                <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                  <li>
                    Watchlist:{" "}
                    <span className="font-semibold text-zinc-900">{isWatchlisted ? "yes" : "no"}</span>
                  </li>
                  <li>
                    Pending approvals:{" "}
                    <span className="font-semibold text-zinc-900">
                      {approvals.filter((a) => a.status === "pending").length}
                    </span>
                  </li>
                  <li>
                    Contract risk:{" "}
                    <span className="font-semibold text-zinc-900">{contract.health_status ?? "unknown"}</span>
                  </li>
                  <li>
                    Why surfaced: target decision path, blockers, approvals, and risk are coordinated here.
                  </li>
                </ul>
              </div>
              <div className="border-t border-zinc-100 pt-4">
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
                    <label className="inline-flex items-center gap-2 text-xs text-zinc-600">
                      <input type="checkbox" name="exceptionFlag" value="1" className="h-3.5 w-3.5 rounded border-zinc-300" />
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
                      <li key={a.id} className="rounded border border-zinc-200/80 px-3 py-2 text-xs text-zinc-600">
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
          <div className="ui-card overflow-hidden">
            <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-6 py-4">
              <h3 className="flex items-center gap-2 ui-section-title text-base">
                <Bell size={17} className="text-[var(--accent)]" strokeWidth={1.75} aria-hidden />
                Reminders
              </h3>
            </div>
            <div className="p-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase text-zinc-500">
                  Scheduled
                </p>
                {upcomingReminders.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-500">
                    None pending. Approve a date field to schedule reminders.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {upcomingReminders.map(
                      (r: {
                        id: string;
                        reminder_type: string;
                        reminder_date: string;
                      }) => (
                        <li
                          key={r.id}
                          className="rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-zinc-800">
                            {r.reminder_type.replace(/_/g, " ")}
                          </span>
                          <span className="text-zinc-500">
                            {" · "}
                            {format(
                              new Date(r.reminder_date + "T12:00:00"),
                              "MMM d, yyyy"
                            )}
                          </span>
                        </li>
                      )
                    )}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-zinc-500">
                  Sent (history)
                </p>
                {reminderHistory.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-500">
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
                      }) => (
                        <li
                          key={r.id}
                          className="text-sm text-zinc-600"
                        >
                          <span className="text-zinc-800">
                            {r.reminder_type.replace(/_/g, " ")}
                          </span>
                          {" · scheduled "}
                          {format(
                            new Date(r.reminder_date + "T12:00:00"),
                            "MMM d, yyyy"
                          )}
                          {r.sent_at && (
                            <>
                              {" · sent "}
                              {format(
                                new Date(r.sent_at),
                                "MMM d, yyyy h:mm a"
                              )}
                            </>
                          )}
                        </li>
                      )
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
            <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-6 py-4">
              <h3 className="ui-section-title text-base">Operational casefile</h3>
            </div>
            <div className="p-6">
              {mergedCasefile.length === 0 ? (
                <p className="text-sm text-zinc-500">No casefile events recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {mergedCasefile.map((entry) => (
                    <li key={entry.id} className="flex items-start justify-between gap-3 text-xs">
                      <span className="text-zinc-700">
                        <span className="font-semibold">{entry.headline}</span>
                        {entry.detail ? ` · ${entry.detail}` : ""}
                        <span className="text-zinc-400"> · {entry.kind}</span>
                      </span>
                      <span className="shrink-0 text-zinc-400">
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
            <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-6 py-4">
              <h3 className="ui-section-title text-base">Ownership & record</h3>
            </div>
            <div className="p-6">
            <dl className="space-y-3">
              <div className="flex items-center gap-2">
                <User size={14} className="text-zinc-400" />
                <dt className="text-sm text-zinc-500">Owner</dt>
                <dd className="ml-auto text-sm font-medium text-zinc-900">
                  {contract.owner?.full_name || contract.owner?.email || "—"}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-zinc-400" />
                <dt className="text-sm text-zinc-500">Created</dt>
                <dd className="ml-auto text-sm text-zinc-900">
                  {format(new Date(contract.created_at), "MMM d, yyyy")}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-zinc-400" />
                <dt className="text-sm text-zinc-500">Updated</dt>
                <dd className="ml-auto text-sm text-zinc-900">
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
                      <li key={item.id} className="text-xs text-zinc-600">
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
            <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-6 py-4">
              <h3 className="ui-section-title text-base">Unified workflow timeline</h3>
            </div>
            <div className="p-6">
              {workflowTimeline.length === 0 ? (
                <p className="text-sm text-zinc-500">No workflow timeline entries yet.</p>
              ) : (
                <ul className="space-y-2">
                  {workflowTimeline.map((entry) => (
                    <li key={entry.id} className="flex items-start justify-between gap-3 text-xs">
                      <span className="text-zinc-700">
                        <span className="font-semibold">{entry.domain}</span> · {entry.label}
                      </span>
                      <span className="shrink-0 text-zinc-400">
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
            <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-6 py-4">
              <h3 className="ui-section-title text-base">Activity</h3>
            </div>
            <div className="p-6">
            {auditEvents.length === 0 ? (
              <p className="text-sm text-zinc-500">No activity recorded.</p>
            ) : (
              <ul className="space-y-3">
                {auditEvents.map(
                  (event: {
                    id: string;
                    action: string;
                    created_at: string;
                  }) => (
                    <li key={event.id} className="flex items-start gap-2">
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" />
                      <div>
                        <p className="text-sm text-zinc-700">
                          {event.action.replace(/\./g, " ")}
                        </p>
                        <p className="text-xs text-zinc-400">
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
            <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-6 py-4">
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
              <div className="mt-6 border-t border-zinc-100 pt-5">
                <p className="ui-label-caps">Field comments & mentions</p>
                {canEdit && (
                  <form action={createClarificationTaskForm} className="mt-2 space-y-2">
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
                      <li key={comment.id} className="rounded border border-zinc-200/80 px-3 py-2 text-xs text-zinc-600">
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
