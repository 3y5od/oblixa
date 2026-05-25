import type { createAdminClient } from "@/lib/supabase/server";
import { loadOrgMemberProfileRows, orgMemberProfileLabel, type OrgMemberProfileRow } from "@/lib/org-member-profiles";
import { applyV10ReadModelVisibility } from "@/lib/visibility";
import {
  EVIDENCE_ACTION_LABELS,
  EVIDENCE_EMPTY_STATE,
  EVIDENCE_EYEBROW,
  EVIDENCE_PAGE_LEAD,
  EVIDENCE_PAGE_TITLE,
  EVIDENCE_PRIMARY_CTA,
  EVIDENCE_ROW_LABELS,
  EVIDENCE_SECTION_LABELS,
  EVIDENCE_STATUS_LABELS,
} from "./spec-strings";
import type {
  EvidenceActionCapability,
  EvidenceModelLoadInput,
  EvidenceModelSearchInput,
  EvidenceOption,
  EvidencePageModel,
  EvidenceRow,
  EvidenceSectionKey,
  EvidenceStatusKey,
} from "./types";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

export const EVIDENCE_SECTION_ORDER = [
  "open_requests",
  "overdue_requests",
  "received_evidence",
  "linked_obligations",
] as const satisfies readonly EvidenceSectionKey[];

export type EvidenceRequirementSourceRow = {
  id: string;
  title: string | null;
  status: string | null;
  due_at?: string | null;
  review_due_at?: string | null;
  contract_id?: string | null;
  work_item_type?: string | null;
  work_item_id?: string | null;
  reviewer_id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type EvidenceSubmissionSourceRow = {
  id: string;
  requirement_id: string;
  status?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  payload_json?: Record<string, unknown> | null;
};

export type EvidenceReadModelStatusRow = {
  evidence_request_id?: string | null;
  status?: string | null;
  submission_count?: number | null;
  latest_submission_at?: string | null;
  due_at?: string | null;
};

export type EvidenceExternalSubmissionRow = {
  evidence_request_id?: string | null;
  submission_id?: string | null;
  file_count?: number | null;
  submitted_at?: string | null;
  upload_status?: string | null;
  review_status?: string | null;
};

export type EvidenceContractRow = {
  id: string;
  title: string | null;
  counterparty?: string | null;
  updated_at?: string | null;
};

export type EvidenceObligationRow = {
  id: string;
  contract_id: string;
  title: string | null;
  status?: string | null;
  due_date?: string | null;
};

export type BuildEvidencePageModelInput = EvidenceModelLoadInput & {
  requirements: EvidenceRequirementSourceRow[];
  submissions: EvidenceSubmissionSourceRow[];
  readModelStatuses: EvidenceReadModelStatusRow[];
  externalSubmissions: EvidenceExternalSubmissionRow[];
  contracts: EvidenceContractRow[];
  obligations: EvidenceObligationRow[];
  members: OrgMemberProfileRow[];
  warnings?: string[];
  now?: Date;
};

export function normalizeEvidenceSection(input: EvidenceModelSearchInput): EvidenceSectionKey {
  const section = normalizeToken(input.section);
  if (isEvidenceSectionKey(section)) return section;
  return "open_requests";
}

export function buildEvidenceHref(input: {
  section?: EvidenceSectionKey;
  contract?: string | null;
  create?: boolean;
}) {
  const params = new URLSearchParams();
  if (input.section && input.section !== "open_requests") params.set("section", input.section);
  if (input.contract) params.set("contract", input.contract);
  if (input.create) params.set("create", "1");
  const qs = params.toString();
  return qs ? `/contracts/evidence-studio?${qs}` : "/contracts/evidence-studio";
}

export function buildEvidencePageModel(input: BuildEvidencePageModelInput): EvidencePageModel {
  const activeSection = normalizeEvidenceSection(input);
  const selectedContractId = normalizeToken(input.contract);
  const contractById = new Map(input.contracts.map((contract) => [contract.id, contract]));
  const obligationById = new Map(input.obligations.map((obligation) => [obligation.id, obligation]));
  const memberLabelById = new Map(
    input.members.map((member) => [member.user_id, orgMemberProfileLabel(member.profiles)])
  );
  const latestSubmissionByRequirement = latestSubmissionMap(input.submissions);
  const readStatusByRequirement = new Map(
    input.readModelStatuses
      .filter((row) => row.evidence_request_id)
      .map((row) => [String(row.evidence_request_id), row])
  );
  const externalFileCountByRequirement = externalFileCountMap(input.externalSubmissions);
  const now = input.now ?? new Date();

  const shapedRows = input.requirements
    .filter((row) => normalizeToken(row.status) !== "waived")
    .map((row) =>
      shapeEvidenceRow(row, {
        contractById,
        obligationById,
        memberLabelById,
        latestSubmissionByRequirement,
        readStatusByRequirement,
        externalFileCountByRequirement,
        userId: input.userId,
        now,
      })
    );

  const selectedRows = selectedContractId
    ? shapedRows.filter((row) => row.contractId === selectedContractId)
    : shapedRows;

  const sections = EVIDENCE_SECTION_ORDER.map((key) => ({
    key,
    label: EVIDENCE_SECTION_LABELS[key],
    count: selectedRows.filter((row) => matchesSection(row, key)).length,
    href: buildEvidenceHref({ section: key, contract: selectedContractId }),
    active: key === activeSection,
  }));

  const rows = selectedRows
    .filter((row) => matchesSection(row, activeSection))
    .sort(compareEvidenceRows);

  const contractOptions = toContractOptions(input.contracts);
  const createObligations = selectedContractId
    ? input.obligations.filter((obligation) => obligation.contract_id === selectedContractId)
    : input.obligations;

  return {
    title: EVIDENCE_PAGE_TITLE,
    eyebrow: EVIDENCE_EYEBROW,
    lead: EVIDENCE_PAGE_LEAD,
    primaryCta: EVIDENCE_PRIMARY_CTA,
    activeSection,
    selectedContractId,
    sections,
    rows,
    totalVisibleRows: selectedRows.length,
    create: {
      open: input.create === "1" || input.create === "true",
      selectedContractId,
      contracts: contractOptions,
      obligations: toObligationOptions(createObligations, contractById),
    },
    warnings: input.warnings ?? [],
  };
}

export async function loadEvidencePageModel(
  admin: AdminClient,
  orgId: string,
  input: EvidenceModelLoadInput
): Promise<EvidencePageModel> {
  const warnings: string[] = [];

  const { data: requirementRows, error: requirementsError } = await admin
    .from("evidence_requirements")
    .select("id, title, status, due_at, review_due_at, contract_id, work_item_type, work_item_id, reviewer_id, updated_at, created_at")
    .eq("organization_id", orgId)
    .neq("status", "waived")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(1000);
  if (requirementsError) warnings.push("evidence_requirements");

  const requirements = (requirementRows ?? []) as EvidenceRequirementSourceRow[];
  const requirementIds = requirements.map((row) => row.id).filter(Boolean);
  const linkedContractIds = requirements.map((row) => row.contract_id).filter(Boolean) as string[];

  const { data: allContracts, error: contractsError } = await admin
    .from("contracts")
    .select("id, title, counterparty, updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(300);
  if (contractsError) warnings.push("contracts");

  const contractMap = new Map<string, EvidenceContractRow>();
  for (const contract of (allContracts ?? []) as EvidenceContractRow[]) {
    contractMap.set(contract.id, contract);
  }

  const missingLinkedContractIds = linkedContractIds.filter((id) => !contractMap.has(id));
  if (missingLinkedContractIds.length > 0) {
    const { data: linkedContracts, error: linkedContractsError } = await admin
      .from("contracts")
      .select("id, title, counterparty, updated_at")
      .eq("organization_id", orgId)
      .in("id", [...new Set(missingLinkedContractIds)]);
    if (linkedContractsError) warnings.push("linked_contracts");
    for (const contract of (linkedContracts ?? []) as EvidenceContractRow[]) {
      contractMap.set(contract.id, contract);
    }
  }

  const [{ data: submissions, error: submissionsError }, { data: obligations, error: obligationsError }] =
    await Promise.all([
      requirementIds.length === 0
        ? Promise.resolve({ data: [] as EvidenceSubmissionSourceRow[], error: null })
        : admin
            .from("evidence_submissions")
            .select("id, requirement_id, status, submitted_at, reviewed_at, payload_json")
            .eq("organization_id", orgId)
            .in("requirement_id", requirementIds)
            .order("submitted_at", { ascending: false, nullsFirst: false })
            .limit(2000),
      admin
        .from("contract_obligations")
        .select("id, contract_id, title, status, due_date")
        .eq("organization_id", orgId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(300),
    ]);
  if (submissionsError) warnings.push("evidence_submissions");
  if (obligationsError) warnings.push("contract_obligations");

  let readModelQuery = applyV10ReadModelVisibility(
    admin
      .from("v10_evidence_request_statuses")
      .select("evidence_request_id, status, submission_count, latest_submission_at, due_at"),
    {
      organizationId: orgId,
      role: input.role,
      workspaceMode: input.workspaceMode ?? "core",
    }
  );
  if (requirementIds.length > 0) readModelQuery = readModelQuery.in("evidence_request_id", requirementIds);
  const { data: readModelStatuses, error: readModelStatusesError } = await readModelQuery.limit(2000);
  if (readModelStatusesError) warnings.push("v10_evidence_request_statuses");

  let externalSubmissionQuery = applyV10ReadModelVisibility(
    admin
      .from("v10_external_evidence_submissions")
      .select("evidence_request_id, submission_id, file_count, submitted_at, upload_status, review_status"),
    {
      organizationId: orgId,
      role: input.role,
      workspaceMode: input.workspaceMode ?? "core",
    }
  );
  if (requirementIds.length > 0) externalSubmissionQuery = externalSubmissionQuery.in("evidence_request_id", requirementIds);
  const { data: externalSubmissions, error: externalSubmissionsError } = await externalSubmissionQuery.limit(2000);
  if (externalSubmissionsError) warnings.push("v10_external_evidence_submissions");

  const reviewerIds = requirements.map((row) => row.reviewer_id).filter(Boolean) as string[];
  const members = await loadOrgMemberProfileRows(admin, orgId, {
    userIds: reviewerIds.length > 0 ? reviewerIds : undefined,
    memberColumns: "id, organization_id, user_id, role, created_at",
    limit: 200,
  });

  return buildEvidencePageModel({
    ...input,
    requirements,
    submissions: (submissions ?? []) as EvidenceSubmissionSourceRow[],
    readModelStatuses: (readModelStatuses ?? []) as EvidenceReadModelStatusRow[],
    externalSubmissions: (externalSubmissions ?? []) as EvidenceExternalSubmissionRow[],
    contracts: Array.from(contractMap.values()),
    obligations: (obligations ?? []) as EvidenceObligationRow[],
    members,
    warnings,
  });
}

export { EVIDENCE_EMPTY_STATE };

function shapeEvidenceRow(
  row: EvidenceRequirementSourceRow,
  input: {
    contractById: Map<string, EvidenceContractRow>;
    obligationById: Map<string, EvidenceObligationRow>;
    memberLabelById: Map<string, string>;
    latestSubmissionByRequirement: Map<string, EvidenceSubmissionSourceRow>;
    readStatusByRequirement: Map<string, EvidenceReadModelStatusRow>;
    externalFileCountByRequirement: Map<string, number>;
    userId: string;
    now: Date;
  }
): EvidenceRow {
  const requirementId = row.id;
  const title = normalizeToken(row.title) || EVIDENCE_PRIMARY_CTA;
  const contractId = row.contract_id ?? null;
  const contract = contractId ? input.contractById.get(contractId) : null;
  const contractTitle = contract?.title || (contractId ? "Untitled contract" : "None");
  const contractHref = contractId ? `/contracts/${contractId}?tab=overview#contract-evidence` : null;
  const isObligation = normalizeToken(row.work_item_type) === "obligation";
  const linkedObligationId = isObligation ? row.work_item_id ?? null : null;
  const linkedObligation = linkedObligationId ? input.obligationById.get(linkedObligationId) : null;
  const linkedObligationTitle = linkedObligation?.title || (linkedObligationId ? "Linked obligation" : "None");
  const linkedObligationHref =
    contractId && linkedObligationId ? `/contracts/${contractId}?tab=overview#contract-obligations` : null;
  const readStatus = input.readStatusByRequirement.get(requirementId);
  const latestSubmission = input.latestSubmissionByRequirement.get(requirementId);
  const status = deriveEvidenceStatus({
    sourceStatus: readStatus?.status ?? row.status,
    dueAt: readStatus?.due_at ?? row.due_at ?? null,
    now: input.now,
  });
  const externalFiles = input.externalFileCountByRequirement.get(requirementId) ?? 0;
  const payloadFiles = countPayloadFiles(latestSubmission?.payload_json);
  const attachedFilesCount = Math.max(externalFiles, payloadFiles);
  const ownerUserId = row.reviewer_id ?? null;
  const requestOwnerLabel =
    ownerUserId === input.userId
      ? "You"
      : ownerUserId
        ? input.memberLabelById.get(ownerUserId) ?? "Assigned teammate"
        : "Unassigned";
  const href = contractHref ?? "/contracts/evidence-studio";

  const rowModel: EvidenceRow = {
    id: requirementId,
    requirementId,
    requestTitle: title,
    contractId,
    contractTitle,
    contractHref,
    linkedObligationId,
    linkedObligationTitle,
    linkedObligationHref,
    requestOwnerUserId: ownerUserId,
    requestOwnerLabel,
    dueAt: row.due_at ?? null,
    dueLabel: formatDateLabel(row.due_at ?? null),
    status,
    statusLabel: EVIDENCE_STATUS_LABELS[status],
    statusTone: statusTone(status),
    attachedFilesCount,
    attachedFilesLabel:
      attachedFilesCount === 1 ? "1 file" : attachedFilesCount > 1 ? `${attachedFilesCount} files` : "None",
    latestSubmissionId: latestSubmission?.id ?? null,
    latestSubmissionStatus: latestSubmission?.status ?? null,
    href,
    display: {
      requestTitle: { label: EVIDENCE_ROW_LABELS.requestTitle, value: title, href },
      linkedContract: { label: EVIDENCE_ROW_LABELS.linkedContract, value: contractTitle, href: contractHref },
      linkedObligation: {
        label: EVIDENCE_ROW_LABELS.linkedObligation,
        value: linkedObligationTitle,
        href: linkedObligationHref,
      },
      requestOwner: { label: EVIDENCE_ROW_LABELS.requestOwner, value: requestOwnerLabel },
      dueDate: { label: EVIDENCE_ROW_LABELS.dueDate, value: formatDateLabel(row.due_at ?? null) },
      status: { label: EVIDENCE_ROW_LABELS.status, value: EVIDENCE_STATUS_LABELS[status] },
      attachedFiles: {
        label: EVIDENCE_ROW_LABELS.attachedFiles,
        // Uniform "{count} file(s)" format so the value reads naturally
        // alongside a paperclip-icon prefix in the UI. The previous
        // "None" sentinel produced an awkward "ATTACHED FILES None"
        // sentence-fragment in the row's STATUS cell.
        value: attachedFilesCount === 1 ? "1 file" : `${attachedFilesCount} files`,
      },
    },
    actions: [],
  };
  rowModel.actions = buildActionCapabilities(rowModel);
  return rowModel;
}

function deriveEvidenceStatus(input: {
  sourceStatus?: string | null;
  dueAt?: string | null;
  now: Date;
}): EvidenceStatusKey {
  const status = normalizeToken(input.sourceStatus).toLowerCase();
  if ((status === "required" || status === "rejected" || status === "overdue") && isPastDue(input.dueAt, input.now)) {
    return "overdue";
  }
  if (status === "approved" || status === "accepted") return "accepted";
  if (status === "submitted" || status === "received") return "received";
  if (status === "rejected") return "rejected";
  if (status === "overdue") return "overdue";
  return "requested";
}

function buildActionCapabilities(row: EvidenceRow): EvidenceActionCapability[] {
  const createHref = buildEvidenceHref({ create: true, contract: row.contractId });
  const uploadEnabled = row.status === "requested" || row.status === "overdue" || row.status === "rejected";
  const reviewEnabled = row.status === "received" && row.latestSubmissionId;
  const contractEvidenceHref = row.contractHref ?? createHref;
  return [
    {
      key: "request_evidence",
      label: EVIDENCE_ACTION_LABELS.request_evidence,
      kind: "link",
      href: createHref,
      requirementId: row.requirementId,
    },
    uploadEnabled
      ? {
          key: "upload_evidence",
          label: EVIDENCE_ACTION_LABELS.upload_evidence,
          kind: "mutation",
          mutation: "upload_evidence",
          requirementId: row.requirementId,
        }
      : {
          key: "upload_evidence",
          label: EVIDENCE_ACTION_LABELS.upload_evidence,
          kind: "link",
          href: contractEvidenceHref,
          requirementId: row.requirementId,
        },
    reviewEnabled
      ? {
          key: "accept",
          label: EVIDENCE_ACTION_LABELS.accept,
          kind: "mutation",
          mutation: "accept",
          requirementId: row.requirementId,
          submissionId: row.latestSubmissionId,
        }
      : {
          key: "accept",
          label: EVIDENCE_ACTION_LABELS.accept,
          kind: "link",
          href: contractEvidenceHref,
          requirementId: row.requirementId,
          submissionId: row.latestSubmissionId,
        },
    reviewEnabled
      ? {
          key: "reject",
          label: EVIDENCE_ACTION_LABELS.reject,
          kind: "mutation",
          mutation: "reject",
          requirementId: row.requirementId,
          submissionId: row.latestSubmissionId,
        }
      : {
          key: "reject",
          label: EVIDENCE_ACTION_LABELS.reject,
          kind: "link",
          href: contractEvidenceHref,
          requirementId: row.requirementId,
          submissionId: row.latestSubmissionId,
        },
    {
      key: "send_reminder",
      label: EVIDENCE_ACTION_LABELS.send_reminder,
      kind: row.status === "accepted" ? "link" : "mutation",
      href: contractEvidenceHref,
      mutation: row.status === "accepted" ? undefined : "send_reminder",
      requirementId: row.requirementId,
    },
  ];
}

function matchesSection(row: EvidenceRow, section: EvidenceSectionKey) {
  switch (section) {
    case "open_requests":
      return row.status === "requested" || row.status === "rejected";
    case "overdue_requests":
      return row.status === "overdue";
    case "received_evidence":
      return row.status === "received" || row.status === "accepted" || row.status === "rejected";
    case "linked_obligations":
      return Boolean(row.linkedObligationId);
  }
}

function compareEvidenceRows(a: EvidenceRow, b: EvidenceRow) {
  const rank = (row: EvidenceRow) =>
    row.status === "overdue" ? 0 : row.status === "received" ? 1 : row.status === "requested" ? 2 : 3;
  const rankDelta = rank(a) - rank(b);
  if (rankDelta !== 0) return rankDelta;
  if (a.dueAt && b.dueAt && a.dueAt !== b.dueAt) return a.dueAt.localeCompare(b.dueAt);
  if (a.dueAt && !b.dueAt) return -1;
  if (!a.dueAt && b.dueAt) return 1;
  return a.requestTitle.localeCompare(b.requestTitle);
}

function latestSubmissionMap(rows: EvidenceSubmissionSourceRow[]) {
  const map = new Map<string, EvidenceSubmissionSourceRow>();
  for (const row of rows) {
    const current = map.get(row.requirement_id);
    if (!current || timestamp(row.submitted_at) > timestamp(current.submitted_at)) {
      map.set(row.requirement_id, row);
    }
  }
  return map;
}

function externalFileCountMap(rows: EvidenceExternalSubmissionRow[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.evidence_request_id) continue;
    map.set(row.evidence_request_id, (map.get(row.evidence_request_id) ?? 0) + Math.max(0, Number(row.file_count ?? 0)));
  }
  return map;
}

function countPayloadFiles(payload: Record<string, unknown> | null | undefined): number {
  if (!payload) return 0;
  const candidates = [payload.files, payload.fileIds, payload.attachments, payload.fileTypes];
  return candidates.reduce<number>(
    (max, value) => (Array.isArray(value) ? Math.max(max, value.length) : max),
    0
  );
}

function toContractOptions(contracts: EvidenceContractRow[]): EvidenceOption[] {
  return contracts
    .map((contract) => ({ value: contract.id, label: contract.title || "Untitled contract" }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function toObligationOptions(
  obligations: EvidenceObligationRow[],
  contractById: Map<string, EvidenceContractRow>
): EvidenceOption[] {
  return obligations
    .map((obligation) => {
      const contract = contractById.get(obligation.contract_id);
      const prefix = contract?.title ? `${contract.title}: ` : "";
      return { value: obligation.id, label: `${prefix}${obligation.title || "Untitled obligation"}` };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function normalizeToken(value: string | null | undefined) {
  return (value ?? "").trim();
}

function isEvidenceSectionKey(value: string): value is EvidenceSectionKey {
  return (EVIDENCE_SECTION_ORDER as readonly string[]).includes(value);
}

function isPastDue(value: string | null | undefined, now: Date) {
  if (!value) return false;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < now.getTime();
}

function statusTone(status: EvidenceStatusKey): EvidenceRow["statusTone"] {
  if (status === "accepted") return "healthy";
  if (status === "received") return "info";
  if (status === "overdue") return "overdue";
  if (status === "rejected") return "blocked";
  return "in_review";
}

function formatDateLabel(value: string | null) {
  if (!value) return "Missing";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function timestamp(value: string | null | undefined) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
