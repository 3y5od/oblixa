import { attachOwnerProfiles } from "@/lib/contracts";
import {
  fetchReviewQueuePage,
  getReviewStatsForContractIds,
  type ContractReviewStats,
} from "@/lib/contract-review-stats";
import type { createAdminClient } from "@/lib/supabase/server";
import type { Contract, ContractFile, ExtractedField } from "@/lib/types";
import { FIELD_REVIEW_IMPORTANT_FIELD_ALIASES } from "./spec-strings";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

type OwnerSummary = {
  full_name: string | null;
  email: string | null;
};

export type FieldReviewContract = Contract & {
  owner?: OwnerSummary;
  contract_files?: ContractFile[];
  extracted_fields?: ExtractedField[];
};

export interface FieldReviewQueueItem {
  id: string;
  title: string;
  counterparty: string | null;
  ownerLabel: string;
  updatedAt: string;
  pendingFields: number;
  totalFields: number;
  href: string;
}

export interface FieldReviewActiveContract {
  id: string;
  title: string;
  counterparty: string | null;
  ownerLabel: string;
  status: Contract["status"];
  files: ContractFile[];
  href: string;
}

export interface FieldReviewActiveField {
  id: string;
  fieldName: string;
  fieldLabel: string;
  suggestedValue: string | null;
  sourceSnippet: string | null;
  confidence: number | null;
  confidenceLabel: string;
  source: ExtractedField["source"];
  currentApprovedValue: string | null;
  importantLabel: string | null;
  needsCitation: boolean;
}

export interface FieldReviewDocumentPreview {
  status: "available" | "unavailable";
  title: string;
  excerpt: string;
  sourceFileNames: string[];
}

export interface FieldReviewProgress {
  contractsWaiting: number;
  fieldsWaiting: number;
  activeContractPosition: number;
  activeFieldPosition: number;
  activeContractPendingFields: number;
  activeContractTotalFields: number;
}

export interface FieldReviewWorkspaceModel {
  page: number;
  pageSize: number;
  totalContracts: number;
  totalPages: number;
  queue: FieldReviewQueueItem[];
  activeContract: FieldReviewActiveContract | null;
  activeField: FieldReviewActiveField | null;
  documentPreview: FieldReviewDocumentPreview | null;
  progress: FieldReviewProgress;
  nextHref: string | null;
  skipHref: string | null;
  warnings: string[];
}

export interface FieldReviewWorkspaceParams {
  page?: number;
  contract?: string | null;
  field?: string | null;
}

export interface BuildFieldReviewWorkspaceInput {
  contracts: FieldReviewContract[];
  reviewStats?: Record<string, ContractReviewStats>;
  totalContracts?: number;
  page?: number;
  pageSize?: number;
  selectedContractId?: string | null;
  selectedFieldId?: string | null;
  warnings?: string[];
}

const REVIEW_CONTRACT_COLUMNS =
  "id, organization_id, title, counterparty, contract_type, status, search_document, owner_id, created_by, created_at, updated_at, contract_files(*), extracted_fields(*)";

const PREVIEW_EXCERPT_CHARS = 720;

function normalizePage(page: unknown): number {
  return typeof page === "number" && Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function formatReviewFieldLabel(fieldName: string): string {
  return fieldName
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getImportantFieldLabel(fieldName: string): string | null {
  const normalized = fieldName.toLowerCase();
  return (
    FIELD_REVIEW_IMPORTANT_FIELD_ALIASES.find((entry) =>
      entry.keys.some((key) => key.toLowerCase() === normalized)
    )?.label ?? null
  );
}

function importantFieldRank(fieldName: string): number {
  const normalized = fieldName.toLowerCase();
  const index = FIELD_REVIEW_IMPORTANT_FIELD_ALIASES.findIndex((entry) =>
    entry.keys.some((key) => key.toLowerCase() === normalized)
  );
  return index === -1 ? FIELD_REVIEW_IMPORTANT_FIELD_ALIASES.length : index;
}

export function sortPendingFieldsForReview(fields: ExtractedField[]): ExtractedField[] {
  return [...fields]
    .filter((field) => field.status === "pending")
    .sort((a, b) => {
      const importantDelta = importantFieldRank(a.field_name) - importantFieldRank(b.field_name);
      if (importantDelta !== 0) return importantDelta;
      const createdDelta = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (createdDelta !== 0) return createdDelta;
      return a.id.localeCompare(b.id);
    });
}

function formatConfidence(confidence: number | null): string {
  if (confidence == null || Number.isNaN(confidence)) return "No model signal";
  return `${Math.round(Math.min(1, Math.max(0, confidence)) * 100)}%`;
}

function ownerLabel(contract: FieldReviewContract): string {
  return contract.owner?.full_name ?? contract.owner?.email ?? "Unassigned";
}

function contractHref(contractId: string, page: number, fieldId?: string | null): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("contract", contractId);
  if (fieldId) params.set("field", fieldId);
  return `/contracts/review?${params.toString()}`;
}

function contractDetailHref(contractId: string): string {
  return `/contracts/${contractId}?tab=fields&from=review#extracted-fields`;
}

function buildDocumentPreview(
  contract: FieldReviewContract,
  activeField: ExtractedField | null
): FieldReviewDocumentPreview {
  const sourceFileNames = (contract.contract_files ?? []).map((file) => file.file_name);
  const rawDocument = typeof contract.search_document === "string" ? contract.search_document : "";
  const document = normalizeWhitespace(rawDocument);
  if (!document) {
    return {
      status: "unavailable",
      title: "Document preview unavailable",
      excerpt:
        sourceFileNames.length > 0
          ? "No searchable document text is available yet. Use the source snippet and attached file list while reviewing this field."
          : "No source file or searchable document text is attached to this contract.",
      sourceFileNames,
    };
  }

  const snippet = activeField?.source_snippet ? normalizeWhitespace(activeField.source_snippet) : "";
  const lowerDocument = document.toLowerCase();
  const lowerSnippet = snippet.toLowerCase();
  const snippetIndex = lowerSnippet ? lowerDocument.indexOf(lowerSnippet.slice(0, 80)) : -1;
  const start =
    snippetIndex > -1
      ? Math.max(0, snippetIndex - Math.floor(PREVIEW_EXCERPT_CHARS / 3))
      : 0;
  const excerpt = document.slice(start, start + PREVIEW_EXCERPT_CHARS);

  return {
    status: "available",
    title: snippetIndex > -1 ? "Document preview near source" : "Document preview",
    excerpt:
      start > 0 || start + PREVIEW_EXCERPT_CHARS < document.length
        ? `${start > 0 ? "... " : ""}${excerpt}${start + PREVIEW_EXCERPT_CHARS < document.length ? " ..." : ""}`
        : excerpt,
    sourceFileNames,
  };
}

function currentApprovedValue(fields: ExtractedField[], activeField: ExtractedField): string | null {
  return (
    fields.find(
      (field) =>
        field.id !== activeField.id &&
        field.field_name === activeField.field_name &&
        (field.status === "approved" || field.status === "edited") &&
        field.field_value &&
        field.field_value.trim().length > 0
    )?.field_value ?? null
  );
}

function toQueueItem(
  contract: FieldReviewContract,
  stats: ContractReviewStats | undefined,
  page: number
): FieldReviewQueueItem {
  const pendingFields = stats?.pending ?? (contract.extracted_fields ?? []).filter((field) => field.status === "pending").length;
  const totalFields = stats?.total ?? (contract.extracted_fields ?? []).length;
  const nextField = sortPendingFieldsForReview(contract.extracted_fields ?? [])[0] ?? null;
  return {
    id: contract.id,
    title: contract.title,
    counterparty: contract.counterparty,
    ownerLabel: ownerLabel(contract),
    updatedAt: contract.updated_at,
    pendingFields,
    totalFields,
    href: contractHref(contract.id, page, nextField?.id),
  };
}

export function buildFieldReviewWorkspaceModel(
  input: BuildFieldReviewWorkspaceInput
): FieldReviewWorkspaceModel {
  const page = normalizePage(input.page);
  const pageSize = input.pageSize && input.pageSize > 0 ? input.pageSize : Math.max(1, input.contracts.length || 1);
  const contracts = input.contracts;
  const reviewStats = input.reviewStats ?? {};
  const queue = contracts
    .map((contract) => toQueueItem(contract, reviewStats[contract.id], page))
    .filter((item) => item.pendingFields > 0);

  const contractsWithPending = contracts.filter(
    (contract) => sortPendingFieldsForReview(contract.extracted_fields ?? []).length > 0
  );
  const selectedContract = input.selectedContractId
    ? contractsWithPending.find((contract) => contract.id === input.selectedContractId) ?? null
    : null;
  const activeContract = selectedContract ?? contractsWithPending[0] ?? null;
  const pendingFields = activeContract
    ? sortPendingFieldsForReview(activeContract.extracted_fields ?? [])
    : [];
  const selectedField =
    input.selectedFieldId && activeContract
      ? pendingFields.find((field) => field.id === input.selectedFieldId) ?? null
      : null;
  const activeField = selectedField ?? pendingFields[0] ?? null;
  const activeContractIndex = activeContract
    ? contractsWithPending.findIndex((contract) => contract.id === activeContract.id)
    : -1;
  const activeFieldIndex = activeField
    ? pendingFields.findIndex((field) => field.id === activeField.id)
    : -1;

  const flatPending = contractsWithPending.flatMap((contract) =>
    sortPendingFieldsForReview(contract.extracted_fields ?? []).map((field) => ({ contract, field }))
  );
  const flatIndex = activeField
    ? flatPending.findIndex((item) => item.field.id === activeField.id)
    : -1;
  const next = flatIndex > -1 ? flatPending[flatIndex + 1] ?? null : flatPending[0] ?? null;
  const nextHref = next ? contractHref(next.contract.id, page, next.field.id) : null;
  const skipHref = nextHref ?? (activeContract ? contractHref(activeContract.id, page) : null);

  const totalContracts = input.totalContracts ?? contracts.length;
  const totalPages = Math.max(1, Math.ceil(totalContracts / pageSize));
  const fieldsWaiting = flatPending.length;

  return {
    page,
    pageSize,
    totalContracts,
    totalPages,
    queue,
    activeContract: activeContract
      ? {
          id: activeContract.id,
          title: activeContract.title,
          counterparty: activeContract.counterparty,
          ownerLabel: ownerLabel(activeContract),
          status: activeContract.status,
          files: activeContract.contract_files ?? [],
          href: contractDetailHref(activeContract.id),
        }
      : null,
    activeField: activeField
      ? {
          id: activeField.id,
          fieldName: activeField.field_name,
          fieldLabel: formatReviewFieldLabel(activeField.field_name),
          suggestedValue: activeField.field_value,
          sourceSnippet: activeField.source_snippet,
          confidence: activeField.confidence,
          confidenceLabel: formatConfidence(activeField.confidence),
          source: activeField.source,
          currentApprovedValue: activeContract
            ? currentApprovedValue(activeContract.extracted_fields ?? [], activeField)
            : null,
          importantLabel: getImportantFieldLabel(activeField.field_name),
          needsCitation:
            activeField.source === "ai" &&
            !!activeField.field_value?.trim() &&
            !activeField.source_snippet?.trim(),
        }
      : null,
    documentPreview: activeContract ? buildDocumentPreview(activeContract, activeField) : null,
    progress: {
      contractsWaiting: contractsWithPending.length,
      fieldsWaiting,
      activeContractPosition: activeContractIndex > -1 ? activeContractIndex + 1 : 0,
      activeFieldPosition: activeFieldIndex > -1 ? activeFieldIndex + 1 : 0,
      activeContractPendingFields: pendingFields.length,
      activeContractTotalFields: activeContract?.extracted_fields?.length ?? 0,
    },
    nextHref,
    skipHref,
    warnings: input.warnings ?? [],
  };
}

export async function loadFieldReviewWorkspaceModel(
  admin: Admin,
  orgId: string,
  params: FieldReviewWorkspaceParams
): Promise<FieldReviewWorkspaceModel> {
  const page = normalizePage(params.page);
  const warnings: string[] = [];
  const queue = await fetchReviewQueuePage(admin, orgId, page);
  const ids = new Set(queue.contracts.map((contract) => contract.id));
  if (params.contract) ids.add(params.contract);

  let contracts: FieldReviewContract[] = [];
  if (ids.size > 0) {
    const { data, error } = await admin
      .from("contracts")
      .select(REVIEW_CONTRACT_COLUMNS)
      .eq("organization_id", orgId)
      .in("id", [...ids])
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[field-review] contract workspace query error:", error.message);
      warnings.push("Contract review data is partially unavailable.");
    } else {
      contracts = (data ?? []) as FieldReviewContract[];
    }
  }

  const order = new Map(queue.contracts.map((contract, index) => [contract.id, index]));
  contracts.sort((a, b) => {
    const ai = order.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bi = order.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const contractsWithOwners = await attachOwnerProfiles(admin, orgId, contracts);
  const reviewStats = await getReviewStatsForContractIds(
    admin,
    contractsWithOwners.map((contract) => contract.id)
  );

  return buildFieldReviewWorkspaceModel({
    contracts: contractsWithOwners,
    reviewStats,
    totalContracts: queue.total,
    page: queue.page,
    pageSize: queue.pageSize,
    selectedContractId: params.contract,
    selectedFieldId: params.field,
    warnings,
  });
}
